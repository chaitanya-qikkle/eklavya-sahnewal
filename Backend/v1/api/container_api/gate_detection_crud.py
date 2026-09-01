"""Main Gate — vehicle/container ALPR detection log.

Frontend contract:
  GET /v1/container/vehicle-container-detection  -> full list, latest first
  GET /v1/container/vehicle-container-detection/img?p=<relative path>
      -> serves a detection snapshot image

GET_VEHICLE_CONTAINER_DETECTION (v2) matches each vehicle detection with its
container detection (same gate, <=2min apart) and, where possible, further
matches the container against Gateway Rail's NAV integration data (linked
server, <=2h of the container detection) to attach real container details —
ContainerSize/Type, DocumentNo, NAVDateTime, Process, Terminal, Mode,
ContainerStatus, IntegrationVehicleNo, IntegrationStatus. Unmatched rows
(vehicle-only or container-only detections) still come through with those
integration fields NULL.

The SP returns absolute Windows paths
(D:\\QKL\\Rail-OCR\\Gate-ALPR\\output-test\\<Gate>\\<dd-MM-yyyy>\\<file>.jpg)
for VehicleImagePath/ContainerImagePath. The API strips the configured base
directory off those paths before sending rows to the frontend, and the /img
endpoint re-joins a relative path onto that same base directory — same
scoped-serving pattern as esurvey_crud.py's STITCHING_DIR/img endpoint.
"""
import logging
import os
import pathlib

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from utils.db_utils import SQLManager

router = APIRouter()
logger = logging.getLogger(__name__)

DETECTION_IMG_DIR = pathlib.Path(os.getenv("GATE_DETECTION_IMG_DIR", r"D:\QKL\Rail-OCR\Gate-ALPR\output-test"))


def _img_url(abs_path):
    """Turn an absolute Windows path the SP returned into a full API image
    URL, same convention as esurvey_crud.py's _img_url — only if the file
    actually exists on disk, else None (row still returned, just no image)."""
    if not abs_path:
        return None
    try:
        rel = pathlib.PureWindowsPath(abs_path).relative_to(DETECTION_IMG_DIR)
    except Exception:
        return None
    target = DETECTION_IMG_DIR / rel
    if not target.is_file():
        return None
    rel_slash = str(rel).replace("\\", "/")
    return f"/v1/container/vehicle-container-detection/img?p={rel_slash}"


@router.get("/vehicle-container-detection")
def get_vehicle_container_detection():
    db = SQLManager()
    try:
        result = db.execute_query("EXEC dbo.GET_VEHICLE_CONTAINER_DETECTION")
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}

        rows = result.get("data", []) or []
        for row in rows:
            row["VehicleImagePath"] = _img_url(row.get("VehicleImagePath"))
            row["ContainerImagePath"] = _img_url(row.get("ContainerImagePath"))

        return {"status": "success", "data": rows}
    except Exception as e:
        logger.exception("vehicle-container-detection error")
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/vehicle-container-detection/img", include_in_schema=False)
def serve_detection_image(p: str = Query(...)):
    try:
        target = (DETECTION_IMG_DIR / p).resolve()
        target.relative_to(DETECTION_IMG_DIR.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    suffix = target.suffix.lower()
    media = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png" if suffix == ".png" else "application/octet-stream"
    return FileResponse(str(target), media_type=media, headers={"Cache-Control": "public, max-age=3600"})
