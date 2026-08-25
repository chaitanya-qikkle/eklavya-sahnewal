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


# ── Distinct gate names (for the gate filter dropdown) ────────────────────────
@router.get("/gate-names")
def get_gate_names():
    db = SQLManager()
    try:
        result = db.execute_query(
            "SELECT DISTINCT GateName FROM EKL_TRN_CONTAINER_ESURVEY "
            "WHERE GateName IS NOT NULL AND LTRIM(RTRIM(GateName)) <> '' "
            "ORDER BY GateName"
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}

        names = sorted({(r.get("GateName") or "").strip() for r in (result.get("data") or [])} - {""})
        return {"status": "success", "data": names}
    except Exception as e:
        logger.exception("gate-names error")
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


# ── Pre-Gate Survey (paginated) — uses GET_ESURVEY_DETAIL SP ──────────────────
@router.get("/pre-gate-survey")
def get_pre_gate_survey(
    from_date:    Optional[str] = None,
    to_date:      Optional[str] = None,
    container_no: Optional[str] = None,
    gate_type:    Optional[str] = None,
    gate_name:    Optional[str] = None,
    plant_id:     int = Query(0),
    page:      int = Query(1,  ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Paginated pre-gate e-survey report using GET_ESURVEY_DETAIL SP.
    Returns: { status, total, gate_in_count, gate_out_count, page, page_size, total_pages, data }
    """
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_ESURVEY_DETAIL @PlantID = ?, @FromDate = ?, @ToDate = ?, @ContainerNo = NULL, @GateName = ?",
            (plant_id, from_date or None, to_date or None, gate_name or None),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": [], "total": 0}

        rows = result.get("data", []) or []

        for row in rows:
            _normalize(row)

        cn = (container_no or "").strip().upper()
        if cn:
            rows = [r for r in rows if cn in (r.get("ContainerNo") or "").upper()]

        if gate_type:
            gt = gate_type.strip().upper()
            rows = [r for r in rows if r.get("GateType") == gt]

        gate_in_count  = sum(1 for r in rows if r["GateType"] == "GATE_IN")
        gate_out_count = sum(1 for r in rows if r["GateType"] == "GATE_OUT")

        rows.sort(key=lambda r: str(r.get("SurveyTime") or ""), reverse=True)

        total       = len(rows)
        total_pages = max(1, -(-total // page_size))
        start       = (page - 1) * page_size
        page_rows   = rows[start : start + page_size]

        logger.info("pre-gate-survey page=%d/%d size=%d total=%d", page, total_pages, len(page_rows), total)
        return {
            "status":         "success",
            "total":          total,
            "gate_in_count":  gate_in_count,
            "gate_out_count": gate_out_count,
            "page":           page,
            "page_size":      page_size,
            "total_pages":    total_pages,
            "data":           page_rows,
        }

    except Exception as e:
        logger.exception("pre-gate-survey error")
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": [], "total": 0}
    finally:
        db.close_connection()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _img_url(gate: str, date_part: str, cont: str, side: str) -> Optional[str]:
    """Return API image URL only if the file exists on disk."""
    rel  = f"{gate}/{date_part}/{cont}/{side}.jpg"
    if (STITCHING_DIR / rel).is_file():
        return f"/v1/container/img?p={rel}"
    return None


def _normalize(row: dict):
    """Map GET_ESURVEY_DETAIL SP columns → frontend-expected field names."""
    cont_no = (row.get("ContNo") or "").strip()
    row["ContainerNo"] = cont_no
    row["ContSize"]    = row.get("ContainerSize") or ""
    row["ContType"]    = row.get("ContainerType") or ""
    row["Status"]      = row.get("ContainerStatus") or ""
    row["Location"]    = row.get("ContainerLocationName") or ""
    row["VehicleNo"]   = row.get("TrailerNo") or row.get("ANPRVehicleNo") or ""

    gate_name_raw   = (row.get("GateName") or "").strip()
    row["GateName"] = gate_name_raw

    survey_time = row.get("SurveyTime") or row.get("GateInDate") or None
    row["SurveyTime"]  = survey_time
    row["GateInDate"]  = row.get("GateInDate") or None
    row["GateOutDate"] = row.get("GateOutDate") or None
    row["GateType"]    = "GATE_OUT" if row["GateOutDate"] else "GATE_IN"

    date_src = survey_time
    if cont_no and date_src and gate_name_raw:
        try:
            dp = str(date_src)[:10].replace("-", "")
            row["IMG_LEFT"]  = _img_url(gate_name_raw, dp, cont_no, "left")
            row["IMG_RIGHT"] = _img_url(gate_name_raw, dp, cont_no, "right")
            row["IMG_TOP"]   = _img_url(gate_name_raw, dp, cont_no, "top")
            row["IMG_BACK"]  = _img_url(gate_name_raw, dp, cont_no, "back")
        except Exception:
            row["IMG_LEFT"] = row["IMG_RIGHT"] = row["IMG_TOP"] = row["IMG_BACK"] = None
    else:
        row["IMG_LEFT"] = row["IMG_RIGHT"] = row["IMG_TOP"] = row["IMG_BACK"] = None
