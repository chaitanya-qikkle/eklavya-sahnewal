"""Gate Dashboard — fix a transaction whose container number was not read.

Frontend contract:
  POST /v1/container/gate-dashboard/save
      body: gate ("main" | "rail"), container_no, side (left|right|top),
            folder (folder of the unread images), file (picked image name),
            gate_name, detected_time
      -> copies <folder>/<file> to <folder's parent>/<container_no>/<side>.jpg
         and records the container number in the database.

Database writes mirror the detection service's inserts:
  rail -> EXEC dbo.INS_EKL_TRN_RAIL_IN
  main -> INSERT INTO <GATE_DASHBOARD_TABLE> (GateName, SurveyTime, ContainerNo, DetectedTime)
"""
import logging
import os
import pathlib
import re
import shutil
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from utils.db_utils import SQLManager

router = APIRouter()
logger = logging.getLogger(__name__)

# Image folders handed out by the SP must live under this root.
IMG_ROOT = pathlib.Path(os.getenv("GATE_DASHBOARD_IMG_ROOT", r"D:\stitching\outputs"))
MAIN_TABLE = os.getenv("GATE_DASHBOARD_TABLE", "Containers")

CONTAINER_RE = re.compile(r"^[A-Z]{4}\d{7}$")
TABLE_RE = re.compile(r"^[A-Za-z0-9_.\[\]]+$")


class SaveBody(BaseModel):
    gate: Literal["main", "rail"]
    container_no: str
    side: Literal["left", "right", "top"]
    folder: str
    file: str
    gate_name: Optional[str] = None
    detected_time: Optional[str] = None


def _parse_dt(value):
    if not value:
        return None
    raw = str(value).strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            pass
    return None


@router.post("/gate-dashboard/save")
def save_container(body: SaveBody):
    container_no = body.container_no.strip().upper()
    if not CONTAINER_RE.match(container_no):
        return {"status": "error", "message": "Invalid container number"}
    if not TABLE_RE.match(MAIN_TABLE):
        return {"status": "error", "message": "Invalid table name in server config"}
    if body.file != os.path.basename(body.file) or not body.file.lower().endswith((".jpg", ".jpeg", ".png")):
        return {"status": "error", "message": "Invalid file name"}

    # 1) Image: <folder>/<file> -> <parent>/<container_no>/<side>.jpg
    try:
        root = IMG_ROOT.resolve()
        folder = pathlib.Path(body.folder).resolve()
        folder.relative_to(root)
        src = folder / body.file
        if not src.is_file():
            return {"status": "error", "message": "Source image not found"}
        dest_dir = folder.parent / container_no
        dest_dir.relative_to(root)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{body.side}.jpg"
        shutil.copy2(src, dest)
    except ValueError:
        return {"status": "error", "message": "Folder is outside the allowed image root"}
    except Exception as e:
        logger.exception("gate-dashboard save: image copy failed")
        return {"status": "error", "message": f"Could not save image: {e}"}

    # 2) Database
    now = datetime.now()
    db = SQLManager()
    try:
        if body.gate == "rail":
            result = db.execute_query(
                """
                EXEC [dbo].[INS_EKL_TRN_RAIL_IN]
                    @ContainerNo = ?, @RailInDateTime = ?, @ContainerSize = NULL,
                    @ContainerType = NULL, @ShippingLine = NULL, @Confidance = NULL,
                    @Checksm = NULL, @IsSuccess = ?
                """,
                (container_no, _parse_dt(body.detected_time) or now, 0),
                commit=True,
            )
        else:
            result = db.execute_query(
                f"INSERT INTO {MAIN_TABLE} (GateName, SurveyTime, ContainerNo, DetectedTime) VALUES (?, ?, ?, ?)",
                ((body.gate_name or "UNKNOWN_GATE").strip().upper(), now, container_no, _parse_dt(body.detected_time)),
                commit=True,
            )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Database write failed")}
        return {"status": "success", "path": str(dest)}
    except Exception as e:
        logger.exception("gate-dashboard save error")
        return {"status": "error", "message": f"Server Error: {e}"}
    finally:
        db.close_connection()
