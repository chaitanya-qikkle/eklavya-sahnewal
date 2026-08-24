"""
Request schemas for all Master Data domains.

Field sets mirror the real ESS_MST_* tables in YMS_EKLAVYA — see
app/repositories/master_repository.py for the stored procedures each
domain maps to. `plant_id` is optional on every write request: when
omitted, the service fills it in from the caller's session (JWT plant_id).

Commodity, Customer, and EquipmentTransaction have been removed — no
matching stored procedure exists for them in this database (only "Client"
exists, not "Customer").
"""
from typing import Optional

from pydantic import BaseModel


# ── Plant ──────────────────────────────────────────────────────────────────────

class PlantAddRequest(BaseModel):
    url:              Optional[str] = None
    plant_name:       str
    product_type_id:  Optional[int] = None
    client_id:        Optional[int] = None


class PlantUpdateRequest(BaseModel):
    plant_id:         int
    url:              Optional[str] = None
    plant_name:       str
    product_type_id:  Optional[int] = None
    client_id:        Optional[int] = None


class PlantDeleteRequest(BaseModel):
    plant_id: int


# ── Client ────────────────────────────────────────────────────────────────────

class ClientAddRequest(BaseModel):
    client_name: str
    logo:        Optional[str] = None


class ClientUpdateRequest(BaseModel):
    client_id:   int
    client_name: str
    logo:        Optional[str] = None


class ClientDeleteRequest(BaseModel):
    client_id: int


# ── Yard Type ─────────────────────────────────────────────────────────────────

class YardTypeAddRequest(BaseModel):
    yard_type_name: str
    plant_id:       Optional[int] = None


class YardTypeUpdateRequest(BaseModel):
    yard_type_id:   int
    yard_type_name: str
    plant_id:       Optional[int] = None


class YardTypeDeleteRequest(BaseModel):
    yard_type_id: int


# ── Yard ──────────────────────────────────────────────────────────────────────

class YardAddRequest(BaseModel):
    yard_name:    str
    plant_id:     Optional[int] = None
    yard_code:    Optional[str] = None
    yard_type_id: Optional[int] = None


class YardUpdateRequest(BaseModel):
    yard_id:      int
    yard_name:    str
    plant_id:     Optional[int] = None
    yard_code:    Optional[str] = None
    yard_type_id: Optional[int] = None


class YardDeleteRequest(BaseModel):
    yard_id: int


# ── Block ─────────────────────────────────────────────────────────────────────

class BlockAddRequest(BaseModel):
    plant_id:              Optional[int] = None
    block_name:            str
    marking_start:         Optional[str] = None
    no_of_rows:            Optional[int] = None
    no_of_columns:         Optional[int] = None
    no_of_stack:           Optional[int] = None
    total_container_count: Optional[int] = None
    line_id:               Optional[int] = None
    cont_size_id:          Optional[int] = None
    comodity:              Optional[str] = None
    yard_id:               Optional[int] = None
    process_id:            Optional[int] = None


class BlockUpdateRequest(BaseModel):
    block_id:              int
    plant_id:              Optional[int] = None
    block_name:            str
    marking_start:         Optional[str] = None
    no_of_rows:            Optional[int] = None
    no_of_columns:         Optional[int] = None
    no_of_stack:           Optional[int] = None
    total_container_count: Optional[int] = None
    line_id:               Optional[int] = None
    cont_size_id:          Optional[int] = None
    comodity:              Optional[str] = None
    yard_id:               Optional[int] = None
    process_id:            Optional[int] = None


class BlockDeleteRequest(BaseModel):
    block_id: int


# ── Activity ──────────────────────────────────────────────────────────────────

class ActivityAddRequest(BaseModel):
    activity_name: str
    plant_id:      Optional[int] = None


class ActivityUpdateRequest(BaseModel):
    activity_id:   int
    activity_name: str
    plant_id:      Optional[int] = None


class ActivityDeleteRequest(BaseModel):
    activity_id: int


# ── Container Size ────────────────────────────────────────────────────────────

class ContSizeAddRequest(BaseModel):
    cont_size: str
    plant_id:  Optional[int] = None


class ContSizeUpdateRequest(BaseModel):
    cont_size_id: int
    cont_size:    str
    plant_id:     Optional[int] = None


class ContSizeDeleteRequest(BaseModel):
    cont_size_id: int


# ── Container Type ────────────────────────────────────────────────────────────

class ContTypeAddRequest(BaseModel):
    cont_type_name: str
    plant_id:       Optional[int] = None


class ContTypeUpdateRequest(BaseModel):
    cont_type_id:   int
    cont_type_name: str
    plant_id:       Optional[int] = None


class ContTypeDeleteRequest(BaseModel):
    cont_type_id: int


# ── Process ───────────────────────────────────────────────────────────────────

class ProcessAddRequest(BaseModel):
    process_name: str
    plant_id:     Optional[int] = None


class ProcessUpdateRequest(BaseModel):
    process_id:   int
    process_name: str
    plant_id:     Optional[int] = None


class ProcessDeleteRequest(BaseModel):
    process_id: int


# ── Line ──────────────────────────────────────────────────────────────────────

class LineAddRequest(BaseModel):
    line_name: str
    color:     Optional[str] = None
    plant_id:  Optional[int] = None


class LineUpdateRequest(BaseModel):
    line_id:   int
    line_name: str
    color:     Optional[str] = None
    plant_id:  Optional[int] = None


class LineDeleteRequest(BaseModel):
    line_id: int


# ── Equipment ─────────────────────────────────────────────────────────────────

class EquipmentAddRequest(BaseModel):
    plant_id:           Optional[int] = None
    equipment_code:     Optional[str] = None
    equipment_name:     str
    device_id:          Optional[str] = None
    installation_date:  Optional[str] = None
    owner_name:         Optional[str] = None
    equipment_type:     Optional[str] = None
    equipment_maker:    Optional[str] = None
    sim_id:             Optional[str] = None
    vtm_imei_no:        Optional[str] = None
    is_remove_device:   bool = False


class EquipmentUpdateRequest(BaseModel):
    eqp_id:             int
    plant_id:           Optional[int] = None
    equipment_code:     Optional[str] = None
    equipment_name:     str
    device_id:          Optional[str] = None
    installation_date:  Optional[str] = None
    owner_name:         Optional[str] = None
    equipment_type:     Optional[str] = None
    equipment_maker:    Optional[str] = None
    sim_id:             Optional[str] = None
    vtm_imei_no:        Optional[str] = None
    is_remove_device:   bool = False


class EquipmentDeleteRequest(BaseModel):
    eqp_id: int


# ── Inventory Entry ───────────────────────────────────────────────────────────
# (unchanged — not part of this pass; SP behind this doesn't exist in the DB yet)

class InventoryEntrySubmitRequest(BaseModel):
    container_no: str
    block_name:   str
    row_no:       str
    column_name:  str
    device_id:    Optional[str] = None
