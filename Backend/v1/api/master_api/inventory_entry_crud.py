import os
import json
from fastapi import APIRouter, Query
from typing import Optional

from utils.db_utils import SQLManager
from models.master_model import InventoryEntrySubmitRequest

inventory_entry_router = APIRouter()

# Plant ID — set MOBILE_PLANT_ID in .env to override, default 1
_PLANT_ID = int(os.getenv("MOBILE_PLANT_ID", "1"))


@inventory_entry_router.get("/get-block-list")
def get_block_list():
    """
    Block list with Row/Column ranges for the Inventory Mapping screen — GET_BLOCK_LIST.

    Returns one row per block: { Block, MinRow, MaxRow, MinColumn, MaxColumn }.
    The SP returns its result as a single JSON string (FOR JSON PATH), so it's
    parsed here rather than treated as normal tabular rows.
    """
    db = SQLManager()
    try:
        response = db.execute_query("EXEC dbo.GET_BLOCK_LIST")
        if response.get("status") != "success":
            return response

        data = response.get("data") or []
        # FOR JSON PATH comes back as a single column/row containing the JSON text,
        # split across multiple rows if long — concatenate before parsing.
        json_text = "".join(
            next(iter(row.values()), "") for row in data if isinstance(row, dict)
        )
        blocks = json.loads(json_text) if json_text else []

        return {"status": "success", "data": blocks}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@inventory_entry_router.get("/get-inventory-list")
def get_inventory_list():
    """
    All in-yard containers with their current location details.
    No parameters required — returns every container where GATE_OUT_DATE IS NULL.
    """
    db = SQLManager()
    try:
        result = db.execute_query("EXEC dbo.SP_INVENTORY_LIST")
        if not result or result.get("status") != "success":
            return {
                "status": "error",
                "message": (result or {}).get("message", "Query failed"),
                "data": [],
            }
        rows = result.get("data") or []
        return {"status": "success", "total_records": len(rows), "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@inventory_entry_router.post("/submit")
def submit_inventory_entry(request: InventoryEntrySubmitRequest):
    """
    API 2 — Submit the Inventory Entry form (no token required).

    Steps inside SP_INVENTORY_ENTRY_SUBMIT (atomic transaction):
      1. Resolve LocationID from Block + Row + Column  (ESS_MST_LOCATION)
      2. Resolve INVENTORY_ID from ContainerNo         (TBL_CONTAINER_INVENTORY)
      3. INSERT into TBL_EQUIPMENT_TRANSACTION
      4. UPDATE TBL_CONTAINER_INVENTORY.LAST_LOCATION + LAST_MOVED_DATE

    Body:
      container_no : "CAIU1234567"
      block_name   : "P1-L-4"
      row_no       : "A"
      column_name  : "8"
      device_id    : optional
    """
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.SP_INVENTORY_ENTRY_SUBMIT ?, ?, ?, ?, ?, ?, ?",
            (
                _PLANT_ID,
                request.container_no.strip().upper(),
                request.block_name.strip(),
                request.row_no.strip(),
                request.column_name.strip(),
                request.device_id,
                None,
            ),
            commit=True,
        )

        if response.get("status") == "success":
            data = response.get("data") or []
            if data and isinstance(data, list):
                sp_result = data[0]
                if sp_result.get("Status") == 0:
                    return {
                        "status": "error",
                        "message": sp_result.get("Message", "Operation failed"),
                    }
                return {
                    "status": "success",
                    "message": sp_result.get("Message", "Inventory entry submitted successfully"),
                    "data": sp_result,
                }
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
