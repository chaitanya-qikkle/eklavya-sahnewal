from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import ContSizeAddRequest,ContSizeDeleteRequest,ContSizeUpdateRequest
from middleware.auth_middleware import get_current_user


cont_size_router = APIRouter()

@cont_size_router.post("/add-cont-size")
def add_cont_size(request: ContSizeAddRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_CONT_SIZE_ADD ?, ?, ?"
        
        params = (
            request.size_code,
            request.description,
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

@cont_size_router.get("/get-cont-size")
def get_cont_size(size_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_CONT_SIZE_GET ?, ?"
        
        params = (size_id, current_user["plant_id"])
        
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

@cont_size_router.post("/update-cont-size")
def update_cont_size(request: ContSizeUpdateRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_CONT_SIZE_MODIFY ?, ?, ?, ?"
        
        params = (
            request.size_id,
            request.size_code,
            request.description,
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

@cont_size_router.post("/delete-cont-size")
def delete_cont_size(request: ContSizeDeleteRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_CONT_SIZE_DELETE ?, ?"
        
        params = (request.size_id, current_user["plant_id"])
        
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
