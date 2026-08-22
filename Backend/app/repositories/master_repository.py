"""
Master data repository — DB calls for all master-data domains.
(Plant, Yard, Block, Activity, Commodity, ContSize, ContType,
 Process, Customer, Equipment, EquipmentTransaction, Line, Breakdown, DeviceData, InventoryEntry)
"""
from typing import Optional

from app.repositories.base import BaseRepository


class MasterRepository(BaseRepository):

    # ── Plant ──────────────────────────────────────────────────────────────────

    def get_plants(self, plant_id: Optional[int] = None) -> dict:
        return self._exec(
            "EXEC dbo.SP_MASTER_PLANT_LIST ?, ?, ?, ?",
            (plant_id, 0, "PLANT_NAME", "ASC"),
        )

    def add_plant(
        self,
        plant_code: Optional[str],
        plant_name: str,
        location: Optional[str],
        client_id: Optional[int],
        is_active: bool,
        user_id: int,
    ) -> dict:
        return self._exec(
            """EXEC SP_SavePlant
                @PlantID = NULL,
                @PlantCode = ?,
                @PlantName = ?,
                @Location = ?,
                @ClientID = ?,
                @IsActive = ?,
                @UserID = ?""",
            (plant_code, plant_name, location, client_id, int(is_active), user_id),
            commit=True,
        )

    def update_plant(
        self,
        plant_id: int,
        plant_code: Optional[str],
        plant_name: str,
        location: Optional[str],
        client_id: Optional[int],
        is_active: bool,
        user_id: int,
    ) -> dict:
        return self._exec(
            """EXEC SP_SavePlant
                @PlantID = ?,
                @PlantCode = ?,
                @PlantName = ?,
                @Location = ?,
                @ClientID = ?,
                @IsActive = ?,
                @UserID = ?""",
            (plant_id, plant_code, plant_name, location, client_id, int(is_active), user_id),
            commit=True,
        )

    def delete_plant(self, plant_id: int, user_id: int) -> dict:
        return self._exec(
            "EXEC dbo.SP_MASTER_PLANT_DELETE ?, ?",
            (plant_id, user_id),
            commit=True,
        )

    # ── Activity ───────────────────────────────────────────────────────────────

    def get_activities(self) -> dict:
        return self._exec("EXEC dbo.SP_ACTIVITY_GET_ALL")

    def add_activity(self, activity_name: str, user_id: int) -> dict:
        return self._exec(
            "EXEC SP_ACTIVITY_ADD ?, ?", (activity_name, user_id), commit=True
        )

    def update_activity(self, activity_id: int, activity_name: str, is_active: bool, user_id: int) -> dict:
        return self._exec(
            "EXEC SP_ACTIVITY_MODIFY ?, ?, ?, ?",
            (activity_id, activity_name, int(is_active), user_id),
            commit=True,
        )

    def delete_activity(self, activity_id: int, user_id: int) -> dict:
        return self._exec(
            "EXEC SP_ACTIVITY_DELETE ?, ?", (activity_id, user_id), commit=True
        )

    # ── Commodity ──────────────────────────────────────────────────────────────

    def get_commodities(self) -> dict:
        return self._exec("EXEC dbo.SP_COMMODITY_GET_ALL")

    def add_commodity(
        self,
        commodity_code: str,
        commodity_name: str,
        description: Optional[str],
        is_active: bool,
        created_by: int,
    ) -> dict:
        return self._exec(
            "EXEC SP_COMMODITY_ADD ?, ?, ?, ?, ?",
            (commodity_code, commodity_name, description, int(is_active), created_by),
            commit=True,
        )

    def update_commodity(
        self,
        commodity_id: int,
        commodity_code: str,
        commodity_name: str,
        description: Optional[str],
        is_active: bool,
        modified_by: int,
    ) -> dict:
        return self._exec(
            "EXEC SP_COMMODITY_MODIFY ?, ?, ?, ?, ?, ?",
            (commodity_id, commodity_code, commodity_name, description, int(is_active), modified_by),
            commit=True,
        )

    def delete_commodity(self, commodity_id: int, modified_by: int) -> dict:
        return self._exec(
            "EXEC SP_COMMODITY_DELETE ?, ?", (commodity_id, modified_by), commit=True
        )

    # ── Container Size ─────────────────────────────────────────────────────────

    def get_cont_sizes(self) -> dict:
        return self._exec("EXEC dbo.SP_CONT_SIZE_GET_ALL")

    def add_cont_size(self, size_code: str, description: Optional[str]) -> dict:
        return self._exec(
            "EXEC SP_CONT_SIZE_ADD ?, ?", (size_code, description), commit=True
        )

    def update_cont_size(self, size_id: int, size_code: str, description: Optional[str]) -> dict:
        return self._exec(
            "EXEC SP_CONT_SIZE_MODIFY ?, ?, ?", (size_id, size_code, description), commit=True
        )

    def delete_cont_size(self, size_id: int) -> dict:
        return self._exec("EXEC SP_CONT_SIZE_DELETE ?", (size_id,), commit=True)

    # ── Container Type ─────────────────────────────────────────────────────────

    def get_cont_types(self) -> dict:
        return self._exec("EXEC dbo.SP_CONT_TYPE_GET_ALL")

    def add_cont_type(self, type_code: str, iso_code: Optional[str], type_desc: Optional[str]) -> dict:
        return self._exec(
            "EXEC SP_CONT_TYPE_ADD ?, ?, ?", (type_code, iso_code, type_desc), commit=True
        )

    def update_cont_type(self, type_id: int, type_code: str, iso_code: Optional[str], type_desc: Optional[str]) -> dict:
        return self._exec(
            "EXEC SP_CONT_TYPE_MODIFY ?, ?, ?, ?", (type_id, type_code, iso_code, type_desc), commit=True
        )

    def delete_cont_type(self, type_id: int) -> dict:
        return self._exec("EXEC SP_CONT_TYPE_DELETE ?", (type_id,), commit=True)

    # ── Process ────────────────────────────────────────────────────────────────

    def get_processes(self) -> dict:
        return self._exec("EXEC dbo.SP_PROCESS_GET_ALL")

    def add_process(
        self,
        process_code: str,
        process_name: str,
        process_category: Optional[str],
        sort_order: Optional[int],
    ) -> dict:
        return self._exec(
            "EXEC SP_PROCESS_ADD ?, ?, ?, ?",
            (process_code, process_name, process_category, sort_order),
            commit=True,
        )

    def update_process(
        self,
        process_id: int,
        process_code: str,
        process_name: str,
        process_category: Optional[str],
        sort_order: Optional[int],
        is_active: bool,
    ) -> dict:
        return self._exec(
            "EXEC SP_PROCESS_MODIFY ?, ?, ?, ?, ?, ?",
            (process_id, process_code, process_name, process_category, sort_order, int(is_active)),
            commit=True,
        )

    def delete_process(self, process_id: int) -> dict:
        return self._exec("EXEC SP_PROCESS_DELETE ?", (process_id,), commit=True)

    # ── Customer ───────────────────────────────────────────────────────────────

    def get_customers(self) -> dict:
        return self._exec("EXEC dbo.SP_CUSTOMER_GET_ALL")

    def add_customer(self, **kwargs) -> dict:
        r = kwargs
        return self._exec(
            "EXEC SP_CUSTOMER_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (r["customer_code"], r["customer_name"], r["customer_type"], r["gst_no"],
             r["address"], r["contact_person"], r["contact_no"], r["email_id"],
             int(r["is_active"]), r["created_by"]),
            commit=True,
        )

    def update_customer(self, **kwargs) -> dict:
        r = kwargs
        return self._exec(
            "EXEC SP_CUSTOMER_MODIFY ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
            (r["customer_id"], r["customer_code"], r["customer_name"], r["customer_type"],
             r["gst_no"], r["address"], r["contact_person"], r["contact_no"], r["email_id"],
             int(r["is_active"]), r["modified_by"]),
            commit=True,
        )

    def delete_customer(self, customer_id: int) -> dict:
        return self._exec("EXEC SP_CUSTOMER_DELETE ?", (customer_id,), commit=True)

    # ── Line ───────────────────────────────────────────────────────────────────

    def get_lines(self) -> dict:
        return self._exec("EXEC dbo.SP_LINE_GET_ALL")

    def add_line(self, **kwargs) -> dict:
        r = kwargs
        return self._exec(
            "EXEC SP_LINE_ADD ?, ?, ?, ?, ?, ?, ?",
            (r["line_code"], r["line_name"], r["contact_person"], r["contact_no"],
             r["email_id"], int(r["is_active"]), r["created_by"]),
            commit=True,
        )

    def update_line(self, **kwargs) -> dict:
        r = kwargs
        return self._exec(
            "EXEC SP_LINE_MODIFY ?, ?, ?, ?, ?, ?, ?, ?",
            (r["line_id"], r["line_code"], r["line_name"], r["contact_person"],
             r["contact_no"], r["email_id"], int(r["is_active"]), r["modified_by"]),
            commit=True,
        )

    def delete_line(self, line_id: int, modified_by: int) -> dict:
        return self._exec("EXEC SP_LINE_DELETE ?, ?", (line_id, modified_by), commit=True)

    # ── Equipment ──────────────────────────────────────────────────────────────

    def get_equipment(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_EQUIPMENT_LIST ?", (plant_id,))

    def add_equipment(self, params: tuple) -> dict:
        return self._exec("EXEC dbo.SP_EQUIPMENT_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?", params, commit=True)

    def update_equipment(self, params: tuple) -> dict:
        return self._exec("EXEC dbo.SP_EQUIPMENT_UPDATE ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?", params, commit=True)

    def delete_equipment(self, eqp_id: int, modified_by: int) -> dict:
        return self._exec("EXEC SP_EQUIPMENT_DELETE ?, ?", (eqp_id, modified_by), commit=True)

    # ── Equipment Transaction ──────────────────────────────────────────────────

    def get_equipment_transactions(self) -> dict:
        return self._exec("EXEC dbo.SP_MOVEMENT_TRANSACTION_LIST")

    def add_equipment_transaction(self, params: tuple) -> dict:
        return self._exec("EXEC dbo.SP_MOVEMENT_TRANSACTION_ADD ?, ?, ?, ?, ?, ?, ?, ?, ?, ?", params, commit=True)

    def update_equipment_transaction(self, params: tuple) -> dict:
        return self._exec("EXEC dbo.SP_MOVEMENT_TRANSACTION_UPDATE ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?", params, commit=True)

    def delete_equipment_transaction(self, transaction_id: int) -> dict:
        return self._exec("EXEC dbo.SP_MOVEMENT_TRANSACTION_DELETE ?", (transaction_id,), commit=True)

    # ── Device Data ────────────────────────────────────────────────────────────

    def get_device_data(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_DEVICE_DATA_LIST ?", (plant_id,))

    def get_device_data_latest(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_DEVICE_DATA_LATEST ?", (plant_id,))

    def get_device_live_locations(self, plant_id: Optional[int] = None) -> dict:
        return self._exec("EXEC dbo.SP_DEVICE_DATA_LIVE_LOCATIONS ?", (plant_id,))

    # ── Inventory Entry ────────────────────────────────────────────────────────

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
