from models.master_model import YardAddRequest, YardUpdateRequest, YardDeleteRequest
from utils.db_utils import SQLManager
from fastapi import APIRouter, Depends
from typing import Optional
from middleware.auth_middleware import get_current_user

yard_router = APIRouter()


@yard_router.post("/add-yard")
def add_yard(request: YardAddRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    sql = "EXEC dbo.ESS_MST_YARD_INSERT @PlantID=?, @YardName=?, @YardCode=?, @YardTypeID=?, @LatLong=?, @Polygon=?, @IsActive=?, @CreatedBy=?"
    params = (
        current_user["plant_id"],
        request.YardName,
        request.YardCode,
        request.YardTypeID,
        None,
        None,
        request.IsActive,
        current_user["user_id"],
    )
    response = db.execute_query(sql, params=params, fetch_all=True, commit=True)
    db.close_connection()
    return response


@yard_router.get("/get-YardById")
def get_yard(YardID: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    sql = "EXEC dbo.ESS_MST_YARD_GET @YardID=?, @PlantID=?"
    params = (YardID, current_user["plant_id"])
    response = db.execute_query(sql, params=params, fetch_all=True)
    db.close_connection()
    return response


@yard_router.post("/update-yard")
def update_yard(request: YardUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    sql = "EXEC dbo.ESS_MST_YARD_UPDATE @YardID=?, @PlantID=?, @YardName=?, @YardCode=?, @YardTypeID=?, @LatLong=?, @Polygon=?, @IsActive=?, @ModifiedBy=?"
    params = (
        request.YardID,
        current_user["plant_id"],
        request.YardName,
        request.YardCode,
        request.YardTypeID,
        None,
        None,
        request.IsActive,
        current_user["user_id"],
    )
    response = db.execute_query(sql, params=params, fetch_all=True, commit=True)
    db.close_connection()
    return response


@yard_router.delete("/delete-yard")
def delete_yard(request: YardDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    sql = "EXEC dbo.ESS_MST_YARD_DELETE @YardID=?, @DeletedBy=?, @PlantID=?"
    params = (
        request.YardID,
        current_user["user_id"],
        current_user["plant_id"],
    )
    response = db.execute_query(sql, params=params, fetch_all=True, commit=True)
    db.close_connection()
    return response


# ──────────────────────────────────────────────────────────────────────────────
# MASTER-LISTS endpoint  →  returns Yards + Plants + saved Blocks in one shot
# ──────────────────────────────────────────────────────────────────────────────

@yard_router.get("/master-lists")
def get_master_lists(current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        sp_res = db.execute_query(
            "EXEC dbo.SP_MASTER_YARD_MASTER_LISTS ?",
            params=(current_user["plant_id"],),
            fetch_all=True,
        )
        result_sets = sp_res.get("data") or []
        yards = result_sets[0] if len(result_sets) > 0 else []
        plants = result_sets[1] if len(result_sets) > 1 else []
        blocks = result_sets[2] if len(result_sets) > 2 else []
    finally:
        db.close_connection()

    return {
        "status": "success",
        "data": {
            "yards":  yards,
            "plants": plants,
            "blocks": blocks,
        },
    }


@yard_router.get("/get-slot-list")
def get_slot_list(current_user: dict = Depends(get_current_user)):
    """
    All georeferenced yard slots (SlotID, BlockName, Row, Column, LatLong polygon)
    for the 3D yard view — GET_ESS_MST_SLOT_LIST.
    """
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.GET_ESS_MST_SLOT_LIST ?",
            params=(current_user["plant_id"],),
            fetch_all=True,
        )
        if response.get("status") != "success":
            return response

        data = response.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]

        return {"status": "success", "total_records": len(data), "data": data}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
