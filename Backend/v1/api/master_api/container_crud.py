from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user

container_router = APIRouter()

@container_router.get("/search-container")
def search_container(term: str = "", current_user: dict = Depends(get_current_user)):
    """
    Search for container numbers in TBL_CONTAINER_INVENTORY.
    Returns a list of matching container numbers.
    """
    db = SQLManager()
    try:
        # Sanitize term
        search_term = str(term).strip().upper()
        
        query = "EXEC dbo.GET_ALL_YARDINVENTORY_LIST"
        response = db.execute_query(query)
        
        if response.get("status") == "success":
            data = response.get("data", [])
            # Filter in Python since the SP doesn't accept parameters
            if search_term:
                filtered_data = [
                    row for row in data 
                    if row.get("Cont_No") and search_term in str(row.get("Cont_No")).upper()
                ]
            else:
                filtered_data = data
            
            # Return top 20 matches to avoid overwhelming the frontend
            response["data"] = filtered_data[:20]
            
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
