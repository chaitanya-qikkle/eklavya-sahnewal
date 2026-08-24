"""
Master data repository — DB calls for all master-data domains.

Every call here targets a real stored procedure that exists in YMS_EKLAVYA
(the GET_ESS_MST_*/INS_ESS_MST_*/UPD_ESS_MST_*/DEL_ESS_MST_* family). All
INS/UPD/DEL procedures share one shape: they take the full field set plus
@CreatedBy (a user GUID) and an @IsSuccess OUTPUT int, and return that flag
as a single-row result set aliased "result".

Device Data and Inventory Entry below are left untouched — they call SP
names that don't exist in this database and are out of scope for this pass.
"""
from typing import Optional

from app.repositories.base import BaseRepository


class MasterRepository(BaseRepository):

    # ── Plant ──────────────────────────────────────────────────────────────────

    def get_plants(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_PLANT_LIST")

    def get_plant(self, plant_id: int) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_PLANT_BYID ?", (plant_id,))

    def add_plant(self, url: Optional[str], plant_name: str, product_type_id: Optional[int],
                  client_id: Optional[int], created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_PLANT ?, ?, ?, ?, ?, ?, ?",
            (0, url, plant_name, product_type_id, client_id, created_by, 0),
            commit=True,
        )

    def update_plant(self, plant_id: int, url: Optional[str], plant_name: str,
                      product_type_id: Optional[int], client_id: Optional[int], modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_PLANT ?, ?, ?, ?, ?, ?, ?",
            (plant_id, url, plant_name, product_type_id, client_id, modified_by, 0),
            commit=True,
        )

    def delete_plant(self, plant_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_PLANT ?, ?, ?, ?, ?, ?, ?",
            (plant_id, "", "", None, None, deleted_by, 0),
            commit=True,
        )

    # ── Product Type (read-only dropdown for Plant) ──────────────────────────────

    def get_product_types(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_PRODUCTTYPE")

    # ── Client ─────────────────────────────────────────────────────────────────

    def get_clients(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_CLIENT")

    def get_client(self, client_id: int) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_CLIENT_BYID ?", (client_id,))

    def add_client(self, client_name: str, logo: Optional[str], created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_CLIENT ?, ?, ?, ?, ?",
            (0, client_name, logo, created_by, 0),
            commit=True,
        )

    def update_client(self, client_id: int, client_name: str, logo: Optional[str], modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_CLIENT ?, ?, ?, ?, ?",
            (client_id, client_name, logo, modified_by, 0),
            commit=True,
        )

    def delete_client(self, client_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_CLIENT ?, ?, ?, ?, ?",
            (client_id, "", "", deleted_by, 0),
            commit=True,
        )

    # ── Yard Type ──────────────────────────────────────────────────────────────

    def get_yard_types(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_YARDTYPE_LIST")

    def add_yard_type(self, yard_type_name: str, plant_id: int, created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_YARDTYPE ?, ?, ?, ?, ?",
            (0, yard_type_name, plant_id, created_by, 0),
            commit=True,
        )

    def update_yard_type(self, yard_type_id: int, yard_type_name: str, plant_id: int, modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_YARDTYPE ?, ?, ?, ?, ?",
            (yard_type_id, yard_type_name, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_yard_type(self, yard_type_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_YARDTYPE ?, ?, ?, ?, ?",
            (yard_type_id, "", None, deleted_by, 0),
            commit=True,
        )

    # ── Yard ───────────────────────────────────────────────────────────────────

    def get_yard_master_lists(self) -> dict:
        """Combined yards + plants + blocks, used to populate the Yard/Block management page."""
        return self._exec_all(
            "EXEC dbo.GET_ESS_MST_YARD_LIST; EXEC dbo.GET_ESS_MST_PLANT_LIST; EXEC dbo.GET_ESS_MST_BLOCK_LIST",
        )

    def get_yards(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_YARD_LIST")

    def get_yard(self, yard_id: int) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_YARD_BYID ?", (yard_id,))

    def add_yard(self, yard_name: str, plant_id: int, yard_code: Optional[str],
                 yard_type_id: Optional[int], created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_YARD ?, ?, ?, ?, ?, ?, ?",
            (0, yard_name, plant_id, yard_code, yard_type_id, created_by, 0),
            commit=True,
        )

    def update_yard(self, yard_id: int, yard_name: str, plant_id: int, yard_code: Optional[str],
                     yard_type_id: Optional[int], modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_YARD ?, ?, ?, ?, ?, ?, ?",
            (yard_id, yard_name, plant_id, yard_code, yard_type_id, modified_by, 0),
            commit=True,
        )

    def delete_yard(self, yard_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_YARD ?, ?, ?, ?, ?, ?, ?",
            (yard_id, "", None, None, None, deleted_by, 0),
            commit=True,
        )

    # ── Block ──────────────────────────────────────────────────────────────────

    def get_blocks(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_BLOCK_LIST")

    def get_block(self, block_id: int) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_BLOCK_BYID ?", (block_id,))

    def add_block(self, plant_id: int, block_name: str, marking_start: Optional[str],
                  no_of_rows: Optional[int], no_of_columns: Optional[int], no_of_stack: Optional[int],
                  total_container_count: Optional[int], line_id: Optional[int], cont_size_id: Optional[int],
                  comodity: Optional[str], yard_id: Optional[int], process_id: Optional[int],
                  created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_BLOCK ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (0, plant_id, block_name, marking_start, no_of_rows, no_of_columns, no_of_stack,
             total_container_count, line_id, cont_size_id, comodity, yard_id, process_id, created_by, 0),
            commit=True,
        )

    def update_block(self, block_id: int, plant_id: int, block_name: str, marking_start: Optional[str],
                      no_of_rows: Optional[int], no_of_columns: Optional[int], no_of_stack: Optional[int],
                      total_container_count: Optional[int], line_id: Optional[int], cont_size_id: Optional[int],
                      comodity: Optional[str], yard_id: Optional[int], process_id: Optional[int],
                      modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_BLOCK ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (block_id, plant_id, block_name, marking_start, no_of_rows, no_of_columns, no_of_stack,
             total_container_count, line_id, cont_size_id, comodity, yard_id, process_id, modified_by, 0),
            commit=True,
        )

    def delete_block(self, block_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_BLOCK ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (block_id, None, "", None, None, None, None, None, None, None, None, None, None, deleted_by, 0),
            commit=True,
        )

    # ── Activity ───────────────────────────────────────────────────────────────

    def get_activities(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_ACTIVITY_LIST")

    def add_activity(self, activity_name: str, plant_id: int, created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_ACTIVITY ?, ?, ?, ?, ?",
            (0, activity_name, plant_id, created_by, 0),
            commit=True,
        )

    def update_activity(self, activity_id: int, activity_name: str, plant_id: int, modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_ACTIVITY ?, ?, ?, ?, ?",
            (activity_id, activity_name, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_activity(self, activity_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_ACTIVITY ?, ?, ?, ?, ?",
            (activity_id, "", None, deleted_by, 0),
            commit=True,
        )

    # ── Container Size ─────────────────────────────────────────────────────────

    def get_cont_sizes(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_CONTAINER_SIZE_LIST")

    def add_cont_size(self, cont_size: str, plant_id: int, created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_CONTAINER_SIZE ?, ?, ?, ?, ?",
            (0, cont_size, plant_id, created_by, 0),
            commit=True,
        )

    def update_cont_size(self, cont_size_id: int, cont_size: str, plant_id: int, modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_CONTAINER_SIZE ?, ?, ?, ?, ?",
            (cont_size_id, cont_size, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_cont_size(self, cont_size_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_CONTAINER_SIZE ?, ?, ?, ?, ?",
            (cont_size_id, "", None, deleted_by, 0),
            commit=True,
        )

    # ── Container Type ─────────────────────────────────────────────────────────

    def get_cont_types(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_CONTAINER_TYPE_LIST")

    def add_cont_type(self, cont_type_name: str, plant_id: int, created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_CONTAINER_TYPE ?, ?, ?, ?, ?",
            (0, cont_type_name, plant_id, created_by, 0),
            commit=True,
        )

    def update_cont_type(self, cont_type_id: int, cont_type_name: str, plant_id: int, modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_CONTAINER_TYPE ?, ?, ?, ?, ?",
            (cont_type_id, cont_type_name, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_cont_type(self, cont_type_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_CONTAINER_TYPE ?, ?, ?, ?, ?",
            (cont_type_id, "", None, deleted_by, 0),
            commit=True,
        )

    # ── Process ────────────────────────────────────────────────────────────────

    def get_processes(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_PROCESS_LIST")

    def add_process(self, process_name: str, plant_id: int, created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_PROCESS ?, ?, ?, ?, ?",
            (0, process_name, plant_id, created_by, 0),
            commit=True,
        )

    def update_process(self, process_id: int, process_name: str, plant_id: int, modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_PROCESS ?, ?, ?, ?, ?",
            (process_id, process_name, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_process(self, process_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_PROCESS ?, ?, ?, ?, ?",
            (process_id, "", None, deleted_by, 0),
            commit=True,
        )

    # ── Line ───────────────────────────────────────────────────────────────────

    def get_lines(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_LINE_LIST")

    def add_line(self, line_name: str, color: Optional[str], plant_id: int, created_by: str) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_LINE ?, ?, ?, ?, ?, ?",
            (0, line_name, color, plant_id, created_by, 0),
            commit=True,
        )

    def update_line(self, line_id: int, line_name: str, color: Optional[str], plant_id: int, modified_by: str) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_LINE ?, ?, ?, ?, ?, ?",
            (line_id, line_name, color, plant_id, modified_by, 0),
            commit=True,
        )

    def delete_line(self, line_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_LINE ?, ?, ?, ?, ?, ?",
            (line_id, "", None, None, deleted_by, 0),
            commit=True,
        )

    # ── Equipment ──────────────────────────────────────────────────────────────

    def get_equipment(self) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_EQUIPMENT_LIST")

    def get_equipment_by_id(self, eqp_id: int) -> dict:
        return self._exec("EXEC dbo.GET_ESS_MST_EQUIPMENT_BYID ?", (eqp_id,))

    def add_equipment(
        self, plant_id: Optional[int], equipment_code: Optional[str], equipment_name: str,
        device_id: Optional[str], installation_date: Optional[str], owner_name: Optional[str],
        equipment_type: Optional[str], equipment_maker: Optional[str], sim_id: Optional[str],
        vtm_imei_no: Optional[str], is_remove_device: bool, created_by: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.INS_ESS_MST_EQUIPMENT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (0, plant_id, equipment_code, equipment_name, device_id, installation_date, owner_name,
             equipment_type, equipment_maker, sim_id, vtm_imei_no, int(is_remove_device), created_by, 0),
            commit=True,
        )

    def update_equipment(
        self, eqp_id: int, plant_id: Optional[int], equipment_code: Optional[str], equipment_name: str,
        device_id: Optional[str], installation_date: Optional[str], owner_name: Optional[str],
        equipment_type: Optional[str], equipment_maker: Optional[str], sim_id: Optional[str],
        vtm_imei_no: Optional[str], is_remove_device: bool, modified_by: str,
    ) -> dict:
        return self._exec(
            "EXEC dbo.UPD_ESS_MST_EQUIPMENT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (eqp_id, plant_id, equipment_code, equipment_name, device_id, installation_date, owner_name,
             equipment_type, equipment_maker, sim_id, vtm_imei_no, int(is_remove_device), modified_by, 0),
            commit=True,
        )

    def delete_equipment(self, eqp_id: int, deleted_by: str) -> dict:
        return self._exec(
            "EXEC dbo.DEL_ESS_MST_EQUIPMENT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (eqp_id, None, "", "", None, None, None, None, None, None, None, 0, deleted_by, 0),
            commit=True,
        )

    # ── Device Data (unchanged — not part of this pass; SP names below are not real) ──

    def get_device_data(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_DEVICE_DATA_LIST ?", (plant_id,))

    def get_device_data_latest(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_DEVICE_DATA_LATEST ?", (plant_id,))

    def get_device_live_locations(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_DEVICE_DATA_LIVE_LOCATIONS ?", (plant_id,))

    # ── Inventory Entry (unchanged — not part of this pass) ──────────────────────

    def submit_inventory_entry(
        self,
        container_no: str,
        block_name: str,
        row_no: str,
        column_name: str,
        device_id: Optional[str],
    ) -> dict:
        return self._exec(
            "EXEC SP_INVENTORY_ENTRY_SUBMIT ?, ?, ?, ?, ?",
            (container_no, block_name, row_no, column_name, device_id),
            commit=True,
        )
