from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
import json

from middleware.auth_middleware import get_current_user
from models.master_model import BlockAddRequest, BlockUpdateRequest, BlockDeleteRequest
from utils.db_utils import SQLManager

block_router = APIRouter()


@block_router.post("/add-block")
def add_block(request: BlockAddRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        polygon_json = json.dumps(request.Polygon) if request.Polygon else None
        sql = "EXEC ESS_MST_BLOCK_INSERT @YardID=?, @PlantID=?, @BlockName=?, @BlockCode=?, @RowStart=?, @RowEnd=?, @TotalColumns=?, @Polygon=?, @IsActive=?, @CreatedBy=?"
        params = (
            request.YardID,
            current_user["plant_id"],
            request.BlockName,
            request.BlockCode,
            request.RowStart,
            request.RowEnd,
            request.TotalColumns,
            polygon_json,
            request.IsActive,
            current_user["user_id"],
        )
        response = db.execute_query(sql, params=params, fetch_all=True, commit=True)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close_connection()


@block_router.get("/get-blocks")
def get_blocks(YardID: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        sql = "EXEC ESS_MST_BLOCK_GET @YardID=?, @PlantID=?"
        response = db.execute_query(sql, params=(YardID, current_user["plant_id"]), fetch_all=True)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close_connection()


@block_router.post("/update-block")
def update_block(request: BlockUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        polygon_json = json.dumps(request.Polygon) if request.Polygon else None
        sql = "EXEC ESS_MST_BLOCK_UPDATE @BlockID=?, @YardID=?, @PlantID=?, @BlockName=?, @BlockCode=?, @RowStart=?, @RowEnd=?, @TotalColumns=?, @Polygon=?, @IsActive=?, @ModifiedBy=?"
        params = (
            request.BlockID,
            request.YardID,
            current_user["plant_id"],
            request.BlockName,
            request.BlockCode,
            request.RowStart,
            request.RowEnd,
            request.TotalColumns,
            polygon_json,
            request.IsActive,
            current_user["user_id"],
        )
        response = db.execute_query(sql, params=params, fetch_all=True, commit=True)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close_connection()


@block_router.post("/delete-block")
def delete_block(request: BlockDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        sql = "EXEC ESS_MST_BLOCK_DELETE @BlockID=?, @DeletedBy=?, @PlantID=?"
        params = (request.BlockID, current_user["user_id"], current_user["plant_id"])
        response = db.execute_query(sql, params=params, fetch_all=True, commit=True)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close_connection()
