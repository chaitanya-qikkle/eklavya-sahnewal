from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from db_configs.db_connection import get_db_connection


def main() -> None:
    table = sys.argv[1] if len(sys.argv) > 1 else None
    if not table:
        raise SystemExit("Provide a table name")

    conn = get_db_connection()
    if not conn:
        raise SystemExit("Failed to connect")

    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? ORDER BY ORDINAL_POSITION",
            (table,),
        )
        print(cur.fetchall())
    finally:
        conn.close()


if __name__ == "__main__":
    main()
