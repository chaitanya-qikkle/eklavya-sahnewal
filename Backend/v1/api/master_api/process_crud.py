from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import ProcessAddRequest,ProcessUpdateRequest,ProcessDeleteRequest
from middleware.auth_middleware import get_current_user


process_router = APIRouter()


@process_router.post("/add-process")
def add_process(request: ProcessAddRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_PROCESS_ADD ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.process_code,
            request.process_name,
            request.process_category,
            request.sort_order,
            getattr(request, "is_active", True),
            current_user["user_id"],
            current_user["plant_id"]
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            
            sp_result = response["data"][0] 
            
            if sp_result.get("Status") == 0:
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

@process_router.get("/get-process")
def get_process(process_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_PROCESS_GET ?, ?"
        
        params = (process_id, current_user["plant_id"])
        
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

@process_router.post("/update-process")
def update_process(request: ProcessUpdateRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_PROCESS_MODIFY ?, ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.process_id,
            request.process_code,
            request.process_name,
            request.process_category,
            request.sort_order,
            request.is_active,
            current_user["user_id"],
            current_user["plant_id"]
        )
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            
            sp_result = response["data"][0] 
            
            if sp_result.get("Status") == 0:
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

@process_router.post("/delete-process")
def delete_process(request: ProcessDeleteRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_PROCESS_DELETE ?, ?, ?"
        
        params = (request.process_id, current_user["user_id"], current_user["plant_id"])
        
        response = db.execute_query(query, params, commit=True)
        
        if response.get("status") == "success" and response.get("data"):
            
            sp_result = response["data"][0] 
            
            if sp_result.get("Status") == 0:
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
