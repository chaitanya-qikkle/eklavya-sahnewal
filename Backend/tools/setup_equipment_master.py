"""Applies Equipment DB migration.

This creates the stored procedures required by the Equipment endpoints:
- TBL_MST_EQUIPMENT_INSERT
- TBL_MST_EQUIPMENT_GET
- TBL_MST_EQUIPMENT_UPDATE
- TBL_MST_EQUIPMENT_DELETE

Usage (from YMS_Backend):
  python setup_equipment_master.py

It uses the same DB connection settings as the API (see .env / db_configs/configs.py).
"""

from __future__ import annotations

import re
from pathlib import Path

from utils.db_utils import SQLManager


_GO_SPLIT_RE = re.compile(r"^\s*GO\s*$", re.IGNORECASE | re.MULTILINE)


def _split_batches(sql_text: str) -> list[str]:
    # Split by lines containing only GO (SSMS batch separator)
    parts = _GO_SPLIT_RE.split(sql_text)
    return [p.strip() for p in parts if p and p.strip()]


def main() -> None:
    sql_path = Path(__file__).resolve().parent / "db_configs" / "equipment_master_migration.sql"
    if not sql_path.exists():
        raise SystemExit(f"Migration file not found: {sql_path}")

    sql_text = sql_path.read_text(encoding="utf-8")
    batches = _split_batches(sql_text)

    if not batches:
        raise SystemExit("No SQL batches found in migration file")

    db = SQLManager()
    try:
        if db.conn is None:
            raise SystemExit("Database connection unavailable. Check DB_* settings in .env")

        cursor = db.conn.cursor()
        for i, batch in enumerate(batches, start=1):
            cursor.execute(batch)
            # Consume any result sets to avoid pyodbc state issues
            while True:
                if cursor.description:
                    cursor.fetchall()
                if not cursor.nextset():
                    break

            db.conn.commit()
            print(f"Applied batch {i}/{len(batches)}")

        print("Equipment migration applied successfully")
    finally:
        db.close_connection()


if __name__ == "__main__":
    main()
