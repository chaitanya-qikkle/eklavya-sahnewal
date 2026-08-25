"""
Request schemas for all Master Data domains.

Each domain has three schema classes:
  - <Domain>AddRequest
  - <Domain>UpdateRequest
  - <Domain>DeleteRequest
"""
from typing import Any, List, Optional

from pydantic import BaseModel


# ── Plant ──────────────────────────────────────────────────────────────────────

class PlantAddRequest(BaseModel):
    plant_code: Optional[str] = None
    plant_name: str
    location:   Optional[str] = None
    client_id:  Optional[int] = None
    is_active:  bool = True


class PlantUpdateRequest(BaseModel):
    plant_id:   int
    plant_code: Optional[str] = None
    plant_name: str
    location:   Optional[str] = None
    client_id:  Optional[int] = None
    is_active:  bool = True


class PlantDeleteRequest(BaseModel):
    plant_id: int


# ── Yard ──────────────────────────────────────────────────────────────────────

class YardAddRequest(BaseModel):
    PlantId:    Optional[str] = None
    YardName:   Optional[str] = None
    YardCode:   Optional[str] = None
    YardTypeID: Optional[str] = None
    LatLong:    Optional[str] = None
    Polygon:    Optional[str] = None
    IsActive:   bool
    CreatedBy:  Optional[int] = None


class YardUpdateRequest(BaseModel):
    YardID:     int
    PlantId:    Optional[int] = None
    YardName:   Optional[str] = None
    YardCode:   Optional[int] = None
    YardTypeID: Optional[int] = None
    LatLong:    Optional[str] = None
    Polygon:    Optional[str] = None
    IsActive:   bool
    ModifiedBy: Optional[int] = None


class YardDeleteRequest(BaseModel):
    YardID:    int
    DeletedBy: Optional[int] = None


# ── Block ─────────────────────────────────────────────────────────────────────

class BlockAddRequest(BaseModel):
    YardID:       Optional[int] = None
    BlockName:    str
    BlockCode:    Optional[str] = None
    RowStart:     Optional[str] = None
    RowEnd:       Optional[str] = None
    TotalColumns: Optional[int] = None
    Polygon:      Optional[Any] = None
    IsActive:     bool = True


class BlockUpdateRequest(BaseModel):
    BlockID:      int
    YardID:       Optional[int] = None
    BlockName:    str
    BlockCode:    Optional[str] = None
    RowStart:     Optional[str] = None
    RowEnd:       Optional[str] = None
    TotalColumns: Optional[int] = None
    Polygon:      Optional[Any] = None
    IsActive:     bool = True


class BlockDeleteRequest(BaseModel):
    BlockID: int


# ── Activity ──────────────────────────────────────────────────────────────────

class ActivityAddRequest(BaseModel):
    activity_name: str


class ActivityUpdateRequest(BaseModel):
    activity_id:   int
    activity_name: str
    is_active:     bool


class ActivityDeleteRequest(BaseModel):
    activity_id: int


# ── Commodity ─────────────────────────────────────────────────────────────────

class CommodityAddRequest(BaseModel):
    commodity_code: str
    commodity_name: str
    description:    Optional[str] = None
    is_active:      bool = True
    created_by:     int


class CommodityUpdateRequest(BaseModel):
    commodity_id:   int
    commodity_code: str
    commodity_name: str
    description:    Optional[str] = None
    is_active:      bool
    modified_by:    int


class CommodityDeleteRequest(BaseModel):
    commodity_id: int
    modified_by:  int


# ── Container Size ────────────────────────────────────────────────────────────

class ContSizeAddRequest(BaseModel):
    size_code:   str
    description: Optional[str] = None


class ContSizeUpdateRequest(BaseModel):
    size_id:     int
    size_code:   str
    description: Optional[str] = None


class ContSizeDeleteRequest(BaseModel):
    size_id: int


# ── Container Type ────────────────────────────────────────────────────────────

class ContTypeAddRequest(BaseModel):
    type_code: str
    iso_code:  Optional[str] = None
    type_desc: Optional[str] = None


class ContTypeUpdateRequest(BaseModel):
    type_id:   int
    type_code: str
    iso_code:  Optional[str] = None
    type_desc: Optional[str] = None


class ContTypeDeleteRequest(BaseModel):
    type_id: int


# ── Process ───────────────────────────────────────────────────────────────────

class ProcessAddRequest(BaseModel):
    process_code:     str
    process_name:     str
    process_category: Optional[str] = None
    sort_order:       Optional[int] = None


class ProcessUpdateRequest(BaseModel):
    process_id:       int
    process_code:     str
    process_name:     str
    process_category: Optional[str] = None
    sort_order:       Optional[int] = None
    is_active:        bool


class ProcessDeleteRequest(BaseModel):
    process_id: int


# ── Customer ──────────────────────────────────────────────────────────────────

class CustomerAddRequest(BaseModel):
    customer_code:    str
    customer_name:    str
    customer_type:    Optional[str] = None
    gst_no:           Optional[str] = None
    address:          Optional[str] = None
    contact_person:   Optional[str] = None
    contact_no:       Optional[str] = None
    email_id:         Optional[str] = None
    is_active:        bool = True
    created_by:       Optional[int] = None


class CustomerUpdateRequest(BaseModel):
    customer_id:      int
    customer_code:    str
    customer_name:    str
    customer_type:    Optional[str] = None
    gst_no:           Optional[str] = None
    address:          Optional[str] = None
    contact_person:   Optional[str] = None
    contact_no:       Optional[str] = None
    email_id:         Optional[str] = None
    is_active:        bool
    modified_by:      Optional[int] = None


class CustomerDeleteRequest(BaseModel):
    customer_id: int


# ── Client ────────────────────────────────────────────────────────────────────

class ClientDeleteRequest(BaseModel):
    client_id: int


# ── Line ──────────────────────────────────────────────────────────────────────

class LineAddRequest(BaseModel):
    line_code:      str
    line_name:      str
    contact_person: Optional[str] = None
    contact_no:     Optional[str] = None
    email_id:       Optional[str] = None
    is_active:      bool = True
    created_by:     int


class LineUpdateRequest(BaseModel):
    line_id:        int
    line_code:      str
    line_name:      str
    contact_person: Optional[str] = None
    contact_no:     Optional[str] = None
    email_id:       Optional[str] = None
    is_active:      bool
    modified_by:    int


class LineDeleteRequest(BaseModel):
    line_id:     int
    modified_by: int


# ── Equipment ─────────────────────────────────────────────────────────────────

class HeightSettingRequest(BaseModel):
    height:    float
    min_value: float
    max_value: float


class EquipmentAddRequest(BaseModel):
    plant_id:             Optional[int]  = None
    equipment_name:       str
    device_id:            Optional[str]  = None
    installation_date:    Optional[str]  = None
    owner_name:           Optional[str]  = None
    equipment_type:       Optional[str]  = None
    equipment_maker:      Optional[str]  = None
    sim_id:               Optional[str]  = None
    vtm_imei_no:          Optional[str]  = None
    job_allow:            Optional[bool] = False
    is_active:            Optional[bool] = True
    is_delete:            Optional[bool] = False
    is_remove_device:     Optional[bool] = False
    is_manual_breakdown:  Optional[bool] = False
    created_by:           Optional[int]  = 1
    height_settings:      Optional[List[HeightSettingRequest]] = []


class EquipmentUpdateRequest(BaseModel):
    eqp_id:               int
    plant_id:             Optional[int]  = None
    equipment_name:       str
    device_id:            Optional[str]  = None
    installation_date:    Optional[str]  = None
    owner_name:           Optional[str]  = None
    equipment_type:       Optional[str]  = None
    equipment_maker:      Optional[str]  = None
    sim_id:               Optional[str]  = None
    vtm_imei_no:          Optional[str]  = None
    job_allow:            Optional[bool] = False
    is_active:            Optional[bool] = True
    is_delete:            Optional[bool] = False
    is_remove_device:     Optional[bool] = False
    is_manual_breakdown:  Optional[bool] = False
    modified_by:          Optional[int]  = 1
    height_settings:      Optional[List[HeightSettingRequest]] = []


class EquipmentDeleteRequest(BaseModel):
    eqp_id:      int
    modified_by: Optional[int] = 1


# ── Equipment Transaction ─────────────────────────────────────────────────────

class EquipmentTransactionAddRequest(BaseModel):
    location_id:          Optional[int] = None
    inventory_id:         Optional[int] = None
    container_tag_id:     Optional[int] = None
    ocr_container_no:     Optional[str] = None
    gps_latitude:         Optional[str] = None
    gps_longitude:        Optional[str] = None
    device_id:            Optional[str] = None
    packet_type:          Optional[str] = None
    container_trans_type: Optional[str] = None
    transaction_date:     Optional[str] = None


class EquipmentTransactionUpdateRequest(BaseModel):
    transaction_id:       int
    location_id:          Optional[int] = None
    inventory_id:         Optional[int] = None
    container_tag_id:     Optional[int] = None
    ocr_container_no:     Optional[str] = None
    gps_latitude:         Optional[str] = None
    gps_longitude:        Optional[str] = None
    device_id:            Optional[str] = None
    packet_type:          Optional[str] = None
    container_trans_type: Optional[str] = None
    transaction_date:     Optional[str] = None


class EquipmentTransactionDeleteRequest(BaseModel):
    transaction_id: int


# ── Inventory Entry ───────────────────────────────────────────────────────────

class InventoryEntrySubmitRequest(BaseModel):
    container_no: str
    block_name:   str
    row_no:       str
    column_name:  str
    device_id:    Optional[str] = None


# ── Breakdown ─────────────────────────────────────────────────────────────────
# (breakdown schemas follow the same pattern as other domains)
