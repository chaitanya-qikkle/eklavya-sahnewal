from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from models.master_model import LineAddRequest, LineUpdateRequest,LineDeleteRequest
from middleware.auth_middleware import get_current_user


line_router = APIRouter()

@line_router.post("/add-line")
def add_line(request: LineAddRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_LINE_ADD ?, ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.line_code,
            request.line_name,
            request.contact_person,
            request.contact_no,
            request.email_id,
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


@line_router.get("/get-line")
def get_line(line_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_LINE_GET ?, ?"
        
        params = (line_id, current_user["plant_id"])
        
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


@line_router.post("/update-line")
def update_line(request: LineUpdateRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_LINE_MODIFY ?, ?, ?, ?, ?, ?, ?, ?, ?"
        
        params = (
            request.line_id,
            request.line_code,
            request.line_name,
            request.contact_person,
            request.contact_no,
            request.email_id,
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


@line_router.post("/delete-line")
def delete_line(request: LineDeleteRequest, current_user: dict = Depends(get_current_user)):
    
    db = SQLManager()
    
    try:
        query = "EXEC SP_LINE_DELETE ?, ?, ?"
        
        params = (
            request.line_id,
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
