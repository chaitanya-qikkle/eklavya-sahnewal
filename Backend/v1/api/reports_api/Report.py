from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user
from datetime import datetime, timedelta
from pathlib import Path
import traceback
import logging
import logging.handlers
import json
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

_LOG_DIR = Path(__file__).resolve().parents[3] / "logs"
_LOG_DIR.mkdir(exist_ok=True)


def _make_json_file_logger(name: str, filename: str) -> logging.Logger:
    lgr = logging.getLogger(name)
    lgr.setLevel(logging.INFO)
    lgr.propagate = False
    if not lgr.handlers:
        h = logging.handlers.RotatingFileHandler(
            _LOG_DIR / filename,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        h.setFormatter(logging.Formatter("%(message)s"))
        lgr.addHandler(h)
    return lgr


_log_lock_report = _make_json_file_logger("reports.lock_unlock", "device-lock-unlock-report.log")
_log_raw_data    = _make_json_file_logger("reports.device_raw",  "device-raw-data-report.log")


def _to_proc_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse common UI date inputs into a datetime object.

    Returns a native datetime (not a formatted string) so pyodbc binds it as
    SQL_TIMESTAMP directly — a string param would be implicitly converted by
    SQL Server using the connection's DATEFORMAT session setting, which on
    this server reads dd/mm as mm/dd and throws error 8114 for day > 12.
    """
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            pass
    return None


def _resolve_eqp_names(db, equipment_names: Optional[str]) -> str:
    """Convert comma-separated device IDs → comma-separated Equipment_Names for SPs."""
    raw_ids = [x.strip() for x in (equipment_names or "").split(",") if x.strip()]
    try:
        if raw_ids:
            placeholders = ",".join(["?"] * len(raw_ids))
            eq_res = db.execute_query(
                f"SELECT Equipment_Name FROM ESS_MST_EQUIPMENT WHERE ISNULL(IsDelete,0)=0 AND DeviceID IN ({placeholders})",
                params=tuple(raw_ids), fetch_all=True,
            )
        else:
            eq_res = db.execute_query(
                "SELECT Equipment_Name FROM ESS_MST_EQUIPMENT WHERE ISNULL(IsDelete,0)=0",
                fetch_all=True,
            )
        eq_data = eq_res.get("data") or []
        if isinstance(eq_data, list) and eq_data and isinstance(eq_data[0], list):
            eq_data = eq_data[0]
        names = list({r.get("Equipment_Name", "") for r in eq_data if r.get("Equipment_Name")})
        return ",".join(names)
    except Exception:
        return ""


def _apply_camera_filenames(rows: list) -> None:
    """Rebuild CameraImage1/2/3 from DeviceID + TransDate.

    GET_DEVICE_LOCK_REPORT's own CameraImage1/2/3 columns don't match the real
    S3 object names — it builds 'GDL11_<DeviceID><ddMMyyHHmm>.jpg', but actual
    uploads are named '<DeviceID>_<ddMMyyyyHHmmss>_cam<N>_<frame>.jpg' (e.g.
    GDL-SNL-KC-04_22082026125102_cam2_2.jpg). DeviceID/TransDate are returned
    correctly by the SP, so rebuild the filenames from those instead of
    trusting the SP's own (wrong) columns. Frame suffix defaults to _1; the
    frontend falls back to _2/_3 since the actual captured frame varies.
    """
    for row in rows:
        device_id  = row.get("DeviceID")
        trans_date = row.get("TransDate")
        if not device_id or not trans_date:
            continue
        dt = trans_date
        if isinstance(dt, str):
            try:
                dt = datetime.strptime(dt[:19], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
        ts = dt.strftime("%d%m%Y%H%M%S")
        row["CameraImage1"] = f"{device_id}_{ts}_cam1_1.jpg"
        row["CameraImage2"] = f"{device_id}_{ts}_cam2_1.jpg"
        row["CameraImage3"] = f"{device_id}_{ts}_cam3_1.jpg"


@router.get("/reports")
def get_gate_report(
    container_no: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        container_no_param = (container_no or '').strip().upper()

        if from_date:
            try:
                datetime.strptime(from_date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid from_date format. Use YYYY-MM-DD")
        if to_date:
            try:
                datetime.strptime(to_date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid to_date format. Use YYYY-MM-DD")

        plant_id = current_user.get("plant_id", 1)

        result = db.execute_query(
            "EXEC dbo.GET_GATEIN_REPORT @fromDate = ?, @toDate = ?, @ContainerNo = ?, @PlantId = ?",
            (from_date or '', to_date or '', container_no_param, plant_id),
            fetch_all=True,
        )

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message", "Database error"))

        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]

        logger.info(f"Gate report success: {len(data)} records")
        return {"status": "success", "message": f"Found {len(data)} record(s).", "total_records": len(data), "data": data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gate report error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        try:
            db.close_connection()
        except Exception:
            pass


@router.get("/equipment-utilization")
def get_equipment_utilization_report(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    equipment_names: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        plant_id = current_user.get("plant_id", 1)

        now = datetime.now()
        from_dt = _to_proc_datetime(from_date) or (now - timedelta(days=1))
        to_dt   = _to_proc_datetime(to_date)   or now

        eqp_no = _resolve_eqp_names(db, equipment_names)

        result = db.execute_query(
            "EXEC dbo.GET_EQPIMENTUTLIZATION_REPORT @fromDate = ?, @toDate = ?, @Eqp = ?, @PlantID = ?",
            params=(from_dt, to_dt, eqp_no, plant_id),
            fetch_all=True,
        )

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message", "Database error"))

        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]

        logger.info(f"Equipment utilization report success: {len(data)} records")
        return {"status": "success", "message": f"Found {len(data)} record(s).", "total_records": len(data), "data": data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Equipment utilization report error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        try:
            db.close_connection()
        except Exception:
            pass


@router.get("/service-dashboard")
def get_service_dashboard(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    equipment_names: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Combined service dashboard: stats calculated from GET_DEVICE_LOCK_REPORT rows."""
    db = SQLManager()
    try:
        plant_id = current_user.get("plant_id", 1)

        eqp_no = _resolve_eqp_names(db, equipment_names)

        now = datetime.now()
        from_dt = _to_proc_datetime(from_date) or (now - timedelta(days=1))
        to_dt   = _to_proc_datetime(to_date)   or now

        # All transactions via GET_DEVICE_LOCK_REPORT with Type='All'
        result = db.execute_query(
            "EXEC GET_DEVICE_LOCK_REPORT ?, ?, ?, ?, ?, ?",
            params=('All', eqp_no, from_dt, to_dt, plant_id, ''),
            fetch_all=True,
        )
        all_data = (result.get("data") or [])
        if isinstance(all_data, list) and all_data and isinstance(all_data[0], list):
            all_data = all_data[0]
        _apply_camera_filenames(all_data)

        # Calculate stats from rows
        total = len(all_data)
        non_missing = 0
        for row in all_data:
            cont = str(row.get("ContNo") or row.get("RFIDDATA") or "").strip().split(" ")[0]
            if cont and cont.replace("0", "") != "":
                non_missing += 1
        missing = total - non_missing
        accuracy = round((non_missing / total) * 100, 1) if total > 0 else 0.0

        stats = {
            "TotalCount": total,
            "NonMissing": non_missing,
            "Missing": missing,
            "OcrAccuracy": accuracy,
        }

        return {
            "status": "success",
            "stats": stats,
            "total_records": total,
            "data": all_data,
        }
    except Exception as e:
        logger.error(f"Service dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try: db.close_connection()
        except Exception: pass


@router.get("/device-lock-report")
def get_device_lock_report(
    from_date: Optional[str] = Query(None, description="From Date (YYYY-MM-DD or datetime-local)"),
    to_date: Optional[str] = Query(None, description="To Date (YYYY-MM-DD or datetime-local)"),
    equipment_names: Optional[str] = Query(None, description="Comma-separated device IDs"),
    report_type: Optional[str] = Query("All", description="Missing / Non Missing / All"),
    location: Optional[str] = Query("", description="Location filter (Import/Export/All)"),
    current_user: dict = Depends(get_current_user)
):
    """Device lock report via GET_DEVICE_LOCK_REPORT stored procedure."""
    db = SQLManager()
    try:
        plant_id = current_user.get("plant_id", 1)

        # Resolve device IDs → Equipment_Names for the SP
        eqp_no_str = _resolve_eqp_names(db, equipment_names)

        now = datetime.now()
        from_dt = _to_proc_datetime(from_date) or (now - timedelta(days=1))
        to_dt   = _to_proc_datetime(to_date)   or now

        rtype   = (report_type or "All").strip()
        loc_val = (location or "").strip()
        if loc_val.lower() == "all":
            loc_val = ""

        result = db.execute_query(
            "EXEC GET_DEVICE_LOCK_REPORT ?, ?, ?, ?, ?, ?",
            params=(rtype, eqp_no_str, from_dt, to_dt, plant_id, loc_val),
            fetch_all=True,
        )

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message") or "Database error")

        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        _apply_camera_filenames(data)

        try:
            _log_lock_report.info(json.dumps({
                "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "request": {"from_date": from_date, "to_date": to_date, "equipment_names": equipment_names, "report_type": report_type},
                "total_records": len(data),
            }, ensure_ascii=True, default=str))
        except Exception as _le:
            logger.warning("lock-report log write failed: %s", _le)

        return {
            "status": "success",
            "message": f"Data fetched successfully. Found {len(data)} record(s).",
            "total_records": len(data),
            "data": data,
        }

    except HTTPException:
        raise
    except Exception as e:
        error_detail = str(e)
        logger.error(f"Device lock report error: {error_detail}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {error_detail}")
    finally:
        try:
            db.close_connection()
        except Exception:
            pass


@router.get("/device-raw-data")
def get_device_raw_data(
    machine: Optional[str] = Query(None, description="KalmarNo / Equipment Name"),
    from_date: Optional[str] = Query(None, description="From Date (datetime-local or YYYY-MM-DD HH:MM:SS)"),
    to_date: Optional[str] = Query(None, description="To Date (datetime-local or YYYY-MM-DD HH:MM:SS)"),
    current_user: dict = Depends(get_current_user)
):
    db = SQLManager()
    try:
        def _to_dt(val):
            if not val: return None
            raw = str(val).strip()
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%d/%m/%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
                try: return datetime.strptime(raw, fmt)
                except ValueError: pass
            return None

        from_dt = _to_dt(from_date) or datetime(1900, 1, 1)
        to_dt   = _to_dt(to_date)   or datetime(2099, 12, 31, 23, 59, 59)
        plant_id = current_user.get("plant_id", 1)

        # `machine` is sourced from the raw KalmarNo dropdown (EKL_TRN_EKDEVICEDATA.KalmarNo),
        # which doesn't reliably match ESS_MST_EQUIPMENT.Equipment_Name/DeviceID — resolving it
        # through the equipment master rewrites a valid KalmarNo into a name the raw table
        # doesn't recognize, silently zeroing out the SP results. Use it as-is.
        kalmar_no = (machine or "").strip()

        if not kalmar_no:
            # The SP filters via `KalmarNo IN (SELECT VALUE FROM Split_String(@KalmarNo, ','))`.
            # Split_String('') yields a single empty-string row, so an empty filter matches
            # nothing — "All Machines" must be expanded to the full known KalmarNo list.
            try:
                list_res = db.execute_query(
                    "SELECT DISTINCT KalmarNo FROM EKL_TRN_EKDEVICEDATA "
                    "WHERE KalmarNo IS NOT NULL AND LTRIM(RTRIM(KalmarNo)) <> ''",
                    fetch_all=True,
                )
                list_data = list_res.get("data") or []
                if isinstance(list_data, list) and list_data and isinstance(list_data[0], list):
                    list_data = list_data[0]
                kalmar_no = ",".join(row.get("KalmarNo") for row in list_data if row.get("KalmarNo"))
            except Exception:
                pass

        result = db.execute_query(
            "EXEC dbo.GET_RPT_RAW_DEVICE_DATA ?, ?, ?, ?",
            params=(plant_id, from_dt, to_dt, kalmar_no or ""),
        )

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message") or "Database error")

        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]

        # Frontend table expects UPPER_SNAKE keys; the SP returns raw column names
        # (PacketID, GPSFix, KalmarNo, Date_Time, Latitude, ...) which don't match by
        # case/spelling, so every field except RFIDDATA rendered blank and the packet-ID
        # filter (Number(row.PACKET_ID)) always produced NaN, hiding all rows.
        data = [
            {
                "PACKET_ID":      row.get("PacketID"),
                "GPS_FIX":        row.get("GPSFix"),
                "DEVICE_IMEI":    row.get("DeviceIMEI"),
                "Equipment_Name": row.get("KalmarNo"),
                "KALMAR_NO":      row.get("KalmarNo"),
                "DATE_TIME":      row.get("Date_Time"),
                "LATITUDE":       row.get("Latitude"),
                "LONGITUDE":      row.get("Longitude"),
                "ANALOG1":        row.get("Analog1"),
                "RFIDDATA":       row.get("RFIDDATA"),
            }
            for row in data
        ]
        try:
            _log_raw_data.info(json.dumps({
                "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "request": {"machine": machine, "from_date": from_date, "to_date": to_date},
                "total_records": len(data),
                "data": data,
            }, ensure_ascii=True, default=str))
        except Exception as _le:
            logger.warning("device-raw-data log write failed: %s", _le)
        return {
            "status": "success",
            "message": f"Data fetched successfully. Found {len(data)} record(s).",
            "total_records": len(data),
            "data": data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Device raw data report error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        try:
            db.close_connection()
        except Exception:
            pass


@router.get("/trailer-report")
def get_trailer_report(
    trailer_no: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        def _to_dt(val):
            if not val: return None
            raw = str(val).strip()
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try: return datetime.strptime(raw, fmt)
                except ValueError: pass
            return None

        trailer  = (trailer_no or '').strip().upper()
        from_dt  = _to_dt(from_date)
        to_dt    = _to_dt(to_date)
        plant_id = current_user.get("plant_id", 1)

        result = db.execute_query(
            "EXEC dbo.GET_TRAILER_REPORT ?, ?, ?, ?",
            params=(
                from_dt  or '',
                to_dt    or '',
                trailer,
                plant_id,
            ),
        )

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message") or "Database error")

        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]

        return {
            "status": "success",
            "message": f"Found {len(data)} record(s).",
            "total_records": len(data),
            "data": data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Trailer report error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        try: db.close_connection()
        except Exception: pass


class UpdateDeviceContainerRequest(BaseModel):
    eqp_trans_id: int
    cont_no: str

@router.post("/update-device-container")
def update_device_container(
    request: UpdateDeviceContainerRequest,
    current_user: dict = Depends(get_current_user)
):
    db = SQLManager()
    try:
        query = "EXEC [dbo].[UPD_DEVICEDATADETAIL_CONTNO_BY_IMG] ?, ?, ?, ?"
        params = (
            current_user.get("plant_id", 1),
            request.eqp_trans_id,
            request.cont_no,
            current_user.get("user_id", 1)
        )
        result = db.execute_query(query, params, commit=True)

        if result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message") or "Database error")

        data = result.get("data", [])
        is_success = False
        if data and isinstance(data, list) and len(data) > 0:
            is_success = data[0].get("Result", data[0].get("RESULT", 0)) == 1

        if not is_success:
            raise HTTPException(status_code=400, detail="Failed to update container")

        return {
            "status": "success",
            "message": "Container updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update device container error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        try:
            db.close_connection()
        except Exception:
            pass
