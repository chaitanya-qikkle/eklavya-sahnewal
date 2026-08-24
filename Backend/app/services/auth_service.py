"""
Auth service — business logic for login, user management, roles, and menus.

Rules:
  - Calls AuthRepository for DB access
  - Raises HTTPException on business-rule failures
  - Returns plain dicts/objects (never FastAPI response objects)

created_by/modified_by/deleted_by fall back to the acting user's own GUID
(current_user["user_id"]) when the caller doesn't supply one explicitly.
"""
from typing import Optional

from fastapi import HTTPException, status

from app.core.security import create_access_token, create_refresh_token
from app.repositories.auth_repository import AuthRepository
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MenuCreateRequest,
    MenuDeleteRequest,
    MenuUpdateRequest,
    RoleCreateRequest,
    RoleDeleteRequest,
    RoleMenuSetRequest,
    RoleUpdateRequest,
    UserCreateRequest,
    UserDeleteRequest,
    UserUpdatePasswordRequest,
    UserUpdateRequest,
    UserDetails,
)


class AuthService:
    def __init__(self, repo: AuthRepository):
        self.repo = repo

    # ── Login ─────────────────────────────────────────────────────────────────

    def login(self, request: LoginRequest) -> LoginResponse:
        result = self.repo.login(request.username, request.password)

        if result.get("status") == "error":
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=result.get("message", "Database unavailable"),
            )

        data = result.get("data") or []
        if not data:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        user_data = data[0]
        user_id  = str(user_data.get("UserID"))
        plant_id = user_data.get("PlantID")
        role_id  = user_data.get("RoleID")

        if plant_id is None:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Plant assignment missing for authenticated user",
            )

        role_name = "User"
        if role_id:
            role_result = self.repo.get_role_by_id(int(role_id))
            role_rows = role_result.get("data") or []
            if role_rows:
                role_name = role_rows[0].get("RoleName") or role_name

        try:
            self.repo.record_login_history(int(plant_id), user_id, "Login")
        except Exception:
            pass  # audit trail only — never block login on this

        return LoginResponse(
            access_token=create_access_token(
                user_id=user_id,
                username=request.username,
                plant_id=int(plant_id),
            ),
            refresh_token=create_refresh_token(user_id=user_id),
            token_type="bearer",
            user_details=UserDetails(
                user_id=user_id,
                username=request.username,
                first_name=user_data.get("FirstName", "") or "",
                last_name=user_data.get("LastName", "") or "",
                email=user_data.get("EmailId", "") or "",
                role_id=int(role_id or 0),
                role=role_name,
                plant_id=int(plant_id),
                client_id=user_data.get("ClientID"),
            ),
        )

    # ── Users ─────────────────────────────────────────────────────────────────

    def get_users(self) -> dict:
        return self.repo.get_users()

    def create_user(self, request: UserCreateRequest, current_user: dict) -> dict:
        result = self.repo.create_user(
            request.role_id,
            request.plant_id if request.plant_id is not None else current_user.get("plant_id"),
            request.client_id or 0,
            request.first_name, request.last_name,
            request.username, request.password, str(request.email_id),
            request.created_by or current_user["user_id"],
        )
        return self._unwrap_sp_status(result, "User created successfully")

    def update_user(self, request: UserUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_user(
            request.user_id, request.role_id,
            request.plant_id if request.plant_id is not None else current_user.get("plant_id"),
            request.client_id or 0,
            request.first_name, request.last_name,
            request.username, request.password or "", str(request.email_id),
            request.modified_by or current_user["user_id"],
        )
        return self._unwrap_sp_status(result, "User updated successfully")

    def update_user_password(self, request: UserUpdatePasswordRequest) -> dict:
        result = self.repo.update_user_password(request.user_id, request.password)
        return self._unwrap_sp_status(result, "Password updated successfully")

    def delete_user(self, request: UserDeleteRequest, current_user: dict) -> dict:
        result = self.repo.delete_user(request.user_id, request.deleted_by or current_user["user_id"])
        return self._unwrap_sp_status(result, "User deleted successfully")

    # ── Roles ─────────────────────────────────────────────────────────────────

    def get_roles(self) -> dict:
        return self.repo.get_roles()

    def create_role(self, request: RoleCreateRequest, current_user: dict) -> dict:
        result = self.repo.create_role(
            request.role,
            request.plant_id if request.plant_id is not None else current_user.get("plant_id"),
            request.created_by or current_user["user_id"],
        )
        return self._unwrap_sp_status(result, "Role created successfully")

    def update_role(self, request: RoleUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_role(
            request.role_id, request.role,
            request.plant_id if request.plant_id is not None else current_user.get("plant_id"),
            request.modified_by or current_user["user_id"],
        )
        return self._unwrap_sp_status(result, "Role updated successfully")

    def delete_role(self, request: RoleDeleteRequest, current_user: dict) -> dict:
        result = self.repo.delete_role(request.role_id, request.deleted_by or current_user["user_id"])
        return self._unwrap_sp_status(result, "Role deleted successfully")

    # ── Menus ─────────────────────────────────────────────────────────────────

    def get_menus(self, plant_id: Optional[int], current_user: dict) -> dict:
        return self.repo.get_menus(plant_id if plant_id is not None else current_user.get("plant_id"))

    def create_menu(self, request: MenuCreateRequest, current_user: dict) -> dict:
        result = self.repo.create_menu(
            request.menu_name, request.parent_menu_id, request.menu_url,
            request.menu_icon, request.area, request.controller, request.action_result,
            request.plant_id if request.plant_id is not None else current_user.get("plant_id"),
            request.created_by or current_user["user_id"],
        )
        return self._unwrap_sp_status(result, "Menu created successfully")

    def update_menu(self, request: MenuUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_menu(
            request.menu_id, request.menu_name, request.parent_menu_id, request.menu_url,
            request.menu_icon, request.area, request.controller, request.action_result,
            request.plant_id if request.plant_id is not None else current_user.get("plant_id"),
            request.modified_by or current_user["user_id"],
        )
        return self._unwrap_sp_status(result, "Menu updated successfully")

    def delete_menu(self, request: MenuDeleteRequest, current_user: dict) -> dict:
        result = self.repo.delete_menu(request.menu_id, request.deleted_by or current_user["user_id"])
        return self._unwrap_sp_status(result, "Menu deleted successfully")

    def set_role_menus(self, request: RoleMenuSetRequest, current_user: dict) -> dict:
        from datetime import datetime

        created_by = request.created_by or current_user["user_id"]
        now = datetime.now()
        rows = [(request.role_id, menu_id, created_by, now) for menu_id in (request.menu_ids or [])]
        result = self.repo.set_role_menus(request.role_id, rows)
        return self._unwrap_sp_status(result, "Role menus updated successfully")

    def get_role_menus(self, role_id: int) -> dict:
        parents = self.repo.get_role_parent_menus(role_id)
        children = self.repo.get_role_sub_menus(role_id)
        return {
            "status": "success",
            "data": {
                "parent_menus": parents.get("data") or [],
                "sub_menus": children.get("data") or [],
            },
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _unwrap_sp_status(result: dict, default_message: str) -> dict:
        """Normalize SP responses — the success flag comes back as a single-row
        result set under one of a few possible column names."""
        if result.get("status") != "success":
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("message", "Database error"),
            )
        data = result.get("data") or []
        if data:
            row = data[0]
            flag = row.get("result")
            if flag is None:
                flag = row.get("Result")
            if flag is None:
                flag = row.get("IsSuccess")
            if flag is None:
                flag = row.get("issuccess")
            if flag is not None and int(flag) != 1:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=default_message)
        return {
            "status":  "success",
            "message": default_message,
            "data":    data,
        }
