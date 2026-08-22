from fastapi import APIRouter, Depends
from middleware.auth_middleware import get_current_user
from utils.db_utils import SQLManager
from models.user_model import RoleCreateRequest, RoleUpdateRequest, RoleDeleteRequest
import logging

logger = logging.getLogger(__name__)
role_router = APIRouter()



@role_router.get("/get-roles")
def get_roles(current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        response = db.execute_query("EXEC dbo.GET_IND_MST_ROLE")
        if response.get("status") == "success" and response.get("data"):
            response["data"] = [
                {
                    "ROLE_ID":  row["RoleID"],
                    "ROLE":     row["RoleName"],
                    "PLANT_ID": row.get("PlantID"),
                }
                for row in response["data"]
            ]
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@role_router.post("/create-role")
def create_role(request: RoleCreateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        user_id = str(current_user.get("user_id", ""))
        response = db.execute_query(
            "EXEC dbo.INS_IND_MST_ROLE 0, ?, ?, ?",
            (request.role, request.plant_id or 1, user_id),
            commit=True,
        )
        if response.get("status") == "success":
            data = response.get("data") or []
            if data and data[0].get("result", 0) == 1:
                return {"status": "success", "message": "Role created successfully"}
            # No data returned but no error = success (rowcount path)
            if not data:
                return {"status": "success", "message": "Role created successfully"}
        return {"status": "error", "message": response.get("message", "Failed to create role")}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@role_router.post("/update-role")
def update_role(request: RoleUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        user_id = request.modified_by or request.created_by or str(current_user.get("user_id", ""))
        response = db.execute_query(
            "EXEC dbo.UPD_IND_MST_ROLE ?, ?, ?, ?",
            (request.role_id, request.role, request.plant_id or 1, user_id),
            commit=True,
        )
        if response.get("status") == "success":
            data = response.get("data") or []
            if data and data[0].get("result", 0) == 1:
                return {"status": "success", "message": "Role updated successfully"}
            if not data:
                return {"status": "success", "message": "Role updated successfully"}
        return {"status": "error", "message": response.get("message", "Failed to update role")}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@role_router.post("/delete-role")
def delete_role(request: RoleDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        user_id = request.deleted_by or str(current_user.get("user_id", ""))
        response = db.execute_query(
            "EXEC dbo.DEL_IND_MST_ROLE ?, '', 1, ?",
            (request.role_id, user_id),
            commit=True,
        )
        if response.get("status") == "success":
            data = response.get("data") or []
            if data and data[0].get("result", 0) == 1:
                return {"status": "success", "message": "Role deleted successfully"}
            if not data:
                return {"status": "success", "message": "Role deleted successfully"}
        return {"status": "error", "message": response.get("message", "Failed to delete role")}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
