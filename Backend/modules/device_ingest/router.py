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

        result = db.execute_query(
            "EXEC dbo.API_INS_EKY_DEVICE_DATA ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?",
            (
                payload.TYP, payload.LOH, payload.TIM, payload.POS,
                payload.LAT, payload.LAD, payload.LON, payload.LOD,
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
