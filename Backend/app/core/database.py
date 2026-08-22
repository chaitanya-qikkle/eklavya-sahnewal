"""
Database layer — connection pool and query executor.

Two execution helpers are provided:
  - SQLManager  : synchronous, used by all v1 API endpoints
  - run_sp()    : async wrapper around pyodbc, used by v2 modular endpoints

Both read from the same pyodbc connection pool (pyodbc.pooling = True).
"""
from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

import pyodbc
from starlette.concurrency import run_in_threadpool

from app.core.config import (
    DB_DATABASE,
    DB_ENCRYPT,
    DB_PASSWORD,
    DB_SERVER,
    DB_TRUST_CERT,
    DB_USERNAME,
)

logger = logging.getLogger(__name__)

pyodbc.pooling = True  # reuse connections across requests


# ── Driver selection ──────────────────────────────────────────────────────────

def _pick_driver() -> Optional[str]:
    available = pyodbc.drivers()
    for candidate in (
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "SQL Server",
    ):
        if candidate in available:
            return candidate
    return None


# ── Raw connection ────────────────────────────────────────────────────────────

def get_connection() -> Optional[pyodbc.Connection]:
    """Return a new pyodbc connection, or None if the driver/config is missing."""
    driver = _pick_driver()
    if not driver:
        logger.error(
            "No SQL Server ODBC driver found. Available: %s", pyodbc.drivers()
        )
        return None

    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USERNAME};"
        f"PWD={DB_PASSWORD};"
        f"Encrypt={DB_ENCRYPT};"
        f"TrustServerCertificate={DB_TRUST_CERT};"
    )
    try:
        conn = pyodbc.connect(conn_str, timeout=10)
        return conn
    except Exception as exc:
        logger.error("DB connection failed: %s", exc)
        return None


@contextmanager
def db_session():
    """
    Context manager that yields a connection and auto-commits/rolls back.

    Usage:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
    """
    conn = get_connection()
    if not conn:
        raise RuntimeError("Failed to establish database connection")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Synchronous executor (v1 API) ─────────────────────────────────────────────

class SQLManager:
    """
    Lightweight synchronous SQL executor used by the v1 API endpoints.
    Each endpoint creates one instance, uses it, then calls close().

    Returned dict shape:
      success → { status: "success", message: str, data: list[dict] }
      error   → { status: "error",   message: str }
    """

    def __init__(self):
        self.conn = get_connection()
        if not self.conn:
            logger.error("SQLManager: connection failed")

    def execute(
        self,
        sql: str,
        params: tuple = (),
        commit: bool = False,
        fetch_all_sets: bool = False,
    ) -> dict:
        if not self.conn:
            self.conn = get_connection()
        if not self.conn:
            return {"status": "error", "message": "Database connection unavailable"}

        try:
            cursor = self.conn.cursor()
            cursor.execute(sql, params)

            if fetch_all_sets:
                result_sets: list = []
                while True:
                    if cursor.description:
                        cols = [c[0] for c in cursor.description]
                        result_sets.append([dict(zip(cols, row)) for row in cursor.fetchall()])
                    if not cursor.nextset():
                        break
                if commit:
                    self.conn.commit()
                cursor.close()
                return {"status": "success", "message": "Query executed successfully", "data": result_sets}

            if cursor.description:
                cols = [c[0] for c in cursor.description]
                rows = [dict(zip(cols, row)) for row in cursor.fetchall()]
                if commit:
                    self.conn.commit()
                cursor.close()
                return {"status": "success", "message": "Query executed successfully", "data": rows}

            # No result set (INSERT / UPDATE / DELETE)
            if commit:
                self.conn.commit()
            affected = cursor.rowcount
            cursor.close()
            return {"status": "success", "message": "Executed successfully", "rows_affected": affected}

        except Exception as exc:
            if self.conn:
                self.conn.rollback()
            logger.error("SQLManager error: %s", exc)
            return {"status": "error", "message": f"Database operation failed: {exc}"}

    # Keep the old name so existing v1 code keeps working without changes
    def execute_query(self, sql, params=None, commit=False, fetch_all=False):
        return self.execute(sql, params or (), commit=commit, fetch_all_sets=fetch_all)

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception as exc:
                logger.error("Error closing connection: %s", exc)

    # Keep old name so existing v1 code keeps working
    def close_connection(self):
        self.close()


# ── Async executor (v2 / modular API) ────────────────────────────────────────

ParamsType = Union[Dict[str, Any], Iterable[Any]]


class SPExecutor:
    """
    Async stored-procedure executor for the v2 modular API.
    Runs synchronous pyodbc calls on a thread pool so FastAPI stays non-blocking.

    Usage:
        executor = SPExecutor()
        rows = await executor.run("SP_NAME", {"param1": val1, "param2": val2})
        row  = await executor.run("SP_NAME", [val1, val2], fetch="one")
    """

    async def run(
        self,
        sp_name: str,
        params: Optional[ParamsType] = None,
        fetch: str = "all",
    ) -> Any:
        return await run_in_threadpool(self._run_sync, sp_name, params, fetch)

    def _run_sync(self, sp_name: str, params: Optional[ParamsType], fetch: str) -> Any:
        sql, values = self._build_exec(sp_name, params)
        t0 = time.perf_counter()
        try:
            with db_session() as conn:
                cur = conn.cursor()
                cur.execute(sql, values)
                result = self._fetch(cur, fetch)
            logger.info("SP %s completed in %dms", sp_name, int((time.perf_counter() - t0) * 1000))
            return result
        except Exception as exc:
            logger.exception("SP %s failed", sp_name)
            raise RuntimeError("Database operation failed") from exc

    @staticmethod
    def _build_exec(sp_name: str, params: Optional[ParamsType]) -> Tuple[str, tuple]:
        if not params:
            return f"EXEC {sp_name}", ()
        if isinstance(params, dict):
            placeholders = ", ".join(f"@{k} = ?" for k in params)
            return f"EXEC {sp_name} {placeholders}", tuple(params.values())
        values = tuple(params)
        return f"EXEC {sp_name} {', '.join(['?'] * len(values))}", values

    @staticmethod
    def _fetch(cursor, fetch: str) -> Any:
        if fetch == "all_sets":
            sets: List[List[Dict[str, Any]]] = []
            while True:
                if cursor.description:
                    cols = [c[0] for c in cursor.description]
                    sets.append([dict(zip(cols, r)) for r in cursor.fetchall()])
                if not cursor.nextset():
                    break
            return sets

        if not cursor.description:
            return [] if fetch == "all" else None

        cols = [c[0] for c in cursor.description]
        rows = [dict(zip(cols, r)) for r in cursor.fetchall()]
        return rows[0] if fetch == "one" else rows


def get_sp_executor() -> SPExecutor:
    """FastAPI dependency that returns an SPExecutor instance."""
    return SPExecutor()
