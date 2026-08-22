import os
import pathlib
import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from utils.db_utils import SQLManager

router = APIRouter()
logger = logging.getLogger(__name__)

STITCHING_DIR = pathlib.Path(os.getenv("STITCHING_DIR", r"D:\stitching\outputs"))

# ── Image endpoint ────────────────────────────────────────────────────────────
@router.get("/img", include_in_schema=False)
def serve_survey_image(p: str):
    """Serve a stitching image via the API path — works from any client machine."""
    try:
        target = (STITCHING_DIR / p).resolve()
        target.relative_to(STITCHING_DIR.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    suffix = target.suffix.lower()
    media  = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png" if suffix == ".png" else "application/octet-stream"
    return FileResponse(str(target), media_type=media, headers={"Cache-Control": "public, max-age=3600"})


# ── Gate Entry Report (paginated) — uses GET_GATEENTRY_REPORT SP ──────────────
@router.get("/pre-gate-survey")
def get_pre_gate_survey(
    from_date:    Optional[str] = None,
    to_date:      Optional[str] = None,
    container_no: Optional[str] = None,
    page:      int = Query(1,  ge=1),
    page_size: int = Query(20, ge=1, le=100),
    # kept for backwards-compat but unused now
    gate_type: Optional[str] = None,
):
    """
    Paginated gate entry report using GET_GATEENTRY_REPORT SP.
    Returns: { status, total, page, page_size, total_pages, data }
    """
    db = SQLManager()
    try:
        from datetime import date
        today = date.today().isoformat()
        fd = from_date or today
        td = to_date   or today

        result = db.execute_query(
            "EXEC dbo.GET_GATEENTRY_REPORT ?, ?, 0",
            (fd, td),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": [], "total": 0}

        rows = result.get("data", []) or []

        # Client-side container filter
        cn = (container_no or "").strip().upper()
        if cn:
            rows = [r for r in rows if cn in (r.get("ContainerNo") or "").upper()]

        total       = len(rows)
        total_pages = max(1, -(-total // page_size))
        start       = (page - 1) * page_size
        page_rows   = rows[start : start + page_size]

        # Fetch ContainerType/Size from inventory for all page rows
        all_containers = [r.get("ContainerNo", "").strip() for r in page_rows if r.get("ContainerNo")]
        inv_map = {}
        if all_containers:
            placeholders = ",".join("?" * len(all_containers))
            inv_result = db.execute_query(
                f"""
                SELECT ContNo AS ContainerNo, ContainerSize, ContainerType
                FROM (
                    SELECT ContNo, ContainerSize, ContainerType,
                           ROW_NUMBER() OVER (PARTITION BY ContNo ORDER BY CreatedDate DESC) AS rn
                    FROM IND_TRN_CONTAINER_INVENTORY
                    WHERE ContNo IN ({placeholders})
                ) t WHERE rn = 1
                """,
                tuple(all_containers),
            )
            for inv in (inv_result.get("data") or []):
                c = (inv.get("ContainerNo") or "").strip()
                if c:
                    inv_map[c] = inv

        for row in page_rows:
            _normalize_gate_entry(row, inv_map)

        logger.info("gate-entry-report page=%d/%d size=%d total=%d", page, total_pages, len(page_rows), total)
        return {
            "status":      "success",
            "total":       total,
            "page":        page,
            "page_size":   page_size,
            "total_pages": total_pages,
            "data":        page_rows,
        }

    except Exception as e:
        logger.exception("gate-entry-report error")
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": [], "total": 0}
    finally:
        db.close_connection()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalize_gate_entry(row: dict, inv_map: dict = {}):
    """Map GET_GATEENTRY_REPORT SP columns → frontend field names."""
    cont_no = (row.get("ContainerNo") or "").strip()
    row["ContainerNo"] = cont_no
    row["InDate"]      = row.get("InDate") or None
    row["CameraImg"]   = row.get("CameraImg") or None

    # ContainerType/Size — inventory always wins (SP values are often blank)
    inv = inv_map.get(cont_no, {})
    row["ContainerType"] = inv.get("ContainerType") or row.get("ContainerType") or ""
    row["ContainerSize"] = inv.get("ContainerSize") or row.get("ContainerSize") or ""

def _img_url(gate: str, date_part: str, cont: str, side: str) -> Optional[str]:
    """Return API image URL only if the file exists on disk."""
    rel  = f"{gate}/{date_part}/{cont}/{side}.jpg"
    if (STITCHING_DIR / rel).is_file():
        return f"/v1/container/img?p={rel}"
    return None


def _normalize(row: dict):
    """Normalize SP column names → frontend-expected field names."""
    # SP returns: ContainerNo, GateName, GateType, SurveyTime, DetectedTime, Left1, Right1, Top1
    cont_no = (
        row.get("ContainerNo") or row.get("CONTAINER_NO") or ""
    ).strip()
    row["ContainerNo"] = cont_no

    gate_name_raw  = (row.get("GateName") or "").strip()
    row["GateName"] = gate_name_raw

    survey_time = row.get("SurveyTime") or None
    row["SurveyTime"] = survey_time
    row["GateInDate"]  = row.get("GateInDate") or row.get("GATE_IN_DATE") or None
    row["GateOutDate"] = row.get("GateOutDate") or row.get("GATE_OUT_DATE") or None

    # GateType already set by SP; keep it, fallback via GateName
    sp_gate_type = (row.get("GateType") or "").strip().upper()
    if sp_gate_type in ("GATE_IN", "GATE_OUT"):
        row["GateType"] = sp_gate_type
    elif row["GateOutDate"] or "OUT" in gate_name_raw.upper():
        row["GateType"] = "GATE_OUT"
    else:
        row["GateType"] = "GATE_IN"

    row["Status"]    = row.get("INVENTORY_STATUS") or row.get("Status") or ""
    row["ContSize"]  = row.get("Cont_Size")  or row.get("ContSize")  or ""
    row["ContType"]  = row.get("Cont_Type")  or row.get("ContType")  or ""
    row["Process"]   = row.get("ProcessCode") or row.get("Process")  or ""
    row["DocumentNo"] = row.get("DOCUMENT_NO") or row.get("DocumentNo") or ""

    date_src = survey_time
    if cont_no and date_src and gate_name_raw:
        try:
            dp = str(date_src)[:10].replace("-", "")
            row["IMG_LEFT"]  = _img_url(gate_name_raw, dp, cont_no, "left")
            row["IMG_RIGHT"] = _img_url(gate_name_raw, dp, cont_no, "right")
            row["IMG_TOP"]   = _img_url(gate_name_raw, dp, cont_no, "top")
        except Exception:
            row["IMG_LEFT"] = row["IMG_RIGHT"] = row["IMG_TOP"] = None
    else:
        row["IMG_LEFT"] = row["IMG_RIGHT"] = row["IMG_TOP"] = None
