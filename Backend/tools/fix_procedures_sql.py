from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "StoredProcedures" / "_schema" / "procedures.sql"

text = path.read_text(encoding="utf-8", errors="ignore")
pattern = re.compile(r"(?im)^create\s+proc(?:edure)?\b")
text = pattern.sub(lambda m: "GO\n" + m.group(0).upper(), text)
path.write_text(text, encoding="utf-8")
print("Updated procedures.sql with GO separators")
