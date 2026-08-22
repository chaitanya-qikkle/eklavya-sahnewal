from v1.api.auth.auth_router import auth_router
from v1.api.master_api.router import master_router
from v1.api.container_api.router import container_router
from v1.api.reports_api.router import report_router
from fastapi import APIRouter

route = APIRouter()

route.include_router(auth_router,prefix="/v1",tags=["AUTH"])
route.include_router(master_router,prefix="/v1", tags=["MASTER"])
route.include_router(container_router,prefix="/v1",tags=["CONTAINER"])
route.include_router(report_router,prefix="/v1",tags=["REPORTS"])


