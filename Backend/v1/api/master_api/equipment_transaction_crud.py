from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime

from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user
from models.master_model import (
    EquipmentTransactionAddRequest,
    EquipmentTransactionUpdateRequest,
    EquipmentTransactionDeleteRequest,
)


equipment_transaction_router = APIRouter()


def _normalize_datetime(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    # Accept ISO and HTML datetime-local inputs.
    return text.replace("T", " ")


@equipment_transaction_router.get("/get-equipment-transaction-latest")
def get_equipment_transaction_latest(current_user: dict = Depends(get_current_user)):
    """Returns last transaction datetime per DEVICE_ID.

    Used by the Equipment Status screen to show the latest packet time and compute
    'Last UK' (time since last container handling).
    """
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.SP_MOVEMENT_TRANSACTION_LATEST ?",
            (current_user["plant_id"],),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.get("/get-equipment-transaction-live-locations")
def get_equipment_transaction_live_locations(current_user: dict = Depends(get_current_user)):
    """Returns latest GPS location per DEVICE_ID.

    Only rows with valid numeric GPS_LATITUDE/GPS_LONGITUDE are considered.
    """
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.SP_MOVEMENT_TRANSACTION_LIVE_LOCATIONS ?",
            (current_user["plant_id"],),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.get("/daily-utilization")
def get_daily_utilization(
    eqp_no: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Equipment daily utilization from GET_EKY_TRN_DAILY_UTILIZATION SP.
    Returns EquipmentNo, BreakdownTime, IdleTime, WorkTime, TotalMoves,
    WorkingHours, HourlyMoves, ExpectedWorkingHours, PercentageUtilization.
    """
    db = SQLManager()
    try:
        from_d = _normalize_datetime(from_date) or datetime.today().strftime("%Y-%m-%d")
        to_d   = _normalize_datetime(to_date)   or from_d
        eqp    = eqp_no or ""
        response = db.execute_query(
            "EXEC dbo.GET_EKY_TRN_DAILY_UTILIZATION ?, ?, ?",
            (eqp, from_d, to_d),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.get("/daily-utilization-count")
def get_daily_utilization_count(
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Laden/Empty/Size20/Size40 counts from GET_EKY_TRN_DAILY_UTILIZATION_COUNT SP."""
    db = SQLManager()
    try:
        from_d = _normalize_datetime(from_date) or datetime.today().strftime("%Y-%m-%d")
        to_d   = _normalize_datetime(to_date)   or from_d
        response = db.execute_query(
            "EXEC dbo.GET_EKY_TRN_DAILY_UTILIZATION_COUNT ?, ?",
            (from_d, to_d),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.get("/get-equipment-transactions")
def get_equipment_transactions(
    device_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    top: int = 50,
    container_trans_type: Optional[str] = None,
    packet_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        try:
            top_n = int(top)
        except Exception:
            top_n = 50
        top_n = max(1, min(top_n, 500))

        query = "EXEC dbo.SP_MOVEMENT_TRANSACTION_LIST ?, ?, ?, ?, ?, ?, ?, ?"
        params = (
            current_user["plant_id"],
            device_id,
            _normalize_datetime(from_date),
            _normalize_datetime(to_date),
            container_trans_type,
            packet_type,
            1,
            top_n,
        )

        response = db.execute_query(query, params)
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.get("/get-equipment-transaction")
def get_equipment_transaction(transaction_id: int, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = "EXEC dbo.SP_MOVEMENT_TRANSACTION_GET ?, ?"
        params = (transaction_id, current_user["plant_id"])
        response = db.execute_query(query, params)
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.post("/add-equipment-transaction")
def add_equipment_transaction(request: EquipmentTransactionAddRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = "EXEC dbo.SP_MOVEMENT_TRANSACTION_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        params = (
            current_user["plant_id"],
            request.location_id,
            request.inventory_id,
            request.container_tag_id,
            request.ocr_container_no,
            request.gps_latitude,
            request.gps_longitude,
            request.device_id,
            request.packet_type,
            request.container_trans_type,
            _normalize_datetime(request.transaction_date),
        )

        response = db.execute_query(query, params, commit=True)
        if response.get("status") == "success":
            return {"status": "success", "message": "Equipment transaction added successfully", "data": response}
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.post("/update-equipment-transaction")
def update_equipment_transaction(request: EquipmentTransactionUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = "EXEC dbo.SP_MOVEMENT_TRANSACTION_UPDATE ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        params = (
            request.transaction_id,
            current_user["plant_id"],
            request.location_id,
            request.inventory_id,
            request.container_tag_id,
            request.ocr_container_no,
            request.gps_latitude,
            request.gps_longitude,
            request.device_id,
            request.packet_type,
            request.container_trans_type,
            _normalize_datetime(request.transaction_date),
        )

        response = db.execute_query(query, params, commit=True)
        if response.get("status") == "success":
            return {"status": "success", "message": "Equipment transaction updated successfully", "data": response}
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_transaction_router.post("/delete-equipment-transaction")
def delete_equipment_transaction(request: EquipmentTransactionDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = "EXEC dbo.SP_MOVEMENT_TRANSACTION_DELETE ?, ?"
        params = (request.transaction_id, current_user["plant_id"])

        response = db.execute_query(query, params, commit=True)
        if response.get("status") == "success":
            return {"status": "success", "message": "Equipment transaction deleted successfully", "data": response}
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
