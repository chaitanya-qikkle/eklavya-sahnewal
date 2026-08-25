"""
Auth service — business logic for login, user management, roles, and menus.

Rules:
  - Calls AuthRepository for DB access
  - Raises HTTPException on business-rule failures
  - Returns plain dicts/objects (never FastAPI response objects)
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

        if user_data.get("STATUS") == "Failure":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=user_data.get("MSG", "Login failed"))

        user_id  = user_data.get("USER_ID")
        plant_id = user_data.get("PLANT_ID")

        if plant_id is None:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Plant assignment missing for authenticated user",
            )

        role_name = user_data.get("ROLE") or user_data.get("ROLE_NAME") or "User"

        return LoginResponse(
            access_token=create_access_token(
                user_id=int(user_id),
                username=request.username,
                plant_id=int(plant_id),
            ),
            refresh_token=create_refresh_token(user_id=int(user_id)),
            token_type="bearer",
            user_details=UserDetails(
                user_id=int(user_id),
                username=request.username,
                first_name=user_data.get("FIRST_NAME", ""),
                last_name=user_data.get("LAST_NAME", ""),
                email=user_data.get("EMAIL_ID", ""),
                role_id=int(user_data.get("ROLE_ID", 0)),
                role=role_name,
                plant_id=int(plant_id),
            ),
        )

    # ── Users ─────────────────────────────────────────────────────────────────

    def get_users(self) -> dict:
        return self.repo.get_users()

    def create_user(self, request: UserCreateRequest) -> dict:
        result = self.repo.create_user(
            request.role_id, request.first_name, request.last_name,
            request.username, request.password, str(request.email_id), request.created_by,
        )
        return self._unwrap_sp_status(result, "User created successfully")

    def update_user(self, request: UserUpdateRequest) -> dict:
        result = self.repo.update_user(
            request.user_id, request.role_id, request.first_name, request.last_name,
            request.username, request.password or None, str(request.email_id),
            request.is_active, request.modified_by,
        )
        return self._unwrap_sp_status(result, "User updated successfully")

    def delete_user(self, request: UserDeleteRequest) -> dict:
        result = self.repo.delete_user(request.user_id, request.deleted_by)
        return self._unwrap_sp_status(result, "User deleted successfully")

    # ── Roles ─────────────────────────────────────────────────────────────────

    def get_roles(self) -> dict:
        return self.repo.get_roles()

    def create_role(self, request: RoleCreateRequest) -> dict:
        result = self.repo.create_role(request.role, request.plant_id, request.created_by)
        return self._unwrap_sp_status(result, "Role created successfully")

    def update_role(self, request: RoleUpdateRequest, modified_by: int) -> dict:
        result = self.repo.update_role(request.role_id, request.role, request.plant_id, modified_by)
        return self._unwrap_sp_status(result, "Role updated successfully")

    def delete_role(self, request: RoleDeleteRequest, deleted_by: int) -> dict:
        result = self.repo.delete_role(request.role_id, deleted_by)
        return self._unwrap_sp_status(result, "Role deleted successfully")

    # ── Menus ─────────────────────────────────────────────────────────────────

    def get_menus(self) -> dict:
        return self.repo.get_menus()

    def create_menu(self, request: MenuCreateRequest) -> dict:
        result = self.repo.create_menu(
            request.menu_name, request.parent_menu_id, request.menu_url,
            request.menu_icon, request.area, request.controller,
            request.action_result, request.plant_name, request.sort_order, request.created_by,
        )
        return self._unwrap_sp_status(result, "Menu created successfully")

    def update_menu(self, request: MenuUpdateRequest) -> dict:
        result = self.repo.update_menu(
            request.menu_id, request.menu_name, request.parent_menu_id, request.menu_url,
            request.menu_icon, request.area, request.controller, request.action_result,
            request.plant_name, request.sort_order, request.is_active, request.modified_by,
        )
        return self._unwrap_sp_status(result, "Menu updated successfully")

    def delete_menu(self, request: MenuDeleteRequest) -> dict:
        result = self.repo.delete_menu(request.menu_id, request.deleted_by)
        return self._unwrap_sp_status(result, "Menu deleted successfully")

    def set_role_menus(self, request: RoleMenuSetRequest) -> dict:
        csv = ",".join(str(mid) for mid in (request.menu_ids or []))
        result = self.repo.set_role_menus(request.role_id, csv, request.created_by)
        return self._unwrap_sp_status(result, "Role menus updated successfully")

    def get_role_menus(self, role_id: int) -> dict:
        return self.repo.get_role_menus(role_id)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _unwrap_sp_status(result: dict, default_message: str) -> dict:
        """Normalize SP responses that return STATUS/ERRORMSG or Status/Message."""
        if result.get("status") != "success":
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("message", "Database error"),
            )
        data = result.get("data") or []
        if data:
            row = data[0]
            if row.get("STATUS") == "Failure" or row.get("Status") == 0:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail=row.get("MSG") or row.get("Message") or row.get("ERRORMSG", "Operation failed"),
                )
        return {
            "status":  "success",
            "message": default_message,
            "data":    data,
        }
