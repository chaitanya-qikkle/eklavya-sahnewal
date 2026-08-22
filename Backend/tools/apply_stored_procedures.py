from __future__ import annotations

import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from utils.db_utils import SQLManager

PROC_ROOT = ROOT / "StoredProcedures"
EXCLUDE_DIRS = {"_schema"}
GO_SPLIT = re.compile(r"^\s*GO\s*$", re.IGNORECASE | re.MULTILINE)


def _iter_sql_files() -> list[Path]:
    files: list[Path] = []
    for path in PROC_ROOT.rglob("*.sql"):
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def _split_batches(sql_text: str) -> list[str]:
    parts = GO_SPLIT.split(sql_text)
    return [p.strip() for p in parts if p and p.strip()]


def main() -> None:
    files = _iter_sql_files()
    if not files:
        raise SystemExit("No stored procedure files found")

    db = SQLManager()
    try:
        if db.conn is None:
            raise SystemExit("Database connection unavailable")

        cursor = db.conn.cursor()
        for sql_path in files:
            sql_text = sql_path.read_text(encoding="utf-8")
            batches = _split_batches(sql_text)
            for batch in batches:
                cursor.execute(batch)
                # Consume any result sets
                while True:
                    if cursor.description:
                        cursor.fetchall()
                    if not cursor.nextset():
                        break
            db.conn.commit()
            print(f"Applied: {sql_path.relative_to(ROOT)}")
    finally:
        db.close_connection()


if __name__ == "__main__":
    main()
