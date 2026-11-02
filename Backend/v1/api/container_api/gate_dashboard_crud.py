"""Gate Dashboard — fix a transaction whose container number was not read.

Frontend contract:
  POST /v1/container/gate-dashboard/save
      body: gate ("main" | "rail"), container_no, side (left|right|top),
            folder (folder of the unread images), file (picked image name),
            gate_name, detected_time, transaction_id, update_record
      -> copies <folder>/<file> to <folder's parent>/<container_no>/<side>.jpg
         (the folder is created if needed, otherwise the image is added to it)
         and, when update_record is true, sets ContainerNo on the transaction:
  main -> UPDATE EKL_TRN_CONTAINER_ESURVEY SET ContainerNo = ? WHERE SurveyId = ?
  rail -> EXEC dbo.INS_EKL_TRN_RAIL_IN (same call as the rail detection service)
The main table / key names can be changed with GATE_DASHBOARD_TABLE / GATE_DASHBOARD_KEY.
"""
import logging
import os
import pathlib
import re
import shutil
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from utils.db_utils import SQLManager

router = APIRouter()
logger = logging.getLogger(__name__)

# Image folders handed out by the SP must live under this root.
IMG_ROOT = pathlib.Path(
    os.getenv("GATE_DASHBOARD_IMG_ROOT")
    or os.getenv("RAIL_IN_IMG_ROOT")  # same stitching root the Rail Gate In images already use
    or r"D:\Application\eklavya-budget-main\stitching"
)
# Folder (inside <root>/<gate>/<yyyymmdd>/) that holds the images whose container no. was not read.
MISSING_FOLDER = os.getenv("GATE_DASHBOARD_MISSING_FOLDER", "00000000000")
IMG_EXT = (".jpg", ".jpeg", ".png")
# Tables / key columns holding the transactions shown on the dashboard.
MAIN_TABLE = os.getenv("GATE_DASHBOARD_TABLE", "EKL_TRN_CONTAINER_ESURVEY")
MAIN_KEY = os.getenv("GATE_DASHBOARD_KEY", "SurveyId")

CONTAINER_RE = re.compile(r"^[A-Z]{4}\d{7}$")
IDENT_RE = re.compile(r"^[A-Za-z0-9_.\[\]]+$")


class SaveBody(BaseModel):
    gate: Literal["main", "rail"]
    container_no: str
    side: Literal["left", "right", "top"]
    folder: str
    file: str
    gate_name: Optional[str] = None
    detected_time: Optional[str] = None
    # Row to update (main: EKL_TRN_CONTAINER_ESURVEY.SurveyId, rail: EKL_TRN_RAIL_IN.TransactionId).
    transaction_id: Optional[int] = None
    # True when the entered container number differs from the transaction's current one.
    update_record: bool = False


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


def _day_folder(gate_name: str, date: Optional[str]):
    """<root>/<gate>/<yyyymmdd>/<MISSING_FOLDER>; date defaults to today."""
    raw = (date or "").strip()[:10].replace("-", "")
    day = raw if re.fullmatch(r"\d{8}", raw) else datetime.now().strftime("%Y%m%d")
    gate = gate_name.strip()
    # Try the gate name as given, then with '-' / ' ' turned into '_'.
    for name in dict.fromkeys([gate, gate.upper(), re.sub(r"[-\s]+", "_", gate).upper()]):
        if not name or name != os.path.basename(name) or name in (".", ".."):
            continue
        folder = IMG_ROOT / name / day / MISSING_FOLDER
        if folder.is_dir():
            return folder
    return None


class SideItem(BaseModel):
    key: str
    container_no: Optional[str] = None
    date: Optional[str] = None


class SidesBody(BaseModel):
    gate_name: str
    items: list[SideItem]


_SIDE_RE = re.compile(r"(?:^|[_\-. ])(left|right|top)(?:[_\-. ]|$)", re.IGNORECASE)


@router.post("/gate-dashboard/sides")
def present_sides(body: SidesBody):
    """Which of left / right / top exist for each transaction, i.e. image files
    inside <root>/<gate>/<yyyymmdd>/<container_no>/ (<side>.jpg, or any file
    whose name contains left / right / top). No folder = nothing present."""
    gate_dir = IMG_ROOT / os.path.basename(body.gate_name.strip())
    cache = {}
    out = {}
    for it in body.items:
        cn = (it.container_no or "").strip().upper()
        raw = (it.date or "").strip()[:10].replace("-", "")
        sides = []
        if re.fullmatch(r"[A-Z0-9]{4,15}", cn) and re.fullmatch(r"\d{8}", raw) and cn.strip("0"):
            k = (raw, cn)
            if k not in cache:
                found = set()
                try:
                    for p in (gate_dir / raw / cn).iterdir():
                        if p.is_file() and p.suffix.lower() in IMG_EXT:
                            m = _SIDE_RE.search(p.stem)
                            if m:
                                found.add(m.group(1).lower())
                except Exception:
                    pass
                cache[k] = sorted(found)
            sides = cache[k]
        out[it.key] = sides
    return {"status": "success", "sides": out}


@router.get("/gate-dashboard/images")
def list_missing_images(gate_name: str, date: Optional[str] = None):
    """All images in <root>/<gate_name>/<today>/<MISSING_FOLDER>, newest first."""
    raw = (date or "").strip()[:10].replace("-", "")
    day = raw if re.fullmatch(r"\d{8}", raw) else datetime.now().strftime("%Y%m%d")
    gate_dir = IMG_ROOT / os.path.basename(gate_name.strip())
    try:
        days = sorted((d.name for d in gate_dir.iterdir() if d.is_dir() and (d / MISSING_FOLDER).is_dir()), reverse=True)
    except Exception:
        days = []
    folder = _day_folder(gate_name, day)
    fallback = False
    if folder is None and days:
        # No 00000000000 folder for the asked date → show the latest one that exists.
        folder, day, fallback = gate_dir / days[0] / MISSING_FOLDER, days[0], True
    if folder is None:
        return {"status": "success", "folder": None, "images": [], "dates": [], "date": day,
                "message": f"Folder {gate_dir} has no {MISSING_FOLDER} folder (or is not on the server)."}
    try:
        root = IMG_ROOT.resolve()
        files = sorted(
            (p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXT),
            key=lambda p: p.stat().st_mtime, reverse=True,
        )
        images = [
            {"name": p.name,
             "url": "/v1/container/gate-dashboard/img?p=" + p.resolve().relative_to(root).as_posix()}
            for p in files
        ]
        return {"status": "success", "folder": str(folder), "images": images,
                "date": day, "dates": days[:15], "fallback": fallback}
    except Exception as e:
        logger.exception("gate-dashboard images error")
        return {"status": "error", "message": f"Server Error: {e}", "folder": None, "images": []}


@router.get("/gate-dashboard/img", include_in_schema=False)
def serve_image(p: str = Query(...)):
    try:
        target = (IMG_ROOT / p).resolve()
        target.relative_to(IMG_ROOT.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file() or target.suffix.lower() not in IMG_EXT:
        raise HTTPException(status_code=404, detail="Image not found")
    media = "image/png" if target.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(str(target), media_type=media, headers={"Cache-Control": "public, max-age=300"})


@router.post("/gate-dashboard/save")
def save_container(body: SaveBody):
    container_no = body.container_no.strip().upper()
    if not CONTAINER_RE.match(container_no):
        return {"status": "error", "message": "Invalid container number"}
    if not all(IDENT_RE.match(x) for x in (MAIN_TABLE, MAIN_KEY)):
        return {"status": "error", "message": "Invalid table / column name in server config"}
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
        existed = dest_dir.is_dir()  # folder already there → the image is added into it
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{body.side}.jpg"
        shutil.copy2(src, dest)
    except ValueError:
        return {"status": "error", "message": "Folder is outside the allowed image root"}
    except Exception as e:
        logger.exception("gate-dashboard save: image copy failed")
        return {"status": "error", "message": f"Could not save image: {e}"}

    if not body.update_record:
        return {"status": "success", "path": str(dest), "folder_existed": existed, "updated": False}

    # 2) Update the transaction with the container number.
    db = SQLManager()
    try:
        if body.gate == "rail":
            # Same call the detection service makes for rail: the SP creates / updates the
            # rail-in record and the inventory for this container.
            result = db.execute_query(
                """
                EXEC [dbo].[INS_EKL_TRN_RAIL_IN]
                    @ContainerNo = ?, @RailInDateTime = ?, @ContainerSize = NULL,
                    @ContainerType = NULL, @ShippingLine = NULL, @Confidance = NULL,
                    @Checksm = NULL, @IsSuccess = ?
                """,
                (container_no, _parse_dt(body.detected_time) or datetime.now(), 0),
                commit=True,
            )
            if not result or result.get("status") != "success":
                return {"status": "error", "message": (result or {}).get("message", "Database update failed")}
        else:
            if body.transaction_id is None:
                return {"status": "error", "message": f"Image saved to {dest}, but the transaction has no id to update"}
            result = db.execute_query(
                f"UPDATE {MAIN_TABLE} SET ContainerNo = ? WHERE {MAIN_KEY} = ?",
                (container_no, body.transaction_id),
                commit=True,
            )
            if not result or result.get("status") != "success":
                return {"status": "error", "message": (result or {}).get("message", "Database update failed")}
            if not result.get("rows_affected"):
                return {"status": "error", "message": f"Image saved to {dest}, but no transaction with id {body.transaction_id} was found to update"}
        return {"status": "success", "path": str(dest), "folder_existed": existed, "updated": True}
    except Exception as e:
        logger.exception("gate-dashboard save error")
        return {"status": "error", "message": f"Server Error: {e}"}
    finally:
        db.close_connection()
