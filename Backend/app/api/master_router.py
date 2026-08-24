"""
Master data API router — Plant, Client, Product Type, Yard, Yard Type, Block,
Activity, ContSize, ContType, Process, Line, Equipment, Device Data, Inventory Entry.

Thin HTTP layer: validates input via Pydantic, calls service, returns result.

Commodity, Customer, and EquipmentTransaction routes have been removed — no
matching stored procedure exists for them in the live database.
"""
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.database import SQLManager
from app.core.security import get_current_user
from app.repositories.master_repository import MasterRepository
from app.services.master_service import MasterService
from app.schemas.master import (
    ActivityAddRequest, ActivityDeleteRequest, ActivityUpdateRequest,
    BlockAddRequest, BlockDeleteRequest, BlockUpdateRequest,
    ContSizeAddRequest, ContSizeDeleteRequest, ContSizeUpdateRequest,
    ContTypeAddRequest, ContTypeDeleteRequest, ContTypeUpdateRequest,
    EquipmentAddRequest, EquipmentDeleteRequest, EquipmentUpdateRequest,
    InventoryEntrySubmitRequest,
    LineAddRequest, LineDeleteRequest, LineUpdateRequest,
    PlantAddRequest, PlantDeleteRequest, PlantUpdateRequest,
    ProcessAddRequest, ProcessDeleteRequest, ProcessUpdateRequest,
    YardAddRequest, YardDeleteRequest, YardUpdateRequest,
    YardTypeAddRequest, YardTypeDeleteRequest, YardTypeUpdateRequest,
)

router = APIRouter(tags=["Master Data"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
CLIENT_LOGO_DIR = UPLOADS_DIR / "clients"
CLIENT_LOGO_DIR.mkdir(parents=True, exist_ok=True)


def _service() -> MasterService:
    db = SQLManager()
    return MasterService(MasterRepository(db))


def _save_logo(logo: Optional[UploadFile]) -> Optional[str]:
    if not logo or not logo.filename:
        return None
    ext = Path(logo.filename).suffix
    name = f"{uuid.uuid4().hex}{ext}"
    dest = CLIENT_LOGO_DIR / name
    with dest.open("wb") as f:
        f.write(logo.file.read())
    return f"/uploads/clients/{name}"


# ── Plant ──────────────────────────────────────────────────────────────────────

@router.get("/plant/get-plant")
def get_plants(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_plants()
    finally:
        svc.repo.db.close()


@router.post("/plant/add-plant")
def add_plant(body: PlantAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_plant(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/plant/update-plant")
def update_plant(body: PlantUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_plant(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/plant/delete-plant")
def delete_plant(body: PlantDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_plant(body, current_user)
    finally:
        svc.repo.db.close()


# ── Product Type (read-only dropdown for Plant) ───────────────────────────────

@router.get("/product-type/get-product-type")
def get_product_types(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_product_types()
    finally:
        svc.repo.db.close()


# ── Client ─────────────────────────────────────────────────────────────────────

@router.get("/client/get-client")
def get_clients(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_clients()
    finally:
        svc.repo.db.close()


@router.get("/client/get-client-all")
def get_clients_all(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_clients()
    finally:
        svc.repo.db.close()


@router.post("/client/add-client")
def add_client(
    client_name: str = Form(...),
    logo: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        from app.schemas.master import ClientAddRequest as _Req
        return svc.add_client(_Req(client_name=client_name, logo=_save_logo(logo)), current_user)
    finally:
        svc.repo.db.close()


@router.post("/client/update-client")
def update_client(
    client_id: int = Form(...),
    client_name: str = Form(...),
    logo: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    svc = _service()
    try:
        from app.schemas.master import ClientUpdateRequest as _Req
        return svc.update_client(_Req(client_id=client_id, client_name=client_name, logo=_save_logo(logo)), current_user)
    finally:
        svc.repo.db.close()


@router.post("/client/delete-client")
def delete_client(body: dict, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        from app.schemas.master import ClientDeleteRequest as _Req
        return svc.delete_client(_Req(client_id=body.get("client_id")), current_user)
    finally:
        svc.repo.db.close()


# ── Yard Type ──────────────────────────────────────────────────────────────────

@router.get("/yard-type/get-yard-type")
def get_yard_types(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_yard_types()
    finally:
        svc.repo.db.close()


@router.post("/yard-type/add-yard-type")
def add_yard_type(body: YardTypeAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_yard_type(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/yard-type/update-yard-type")
def update_yard_type(body: YardTypeUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_yard_type(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/yard-type/delete-yard-type")
def delete_yard_type(body: YardTypeDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_yard_type(body, current_user)
    finally:
        svc.repo.db.close()


# ── Yard ───────────────────────────────────────────────────────────────────────

@router.get("/yard/master-lists")
def get_yard_master_lists(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_yard_master_lists()
    finally:
        svc.repo.db.close()


@router.get("/yard/get-YardById")
def get_yard_by_id(yard_id: int, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_yard(yard_id)
    finally:
        svc.repo.db.close()


@router.post("/yard/add-yard")
def add_yard(body: YardAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_yard(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/yard/update-yard")
def update_yard(body: YardUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_yard(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/yard/delete-yard")
def delete_yard(body: YardDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_yard(body, current_user)
    finally:
        svc.repo.db.close()


# ── Block ──────────────────────────────────────────────────────────────────────

@router.get("/block/get-blocks")
def get_blocks(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_blocks()
    finally:
        svc.repo.db.close()


@router.post("/block/add-block")
def add_block(body: BlockAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_block(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/block/update-block")
def update_block(body: BlockUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_block(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/block/delete-block")
def delete_block(body: BlockDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_block(body, current_user)
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
        return svc.add_activity(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/activity/update-activity")
def update_activity(body: ActivityUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_activity(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/activity/delete-activity")
def delete_activity(body: ActivityDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_activity(body, current_user)
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
        return svc.add_cont_size(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/cont-size/update-cont-size")
def update_cont_size(body: ContSizeUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_cont_size(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/cont-size/delete-cont-size")
def delete_cont_size(body: ContSizeDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_cont_size(body, current_user)
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
        return svc.add_cont_type(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/cont-type/update-cont-type")
def update_cont_type(body: ContTypeUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_cont_type(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/cont-type/delete-cont-type")
def delete_cont_type(body: ContTypeDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_cont_type(body, current_user)
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
        return svc.add_process(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/process/update-process")
def update_process(body: ProcessUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_process(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/process/delete-process")
def delete_process(body: ProcessDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_process(body, current_user)
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
        return svc.add_line(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/line/update-line")
def update_line(body: LineUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_line(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/line/delete-line")
def delete_line(body: LineDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_line(body, current_user)
    finally:
        svc.repo.db.close()


# ── Equipment ──────────────────────────────────────────────────────────────────

@router.get("/equipment/get-equipment")
def get_equipment(current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.get_equipment()
    finally:
        svc.repo.db.close()


@router.post("/equipment/add-equipment")
def add_equipment(body: EquipmentAddRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.add_equipment(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/equipment/update-equipment")
def update_equipment(body: EquipmentUpdateRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.update_equipment(body, current_user)
    finally:
        svc.repo.db.close()


@router.post("/equipment/delete-equipment")
def delete_equipment(body: EquipmentDeleteRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.delete_equipment(body, current_user)
    finally:
        svc.repo.db.close()


# ── Device Data (unchanged — not part of this pass) ───────────────────────────

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


# ── Inventory Entry (unchanged — not part of this pass) ──────────────────────

@router.post("/inventory-entry/submit")
def submit_inventory_entry(body: InventoryEntrySubmitRequest, current_user: dict = Depends(get_current_user)):
    svc = _service()
    try:
        return svc.submit_inventory_entry(body)
    finally:
        svc.repo.db.close()
