"""Truncates ESS_MST_LOCATION and reloads it from Results.xml at the repo root.

Usage (from Backend/):
  python tools/load_ess_mst_location.py
"""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db_configs.db_connection import get_db_connection

XML_PATH = Path(__file__).resolve().parent.parent.parent / "Results.xml"

COLUMNS = [
    "LocationID",
    "PlantID",
    "YardName",
    "BlockName",
    "ColumnName",
    "RowNo",
    "ContainerLocationName",
    "ContainerLocationName1",
    "StackNo",
    "SlotId",
    "IsEmpty",
    "SequenceNo",
    "IsBook",
]


def _text_or_none(row: ET.Element, tag: str):
    el = row.find(tag)
    if el is None:
        return None
    nil = el.get("{http://www.w3.org/2001/XMLSchema-instance}nil")
    if nil == "true":
        return None
    return el.text


def parse_rows(xml_path: Path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    rows = []
    for row in root.findall("Row"):
        values = [_text_or_none(row, col) for col in COLUMNS]
        rows.append(values)
    return rows


def main() -> None:
    if not XML_PATH.exists():
        raise SystemExit(f"Results.xml not found at {XML_PATH}")

    rows = parse_rows(XML_PATH)
    if not rows:
        raise SystemExit("No <Row> elements found in Results.xml")

    print(f"Parsed {len(rows)} rows from {XML_PATH}")

    conn = get_db_connection()
    if conn is None:
        raise SystemExit("Database connection unavailable. Check .env DB_* settings")

    placeholders = ", ".join("?" for _ in COLUMNS)
    insert_sql = (
        f"INSERT INTO dbo.ESS_MST_LOCATION ({', '.join(COLUMNS)}) "
        f"VALUES ({placeholders})"
    )

    try:
        cursor = conn.cursor()
        cursor.execute("TRUNCATE TABLE dbo.ESS_MST_LOCATION")
        cursor.execute("SET IDENTITY_INSERT dbo.ESS_MST_LOCATION ON")

        cursor.fast_executemany = True
        cursor.executemany(insert_sql, rows)

        cursor.execute("SET IDENTITY_INSERT dbo.ESS_MST_LOCATION OFF")
        conn.commit()
        print(f"Inserted {len(rows)} rows into ESS_MST_LOCATION")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
