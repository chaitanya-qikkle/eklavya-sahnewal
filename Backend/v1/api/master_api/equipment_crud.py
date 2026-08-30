from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import EquipmentAddRequest, EquipmentUpdateRequest, EquipmentDeleteRequest
from middleware.auth_middleware import get_current_user

equipment_router = APIRouter()


def _normalize_date(date_value: Optional[str]) -> Optional[str]:
    if not date_value:
        return None
    # Accept "YYYY-MM-DD", "YYYY-MM-DDTHH:MM", "YYYY-MM-DD HH:MM:SS"; keep date part.
    return str(date_value).strip()[:10]


def _exec_with_output(db: SQLManager, query: str, params: tuple) -> int:
    """Execute SP with OUTPUT param, return the issuccess int value."""
    conn = db.conn
    cursor = conn.cursor()
    cursor.execute(query, params)
    result = 0
    while True:
        try:
            if cursor.description:
                row = cursor.fetchone()
                if row is not None:
                    result = int(row[0])
                    break
        except Exception:
            pass
        try:
            if not cursor.nextset():
                break
        except Exception:
            break
    conn.commit()
    cursor.close()
    return result


@equipment_router.post("/add-equipment")
def add_equipment(request: EquipmentAddRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.INS_ESS_MST_EQUIPMENT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        params = (
            0,  # @EqpID — SP ignores this on insert (identity column)
            request.plant_id or current_user["plant_id"],
            request.equipment_code or '',
            request.equipment_name,
            request.device_id or '',
            _normalize_date(request.installation_date),
            request.owner_name or '',
            request.equipment_type or '',
            request.equipment_maker or '',
            request.sim_id or '',
            request.vtm_imei_no or '',
            int(bool(request.is_remove_device)),
            request.created_by or current_user["user_id"],
        )

        result = _exec_with_output(db, query, params)
        if result == 1:
            return {
                "status": "success",
                "message": "Equipment added successfully",
                "data": {"equipment_name": request.equipment_name},
            }
        return {"status": "error", "message": "Failed to add equipment"}

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()

@equipment_router.get("/get-equipment")
def get_equipment(equipment_id: Optional[int] = None, _: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        if equipment_id:
            query = "SELECT * FROM ESS_MST_EQUIPMENT WHERE ISNULL(IsDelete,0)=0 AND EqpID=?"
            params = (equipment_id,)
        else:
            query = "SELECT * FROM ESS_MST_EQUIPMENT WHERE ISNULL(IsDelete,0)=0 ORDER BY EqpID"
            params = ()

        response = db.execute_query(query, params, fetch_all=True)

        if response.get("status") == "success":
            data = response.get("data") or []
            if isinstance(data, list) and data and isinstance(data[0], list):
                data = data[0]

            for row in data:
                if "EqpID" in row and "Eqp_ID" not in row:
                    row["Eqp_ID"] = row["EqpID"]
                if "DeviceID" in row and "Device_ID" not in row:
                    row["Device_ID"] = row["DeviceID"]
                row["Status"] = "Active" if row.get("IsActive") else "Inactive"

            if equipment_id:
                if data:
                    return {"status": "success", "message": "Equipment retrieved successfully", "data": data[0]}
                return {"status": "error", "message": "Equipment not found"}

            return {
                "status": "success",
                "message": f"{len(data)} equipment(s) retrieved successfully",
                "data": data,
            }

        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_router.get("/get-current-equipment-status")
def get_current_equipment_status(current_user: dict = Depends(get_current_user)):
    """Return live equipment status (Speed, TAT, Location, Status, Lat/Long) via GET_CURRENTEQUIPMENT_STATUS SP."""
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.GET_CURRENTEQUIPMENT_STATUS ?",
            (current_user["plant_id"],),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@equipment_router.post("/update-equipment")
def update_equipment(request: EquipmentUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.UPD_ESS_MST_EQUIPMENT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        params = (
            request.eqp_id,
            request.plant_id or current_user["plant_id"],
            request.equipment_code or '',
            request.equipment_name,
            request.device_id or '',
            _normalize_date(request.installation_date),
            request.owner_name or '',
            request.equipment_type or '',
            request.equipment_maker or '',
            request.sim_id or '',
            request.vtm_imei_no or '',
            int(bool(request.is_remove_device)),
            request.modified_by or current_user["user_id"],
        )

        result = _exec_with_output(db, query, params)
        if result == 1:
            return {
                "status": "success",
                "message": "Equipment updated successfully",
                "data": {"equipment_id": request.eqp_id, "equipment_name": request.equipment_name},
            }
        return {"status": "error", "message": "Failed to update equipment"}

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()

@equipment_router.post("/delete-equipment")
async def delete_equipment(request: EquipmentDeleteRequest, current_user: dict = Depends(get_current_user)):
    """
    Soft delete equipment by ID
    """
    db = SQLManager()

    try:
        deleted_by = request.modified_by or current_user["user_id"]
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.DEL_ESS_MST_EQUIPMENT ?, 0, '', '', '', NULL, '', '', '', '', '', 0, ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        result = _exec_with_output(db, query, (request.eqp_id, deleted_by))

        if result == 1:
            return {
                "status": "success",
                "message": "Equipment deleted successfully",
                "data": {"eqp_id": request.eqp_id, "deleted_by": deleted_by},
            }
        raise HTTPException(status_code=400, detail="Failed to delete equipment")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )
    finally:
        db.close_connection()
