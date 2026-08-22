import re
from pathlib import Path

from utils.db_utils import SQLManager

ROOT = Path(__file__).resolve().parent
EXCLUDE_DIRS = {"env", "__pycache__", ".git", "node_modules"}

PROC_PATTERN = re.compile(r"\bSP_[A-Za-z0-9_]+\b")
TABLE_PATTERN = re.compile(r"\bTBL_[A-Za-z0-9_]+\b")


def _should_skip(path: Path) -> bool:
    return any(part in EXCLUDE_DIRS for part in path.parts)


def _collect_matches(pattern: re.Pattern) -> set[str]:
    matches: set[str] = set()
    for path in ROOT.rglob("*"):
        if _should_skip(path) or not path.is_file():
            continue
        if path.suffix.lower() not in {".py", ".sql", ".md"}:
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for match in pattern.findall(content):
            matches.add(match.upper())
    return matches


def main() -> None:
    required_procs = _collect_matches(PROC_PATTERN)
    required_tables = _collect_matches(TABLE_PATTERN)

    db = SQLManager()
    try:
        procs_res = db.execute_query("EXEC dbo.SP_SYS_LIST_PROCEDURES")
        existing_procs = {row["name"].upper() for row in procs_res.get("data", [])}

        tables_res = db.execute_query("EXEC dbo.SP_SYS_LIST_TABLES")
        existing_tables = {row["name"].upper() for row in tables_res.get("data", [])}

        missing_procs = sorted(required_procs - existing_procs)
        missing_tables = sorted(required_tables - existing_tables)

        print("=== Missing Stored Procedures ===")
        if missing_procs:
            for name in missing_procs:
                print(name)
        else:
            print("None")

        print("\n=== Missing Tables ===")
        if missing_tables:
            for name in missing_tables:
                print(name)
        else:
            print("None")

    finally:
        db.close_connection()


if __name__ == "__main__":
    main()
