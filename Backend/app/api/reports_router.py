"""
Reports API router — gate reports, device reports, daily utilisation, data exports.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.reports_repository import ReportsRepository
from app.services.reports_service import ReportsService

router = APIRouter(prefix="/reports", tags=["Reports"])


def _service() -> ReportsService:
    db = SQLManager()
    return ReportsService(ReportsRepository(db))


# ── Gate in/out report ────────────────────────────────────────────────────────

@router.get("/reports")
def get_gate_report(
    container_no: Optional[str] = Query(None),
    from_date:    Optional[str] = Query(None),
    to_date:      Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.get_gate_report(container_no, from_date, to_date)
    finally:
        svc.repo.db.close()


# ── Device lock report ────────────────────────────────────────────────────────

@router.get("/device-lock-report")
def get_device_lock_report(
    from_date:       Optional[str] = Query(None),
    to_date:         Optional[str] = Query(None),
    equipment_names: Optional[str] = Query(None),
    report_type:     Optional[str] = Query("All"),
    location:        Optional[str] = Query(""),
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.get_device_lock_report(
            from_date, to_date, equipment_names, report_type, location,
            current_user.get("plant_id", 1),
        )
    finally:
        svc.repo.db.close()


# ── Device raw data ───────────────────────────────────────────────────────────

@router.get("/device-raw-data")
def get_device_raw_data(
    machine:   Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.get_device_raw_data(machine, from_date, to_date, current_user.get("plant_id", 0))
    finally:
        svc.repo.db.close()


# ── Update device container ───────────────────────────────────────────────────

class UpdateDeviceContainerRequest(BaseModel):
    eqp_trans_id: int
    cont_no:      str


@router.post("/update-device-container")
def update_device_container(
    body: UpdateDeviceContainerRequest,
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.update_device_container(
            body.eqp_trans_id, body.cont_no,
            current_user.get("plant_id", 1),
            current_user.get("user_id", 1),
        )
    finally:
        svc.repo.db.close()


# ── Daily utilisation ─────────────────────────────────────────────────────────

@router.get("/daily-utilisation")
def get_daily_utilisation(
    from_date: Optional[str] = Query(None),
    to_date:   Optional[str] = Query(None),
    group_by:  Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.get_daily_utilisation(from_date, to_date, group_by)
    finally:
        svc.repo.db.close()
