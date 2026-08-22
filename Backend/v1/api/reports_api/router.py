from fastapi import APIRouter
from v1.api.reports_api.Report import router

report_router = APIRouter()

report_router.include_router(router , prefix="/reports")