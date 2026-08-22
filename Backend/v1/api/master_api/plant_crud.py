from fastapi import APIRouter, Depends, HTTPException, status
import logging

from middleware.auth_middleware import get_current_user
from models.master_model import PlantAddRequest, PlantDeleteRequest, PlantUpdateRequest
from utils.db_utils import SQLManager

logger = logging.getLogger(__name__)


plant_router = APIRouter()


def _unwrap_write_response(response: dict, default_message: str):
    if response.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=response.get("message", default_message),
        )

    # Check if SP returned an error result row (Status = 0)
    data = response.get("data")
    if data and isinstance(data, list) and len(data) > 0:
        first_row = data[0]
        if first_row.get("Status") == 0 or first_row.get("STATUS") == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=first_row.get("Message") or first_row.get("MESSAGE") or default_message,
            )

    return {
        "status": "success",
        "message": default_message,
        "data": data or {"rows_affected": response.get("rows_affected")},
    }


@plant_router.get("/get-plant")
def get_plants(plant_id: int | None = None, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = "EXEC dbo.SP_MASTER_PLANT_LIST ?, ?, ?, ?"
        params = (plant_id, 0, "PLANT_NAME", "ASC")
        response = db.execute_query(query, params)
        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server Error: {str(e)}",
        )

    finally:
        db.close_connection()


@plant_router.post("/add-plant")
def add_plant(request: PlantAddRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = """
        EXEC SP_SavePlant 
            @PlantID = NULL,
            @PlantCode = ?, 
            @PlantName = ?, 
            @Location = ?, 
            @ClientID = ?, 
            @IsActive = ?, 
            @UserID = ?
        """
        params = (
            request.plant_code,
            request.plant_name,
            request.location,
            request.client_id,
            int(bool(request.is_active)),
            current_user["user_id"],
        )
        logger.info("Adding plant: params=%s", params)
        response = db.execute_query(query, params, commit=True)
        logger.info("Add plant DB response: %s", response)
        return _unwrap_write_response(response, "Plant created successfully")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error adding plant: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server Error: {str(e)}",
        )

    finally:
        db.close_connection()


@plant_router.post("/update-plant")
def update_plant(request: PlantUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = """
        EXEC SP_SavePlant 
            @PlantID = ?,
            @PlantCode = ?, 
            @PlantName = ?, 
            @Location = ?, 
            @ClientID = ?, 
            @IsActive = ?, 
            @UserID = ?
        """
        params = (
            request.plant_id,
            request.plant_code,
            request.plant_name,
            request.location,
            request.client_id,
            int(bool(request.is_active)),
            current_user["user_id"],
        )
        response = db.execute_query(query, params, commit=True)
        return _unwrap_write_response(response, "Plant updated successfully")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server Error: {str(e)}",
        )

    finally:
        db.close_connection()


@plant_router.post("/delete-plant")
def delete_plant(request: PlantDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = "EXEC dbo.SP_MASTER_PLANT_DELETE ?, ?"
        params = (request.plant_id, current_user["user_id"])
        response = db.execute_query(query, params, commit=True)
        return _unwrap_write_response(response, "Plant deleted successfully")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server Error: {str(e)}",
        )

    finally:
        db.close_connection()
