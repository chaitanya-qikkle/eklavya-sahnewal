from fastapi import APIRouter, Depends
import pyodbc
import logging
from utils.db_utils import SQLManager
from models.user_model import UserCreateRequest, UserDeleteRequest, UserUpdateRequest, UserUpdatePasswordRequest
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
user_router = APIRouter()


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


@user_router.post("/create-user-sp")
def create_user_sp(user: UserCreateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        chk = db.execute_query(
            "SELECT COUNT(*) AS cnt FROM IND_MST_USER WHERE UserName = ? AND (IsDelete = 0 OR IsDelete IS NULL)",
            (user.username,)
        )
        chk_data = chk.get("data") or []
        if chk_data and chk_data[0].get("cnt", 0) > 0:
            return {"status": "error", "message": "Username already exists"}

        logger.info(f"Creating user: username={user.username}, role={user.role_id}, by={current_user.get('user_id')}")
        response = db.execute_query(
            """
            INSERT INTO IND_MST_USER
                (UserID, RoleID, PlantID, ClientID, FName, LName, UserName, Password, EmailId, CreatedDate, IsDelete)
            VALUES
                (NEWID(), ?, 1, 1, ?, ?, ?, ?, ?, GETDATE(), 0)
            """,
            (
                user.role_id,
                user.first_name,
                user.last_name,
                user.username,
                user.password,
                str(user.email_id),
            ),
            commit=True,
        )

        if response.get("status") == "success":
            return {"status": "success", "message": "User created successfully"}
        return {"status": "error", "message": response.get("message", "Failed to create user")}

    except Exception as e:
        logger.error(f"create-user error: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}

    finally:
        db.close_connection()


@user_router.get("/get-users")
def get_users(current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        response = db.execute_query("""
            SELECT U.UserID, U.RoleID, R.RoleName, U.PlantID, U.ClientID,
                   U.FName, U.LName, U.UserName, U.EmailId
            FROM IND_MST_USER U
            LEFT JOIN IND_MST_ROLE R ON R.RoleID = U.RoleID
            WHERE U.IsDelete = 0 OR U.IsDelete IS NULL
        """)
        return response
    except Exception as e:
        logger.error(f"get-users error: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@user_router.post("/delete-user")
def delete_user(request: UserDeleteRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.DEL_IND_MST_USER ?, 0, 0, 0, '', '', '', '', '', ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        result = _exec_with_output(db, query, (request.user_id, request.deleted_by or request.user_id))
        if result == 1:
            return {"status": "success", "message": "User deleted successfully"}
        return {"status": "error", "message": "Delete failed"}
    except Exception as e:
        logger.error(f"delete-user error: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@user_router.post("/update-user")
def update_user(request: UserUpdateRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        password_param = request.password if request.password else ''
        created_by = request.created_by or request.user_id

        query = """
            DECLARE @issuccess INT = 0;
            EXEC dbo.UPD_IND_MST_USER ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @issuccess OUTPUT;
            SELECT @issuccess AS result;
        """
        params = (
            request.user_id,
            request.role_id,
            request.plant_id,
            request.client_id,
            request.first_name,
            request.last_name,
            request.username,
            password_param,
            str(request.email_id),
            created_by,
        )
        result = _exec_with_output(db, query, params)
        if result == 1:
            return {"status": "success", "message": "User updated successfully"}
        return {"status": "error", "message": "Update failed"}
    except Exception as e:
        logger.error(f"update-user error: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@user_router.post("/update-user-password")
def update_user_password(request: UserUpdatePasswordRequest, current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        query = """
            DECLARE @IsSuccess INT = 0;
            EXEC dbo.UPD_IND_MST_USER_PASSWORD ?, ?, @IsSuccess OUTPUT;
            SELECT @IsSuccess AS result;
        """
        result = _exec_with_output(db, query, (request.user_id, request.password))
        if result == 1:
            return {"status": "success", "message": "Password updated successfully"}
        return {"status": "error", "message": "Password update failed"}
    except Exception as e:
        logger.error(f"update-user-password error: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
