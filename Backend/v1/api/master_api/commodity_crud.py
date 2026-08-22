from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import CommodityAddRequest, CommodityDeleteRequest, CommodityUpdateRequest
from middleware.auth_middleware import get_current_user


commodity_router = APIRouter()

@commodity_router.post("/add-commodity")
def add_commodity(request: CommodityAddRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_COMMODITY_ADD ?, ?, ?, ?, ?, ?"
        
        params = (
            request.commodity_code,
            request.commodity_name,
            request.description,
            request.is_active,
            current_user["user_id"],
            current_user["plant_id"]
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            
            sp_result = response["data"][0] 
            
            if sp_result["Status"] == 0:
                return {
                    "status": "error", 
                    "message": sp_result["Message"]
                }
            else:
                return {
                    "status": "success", 
                    "message": sp_result["Message"],
                    "data": sp_result
                }
                
        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()

@commodity_router.get("/get-commodity")
def get_commodity(commodity_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_COMMODITY_GET ?, ?"
        
        params = (commodity_id, current_user["plant_id"])
        
        response = db.execute_query(query, params)
        
        if response.get("status") == "success" and response.get("data"):
            
            first_row = response["data"][0]
            
            if "Status" in first_row and first_row["Status"] == 0:
                return {
                    "status": "error", 
                    "message": first_row["Message"]
                }
            
            return response
            
        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()

@commodity_router.post("/update-commodity")
def update_commodity(request: CommodityUpdateRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_COMMODITY_MODIFY ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.commodity_id,
            request.commodity_code,
            request.commodity_name,
            request.description,
            request.is_active,
            current_user["user_id"],
            current_user["plant_id"]
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            
            sp_result = response["data"][0] 
            
            if sp_result["Status"] == 0:
                return {
                    "status": "error", 
                    "message": sp_result["Message"]
                }
            else:
                return {
                    "status": "success", 
                    "message": sp_result["Message"],
                    "data": sp_result
                }
                
        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()

@commodity_router.post("/delete-commodity")
def delete_commodity(request: CommodityDeleteRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_COMMODITY_DELETE ?, ?, ?"
        
        params = (
            request.commodity_id,
            current_user["user_id"],
            current_user["plant_id"]
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            
            sp_result = response["data"][0] 
            
            if sp_result["Status"] == 0:
                return {
                    "status": "error", 
                    "message": sp_result["Message"]
                }
            else:
                return {
                    "status": "success", 
                    "message": sp_result["Message"],
                    "data": sp_result
                }
                
        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()
