"""
Auth API router — login, user management, roles.

Menu and role-menu endpoints live in app/api/menu_router.py (mounted at
/v1/menu, matching what the frontend already calls) rather than nested
under /auth/menus/* here.

Each endpoint:
  1. Receives HTTP request
  2. Builds a service instance (with its repository injected)
  3. Delegates to service
  4. Returns the result

No SQL, no business logic here.
"""
from fastapi import APIRouter, Depends, Request

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.auth_repository import AuthRepository
from app.services.auth_service import AuthService
from app.schemas.auth import (
    LoginRequest,
    RoleCreateRequest,
    RoleDeleteRequest,
    RoleUpdateRequest,
    UserCreateRequest,
    UserDeleteRequest,
    UserUpdatePasswordRequest,
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
def create_user(body: UserCreateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.create_user(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/update-user")
def update_user(body: UserUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_user(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/update-user-password")
def update_user_password(body: UserUpdatePasswordRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_user_password(body)
    finally:
        svc.repo.db.close()


@router.post("/delete-user")
def delete_user(body: UserDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_user(body, current_user)
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
        return svc.create_role(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/update-role")
def update_role(body: RoleUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_role(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/delete-role")
def delete_role(body: RoleDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_role(body, current_user)
    finally:
        svc.repo.db.close()
