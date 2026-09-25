from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
from utils.db_utils import SQLManager
from datetime import datetime
from pathlib import Path
import json
import logging
import logging.handlers

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Device Ingest"])

# Centralised log directory — same folder used by main.py
LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_DIR.mkdir(exist_ok=True)


def _make_json_file_logger(name: str, filename: str) -> logging.Logger:
    """Rotating file logger that writes one raw JSON line per record."""
    lgr = logging.getLogger(name)
    lgr.setLevel(logging.INFO)
    lgr.propagate = False  # keep out of the root app log
    if not lgr.handlers:
        h = logging.handlers.RotatingFileHandler(
            LOG_DIR / filename,
            maxBytes=10 * 1024 * 1024,  # 10 MB per file
            backupCount=5,
            encoding="utf-8",
        )
        h.setFormatter(logging.Formatter("%(message)s"))
        lgr.addHandler(h)
    return lgr


_log_all  = _make_json_file_logger("device.data.all",        "device-data-all.log")
_log_lock = _make_json_file_logger("device.data.lock_unlock", "device-data-lock-unlock.log")
_log_hist = _make_json_file_logger("device.data.hist",        "device-data-hist.log")


def _safe_coord_str(value, field_name: str, lo: float, hi: float) -> str:
    """API_INS_EKY_DEVICE_DATA does `CAST(@LAT/@LON as float)` internally on
    whatever string we send, and a downstream call (INS_EKY_TRN_LOCK_DATA)
    builds a `geography::STGeomFromText('POINT(lon lat)', ...)` from those
    same values with no range check. A device sending an empty string,
    "N/A", swapped lat/lon, or any out-of-range number makes either the
    CAST (SQL 8114) or the geography constructor (latitude must be
    -90..90) throw and roll back the whole insert. Validate the numeric
    range here so a bad GPS value degrades to "0" instead of failing the
    packet — "0" is always a valid float and always inside -90..90/-180..180.
    """
    if value is None:
        return "0"
    raw = str(value).strip()
    if not raw:
        return "0"
    try:
        num = float(raw)
    except ValueError:
        logger.warning("device-data: non-numeric %s=%r, coercing to 0", field_name, value)
        return "0"
    if not (lo <= num <= hi):
        logger.warning("device-data: %s=%r out of range [%s, %s], coercing to 0", field_name, value, lo, hi)
        return "0"
    return raw


class DeviceDataPayload(BaseModel):
    # All fields typed as Any — IoT devices send mixed int/float/str values
    TYP: Any = None
    LOH: Any = None
    TIM: Any = None
    POS: Any = None
    LAT: Any = None
    LAD: Any = None
    LON: Any = None
    LOD: Any = None
    NOS: Any = None
    ALT: Any = None
    AN1: Any = None
    AN2: Any = None
    DL1: Any = None
    DL2: Any = None
    DID: Any = None
    CID: Any = None
    FNO: Any = None


@router.post("/device-data")
async def insert_device_data(payload: DeviceDataPayload):
    db = SQLManager()
    try:
        try:
            payload_dict = payload.model_dump()
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            line = json.dumps({"ts": timestamp, **payload_dict}, ensure_ascii=True, default=str)

            _log_all.info(line)

            typ = str(payload_dict.get("TYP") or "").upper()
            loh = str(payload_dict.get("LOH") or "").upper()
            if "LKUK_UK" in typ or "LKUK_LK" in typ:
                _log_lock.info(line)
            if loh == "HIST":
                _log_hist.info(line)
        except Exception as e:
            logger.warning("device-data log write failed: %s", e)

        safe_lat = _safe_coord_str(payload.LAT, "LAT", -90, 90)
        safe_lon = _safe_coord_str(payload.LON, "LON", -180, 180)

        result = db.execute_query(
            "EXEC dbo.API_INS_EKY_DEVICE_DATA ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?",
            (
                payload.TYP, payload.LOH, payload.TIM, payload.POS,
                safe_lat, payload.LAD, safe_lon, payload.LOD,
                payload.NOS, payload.ALT, payload.AN1, payload.AN2,
                payload.DL1, payload.DL2, payload.DID, payload.CID, payload.FNO,
            ),
            commit=True,
        )

        if result.get("status") == "error":
            logger.error("device-data SP error: %s", result.get("message"))
            raise HTTPException(status_code=503, detail=result.get("message"))

        data = result.get("data") or []
        if data:
            first_row = data[0]
            output = first_row[next(iter(first_row))]
        else:
            output = 1

        return {"success": True, "result": output}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("device-data insert error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close_connection()
