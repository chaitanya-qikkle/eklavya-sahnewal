from fastapi import APIRouter
from v1.api.auth.create_user import user_router
from v1.api.auth.login_user import login_router
from v1.api.auth.menu_crud import menu_router
from v1.api.auth.role_crud import role_router

auth_router = APIRouter()

auth_router.include_router(user_router, prefix="/auth")
auth_router.include_router(login_router, prefix="/auth")
auth_router.include_router(role_router, prefix="/auth")
auth_router.include_router(menu_router, prefix="/menu")