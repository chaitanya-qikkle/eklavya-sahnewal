from fastapi import APIRouter, Depends
import logging

from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
from models.menu_model import (
    MenuCreateRequest,
    MenuUpdateRequest,
    MenuDeleteRequest,
    RoleMenuSetRequest,
)

menu_router = APIRouter()


def _unwrap_sp_status(response: dict):
    """Normalize SP responses that return STATUS/ERRORMSG."""
    if response.get("status") != "success" or not response.get("data"):
        return response

    sp_result = response["data"][0]
    status = sp_result.get("STATUS")

    if status == "Failure":
        return {"status": "error", "message": sp_result.get("ERRORMSG", "Operation failed")}

    if status == "Success":
        return {"status": "success", "message": sp_result.get("ERRORMSG", "Success"), "data": sp_result}

    # Unknown shape, return raw
    return response


@menu_router.get("/get-menus")
def get_menus(current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = """
            SELECT
                MenuID      AS MENU_ID,
                MenuName    AS MENU_NAME,
                ParentID    AS PARENT_MENU_ID,
                MenuUrl     AS MENU_URL,
                IsActive    AS IS_ACTIVE,
                IsDelete    AS IS_DELETED
            FROM IND_MST_MENU
            WHERE IsDelete = 0 OR IsDelete IS NULL
        """
        response = db.execute_query(query)
        return response

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/create-menu")
def create_menu(request: MenuCreateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = "EXEC dbo.SP_MENU_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        params = (
            request.menu_name,
            request.parent_menu_id,
            request.menu_url,
            request.menu_icon,
            request.area,
            request.controller,
            request.action_result,
            request.plant_name,
            request.sort_order,
            request.created_by,
        )

        response = db.execute_query(query, params, commit=True)
        return _unwrap_sp_status(response)

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/update-menu")
def update_menu(request: MenuUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = "EXEC dbo.SP_MENU_MODIFY ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?"
        params = (
            request.menu_id,
            request.menu_name,
            request.parent_menu_id,
            request.menu_url,
            request.menu_icon,
            request.area,
            request.controller,
            request.action_result,
            request.plant_name,
            request.sort_order,
            request.is_active,
            request.modified_by,
        )

        response = db.execute_query(query, params, commit=True)
        return _unwrap_sp_status(response)

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/delete-menu")
def delete_menu(request: MenuDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        query = "EXEC dbo.SP_MENU_DELETE ?, ?"
        params = (request.menu_id, request.deleted_by)

        response = db.execute_query(query, params, commit=True)
        return _unwrap_sp_status(response)

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/set-role-menus")
def set_role_menus(request: RoleMenuSetRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        role_id = request.role_id
        menu_ids = [str(int(mid)) for mid in (request.menu_ids or []) if mid]
        menu_ids_str = ",".join(menu_ids)

        created_by = request.created_by or "00000000-0000-0000-0000-000000000000"

        response = db.execute_query(
            "EXEC dbo.SP_SET_ROLE_MENUS ?, ?, ?",
            (role_id, menu_ids_str, created_by),
            commit=True,
        )

        data = response.get("data") or []
        if response.get("status") == "success":
            return {"status": "success", "message": f"Saved {len(menu_ids)} menu permissions"}
        return {"status": "error", "message": response.get("message", "Failed to save")}

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


# Usernames granted every active menu regardless of their role's actual mapping.
FULL_MENU_ACCESS_USERNAMES = {"skai"}


@menu_router.get("/get-role-menus")
def get_role_menus(role_id: str, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        try:
            rid = int(role_id)
        except (ValueError, TypeError):
            rid = role_id

        username = str(current_user.get("username") or "").strip().lower()
        if username in FULL_MENU_ACCESS_USERNAMES:
            query = """
                SELECT MenuID AS MENU_ID, MenuName AS MENU_NAME,
                       ParentID AS PARENT_MENU_ID, MenuUrl AS MENU_URL,
                       IsActive AS IS_ACTIVE
                FROM IND_MST_MENU
                WHERE (IsDelete = 0 OR IsDelete IS NULL)
                      AND (IsActive = 1 OR IsActive IS NULL)
            """
            response = db.execute_query(query)
            logger.info(f"get-role-menus: full-access override for username={username} → {len(response.get('data') or [])} menus")
            return response

        query = """
            SELECT m.MenuID AS MENU_ID, m.MenuName AS MENU_NAME,
                   m.ParentID AS PARENT_MENU_ID, m.MenuUrl AS MENU_URL,
                   m.IsActive AS IS_ACTIVE
            FROM IND_MST_ROLE_MENU rm
            JOIN IND_MST_MENU m ON m.MenuID = rm.MenuID
            WHERE rm.RoleID = ? AND (rm.IsDelete = 0 OR rm.IsDelete IS NULL)
                  AND (m.IsDelete = 0 OR m.IsDelete IS NULL)
        """
        response = db.execute_query(query, (rid,))
        logger.info(f"get-role-menus: role_id={role_id} → {len(response.get('data') or [])} menus")
        return response

    except Exception as e:
        logger.error(f"get-role-menus error: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()
