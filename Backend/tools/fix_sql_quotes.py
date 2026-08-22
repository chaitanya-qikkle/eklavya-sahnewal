from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROC_ROOT = ROOT / "StoredProcedures"
EXCLUDE_DIRS = {"_schema"}


def _iter_sql_files() -> list[Path]:
    files: list[Path] = []
    for path in PROC_ROOT.rglob("*.sql"):
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def main() -> None:
    for path in _iter_sql_files():
        text = path.read_text(encoding="utf-8")
        if '"' not in text:
            continue
        text = text.replace('"', "'")
        path.write_text(text, encoding="utf-8")
        print(f"Fixed quotes: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
