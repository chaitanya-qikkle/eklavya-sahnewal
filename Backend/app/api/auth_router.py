"""
Auth API router — login, user management, roles, menus.

Each endpoint:
  1. Receives HTTP request
  2. Builds a service instance (with its repository injected)
  3. Delegates to service
  4. Returns the result

No SQL, no business logic here.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Request

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.auth_repository import AuthRepository
from app.services.auth_service import AuthService
from app.schemas.auth import (
    LoginRequest,
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
)
from middleware.rate_limiter import limiter, LOGIN_RATE_LIMIT_PER_MINUTE

router = APIRouter(prefix="/auth", tags=["Auth"])


def _service() -> AuthService:
    """Build AuthService with a fresh SQLManager for each request."""
    db = SQLManager()
    return AuthService(AuthRepository(db))


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit(f"{LOGIN_RATE_LIMIT_PER_MINUTE}/minute")
async def login(request: Request, body: LoginRequest):
    svc = _service()
    try:
        result = svc.login(body)
        return {
            "status":       "success",
            "message":      "Login successful",
            "access_token":  result.access_token,
            "refresh_token": result.refresh_token,
            "token_type":    result.token_type,
            "user_details":  result.user_details.model_dump(),
        }
    finally:
        svc.repo.db.close()


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/get-users")
def get_users(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_users()
    finally:
        svc.repo.db.close()


@router.post("/create-user-sp")
def create_user(body: UserCreateRequest):
    svc = _service()
    try:
        return svc.create_user(body)
    finally:
        svc.repo.db.close()


@router.post("/update-user")
def update_user(body: UserUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_user(body)
    finally:
        svc.repo.db.close()


@router.post("/delete-user")
def delete_user(body: UserDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_user(body)
    finally:
        svc.repo.db.close()


# ── Roles ─────────────────────────────────────────────────────────────────────

@router.get("/get-roles")
def get_roles(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_roles()
    finally:
        svc.repo.db.close()


@router.post("/create-role")
def create_role(body: RoleCreateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.create_role(body)
    finally:
        svc.repo.db.close()


@router.post("/update-role")
def update_role(body: RoleUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_role(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


@router.post("/delete-role")
def delete_role(body: RoleDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_role(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


# ── Menus ─────────────────────────────────────────────────────────────────────

@router.get("/menus/get-menus")
def get_menus():
    svc = _service()
    try:
        return svc.get_menus()
    finally:
        svc.repo.db.close()


@router.post("/menus/create-menu")
def create_menu(body: MenuCreateRequest):
    svc = _service()
    try:
        return svc.create_menu(body)
    finally:
        svc.repo.db.close()


@router.post("/menus/update-menu")
def update_menu(body: MenuUpdateRequest):
    svc = _service()
    try:
        return svc.update_menu(body)
    finally:
        svc.repo.db.close()


@router.post("/menus/delete-menu")
def delete_menu(body: MenuDeleteRequest):
    svc = _service()
    try:
        return svc.delete_menu(body)
    finally:
        svc.repo.db.close()


@router.post("/menus/set-role-menus")
def set_role_menus(body: RoleMenuSetRequest):
    svc = _service()
    try:
        return svc.set_role_menus(body)
    finally:
        svc.repo.db.close()


@router.get("/menus/get-role-menus")
def get_role_menus(role_id: int):
    svc = _service()
    try:
        return svc.get_role_menus(role_id)
    finally:
        svc.repo.db.close()
