from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import ActivityAddRequest,ActivityDeleteRequest,ActivityUpdateRequest
from middleware.auth_middleware import get_current_user

activity_router = APIRouter()

@activity_router.post("/add-activity")
def add_activity(request: ActivityAddRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_ACTIVITY_ADD ?, ?"
        
        params = (request.activity_name, current_user["plant_id"])
        
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



@activity_router.get("/get-activity")
def get_activity(activity_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_ACTIVITY_GET ?, ?"
        
        params = (activity_id, current_user["plant_id"])
        
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

@activity_router.post("/update-activity")
def update_activity(request: ActivityUpdateRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_ACTIVITY_MODIFY ?, ?, ?, ?"
        
        params = (
            request.activity_id,
            request.activity_name,
            request.is_active,
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

@activity_router.post("/delete-activity")
def delete_activity(request: ActivityDeleteRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_ACTIVITY_DELETE ?, ?"
        
        params = (request.activity_id, current_user["plant_id"])
        
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
