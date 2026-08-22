"""
Master data API router — Plant, Activity, Commodity, ContSize, ContType,
Process, Customer, Line, Equipment, EquipmentTransaction, DeviceData, InventoryEntry.

Thin HTTP layer: validates input via Pydantic, calls service, returns result.
"""
from typing import Optional

from fastapi import APIRouter, Depends

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.master_repository import MasterRepository
from app.services.master_service import MasterService
from app.schemas.master import (
    ActivityAddRequest, ActivityDeleteRequest, ActivityUpdateRequest,
    CommodityAddRequest, CommodityDeleteRequest, CommodityUpdateRequest,
    ContSizeAddRequest, ContSizeDeleteRequest, ContSizeUpdateRequest,
    ContTypeAddRequest, ContTypeDeleteRequest, ContTypeUpdateRequest,
    CustomerAddRequest, CustomerDeleteRequest, CustomerUpdateRequest,
    EquipmentTransactionAddRequest, EquipmentTransactionDeleteRequest, EquipmentTransactionUpdateRequest,
    InventoryEntrySubmitRequest,
    LineAddRequest, LineDeleteRequest, LineUpdateRequest,
    PlantAddRequest, PlantDeleteRequest, PlantUpdateRequest,
    ProcessAddRequest, ProcessDeleteRequest, ProcessUpdateRequest,
)

router = APIRouter(tags=["Master Data"])


def _service() -> MasterService:
    db = SQLManager()
    return MasterService(MasterRepository(db))


# ── Plant ──────────────────────────────────────────────────────────────────────

@router.get("/plant/get-plant")
def get_plants(plant_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_plants(plant_id)
    finally:
        svc.repo.db.close()


@router.post("/plant/add-plant")
def add_plant(body: PlantAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_plant(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


@router.post("/plant/update-plant")
def update_plant(body: PlantUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_plant(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


@router.post("/plant/delete-plant")
def delete_plant(body: PlantDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_plant(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


# ── Activity ───────────────────────────────────────────────────────────────────

@router.get("/activity/get-activity")
def get_activities(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_activities()
    finally:
        svc.repo.db.close()


@router.post("/activity/add-activity")
def add_activity(body: ActivityAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_activity(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


@router.post("/activity/update-activity")
def update_activity(body: ActivityUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_activity(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


@router.post("/activity/delete-activity")
def delete_activity(body: ActivityDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_activity(body, current_user["user_id"])
    finally:
        svc.repo.db.close()


# ── Commodity ──────────────────────────────────────────────────────────────────

@router.get("/commodity/get-commodity")
def get_commodities(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_commodities()
    finally:
        svc.repo.db.close()


@router.post("/commodity/add-commodity")
def add_commodity(body: CommodityAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_commodity(body)
    finally:
        svc.repo.db.close()


@router.post("/commodity/update-commodity")
def update_commodity(body: CommodityUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_commodity(body)
    finally:
        svc.repo.db.close()


@router.post("/commodity/delete-commodity")
def delete_commodity(body: CommodityDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_commodity(body)
    finally:
        svc.repo.db.close()


# ── Container Size ─────────────────────────────────────────────────────────────

@router.get("/cont-size/get-cont-size")
def get_cont_sizes(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_cont_sizes()
    finally:
        svc.repo.db.close()


@router.post("/cont-size/add-cont-size")
def add_cont_size(body: ContSizeAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_cont_size(body)
    finally:
        svc.repo.db.close()


@router.post("/cont-size/update-cont-size")
def update_cont_size(body: ContSizeUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_cont_size(body)
    finally:
        svc.repo.db.close()


@router.post("/cont-size/delete-cont-size")
def delete_cont_size(body: ContSizeDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_cont_size(body)
    finally:
        svc.repo.db.close()


# ── Container Type ─────────────────────────────────────────────────────────────

@router.get("/cont-type/get-cont-type")
def get_cont_types(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_cont_types()
    finally:
        svc.repo.db.close()


@router.post("/cont-type/add-cont-type")
def add_cont_type(body: ContTypeAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_cont_type(body)
    finally:
        svc.repo.db.close()


@router.post("/cont-type/update-cont-type")
def update_cont_type(body: ContTypeUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_cont_type(body)
    finally:
        svc.repo.db.close()


@router.post("/cont-type/delete-cont-type")
def delete_cont_type(body: ContTypeDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_cont_type(body)
    finally:
        svc.repo.db.close()


# ── Process ────────────────────────────────────────────────────────────────────

@router.get("/process/get-process")
def get_processes(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_processes()
    finally:
        svc.repo.db.close()


@router.post("/process/add-process")
def add_process(body: ProcessAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_process(body)
    finally:
        svc.repo.db.close()


@router.post("/process/update-process")
def update_process(body: ProcessUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_process(body)
    finally:
        svc.repo.db.close()


@router.post("/process/delete-process")
def delete_process(body: ProcessDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_process(body)
    finally:
        svc.repo.db.close()


# ── Customer ───────────────────────────────────────────────────────────────────

@router.get("/customer/get-customer")
def get_customers(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_customers()
    finally:
        svc.repo.db.close()


@router.post("/customer/add-customer")
def add_customer(body: CustomerAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_customer(body)
    finally:
        svc.repo.db.close()


@router.post("/customer/update-customer")
def update_customer(body: CustomerUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_customer(body)
    finally:
        svc.repo.db.close()


@router.post("/customer/delete-customer")
def delete_customer(body: CustomerDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_customer(body)
    finally:
        svc.repo.db.close()


# ── Line ───────────────────────────────────────────────────────────────────────

@router.get("/line/get-line")
def get_lines(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_lines()
    finally:
        svc.repo.db.close()


@router.post("/line/add-line")
def add_line(body: LineAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_line(body)
    finally:
        svc.repo.db.close()


@router.post("/line/update-line")
def update_line(body: LineUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_line(body)
    finally:
        svc.repo.db.close()


@router.post("/line/delete-line")
def delete_line(body: LineDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_line(body)
    finally:
        svc.repo.db.close()


# ── Equipment Transaction ──────────────────────────────────────────────────────

@router.get("/equipment-transaction/get-equipment-transaction")
def get_equipment_transactions(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.repo.get_equipment_transactions()
    finally:
        svc.repo.db.close()


# ── Device Data ────────────────────────────────────────────────────────────────

@router.get("/device-data/get-device-data")
def get_device_data(plant_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.repo.get_device_data(plant_id)
    finally:
        svc.repo.db.close()


@router.get("/device-data/get-device-data-latest")
def get_device_data_latest(plant_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.repo.get_device_data_latest(plant_id)
    finally:
        svc.repo.db.close()


@router.get("/device-data/get-device-live-locations")
def get_device_live_locations(plant_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.repo.get_device_live_locations(plant_id)
    finally:
        svc.repo.db.close()


# ── Inventory Entry ────────────────────────────────────────────────────────────

@router.post("/inventory-entry/submit")
def submit_inventory_entry(body: InventoryEntrySubmitRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.submit_inventory_entry(body)
    finally:
        svc.repo.db.close()
