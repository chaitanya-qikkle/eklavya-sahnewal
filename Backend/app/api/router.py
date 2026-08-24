"""
Main API router — aggregates all domain routers under /v1.

To add a new domain:
  1. Create app/schemas/<domain>.py
  2. Create app/repositories/<domain>_repository.py
  3. Create app/services/<domain>_service.py
  4. Create app/api/<domain>_router.py
  5. Import and include it here
"""
from fastapi import APIRouter

from app.api.auth_router      import router as auth_router
from app.api.container_router import router as container_router
from app.api.master_router    import router as master_router
from app.api.menu_router      import router as menu_router
from app.api.reports_router   import router as reports_router

# All new-architecture routes live under /v1
api_router = APIRouter(prefix="/v1")

api_router.include_router(auth_router)
api_router.include_router(menu_router)
api_router.include_router(master_router)
api_router.include_router(container_router)
api_router.include_router(reports_router)
