"""
Menu / role-menu API router — mounted at /v1/menu, matching the paths the
frontend already calls (API_ENDPOINTS.AUTH.GET_MENUS etc. in
Frontend/src/config/api.js point at /v1/menu/*, not /v1/auth/menus/*).
"""
from typing import Optional

from fastapi import APIRouter, Depends

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.auth_repository import AuthRepository
from app.services.auth_service import AuthService
from app.schemas.auth import (
    MenuCreateRequest,
    MenuDeleteRequest,
    MenuUpdateRequest,
    RoleMenuSetRequest,
)

router = APIRouter(prefix="/menu", tags=["Menu"])


def _service() -> AuthService:
    db = SQLManager()
    return AuthService(AuthRepository(db))


@router.get("/get-menus")
def get_menus(plant_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_menus(plant_id, current_user)
    finally:
        svc.repo.db.close()


@router.post("/create-menu")
def create_menu(body: MenuCreateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.create_menu(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/update-menu")
def update_menu(body: MenuUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_menu(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/delete-menu")
def delete_menu(body: MenuDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_menu(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/set-role-menus")
def set_role_menus(body: RoleMenuSetRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.set_role_menus(body, current_user)
    finally:
        svc.repo.db.close()


@router.get("/get-role-menus")
def get_role_menus(role_id: int, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_role_menus(role_id)
    finally:
        svc.repo.db.close()
