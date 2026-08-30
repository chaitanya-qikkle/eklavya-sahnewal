from pydantic import BaseModel
from typing import Optional, List, Any

class PlantAddRequest(BaseModel):
    plant_code: Optional[str] = None
    plant_name: str
    location: Optional[str] = None
    client_id: Optional[int] = None
    is_active: bool = True

class PlantUpdateRequest(BaseModel):
    plant_id: int
    plant_code: Optional[str] = None
    plant_name: str
    location: Optional[str] = None
    client_id: Optional[int] = None
    is_active: bool = True

class PlantDeleteRequest(BaseModel):
    plant_id: int

class ActivityAddRequest(BaseModel):
    activity_name: str

class ActivityUpdateRequest(BaseModel):
    activity_id: int
    activity_name: str
    is_active: bool

class ActivityDeleteRequest(BaseModel):
    activity_id: int

class CommodityAddRequest(BaseModel):
    commodity_code: str
    commodity_name: str
    description: Optional[str] = None
    is_active: bool = True
    created_by : int

class CommodityUpdateRequest(BaseModel):
    commodity_id: int
    commodity_code: str
    commodity_name: str
    description: Optional[str] = None
    is_active: bool
    modified_by : int
   

class CommodityDeleteRequest(BaseModel):
    commodity_id: int
    modified_by : int
   

class ContSizeAddRequest(BaseModel):
    size_code: str
    description: Optional[str] = None

class ContSizeUpdateRequest(BaseModel):
    size_id: int
    size_code: str
    description: Optional[str] = None

class ContSizeDeleteRequest(BaseModel):
    size_id: int

class ContTypeAddRequest(BaseModel):
    type_code: str
    iso_code: Optional[str] = None
    type_desc: Optional[str] = None

class ContTypeUpdateRequest(BaseModel):
    type_id: int
    type_code: str
    iso_code: Optional[str] = None
    type_desc: Optional[str] = None

class ProcessAddRequest(BaseModel):
    process_code: str
    process_name: str
    process_category: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True
    created_by: Optional[int] = 1

class ProcessUpdateRequest(BaseModel):
    process_id: int
    process_code: str
    process_name: str
    process_category: Optional[str] = None
    sort_order: Optional[int] = 0
    is_active: Optional[bool] = True
    modified_by: Optional[int] = 1

class HeightSettingRequest(BaseModel):
    height: float
    min_value: float
    max_value: float


class EquipmentAddRequest(BaseModel):
    plant_id: Optional[int] = None
    equipment_code: Optional[str] = None
    equipment_name: str
    device_id: Optional[str] = None
    installation_date: Optional[str] = None
    owner_name: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_maker: Optional[str] = None
    sim_id: Optional[str] = None
    vtm_imei_no: Optional[str] = None
    is_remove_device: Optional[bool] = False
    created_by: Optional[str] = ''
    # Accepted but not persisted — INS_ESS_MST_EQUIPMENT has no columns for these.
    job_allow: Optional[bool] = False
    is_active: Optional[bool] = True
    is_manual_breakdown: Optional[bool] = False
    height_settings: Optional[List[HeightSettingRequest]] = []


class EquipmentUpdateRequest(BaseModel):
    eqp_id: int
    plant_id: Optional[int] = None
    equipment_code: Optional[str] = None
    equipment_name: str
    device_id: Optional[str] = None
    installation_date: Optional[str] = None
    owner_name: Optional[str] = None
    equipment_type: Optional[str] = None
    equipment_maker: Optional[str] = None
    sim_id: Optional[str] = None
    vtm_imei_no: Optional[str] = None
    is_remove_device: Optional[bool] = False
    modified_by: Optional[str] = ''
    # Accepted but not persisted — UPD_ESS_MST_EQUIPMENT has no columns for these.
    job_allow: Optional[bool] = False
    is_active: Optional[bool] = True
    is_manual_breakdown: Optional[bool] = False
    height_settings: Optional[List[HeightSettingRequest]] = []

class EquipmentDeleteRequest(BaseModel):
    eqp_id: int
    modified_by: Optional[str] = ''


class EquipmentTransactionAddRequest(BaseModel):
    location_id: Optional[int] = None
    inventory_id: Optional[int] = None
    container_tag_id: Optional[int] = None
    ocr_container_no: Optional[str] = None
    gps_latitude: Optional[str] = None
    gps_longitude: Optional[str] = None
    device_id: Optional[str] = None
    packet_type: Optional[str] = None
    container_trans_type: Optional[str] = None
    transaction_date: Optional[str] = None

class InventoryEntrySubmitRequest(BaseModel):
    container_no: str
    block_name: str
    row_no: str
    column_name: str
    device_id: Optional[str] = None

class YardAddRequest(BaseModel):
    PlantId  : Optional[str]
    YardName : Optional[str]
    YardCode : Optional[str]
    YardTypeID : Optional[str]
    LatLong : Optional[str]
    Polygon : Optional[str]
    IsActive : bool
    CreatedBy : Optional[int]


class YardUpdateRequest(BaseModel):
    YardID     : int           
    PlantId    : Optional[int]
    YardName   : Optional[str]
    YardCode   : Optional[int]
    YardTypeID : Optional[int]
    LatLong    : Optional[str]
    Polygon    : Optional[str]
    IsActive   : bool
    ModifiedBy : Optional[int]

class YardDeleteRequest(BaseModel):
    YardID    : int
    DeletedBy : Optional[int]

class EquipmentTransactionUpdateRequest(BaseModel):
    transaction_id: int
    location_id: Optional[int] = None
    inventory_id: Optional[int] = None
    container_tag_id: Optional[int] = None
    ocr_container_no: Optional[str] = None
    gps_latitude: Optional[str] = None
    gps_longitude: Optional[str] = None
    device_id: Optional[str] = None
    packet_type: Optional[str] = None
    container_trans_type: Optional[str] = None
    transaction_date: Optional[str] = None


class EquipmentTransactionDeleteRequest(BaseModel):
    transaction_id: int


class ContTypeDeleteRequest(BaseModel):
    type_id: int

class CustomerAddRequest(BaseModel):
    customer_code: str
    customer_name: str
    customer_type: Optional[str] = None
    gst_no: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    is_active: bool = True
    created_by : Optional[int] = None

class CustomerUpdateRequest(BaseModel):
    customer_id: int
    customer_code: str
    customer_name: str
    customer_type: Optional[str] = None
    gst_no: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    is_active: bool
    modified_by : Optional[int] = None

class CustomerDeleteRequest(BaseModel):
    customer_id: int

class ClientAddRequest(BaseModel):
    client_code: Optional[str] = None
    client_name: str
    client_type: Optional[str] = None
    gst_no: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    is_active: Optional[bool] = True
    created_by: Optional[int] = None

class ClientUpdateRequest(BaseModel):
    client_id: int
    client_code: Optional[str] = None
    client_name: str
    client_type: Optional[str] = None
    gst_no: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    is_active: Optional[bool] = True
    modified_by: Optional[int] = None

class ClientDeleteRequest(BaseModel):
    client_id: int

class LineAddRequest(BaseModel):
    line_code: str
    line_name: str
    contact_person: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    is_active: bool = True
    created_by : int

class LineUpdateRequest(BaseModel):
    line_id: int
    line_code: str
    line_name: str
    contact_person: Optional[str] = None
    contact_no: Optional[str] = None
    email_id: Optional[str] = None
    is_active: bool
    modified_by: int

class LineDeleteRequest(BaseModel):
    line_id: int
    modified_by: int
    
class ProcessAddRequest(BaseModel):
    process_code: str
    process_name: str
    process_category: Optional[str] = None
    sort_order: Optional[int] = None

class ProcessUpdateRequest(BaseModel):
    process_id: int
    process_code: str
    process_name: str
    process_category: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: bool

class ProcessDeleteRequest(BaseModel):
    process_id: int


# ─── Block Master ─────────────────────────────────────────────────────────────

class BlockAddRequest(BaseModel):
    YardID: Optional[int] = None
    BlockName: str
    BlockCode: Optional[str] = None
    RowStart: Optional[str] = None     # e.g. "A"
    RowEnd: Optional[str] = None       # e.g. "G"
    TotalColumns: Optional[int] = None # number of columns
    Polygon: Optional[Any] = None      # JSON array of lat/lng from map drawing
    IsActive: bool = True

class BlockUpdateRequest(BaseModel):
    BlockID: int
    YardID: Optional[int] = None
    BlockName: str
    BlockCode: Optional[str] = None
    RowStart: Optional[str] = None
    RowEnd: Optional[str] = None
    TotalColumns: Optional[int] = None
    Polygon: Optional[Any] = None
    IsActive: bool = True

class BlockDeleteRequest(BaseModel):
    BlockID: int
