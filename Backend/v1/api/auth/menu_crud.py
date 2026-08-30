from fastapi import APIRouter, Depends
import logging
from datetime import datetime

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


def _exec_with_output(db: SQLManager, query: str, params: tuple) -> int:
    """Execute SP with OUTPUT param, return the issuccess int value."""
    conn = db.conn
    cursor = conn.cursor()
    cursor.execute(query, params)
    result = 0
    while True:
        try:
            if cursor.description:
                row = cursor.fetchone()
                if row is not None:
                    result = int(row[0])
                    break
        except Exception:
            pass
        try:
            if not cursor.nextset():
                break
        except Exception:
            break
    conn.commit()
    cursor.close()
    return result


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
        created_by = request.created_by or str(current_user.get("user_id", ""))
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.INS_IND_MST_MENU ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        params = (
            0,  # @MenuID — SP ignores this on insert (identity column)
            request.menu_name,
            request.parent_menu_id or 0,
            request.plant_id or 1,
            request.menu_url or '',
            request.menu_icon or '',
            request.area or '',
            request.controller or '',
            request.action_result or '',
            created_by,
        )
        result = _exec_with_output(db, query, params)
        if result == 1:
            return {"status": "success", "message": "Menu created successfully"}
        return {"status": "error", "message": "Failed to create menu"}

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/update-menu")
def update_menu(request: MenuUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        modified_by = request.modified_by or str(current_user.get("user_id", ""))
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.UPD_IND_MST_MENU ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        params = (
            request.menu_id,
            request.menu_name,
            request.parent_menu_id or 0,
            request.plant_id or 1,
            request.menu_url or '',
            request.menu_icon or '',
            request.area or '',
            request.controller or '',
            request.action_result or '',
            modified_by,
        )
        result = _exec_with_output(db, query, params)
        if result == 1:
            return {"status": "success", "message": "Menu updated successfully"}
        return {"status": "error", "message": "Failed to update menu"}

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/delete-menu")
def delete_menu(request: MenuDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()

    try:
        deleted_by = request.deleted_by or str(current_user.get("user_id", ""))
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.DEL_IND_MST_MENU ?, '', 0, 1, '', '', '', '', '', ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        result = _exec_with_output(db, query, (request.menu_id, deleted_by))
        if result == 1:
            return {"status": "success", "message": "Menu deleted successfully"}
        return {"status": "error", "message": "Failed to delete menu"}

    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@menu_router.post("/set-role-menus")
def set_role_menus(request: RoleMenuSetRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        role_id = request.role_id
        menu_ids = [int(mid) for mid in (request.menu_ids or []) if mid]
        created_by = request.created_by or "00000000-0000-0000-0000-000000000000"
        now = datetime.now()

        # sp_BulkInsertRoleMenu takes @RoleID and a RoleMenu-typed table parameter
        # (RoleID, MenuID, CreatedBy, CreatedDate) — pyodbc passes TVPs as a list of tuples.
        tvp_rows = [(role_id, mid, created_by, now) for mid in menu_ids]

        cursor = db.conn.cursor()
        cursor.execute("{CALL sp_BulkInsertRoleMenu (?, ?)}", role_id, tvp_rows)
        while cursor.description is None:
            if not cursor.nextset():
                break
        db.conn.commit()
        cursor.close()

        return {"status": "success", "message": f"Saved {len(menu_ids)} menu permissions"}

    except Exception as e:
        if db.conn:
            db.conn.rollback()
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
