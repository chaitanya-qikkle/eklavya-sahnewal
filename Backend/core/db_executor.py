from __future__ import annotations

import logging
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from starlette.concurrency import run_in_threadpool

from core.errors import DatabaseError
from db_configs.db_connection import get_db_session

logger = logging.getLogger(__name__)

ParamsType = Union[Dict[str, Any], Iterable[Any]]


class StoredProcedureExecutor:
    """Executes stored procedures using a pooled pyodbc connection."""

    async def execute_sp(
        self,
        sp_name: str,
        params: Optional[ParamsType] = None,
        fetch: str = "all",
    ) -> Any:
        return await run_in_threadpool(self._execute_sp_sync, sp_name, params, fetch)

    def _execute_sp_sync(
        self,
        sp_name: str,
        params: Optional[ParamsType],
        fetch: str,
    ) -> Any:
        sql, values = self._build_exec(sp_name, params)
        start = time.perf_counter()

        try:
            with get_db_session() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, values)
                result = self._fetch_result(cursor, fetch)

            elapsed_ms = int((time.perf_counter() - start) * 1000)
            logger.info("DB SP %s completed in %sms", sp_name, elapsed_ms)
            return result
        except Exception as exc:
            logger.exception("DB SP %s failed", sp_name)
            raise DatabaseError("Database operation failed") from exc

    @staticmethod
    def _build_exec(sp_name: str, params: Optional[ParamsType]) -> Tuple[str, Tuple[Any, ...]]:
        if not params:
            return f"EXEC {sp_name}", ()

        if isinstance(params, dict):
            placeholders = ", ".join([f"@{key} = ?" for key in params.keys()])
            return f"EXEC {sp_name} {placeholders}", tuple(params.values())

        values = tuple(params)
        placeholders = ", ".join(["?"] * len(values))
        return f"EXEC {sp_name} {placeholders}", values

    @staticmethod
    def _fetch_result(cursor, fetch: str) -> Any:
        if fetch == "all_sets":
            return StoredProcedureExecutor._fetch_all_sets(cursor)

        if not cursor.description:
            return [] if fetch == "all" else None

        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        data = [dict(zip(columns, row)) for row in rows]

        if fetch == "one":
            return data[0] if data else None

        return data

    @staticmethod
    def _fetch_all_sets(cursor) -> List[List[Dict[str, Any]]]:
        result_sets: List[List[Dict[str, Any]]] = []

        while True:
            if cursor.description:
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                result_sets.append([dict(zip(columns, row)) for row in rows])

            if not cursor.nextset():
                break

        return result_sets


def get_db_executor() -> StoredProcedureExecutor:
    return StoredProcedureExecutor()
