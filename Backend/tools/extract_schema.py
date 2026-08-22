from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
IN_PATH = ROOT / "StoredProcedures" / "_schema" / "schema_dump.json"
OUT_PATH = ROOT / "StoredProcedures" / "_schema" / "selected_tables.json"

TABLES = {
    "TBL_MST_USER",
    "TBL_MST_ROLE",
    "TBL_MST_PLANT",
    "TBL_CONTAINER_INVENTORY",
    "TBL_EKDEVICE_DATA",
    "TBL_MST_EQUIPMENT",
    "TBL_EQUIPMENT_TRANSACTION",
    "ESS_MST_YARD",
    "ESS_MST_BLOCK",
}


def _filter_rows(rows: List[Dict[str, Any]], key: str) -> List[Dict[str, Any]]:
    return [r for r in rows if r.get(key) in TABLES]


def main() -> None:
    data = json.loads(IN_PATH.read_text(encoding="utf-8"))

    selected = {
        "tables": _filter_rows(data.get("tables", []), "table_name"),
        "columns": _filter_rows(data.get("columns", []), "table_name"),
        "primary_keys": _filter_rows(data.get("primary_keys", []), "table_name"),
        "foreign_keys": [
            r
            for r in data.get("foreign_keys", [])
            if r.get("fk_table") in TABLES or r.get("ref_table") in TABLES
        ],
        "indexes": _filter_rows(data.get("indexes", []), "table_name"),
    }

    OUT_PATH.write_text(json.dumps(selected, indent=2, ensure_ascii=True), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
