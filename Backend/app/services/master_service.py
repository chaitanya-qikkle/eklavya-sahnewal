"""
Master data service — business logic for all master-data domains.

Validates SP responses, raises HTTP exceptions for failures, and returns
clean response dicts. Every INS/UPD/DEL stored procedure in this domain
returns its success flag as a single-row result set (column name is
"result", case varies) — `_raise_if_error` normalizes that.

`plant_id` on write requests defaults to the caller's session plant
(`current_user["plant_id"]`) when the request doesn't specify one.
"""
from typing import Optional

from fastapi import HTTPException, status

from app.repositories.master_repository import MasterRepository
from app.schemas.master import (
    ActivityAddRequest, ActivityDeleteRequest, ActivityUpdateRequest,
    BlockAddRequest, BlockDeleteRequest, BlockUpdateRequest,
    ClientAddRequest, ClientDeleteRequest, ClientUpdateRequest,
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


def _raise_if_error(result: dict, default_message: str = "Operation failed") -> dict:
    """Raise HTTPException if the SP call failed or its @IsSuccess flag came back 0."""
    if result.get("status") == "error":
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("message", default_message),
        )
    data = result.get("data") or []
    if data:
        row = data[0]
        flag = row.get("result")
        if flag is None:
            flag = row.get("Result")
        if flag is None:
            flag = row.get("IsSuccess")
        if flag is None:
            flag = row.get("issuccess")
        if flag is not None and int(flag) != 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=default_message)
    return {"status": "success", "message": default_message, "data": data}


class MasterService:
    def __init__(self, repo: MasterRepository):
        self.repo = repo

    @staticmethod
    def _plant(explicit: Optional[int], current_user: dict) -> Optional[int]:
        return explicit if explicit is not None else current_user.get("plant_id")

    # ── Plant ──────────────────────────────────────────────────────────────────

    def get_plants(self) -> dict:
        return self.repo.get_plants()

    def add_plant(self, req: PlantAddRequest, current_user: dict) -> dict:
        result = self.repo.add_plant(
            req.url, req.plant_name, req.product_type_id, req.client_id, current_user["user_id"],
        )
        return _raise_if_error(result, "Plant created successfully")

    def update_plant(self, req: PlantUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_plant(
            req.plant_id, req.url, req.plant_name, req.product_type_id, req.client_id, current_user["user_id"],
        )
        return _raise_if_error(result, "Plant updated successfully")

    def delete_plant(self, req: PlantDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_plant(req.plant_id, current_user["user_id"]), "Plant deleted successfully")

    # ── Product Type ───────────────────────────────────────────────────────────

    def get_product_types(self) -> dict:
        return self.repo.get_product_types()

    # ── Client ─────────────────────────────────────────────────────────────────

    def get_clients(self) -> dict:
        return self.repo.get_clients()

    def add_client(self, req: ClientAddRequest, current_user: dict) -> dict:
        result = self.repo.add_client(req.client_name, req.logo, current_user["user_id"])
        return _raise_if_error(result, "Client created successfully")

    def update_client(self, req: ClientUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_client(req.client_id, req.client_name, req.logo, current_user["user_id"])
        return _raise_if_error(result, "Client updated successfully")

    def delete_client(self, req: ClientDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_client(req.client_id, current_user["user_id"]), "Client deleted successfully")

    # ── Yard Type ──────────────────────────────────────────────────────────────

    def get_yard_types(self) -> dict:
        return self.repo.get_yard_types()

    def add_yard_type(self, req: YardTypeAddRequest, current_user: dict) -> dict:
        result = self.repo.add_yard_type(req.yard_type_name, self._plant(req.plant_id, current_user), current_user["user_id"])
        return _raise_if_error(result, "Yard type created successfully")

    def update_yard_type(self, req: YardTypeUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_yard_type(
            req.yard_type_id, req.yard_type_name, self._plant(req.plant_id, current_user), current_user["user_id"],
        )
        return _raise_if_error(result, "Yard type updated successfully")

    def delete_yard_type(self, req: YardTypeDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_yard_type(req.yard_type_id, current_user["user_id"]), "Yard type deleted successfully")

    # ── Yard ───────────────────────────────────────────────────────────────────

    def get_yard_master_lists(self) -> dict:
        result = self.repo.get_yard_master_lists()
        if result.get("status") != "success":
            return {"status": "error", "message": result.get("message", "Query failed"), "data": {"yards": [], "plants": [], "blocks": []}}
        sets = result.get("data") or []
        yards  = sets[0] if len(sets) > 0 else []
        plants = sets[1] if len(sets) > 1 else []
        blocks = sets[2] if len(sets) > 2 else []
        return {"status": "success", "data": {"yards": yards, "plants": plants, "blocks": blocks}}

    def get_yards(self) -> dict:
        return self.repo.get_yards()

    def get_yard(self, yard_id: int) -> dict:
        return self.repo.get_yard(yard_id)

    def add_yard(self, req: YardAddRequest, current_user: dict) -> dict:
        result = self.repo.add_yard(
            req.yard_name, self._plant(req.plant_id, current_user), req.yard_code, req.yard_type_id, current_user["user_id"],
        )
        return _raise_if_error(result, "Yard created successfully")

    def update_yard(self, req: YardUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_yard(
            req.yard_id, req.yard_name, self._plant(req.plant_id, current_user), req.yard_code,
            req.yard_type_id, current_user["user_id"],
        )
        return _raise_if_error(result, "Yard updated successfully")

    def delete_yard(self, req: YardDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_yard(req.yard_id, current_user["user_id"]), "Yard deleted successfully")

    # ── Block ──────────────────────────────────────────────────────────────────

    def get_blocks(self) -> dict:
        return self.repo.get_blocks()

    def get_block(self, block_id: int) -> dict:
        return self.repo.get_block(block_id)

    def add_block(self, req: BlockAddRequest, current_user: dict) -> dict:
        result = self.repo.add_block(
            self._plant(req.plant_id, current_user), req.block_name, req.marking_start,
            req.no_of_rows, req.no_of_columns, req.no_of_stack, req.total_container_count,
            req.line_id, req.cont_size_id, req.comodity, req.yard_id, req.process_id,
            current_user["user_id"],
        )
        return _raise_if_error(result, "Block created successfully")

    def update_block(self, req: BlockUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_block(
            req.block_id, self._plant(req.plant_id, current_user), req.block_name, req.marking_start,
            req.no_of_rows, req.no_of_columns, req.no_of_stack, req.total_container_count,
            req.line_id, req.cont_size_id, req.comodity, req.yard_id, req.process_id,
            current_user["user_id"],
        )
        return _raise_if_error(result, "Block updated successfully")

    def delete_block(self, req: BlockDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_block(req.block_id, current_user["user_id"]), "Block deleted successfully")

    # ── Activity ───────────────────────────────────────────────────────────────

    def get_activities(self) -> dict:
        return self.repo.get_activities()

    def add_activity(self, req: ActivityAddRequest, current_user: dict) -> dict:
        result = self.repo.add_activity(req.activity_name, self._plant(req.plant_id, current_user), current_user["user_id"])
        return _raise_if_error(result, "Activity created successfully")

    def update_activity(self, req: ActivityUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_activity(
            req.activity_id, req.activity_name, self._plant(req.plant_id, current_user), current_user["user_id"],
        )
        return _raise_if_error(result, "Activity updated successfully")

    def delete_activity(self, req: ActivityDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_activity(req.activity_id, current_user["user_id"]), "Activity deleted successfully")

    # ── Container Size ─────────────────────────────────────────────────────────

    def get_cont_sizes(self) -> dict:
        return self.repo.get_cont_sizes()

    def add_cont_size(self, req: ContSizeAddRequest, current_user: dict) -> dict:
        result = self.repo.add_cont_size(req.cont_size, self._plant(req.plant_id, current_user), current_user["user_id"])
        return _raise_if_error(result, "Container size created successfully")

    def update_cont_size(self, req: ContSizeUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_cont_size(
            req.cont_size_id, req.cont_size, self._plant(req.plant_id, current_user), current_user["user_id"],
        )
        return _raise_if_error(result, "Container size updated successfully")

    def delete_cont_size(self, req: ContSizeDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_cont_size(req.cont_size_id, current_user["user_id"]), "Container size deleted successfully")

    # ── Container Type ─────────────────────────────────────────────────────────

    def get_cont_types(self) -> dict:
        return self.repo.get_cont_types()

    def add_cont_type(self, req: ContTypeAddRequest, current_user: dict) -> dict:
        result = self.repo.add_cont_type(req.cont_type_name, self._plant(req.plant_id, current_user), current_user["user_id"])
        return _raise_if_error(result, "Container type created successfully")

    def update_cont_type(self, req: ContTypeUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_cont_type(
            req.cont_type_id, req.cont_type_name, self._plant(req.plant_id, current_user), current_user["user_id"],
        )
        return _raise_if_error(result, "Container type updated successfully")

    def delete_cont_type(self, req: ContTypeDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_cont_type(req.cont_type_id, current_user["user_id"]), "Container type deleted successfully")

    # ── Process ────────────────────────────────────────────────────────────────

    def get_processes(self) -> dict:
        return self.repo.get_processes()

    def add_process(self, req: ProcessAddRequest, current_user: dict) -> dict:
        result = self.repo.add_process(req.process_name, self._plant(req.plant_id, current_user), current_user["user_id"])
        return _raise_if_error(result, "Process created successfully")

    def update_process(self, req: ProcessUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_process(
            req.process_id, req.process_name, self._plant(req.plant_id, current_user), current_user["user_id"],
        )
        return _raise_if_error(result, "Process updated successfully")

    def delete_process(self, req: ProcessDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_process(req.process_id, current_user["user_id"]), "Process deleted successfully")

    # ── Line ───────────────────────────────────────────────────────────────────

    def get_lines(self) -> dict:
        return self.repo.get_lines()

    def add_line(self, req: LineAddRequest, current_user: dict) -> dict:
        result = self.repo.add_line(req.line_name, req.color, self._plant(req.plant_id, current_user), current_user["user_id"])
        return _raise_if_error(result, "Line created successfully")

    def update_line(self, req: LineUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_line(
            req.line_id, req.line_name, req.color, self._plant(req.plant_id, current_user), current_user["user_id"],
        )
        return _raise_if_error(result, "Line updated successfully")

    def delete_line(self, req: LineDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_line(req.line_id, current_user["user_id"]), "Line deleted successfully")

    # ── Equipment ──────────────────────────────────────────────────────────────

    def get_equipment(self) -> dict:
        return self.repo.get_equipment()

    def get_equipment_by_id(self, eqp_id: int) -> dict:
        return self.repo.get_equipment_by_id(eqp_id)

    def add_equipment(self, req: EquipmentAddRequest, current_user: dict) -> dict:
        result = self.repo.add_equipment(
            self._plant(req.plant_id, current_user), req.equipment_code, req.equipment_name, req.device_id,
            req.installation_date, req.owner_name, req.equipment_type, req.equipment_maker,
            req.sim_id, req.vtm_imei_no, req.is_remove_device, current_user["user_id"],
        )
        return _raise_if_error(result, "Equipment created successfully")

    def update_equipment(self, req: EquipmentUpdateRequest, current_user: dict) -> dict:
        result = self.repo.update_equipment(
            req.eqp_id, self._plant(req.plant_id, current_user), req.equipment_code, req.equipment_name, req.device_id,
            req.installation_date, req.owner_name, req.equipment_type, req.equipment_maker,
            req.sim_id, req.vtm_imei_no, req.is_remove_device, current_user["user_id"],
        )
        return _raise_if_error(result, "Equipment updated successfully")

    def delete_equipment(self, req: EquipmentDeleteRequest, current_user: dict) -> dict:
        return _raise_if_error(self.repo.delete_equipment(req.eqp_id, current_user["user_id"]), "Equipment deleted successfully")

    # ── Inventory Entry (unchanged — not part of this pass) ──────────────────────

    def submit_inventory_entry(self, req: InventoryEntrySubmitRequest) -> dict:
        return _raise_if_error(
            self.repo.submit_inventory_entry(
                req.container_no, req.block_name, req.row_no, req.column_name, req.device_id
            )
        )
