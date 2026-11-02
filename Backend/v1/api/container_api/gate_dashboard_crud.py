"""Gate Dashboard — fix transactions whose left / right / top images are missing.

Main Gate In rows come from the Pre-Gate survey SP (GET_ESURVEY_DETAIL), whose
images live at  <stitching>/<GateName>/<yyyymmdd of SurveyTime>/<ContainerNo>/<side>.jpg.
Images that could not be matched to a container are kept in
<stitching>/<gate>/<yyyymmdd>/00000000000/ . This module:

  GET  /v1/container/gate-dashboard/images?gate_name&date
       -> every image in <stitching>/<gate_name>/<date|today>/00000000000
  GET  /v1/container/gate-dashboard/img?p=<relative path>   -> serves one image
  GET  /v1/container/gate-dashboard/containers?term         -> container-number suggestions
                                                                (in the yard in the last 24 h)
  POST /v1/container/gate-dashboard/save
       body: gate ("main" | "rail"), container_no, side (left|right|top), folder, file,
             gate_name, survey_time, old_container_no, detected_time, update_record
       -> MOVES <folder>/<file> to <stitching>/<gate_name>/<yyyymmdd>/<container_no>/<side>.jpg
          (main; rail uses the 00000000000 folder's parent), creating the folder if needed
          or adding to it, then updates the transaction:
            main -> UPDATE EKL_TRN_CONTAINER_ESURVEY SET ContainerNo (INSERT if no row matches)
            rail -> EXEC dbo.INS_EKL_TRN_RAIL_IN (same call as the rail detection service)
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

# Same stitching root the pre-gate survey / rail images are read from.
IMG_ROOT = pathlib.Path(
    os.getenv("GATE_DASHBOARD_IMG_ROOT")
    or os.getenv("STITCHING_DIR")
    or os.getenv("RAIL_IN_IMG_ROOT")
    or r"D:\Application\eklavya-budget-main\stitching"
)
# Folder (inside <root>/<gate>/<yyyymmdd>/) that holds the images whose container no. was not read.
MISSING_FOLDER = os.getenv("GATE_DASHBOARD_MISSING_FOLDER", "00000000000")
IMG_EXT = (".jpg", ".jpeg", ".png")
# Table holding the Main Gate In transactions (survey rows).
MAIN_TABLE = os.getenv("GATE_DASHBOARD_TABLE", "EKL_TRN_CONTAINER_ESURVEY")

CONTAINER_RE = re.compile(r"^[A-Z]{4}\d{7}$")
IDENT_RE = re.compile(r"^[A-Za-z0-9_.\[\]]+$")


class SaveBody(BaseModel):
    gate: Literal["main", "rail"]
    container_no: str
    side: Literal["left", "right", "top"]
    folder: str
    file: str
    gate_name: Optional[str] = None        # main: the row's GateName (folder name under the root)
    survey_time: Optional[str] = None      # main: the row's SurveyTime (decides the date folder)
    old_container_no: Optional[str] = None  # main: the number the row has now
    detected_time: Optional[str] = None    # rail: RailInDateTime for the SP
    update_record: bool = False            # rail: run the SP (number changed)


def _parse_dt(value):
    if not value:
        return None
    raw = str(value).strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            pass
    return None


def _day(date: Optional[str]) -> str:
    """yyyymmdd from a 'YYYY-MM-DD…' string; today when missing / invalid."""
    raw = (date or "").strip()[:10].replace("-", "")
    return raw if re.fullmatch(r"\d{8}", raw) else datetime.now().strftime("%Y%m%d")


def _day_folder(gate_name: str, day: str):
    """<root>/<gate>/<yyyymmdd>/<MISSING_FOLDER> if it exists."""
    gate = gate_name.strip()
    # Try the gate name as given, then upper-case, then with '-' / ' ' turned into '_'.
    for name in dict.fromkeys([gate, gate.upper(), re.sub(r"[-\s]+", "_", gate).upper()]):
        if not name or name != os.path.basename(name) or name in (".", ".."):
            continue
        folder = IMG_ROOT / name / day / MISSING_FOLDER
        if folder.is_dir():
            return folder
    return None


@router.get("/gate-dashboard/containers")
def suggest_containers(term: str = Query("", max_length=20)):
    """Container-number suggestions for the entry box: containers that came into the
    yard in the last 24 hours (EKL_TRN_INVENTORY), newest first."""
    term = re.sub(r"[^A-Za-z0-9]", "", term).upper()
    if len(term) < 2:
        return {"status": "success", "data": []}
    db = SQLManager()
    try:
        result = db.execute_query(
            """
            SELECT TOP 15 ContNo, MAX(ContainerSize) AS ContainerSize, MAX(Process) AS Process,
                   MAX(GateInDate) AS GateInDate
            FROM EKL_TRN_INVENTORY
            WHERE ContNo LIKE ? AND GateInDate >= DATEADD(HOUR, -24, GETDATE())
            GROUP BY ContNo
            ORDER BY MAX(GateInDate) DESC
            """,
            (f"%{term}%",),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}
        rows = result.get("data", []) or []
        for r in rows:
            if r.get("GateInDate") is not None:
                r["GateInDate"] = r["GateInDate"].strftime("%Y-%m-%d %H:%M:%S")
        return {"status": "success", "data": rows}
    except Exception as e:
        logger.exception("gate-dashboard containers error")
        return {"status": "error", "message": f"Server Error: {e}", "data": []}
    finally:
        db.close_connection()


@router.get("/gate-dashboard/images")
def list_missing_images(gate_name: str, date: Optional[str] = None):
    """All images in <root>/<gate_name>/<date|today>/<MISSING_FOLDER>, newest first."""
    day = _day(date)
    gate_dir = IMG_ROOT / os.path.basename(gate_name.strip())
    try:
        days = sorted((d.name for d in gate_dir.iterdir() if d.is_dir() and (d / MISSING_FOLDER).is_dir()), reverse=True)
    except Exception:
        days = []
    folder = _day_folder(gate_name, day)
    fallback = False
    if folder is None and days:
        # No 00000000000 folder for the asked date -> show the latest one that exists.
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
    if not IDENT_RE.match(MAIN_TABLE):
        return {"status": "error", "message": "Invalid table name in server config"}
    if body.file != os.path.basename(body.file) or not body.file.lower().endswith(IMG_EXT):
        return {"status": "error", "message": "Invalid file name"}

    # 1) Image: MOVE <folder>/<file> -> <gate>/<date>/<container_no>/<side>.jpg
    try:
        root = IMG_ROOT.resolve()
        folder = pathlib.Path(body.folder).resolve()
        folder.relative_to(root)
        src = folder / body.file
        if not src.is_file():
            return {"status": "error", "message": "Source image not found"}
        gate_dir = os.path.basename((body.gate_name or "").strip())
        if body.gate == "main" and gate_dir and body.survey_time:
            # Where the pre-gate survey looks for this transaction's images.
            dest_dir = root / gate_dir / _day(body.survey_time) / container_no
        else:
            dest_dir = folder.parent / container_no
        dest_dir.resolve().relative_to(root)
        existed = dest_dir.is_dir()  # folder already there -> the image is added into it
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{body.side}.jpg"
        if dest.exists():
            dest.unlink()  # same side saved before -> replace it
        shutil.move(str(src), str(dest))  # moved out of 00000000000, so it is not offered again
        url = "/v1/container/gate-dashboard/img?p=" + dest.resolve().relative_to(root).as_posix()
    except ValueError:
        return {"status": "error", "message": "Folder is outside the allowed image root"}
    except Exception as e:
        logger.exception("gate-dashboard save: image move failed")
        return {"status": "error", "message": f"Could not save image: {e}"}

    ok = {"status": "success", "path": str(dest), "folder_existed": existed, "url": url}

    # 2) Update the transaction with the container number.
    db = SQLManager()
    try:
        if body.gate == "rail":
            if not body.update_record:
                return {**ok, "updated": False}
            # Same call the detection service makes for rail.
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
            return {**ok, "updated": True}

        # Main Gate In: the row already carries this number -> only the image was missing.
        old = (body.old_container_no or "").strip().split(" ")[0].upper()
        if old == container_no:
            return {**ok, "updated": False}

        survey = _parse_dt(body.survey_time)
        updated_rows = 0
        if body.gate_name and survey:
            t0 = survey.replace(microsecond=0)
            result = db.execute_query(
                f"UPDATE {MAIN_TABLE} SET ContainerNo = ? "
                "WHERE UPPER(GateName) = UPPER(?) AND SurveyTime >= ? AND SurveyTime < DATEADD(SECOND, 1, ?) "
                "AND ContainerNo = ?",
                (container_no, body.gate_name.strip(), t0, t0, old),
                commit=True,
            )
            if not result or result.get("status") != "success":
                return {"status": "error", "message": (result or {}).get("message", "Database update failed")}
            updated_rows = result.get("rows_affected") or 0
        if updated_rows:
            return {**ok, "updated": True, "inserted": False}

        # Another side of this container was already saved for this gate / time -> the row exists.
        if body.gate_name and survey:
            found = db.execute_query(
                f"SELECT TOP 1 1 AS x FROM {MAIN_TABLE} WHERE UPPER(GateName) = UPPER(?) AND ContainerNo = ? "
                "AND SurveyTime BETWEEN DATEADD(MINUTE, -30, ?) AND DATEADD(MINUTE, 30, ?)",
                (body.gate_name.strip(), container_no, survey, survey),
            )
            if found and found.get("status") == "success" and found.get("data"):
                return {**ok, "updated": False, "inserted": False}

        # The survey table has no matching row -> insert it, same columns the detection service writes.
        result = db.execute_query(
            f"INSERT INTO {MAIN_TABLE} (GateName, SurveyTime, ContainerNo, DetectedTime) VALUES (?, ?, ?, ?)",
            ((body.gate_name or "UNKNOWN_GATE").strip(), survey or datetime.now(), container_no, _parse_dt(body.detected_time)),
            commit=True,
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Database insert failed")}
        return {**ok, "updated": False, "inserted": True}
    except Exception as e:
        logger.exception("gate-dashboard save error")
        return {"status": "error", "message": f"Server Error: {e}"}
    finally:
        db.close_connection()
