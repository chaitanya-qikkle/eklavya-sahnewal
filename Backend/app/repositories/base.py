"""
BaseRepository — common helpers shared by all domain repositories.

Every repository inherits from this and receives a SQLManager instance,
keeping all DB interaction in the repository layer.
"""
from app.core.database import SQLManager


class BaseRepository:
    def __init__(self, db: SQLManager):
        self.db = db

    def _exec(self, sql: str, params: tuple = (), commit: bool = False) -> dict:
        return self.db.execute_query(sql, params, commit=commit)

    def _exec_all(self, sql: str, params: tuple = (), commit: bool = False) -> dict:
        return self.db.execute_query(sql, params, commit=commit, fetch_all=True)
