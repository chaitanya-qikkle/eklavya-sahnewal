"""Custom GLB model upload for the Yard Builder dev tool.

Frontend contract (see Frontend/src/modules/yard3d/pages/YardBuilderPage.jsx):
  GET  /v1/assets/models         -> { status, data: [{ filename, url }, ...] }
  POST /v1/assets/upload-model   -> multipart form field "file" (.glb only)

Uploaded models are stored under Frontend/public/models/custom/ so Vite/the
built app serves them as plain static files at /models/custom/<filename> —
no separate static mount needed on the backend side.

Uploads are run through `gltf-transform draco` (mesh-geometry-only Draco
compression, e.g. ~60MB -> ~6MB on the warehouse models) before being saved.
An earlier version also ran WebP texture recompression, but some source
textures crash sharp/libvips's colourspace handling during WebP re-encoding
("parameter space not set" / VipsInterpretation errors — a real upstream
libvips limitation, not a bug in the upload), so that step was dropped;
mesh-only Draco compression doesn't touch textures at all and has no such
crash risk. If the Draco pass itself fails for any reason, the raw upload is
kept as a safe fallback rather than losing the model entirely.

No auth on these routes, deliberately: the Yard Builder page that calls them
is a standalone dev tool (not linked from any menu, not reachable through the
normal login flow) and doesn't carry a JWT — requiring one here just breaks
the upload with "Not authenticated". If this ever needs to be exposed beyond
local development, add auth back before that happens.
"""
import json
import logging
import re
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

logger = logging.getLogger(__name__)
assets_router = APIRouter()

# Frontend/public/models/custom — Backend/ and Frontend/ are sibling dirs
# under the project root. __file__ = Backend/v1/api/assets_api/Assets.py, so
# parents[3] = Backend, parents[4] = project root.
FRONTEND_DIR = Path(__file__).resolve().parents[4] / "Frontend"
MODELS_DIR = FRONTEND_DIR / "public" / "models" / "custom"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

LAYOUT_FILE = FRONTEND_DIR / "public" / "yard-layout-sahnewal.json"
BAKE_SCRIPT = FRONTEND_DIR / "bake-yard-builder-edits.mjs"
NODE_BIN = "node"  # relies on node being on PATH, same as running the script by hand

# Local devDependency binary, not a global install — .cmd wrapper on Windows.
GLTF_TRANSFORM_BIN = FRONTEND_DIR / "node_modules" / ".bin" / "gltf-transform.cmd"

MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB raw upload cap

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _safe_stem(filename: str) -> str:
    stem = Path(filename).stem
    stem = _SAFE_NAME_RE.sub("_", stem).strip("_") or "model"
    return stem[:80]


def _compress_draco(raw: bytes) -> bytes:
    """Run raw GLB bytes through `gltf-transform draco` (mesh-only compression).

    Returns the compressed bytes, or the original `raw` unchanged if the
    binary is missing or the pass fails for any reason — a failed/skipped
    compression should never block an upload.
    """
    if not GLTF_TRANSFORM_BIN.is_file():
        logger.warning("gltf-transform binary not found at %s — skipping compression", GLTF_TRANSFORM_BIN)
        return raw

    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.glb"
        dst = Path(td) / "out.glb"
        src.write_bytes(raw)
        try:
            result = subprocess.run(
                [str(GLTF_TRANSFORM_BIN), "draco", str(src), str(dst)],
                capture_output=True, text=True, timeout=180, check=True,
            )
            logger.info("gltf-transform draco: %s", (result.stdout or result.stderr or "").strip())
        except Exception as e:
            logger.warning("gltf-transform draco failed, keeping uncompressed upload: %s", e)
            return raw

        if not dst.is_file():
            logger.warning("gltf-transform draco produced no output, keeping uncompressed upload")
            return raw
        return dst.read_bytes()


@assets_router.get("/models")
def list_models():
    try:
        files = sorted(p.name for p in MODELS_DIR.glob("*.glb"))
        data = [{"filename": f, "url": f"/models/custom/{f}"} for f in files]
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"list_models error: {e}")
        return {"status": "error", "message": f"Server Error: {e}"}


@assets_router.post("/upload-model")
async def upload_model(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".glb"):
        raise HTTPException(status_code=400, detail="Only .glb files are supported")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024*1024)}MB limit")
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    original_size = len(raw)
    compressed = _compress_draco(raw)
    compressed_size = len(compressed)

    stem = _safe_stem(file.filename)
    final_name = f"{stem}-{uuid.uuid4().hex[:8]}.glb"
    final_path = MODELS_DIR / final_name
    final_path.write_bytes(compressed)

    logger.info(
        f"Uploaded model '{file.filename}' -> {final_name} "
        f"({original_size} -> {compressed_size} bytes, "
        f"{'draco-compressed' if compressed_size != original_size else 'uncompressed fallback'})"
    )

    return {
        "status": "success",
        "message": "Model uploaded",
        "data": {
            "filename": final_name,
            "url": f"/models/custom/{final_name}",
            "size": compressed_size,
            "original_size": original_size,
        },
    }


class BakeYardLayoutRequest(BaseModel):
    edits: dict[str, Any]


@assets_router.post("/bake-yard-layout")
def bake_yard_layout(request: BakeYardLayoutRequest):
    """Bake a Yard Builder edits object straight into yard-layout-sahnewal.json,
    server-side — same effect as "Export edits.json" + running
    bake-yard-builder-edits.mjs by hand, but from a single button in the tool.

    Runs the existing bake script itself (not a re-implementation) so both
    paths always apply edits identically. A .bak-<timestamp> copy of the
    layout file is written first so a bad bake can always be rolled back.
    """
    if not LAYOUT_FILE.is_file():
        raise HTTPException(status_code=500, detail=f"Layout file not found: {LAYOUT_FILE}")
    if not BAKE_SCRIPT.is_file():
        raise HTTPException(status_code=500, detail=f"Bake script not found: {BAKE_SCRIPT}")

    import datetime
    backup_path = LAYOUT_FILE.with_suffix(f".json.bak-{datetime.datetime.now():%Y%m%d%H%M%S}")
    backup_path.write_bytes(LAYOUT_FILE.read_bytes())

    with tempfile.TemporaryDirectory() as td:
        edits_path = Path(td) / "edits.json"
        edits_path.write_text(json.dumps({"edits": request.edits}), encoding="utf-8")
        try:
            result = subprocess.run(
                [NODE_BIN, str(BAKE_SCRIPT), str(edits_path), str(LAYOUT_FILE)],
                cwd=str(FRONTEND_DIR), capture_output=True, text=True, timeout=60, check=True,
            )
        except subprocess.CalledProcessError as e:
            logger.error("bake-yard-layout failed: %s", e.stderr)
            return {"status": "error", "message": e.stderr or str(e), "backup": backup_path.name}
        except Exception as e:
            logger.error("bake-yard-layout failed: %s", e)
            return {"status": "error", "message": str(e), "backup": backup_path.name}

    logger.info("bake-yard-layout: %s", result.stdout.strip())
    return {"status": "success", "message": result.stdout.strip(), "backup": backup_path.name}
