"""
Master data service — business logic for all master-data domains.

Validates SP responses, raises HTTP exceptions for failures,
and returns clean response dicts.
"""
from fastapi import HTTPException, status

from app.repositories.master_repository import MasterRepository
from app.schemas.master import (
    ActivityAddRequest, ActivityDeleteRequest, ActivityUpdateRequest,
    BlockAddRequest, BlockDeleteRequest, BlockUpdateRequest,
    CommodityAddRequest, CommodityDeleteRequest, CommodityUpdateRequest,
    ContSizeAddRequest, ContSizeDeleteRequest, ContSizeUpdateRequest,
    ContTypeAddRequest, ContTypeDeleteRequest, ContTypeUpdateRequest,
    CustomerAddRequest, CustomerDeleteRequest, CustomerUpdateRequest,
    EquipmentAddRequest, EquipmentDeleteRequest, EquipmentUpdateRequest,
    EquipmentTransactionAddRequest, EquipmentTransactionDeleteRequest, EquipmentTransactionUpdateRequest,
    InventoryEntrySubmitRequest,
    LineAddRequest, LineDeleteRequest, LineUpdateRequest,
    PlantAddRequest, PlantDeleteRequest, PlantUpdateRequest,
    ProcessAddRequest, ProcessDeleteRequest, ProcessUpdateRequest,
)


def _raise_if_error(result: dict, default_message: str = "Operation failed") -> dict:
    """Raise HTTPException if the SP result signals an error; otherwise return result."""
    if result.get("status") == "error":
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("message", default_message),
        )
    data = result.get("data") or []
    if data:
        first = data[0]
        if first.get("Status") == 0 or first.get("STATUS") == 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=first.get("Message") or first.get("MESSAGE") or default_message,
            )
    return result


class MasterService:
    def __init__(self, repo: MasterRepository):
        self.repo = repo

    # ── Plant ──────────────────────────────────────────────────────────────────

    def get_plants(self, plant_id=None) -> dict:
        return _raise_if_error(self.repo.get_plants(plant_id))

    def add_plant(self, req: PlantAddRequest, user_id: int) -> dict:
        result = self.repo.add_plant(
            req.plant_code, req.plant_name, req.location,
            req.client_id, req.is_active, user_id,
        )
        return _raise_if_error(result, "Plant created successfully")

    def update_plant(self, req: PlantUpdateRequest, user_id: int) -> dict:
        result = self.repo.update_plant(
            req.plant_id, req.plant_code, req.plant_name, req.location,
            req.client_id, req.is_active, user_id,
        )
        return _raise_if_error(result, "Plant updated successfully")

    def delete_plant(self, req: PlantDeleteRequest, user_id: int) -> dict:
        return _raise_if_error(self.repo.delete_plant(req.plant_id, user_id))

    # ── Activity ───────────────────────────────────────────────────────────────

    def get_activities(self) -> dict:
        return _raise_if_error(self.repo.get_activities())

    def add_activity(self, req: ActivityAddRequest, user_id: int) -> dict:
        return _raise_if_error(self.repo.add_activity(req.activity_name, user_id))

    def update_activity(self, req: ActivityUpdateRequest, user_id: int) -> dict:
        return _raise_if_error(self.repo.update_activity(req.activity_id, req.activity_name, req.is_active, user_id))

    def delete_activity(self, req: ActivityDeleteRequest, user_id: int) -> dict:
        return _raise_if_error(self.repo.delete_activity(req.activity_id, user_id))

    # ── Commodity ──────────────────────────────────────────────────────────────

    def get_commodities(self) -> dict:
        return _raise_if_error(self.repo.get_commodities())

    def add_commodity(self, req: CommodityAddRequest) -> dict:
        return _raise_if_error(
            self.repo.add_commodity(
                req.commodity_code, req.commodity_name, req.description,
                req.is_active, req.created_by,
            )
        )

    def update_commodity(self, req: CommodityUpdateRequest) -> dict:
        return _raise_if_error(
            self.repo.update_commodity(
                req.commodity_id, req.commodity_code, req.commodity_name,
                req.description, req.is_active, req.modified_by,
            )
        )

    def delete_commodity(self, req: CommodityDeleteRequest) -> dict:
        return _raise_if_error(self.repo.delete_commodity(req.commodity_id, req.modified_by))

    # ── Container Size ─────────────────────────────────────────────────────────

    def get_cont_sizes(self) -> dict:
        return _raise_if_error(self.repo.get_cont_sizes())

    def add_cont_size(self, req: ContSizeAddRequest) -> dict:
        return _raise_if_error(self.repo.add_cont_size(req.size_code, req.description))

    def update_cont_size(self, req: ContSizeUpdateRequest) -> dict:
        return _raise_if_error(self.repo.update_cont_size(req.size_id, req.size_code, req.description))

    def delete_cont_size(self, req: ContSizeDeleteRequest) -> dict:
        return _raise_if_error(self.repo.delete_cont_size(req.size_id))

    # ── Container Type ─────────────────────────────────────────────────────────

    def get_cont_types(self) -> dict:
        return _raise_if_error(self.repo.get_cont_types())

    def add_cont_type(self, req: ContTypeAddRequest) -> dict:
        return _raise_if_error(self.repo.add_cont_type(req.type_code, req.iso_code, req.type_desc))

    def update_cont_type(self, req: ContTypeUpdateRequest) -> dict:
        return _raise_if_error(self.repo.update_cont_type(req.type_id, req.type_code, req.iso_code, req.type_desc))

    def delete_cont_type(self, req: ContTypeDeleteRequest) -> dict:
        return _raise_if_error(self.repo.delete_cont_type(req.type_id))

    # ── Process ────────────────────────────────────────────────────────────────

    def get_processes(self) -> dict:
        return _raise_if_error(self.repo.get_processes())

    def add_process(self, req: ProcessAddRequest) -> dict:
        return _raise_if_error(self.repo.add_process(req.process_code, req.process_name, req.process_category, req.sort_order))

    def update_process(self, req: ProcessUpdateRequest) -> dict:
        return _raise_if_error(self.repo.update_process(req.process_id, req.process_code, req.process_name, req.process_category, req.sort_order, req.is_active))

    def delete_process(self, req: ProcessDeleteRequest) -> dict:
        return _raise_if_error(self.repo.delete_process(req.process_id))

    # ── Customer ───────────────────────────────────────────────────────────────

    def get_customers(self) -> dict:
        return _raise_if_error(self.repo.get_customers())

    def add_customer(self, req: CustomerAddRequest) -> dict:
        return _raise_if_error(self.repo.add_customer(**req.model_dump()))

    def update_customer(self, req: CustomerUpdateRequest) -> dict:
        return _raise_if_error(self.repo.update_customer(**req.model_dump()))

    def delete_customer(self, req: CustomerDeleteRequest) -> dict:
        return _raise_if_error(self.repo.delete_customer(req.customer_id))

    # ── Line ───────────────────────────────────────────────────────────────────

    def get_lines(self) -> dict:
        return _raise_if_error(self.repo.get_lines())

    def add_line(self, req: LineAddRequest) -> dict:
        return _raise_if_error(self.repo.add_line(**req.model_dump()))

    def update_line(self, req: LineUpdateRequest) -> dict:
        return _raise_if_error(self.repo.update_line(**req.model_dump()))

    def delete_line(self, req: LineDeleteRequest) -> dict:
        return _raise_if_error(self.repo.delete_line(req.line_id, req.modified_by))

    # ── Inventory Entry ────────────────────────────────────────────────────────

    def submit_inventory_entry(self, req: InventoryEntrySubmitRequest) -> dict:
        return _raise_if_error(
            self.repo.submit_inventory_entry(
                req.container_no, req.block_name, req.row_no, req.column_name, req.device_id
            )
        )
