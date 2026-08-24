# NOTE: auth_router and master_router (v1.api.auth / v1.api.master_api) used to be
# mounted here. They've been superseded by app/api/auth_router.py, app/api/menu_router.py,
# and app/api/master_router.py, which are wired to the real stored procedures in
# YMS_EKLAVYA (the old ones here largely called SP names that don't exist in the DB).
# Left un-mounted rather than deleted in case anything still imports them directly.
from v1.api.container_api.router import container_router
from v1.api.reports_api.router import report_router
from fastapi import APIRouter

route = APIRouter()

route.include_router(container_router,prefix="/v1",tags=["CONTAINER"])
route.include_router(report_router,prefix="/v1",tags=["REPORTS"])


