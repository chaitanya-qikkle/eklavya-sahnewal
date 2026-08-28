"""Custom GLB model upload for the Yard Builder dev tool.

Frontend contract (see Frontend/src/modules/yard3d/pages/YardBuilderPage.jsx):
  GET  /v1/assets/models         -> { status, data: [{ filename, url }, ...] }
  POST /v1/assets/upload-model   -> multipart form field "file" (.glb only)

Uploaded models are stored under Frontend/public/models/custom/ so Vite/the
built app serves them as plain static files at /models/custom/<filename> —
no separate static mount needed on the backend side.

Uploads are saved as-is, no compression step. An earlier version ran every
upload through gltf-transform (Draco mesh compression + WebP texture
recompression), but some source textures crash sharp/libvips's colourspace
handling during WebP re-encoding ("parameter space not set" /
VipsInterpretation errors — a real upstream libvips limitation, not a bug in
the upload), and per explicit instruction compression was dropped entirely
rather than chase that further.

No auth on these routes, deliberately: the Yard Builder page that calls them
is a standalone dev tool (not linked from any menu, not reachable through the
normal login flow) and doesn't carry a JWT — requiring one here just breaks
the upload with "Not authenticated". If this ever needs to be exposed beyond
local development, add auth back before that happens.
"""
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File

logger = logging.getLogger(__name__)
assets_router = APIRouter()

# Frontend/public/models/custom — Backend/ and Frontend/ are sibling dirs
# under the project root. __file__ = Backend/v1/api/assets_api/Assets.py, so
# parents[3] = Backend, parents[4] = project root.
MODELS_DIR = (Path(__file__).resolve().parents[4] / "Frontend" / "public" / "models" / "custom")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB raw upload cap

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _safe_stem(filename: str) -> str:
    stem = Path(filename).stem
    stem = _SAFE_NAME_RE.sub("_", stem).strip("_") or "model"
    return stem[:80]


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

    stem = _safe_stem(file.filename)
    final_name = f"{stem}-{uuid.uuid4().hex[:8]}.glb"
    final_path = MODELS_DIR / final_name
    final_path.write_bytes(raw)

    logger.info(f"Uploaded model '{file.filename}' -> {final_name} ({len(raw)} bytes, no compression)")

    return {
        "status": "success",
        "message": "Model uploaded",
        "data": {
            "filename": final_name,
            "url": f"/models/custom/{final_name}",
            "size": len(raw),
        },
    }
