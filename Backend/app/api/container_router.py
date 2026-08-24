"""
Container API router — inventory, live status, 3D yard, e-survey, physical location.
"""
import os
import pathlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.container_repository import ContainerRepository
from app.schemas.container import UpdateLocationRequest
from app.services.container_service import ContainerService

router = APIRouter(prefix="/container", tags=["Container"])

STITCHING_DIR = pathlib.Path(os.getenv("STITCHING_DIR", r"D:\stitching\outputs"))


def _service() -> ContainerService:
    db = SQLManager()
    return ContainerService(ContainerRepository(db))


# ── Paginated inventory ───────────────────────────────────────────────────────

@router.get("/container-inventory")
def get_container_inventory(
    page_index: int = Query(1, ge=1),
    page_size:  int = Query(25, ge=1),
    search_for: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.get_container_inventory(page_index, page_size, search_for or None)
    finally:
        svc.repo.db.close()


# ── Live status (all in-yard containers) ──────────────────────────────────────

@router.get("/container-live-status")
def get_container_live_status(search_for: Optional[str] = None):
    svc = _service()
    try:
        return svc.get_container_live_status(search_for)
    finally:
        svc.repo.db.close()


# ── Location slots (map overlay) ──────────────────────────────────────────────

@router.get("/location-slots")
def get_location_slots():
    svc = _service()
    try:
        return svc.get_location_slots()
    finally:
        svc.repo.db.close()


# ── 3D yard data ──────────────────────────────────────────────────────────────

@router.get("/yard-3d-inventory")
def get_yard_3d_inventory():
    svc = _service()
    try:
        return svc.get_yard_3d_inventory()
    finally:
        svc.repo.db.close()


# ── 3D yard — equipment-positioned slot list ─────────────────────────────────

@router.get("/yard-3d-slot-list")
def get_yard_3d_slot_list():
    svc = _service()
    try:
        return svc.get_yard_3d_slot_list()
    finally:
        svc.repo.db.close()


# ── Daily utilisation report ──────────────────────────────────────────────────

@router.get("/daily-utilisation")
def get_daily_utilisation(
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
    group_by:  Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        return svc.get_daily_utilisation(from_date, to_date, group_by)
    finally:
        svc.repo.db.close()


# ── Container detail ──────────────────────────────────────────────────────────

@router.get("/container-info")
def get_container_info(container_no: str = ""):
    svc = _service()
    try:
        return svc.get_container_info(container_no)
    finally:
        svc.repo.db.close()


# ── Update physical location (mobile) ────────────────────────────────────────

@router.post("/update-physical-location")
def update_physical_location(body: UpdateLocationRequest):
    svc = _service()
    try:
        return svc.update_physical_location(body.container_no, body.location)
    finally:
        svc.repo.db.close()


# ── Pre-gate e-survey (paginated) ─────────────────────────────────────────────

@router.get("/pre-gate-survey")
def get_pre_gate_survey(
    gate_type:    Optional[str] = None,
    gate_name:    Optional[str] = None,
    from_date:    Optional[str] = None,
    to_date:      Optional[str] = None,
    container_no: Optional[str] = None,
    plant_id:     int = Query(0),
    page:      int = Query(1,  ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    svc = _service()
    try:
        return svc.get_pre_gate_survey(
            gate_type, gate_name, from_date, to_date, container_no,
            page, page_size, STITCHING_DIR, plant_id,
        )
    finally:
        svc.repo.db.close()


# ── Survey image (served from stitching dir) ──────────────────────────────────

@router.get("/img", include_in_schema=False)
def serve_survey_image(p: str):
    try:
        target = (STITCHING_DIR / p).resolve()
        target.relative_to(STITCHING_DIR.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    suffix = target.suffix.lower()
    media  = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png" if suffix == ".png" else "application/octet-stream"
    return FileResponse(str(target), media_type=media, headers={"Cache-Control": "public, max-age=3600"})
