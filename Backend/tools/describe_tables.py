from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "StoredProcedures" / "_schema" / "selected_tables.json"
OUT_PATH = ROOT / "StoredProcedures" / "_schema" / "selected_tables_summary.txt"


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    columns = data.get("columns", [])

    by_table = {}
    for col in columns:
        table = col.get("table_name")
        by_table.setdefault(table, []).append(col)

    lines = []
    for table in sorted(by_table.keys()):
        lines.append(f"[{table}]")
        for col in by_table[table]:
            dtype = col.get("data_type")
            max_length = col.get("max_length")
            precision = col.get("precision")
            scale = col.get("scale")
            null_flag = "NULL" if col.get("is_nullable") else "NOT NULL"
            length = ""
            if dtype in {"varchar", "nvarchar", "char", "nchar"}:
                length = f"({max_length})"
            elif dtype in {"decimal", "numeric"}:
                length = f"({precision},{scale})"
            lines.append(f"- {col.get('column_name')}: {dtype}{length} {null_flag}")
        lines.append("")

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
