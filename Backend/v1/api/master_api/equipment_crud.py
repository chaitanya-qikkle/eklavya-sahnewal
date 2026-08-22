from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import json
from utils.db_utils import SQLManager
from models.master_model import EquipmentAddRequest, EquipmentUpdateRequest, EquipmentDeleteRequest
from middleware.auth_middleware import get_current_user

equipment_router = APIRouter()


def _normalize_date(date_value: Optional[str]) -> Optional[str]: 
    if not date_value:
        return None
    # Accept "YYYY-MM-DD", "YYYY-MM-DDTHH:MM", "YYYY-MM-DD HH:MM:SS"; keep date part.
    return str(date_value).strip()[:10]

@equipment_router.post("/add-equipment")
def add_equipment(request: EquipmentAddRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        height_settings = request.height_settings or []
        height_settings_json = (
            json.dumps(
                [
                    {
                        "equipment_name": request.equipment_name,
                        "height": setting.height,
                        "min_value": setting.min_value,
                        "max_value": setting.max_value,
                    }
                    for setting in height_settings
                ]
            )
            if height_settings
            else None
        )

        query = "EXEC dbo.SP_EQUIPMENT_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            current_user["plant_id"], 
            request.equipment_name, 
            request.device_id,
            _normalize_date(request.installation_date), 
            request.owner_name,
            request.equipment_type, 
            request.equipment_maker, 
            request.sim_id,
            request.vtm_imei_no, 
            int(bool(request.job_allow)),
            int(bool(request.is_active)), 
            int(bool(request.is_remove_device)),
            int(bool(request.is_manual_breakdown)), 
            current_user["user_id"],
            height_settings_json,
        )
        
        response = db.execute_query(query, params, commit=True, fetch_all=True)
        
        if response.get("status") == "success" and response.get("data"):
            result_sets = response["data"]
            result = result_sets[0][0] if result_sets else {}
            
            if result.get("Status") == 1:
                return {
                    "status": "success",
                    "message": result.get("Message", "Equipment added successfully"),
                    "data": {
                        "equipment_id": result.get("EquipmentID"),
                        "equipment_name": request.equipment_name,
                        "height_settings_added": len(height_settings)
                    }
                }
            else:
                return {
                    "status": "error",
                    "message": result.get("Message", "Failed to add equipment")
                }
        
        return response

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
        height_settings = request.height_settings or []
        height_settings_json = (
            json.dumps(
                [
                    {
                        "equipment_name": request.equipment_name,
                        "height": setting.height,
                        "min_value": setting.min_value,
                        "max_value": setting.max_value,
                    }
                    for setting in height_settings
                ]
            )
            if height_settings
            else None
        )

        query = "EXEC dbo.SP_EQUIPMENT_UPDATE ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"

        params = (
            request.eqp_id,
            current_user["plant_id"],
            request.equipment_name,
            request.device_id,
            _normalize_date(request.installation_date),
            request.owner_name,
            request.equipment_type,
            request.equipment_maker,
            request.sim_id,
            request.vtm_imei_no,
            int(bool(request.job_allow)),
            int(bool(request.is_active)),
            int(bool(request.is_remove_device)),
            int(bool(request.is_manual_breakdown)),
            current_user["user_id"],
            height_settings_json,
        )

        response = db.execute_query(query, params, commit=True, fetch_all=True)

        if response.get("status") == "success" and response.get("data"):
            result_sets = response["data"]
            result = result_sets[0][0] if result_sets else {}

            if result.get("Status") == 1:
                return {
                    "status": "success",
                    "message": result.get("Message", "Equipment updated successfully"),
                    "data": {
                        "equipment_id": request.eqp_id,
                        "equipment_name": request.equipment_name,
                        "height_settings_updated": len(height_settings)
                    }
                }
            else:
                return {
                    "status": "error",
                    "message": result.get("Message", "Failed to update equipment")
                }

        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()

@equipment_router.post("/delete-equipment")
async def delete_equipment(request: EquipmentDeleteRequest, current_user: dict = Depends(get_current_user)):
    """
    Soft delete equipment by ID
    """
    sql_manager = SQLManager()
    
    try:
        # Execute the stored procedure with COMMIT enabled
        query = "EXEC dbo.TBL_MST_EQUIPMENT_DELETE @Equipment_ID = ?, @DeletedBy = ?, @Plant_ID = ?"
        params = (request.eqp_id, current_user["user_id"], current_user["plant_id"])
        
        response = sql_manager.execute_query(
            sql_query=query,
            params=params,
            fetch_all=True,
            commit=True,
        )
        if response['status'] == 'success':
            # Extract the result from stored procedure
            if response['data'] and len(response['data']) > 0:
                result = response['data'][0][0]  # First result set, first row
                
                if result.get('Status') == 1:
                    return {
                        "status": "success",
                        "message": result.get('Message', 'Equipment deleted successfully'),
                        "data": {
                            "eqp_id": request.eqp_id,
                            "deleted_by": current_user["user_id"]
                        }
                    }
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=result.get('Message', 'Failed to delete equipment')
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="No response from stored procedure"
                )
        else:
            raise HTTPException(
                status_code=500,
                detail=response.get('message', 'Database error occurred')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )
    finally:
        sql_manager.close_connection()
