from typing import Dict, Any

from core.db_executor import StoredProcedureExecutor
from core.errors import DatabaseError

class OrderRepository:
    def __init__(self, db: StoredProcedureExecutor):
        self.db = db

    async def create_order(self, plant_id: int, user_id: int, item_name: str, quantity: int, remarks: str) -> Dict[str, Any]:
        """
        Executes the stored procedure to create an order.
        All business logic resides in SP_CreateOrder.
        """
        params = {
            "PlantID": plant_id,
            "CreatedBy": user_id,
            "ItemName": item_name,
            "Quantity": quantity,
            "Remarks": remarks or "",
        }

        row = await self.db.execute_sp("SP_CreateOrder", params, fetch="one")

        if not row:
            raise DatabaseError("Stored procedure did not return a response")

        return row
