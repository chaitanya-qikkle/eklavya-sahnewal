from typing import Any, Dict

from core.db_executor import StoredProcedureExecutor
from core.errors import DatabaseError


class AuthRepository:
    def __init__(self, db: StoredProcedureExecutor):
        self.db = db

    async def login(self, username: str, password: str) -> Dict[str, Any]:
        result = await self.db.execute_sp(
            "SP_USER_LOGIN",
            [username, password],
            fetch="one",
        )

        if not result:
            raise DatabaseError("Stored procedure did not return a response")

        return result
