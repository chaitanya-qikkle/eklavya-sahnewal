from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from db_configs.db_connection import get_db_connection
OUT_DIR = ROOT / "StoredProcedures" / "_schema"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def _rows_to_dicts(cursor) -> List[Dict[str, Any]]:
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def main() -> None:
    conn = get_db_connection()
    if not conn:
        raise SystemExit("Failed to connect to database")

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT s.name AS schema_name, t.name AS table_name, t.object_id
            FROM sys.tables t
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE t.is_ms_shipped = 0
            ORDER BY s.name, t.name
            """
        )
        tables = _rows_to_dicts(cursor)

        cursor.execute(
            """
            SELECT
                s.name AS schema_name,
                t.name AS table_name,
                c.name AS column_name,
                ty.name AS data_type,
                c.max_length,
                c.precision,
                c.scale,
                c.is_nullable,
                c.is_identity,
                dc.definition AS default_definition
            FROM sys.columns c
            INNER JOIN sys.tables t ON t.object_id = c.object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
            LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
            WHERE t.is_ms_shipped = 0
            ORDER BY s.name, t.name, c.column_id
            """
        )
        columns = _rows_to_dicts(cursor)

        cursor.execute(
            """
            SELECT
                s.name AS schema_name,
                t.name AS table_name,
                kc.name AS constraint_name,
                c.name AS column_name,
                ic.key_ordinal
            FROM sys.key_constraints kc
            INNER JOIN sys.tables t ON t.object_id = kc.parent_object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.index_columns ic
                ON ic.object_id = t.object_id AND ic.index_id = kc.unique_index_id
            INNER JOIN sys.columns c
                ON c.object_id = t.object_id AND c.column_id = ic.column_id
            WHERE kc.type = 'PK'
            ORDER BY s.name, t.name, kc.name, ic.key_ordinal
            """
        )
        primary_keys = _rows_to_dicts(cursor)

        cursor.execute(
            """
            SELECT
                fs.name AS fk_schema,
                fkt.name AS fk_table,
                fk.name AS fk_name,
                fc.name AS fk_column,
                rs.name AS ref_schema,
                rt.name AS ref_table,
                rc.name AS ref_column,
                fkc.constraint_column_id AS ordinal
            FROM sys.foreign_keys fk
            INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            INNER JOIN sys.tables fkt ON fkt.object_id = fkc.parent_object_id
            INNER JOIN sys.schemas fs ON fs.schema_id = fkt.schema_id
            INNER JOIN sys.columns fc ON fc.object_id = fkt.object_id AND fc.column_id = fkc.parent_column_id
            INNER JOIN sys.tables rt ON rt.object_id = fkc.referenced_object_id
            INNER JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
            INNER JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
            ORDER BY fs.name, fkt.name, fk.name, fkc.constraint_column_id
            """
        )
        foreign_keys = _rows_to_dicts(cursor)

        cursor.execute(
            """
            SELECT
                s.name AS schema_name,
                i.name AS index_name,
                t.name AS table_name,
                i.is_unique,
                i.is_primary_key,
                i.type_desc,
                ic.key_ordinal,
                c.name AS column_name,
                ic.is_included_column
            FROM sys.indexes i
            INNER JOIN sys.tables t ON t.object_id = i.object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.index_columns ic
                ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            INNER JOIN sys.columns c
                ON c.object_id = t.object_id AND c.column_id = ic.column_id
            WHERE t.is_ms_shipped = 0 AND i.name IS NOT NULL
            ORDER BY s.name, t.name, i.name, ic.key_ordinal
            """
        )
        indexes = _rows_to_dicts(cursor)

        cursor.execute(
            """
            SELECT
                s.name AS schema_name,
                tt.name AS type_name,
                c.name AS column_name,
                ty.name AS data_type,
                c.max_length,
                c.precision,
                c.scale,
                c.is_nullable,
                c.column_id
            FROM sys.table_types tt
            INNER JOIN sys.schemas s ON s.schema_id = tt.schema_id
            INNER JOIN sys.columns c ON c.object_id = tt.type_table_object_id
            INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
            ORDER BY s.name, tt.name, c.column_id
            """
        )
        table_types = _rows_to_dicts(cursor)

        cursor.execute(
            """
            SELECT
                s.name AS schema_name,
                p.name AS proc_name,
                m.definition
            FROM sys.procedures p
            INNER JOIN sys.schemas s ON s.schema_id = p.schema_id
            INNER JOIN sys.sql_modules m ON m.object_id = p.object_id
            WHERE p.is_ms_shipped = 0
            ORDER BY s.name, p.name
            """
        )
        procedures = _rows_to_dicts(cursor)

        schema_data = {
            "tables": tables,
            "columns": columns,
            "primary_keys": primary_keys,
            "foreign_keys": foreign_keys,
            "indexes": indexes,
            "table_types": table_types,
            "procedures": procedures,
        }

        (OUT_DIR / "schema_dump.json").write_text(
            json.dumps(schema_data, indent=2, ensure_ascii=True),
            encoding="utf-8",
        )

        proc_sql = []
        for proc in procedures:
            schema = proc["schema_name"]
            name = proc["proc_name"]
            definition = proc["definition"] or ""
            header = f"-- {schema}.{name}\n"
            proc_sql.append(header + definition.strip() + "\n\n")

        (OUT_DIR / "procedures.sql").write_text(
            "".join(proc_sql), encoding="utf-8"
        )

        print(f"Schema exported to: {OUT_DIR}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
