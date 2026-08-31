"""Rail Gate In — dual-camera OCR detection report for rail-in containers.

Frontend contract:
  GET /v1/container/rail-in?from_date&to_date&container_no
      -> list of rail-in records (date range OR container-no search, per
         GET_RPT_RAIL_IN's own branching)
  GET /v1/container/rail-in/img?p=<relative path>
      -> serves a Camera1/Camera2 snapshot image

GET_RPT_RAIL_IN returns absolute Windows paths under two camera-specific
base directories (D:\\QKL\\Rail-OCR\\Rail\\Frames\\Rail-In-123 for Camera1,
...\\Rail-In-124 for Camera2). Both live under one common root
(RAIL_IN_IMG_ROOT), so the API strips that shared root off before sending
rows to the frontend, and the /img endpoint re-joins a relative path onto
the same root — same scoped-serving pattern as esurvey_crud.py/
gate_detection_crud.py's image endpoints.
"""
import logging
import os
import pathlib
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from utils.db_utils import SQLManager

router = APIRouter()
logger = logging.getLogger(__name__)

RAIL_IN_IMG_ROOT = pathlib.Path(os.getenv("RAIL_IN_IMG_ROOT", r"D:\QKL\Rail-OCR\Rail\Frames"))


def _img_url(abs_path):
    """Absolute Windows path (under either Rail-In-123 or Rail-In-124) -> a
    servable API URL, only if the file actually exists on disk."""
    if not abs_path:
        return None
    try:
        rel = pathlib.PureWindowsPath(abs_path).relative_to(RAIL_IN_IMG_ROOT)
    except Exception:
        return None
    target = RAIL_IN_IMG_ROOT / rel
    if not target.is_file():
        return None
    rel_slash = str(rel).replace("\\", "/")
    return f"/v1/container/rail-in/img?p={rel_slash}"


@router.get("/rail-in")
def get_rail_in(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    container_no: Optional[str] = None,
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_RPT_RAIL_IN @fromDate = ?, @toDate = ?, @ContainerNo = ?",
            (from_date or None, to_date or None, (container_no or "").strip()),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}

        rows = result.get("data", []) or []
        for row in rows:
            row["Camera1ImagePath"] = _img_url(row.get("Camera1ImagePath"))
            row["Camera2ImagePath"] = _img_url(row.get("Camera2ImagePath"))

        return {"status": "success", "data": rows}
    except Exception as e:
        logger.exception("rail-in error")
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/rail-in/img", include_in_schema=False)
def serve_rail_in_image(p: str = Query(...)):
    try:
        target = (RAIL_IN_IMG_ROOT / p).resolve()
        target.relative_to(RAIL_IN_IMG_ROOT.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    suffix = target.suffix.lower()
    media = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png" if suffix == ".png" else "application/octet-stream"
    return FileResponse(str(target), media_type=media, headers={"Cache-Control": "public, max-age=3600"})
