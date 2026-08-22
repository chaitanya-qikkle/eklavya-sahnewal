"""
Container service — business logic for container inventory, live status, e-survey.
All queries go through stored procedures via ContainerRepository.
"""
import pathlib
from typing import Optional

from fastapi import HTTPException, status

from app.repositories.container_repository import ContainerRepository


class ContainerService:
    def __init__(self, repo: ContainerRepository):
        self.repo = repo

    def get_container_inventory(
        self,
        page_index: int,
        page_size: int,
        search_for: Optional[str],
    ) -> dict:
        result = self.repo.get_container_inventory(page_index, page_size, search_for)
        if result.get("status") != "success":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("message"))

        all_sets       = result["data"]
        rows           = all_sets[0] if all_sets else []
        process_counts = all_sets[1] if len(all_sets) > 1 else []
        total          = rows[0]["TOTAL_RECORDS"] if rows else 0
        total_pages    = max(1, (total + page_size - 1) // page_size)

        for row in rows:
            row.pop("TOTAL_RECORDS", None)

        return {
            "status":          "success",
            "page_index":      page_index,
            "page_size":       page_size,
            "total_records":   total,
            "total_pages":     total_pages,
            "has_next_page":   page_index < total_pages,
            "records_on_page": len(rows),
            "process_summary": process_counts,
            "data":            rows,
        }

    def get_container_live_status(self, search_for: Optional[str] = None) -> dict:
        result = self.repo.get_container_live_status(search_for)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}
        rows = result.get("data", []) or []
        return {"status": "success", "count": len(rows), "data": rows}

    def get_location_slots(self) -> dict:
        result = self.repo.get_location_slots()
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}
        rows = result.get("data", []) or []
        return {"status": "success", "count": len(rows), "data": rows}

    def get_yard_3d_inventory(self) -> dict:
        return self.repo.get_yard_3d_inventory()

    def get_yard_3d_slot_list(self) -> dict:
        result = self.repo.get_yard_3d_slot_list()
        if result and result.get("status") == "success":
            return result
        return {"status": "error", "message": "No positioned containers", "data": []}

    def get_container_info(self, container_no: str) -> dict:
        return self.repo.get_container_info(container_no.strip().upper())

    def update_physical_location(self, container_no: str, location: str) -> dict:
        result = self.repo.update_physical_location(container_no, location)
        if not result or result.get("status") != "success":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("message", "SP failed"))

        rows      = result.get("data") or []
        sp_result = rows[0].get("Result") if rows else None

        if sp_result == 2:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                detail=f"Location '{location}' not found. Check Block:Row:Column:Stack values.",
            )
        if sp_result != 1:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Unexpected SP result: {sp_result}")

        return {
            "status":       "success",
            "message":      f"Container {container_no} location updated to {location}",
            "container_no": container_no,
            "location":     location,
        }

    def get_pre_gate_survey(
        self,
        gate_type: Optional[str],
        from_date: Optional[str],
        to_date: Optional[str],
        container_no: Optional[str],
        page: int,
        page_size: int,
        stitching_dir: pathlib.Path,
    ) -> dict:
        fd = from_date or "1900-01-01"
        td = to_date   or "9999-12-31"
        gt = gate_type or ""

        result = self.repo.get_pre_gate_survey(fd, td, gt)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": [], "total": 0}

        rows = result.get("data", []) or []

        if container_no:
            q = container_no.upper()
            rows = [r for r in rows if q in str(r.get("CONTAINER_NO") or "").upper()]

        for row in rows:
            gate_raw       = (row.get("GateName") or "").strip().upper()
            row["_gate_type"] = "GATE_OUT" if row.get("GATE_OUT_DATE") or "OUT" in gate_raw else "GATE_IN"

        gate_in_count  = sum(1 for r in rows if r["_gate_type"] == "GATE_IN")
        gate_out_count = sum(1 for r in rows if r["_gate_type"] == "GATE_OUT")

        total       = len(rows)
        total_pages = max(1, -(-total // page_size))
        page_rows   = rows[(page - 1) * page_size: page * page_size]

        for row in page_rows:
            _normalize_survey_row(row, stitching_dir)

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

    def get_daily_utilisation(
        self,
        from_date: Optional[str],
        to_date: Optional[str],
        group_by: Optional[str],
    ) -> dict:
        from datetime import datetime, timedelta

        today  = datetime.today()
        f_date = (from_date or "").strip().replace("T", " ") or (today - timedelta(days=29)).strftime("%Y-%m-%d")
        t_date = (to_date   or "").strip().replace("T", " ") or today.strftime("%Y-%m-%d")
        grp    = (group_by  or "").strip().lower()

        ALLOWED = {"process", "size", "type", "status"}
        if grp and grp not in ALLOWED:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"group_by must be one of {sorted(ALLOWED)}")

        result = self.repo.get_daily_utilisation(f_date, t_date, grp or None)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}

        rows = result.get("data") or []
        return {
            "status":    "success",
            "from_date": f_date,
            "to_date":   t_date,
            "group_by":  grp or None,
            "count":     len(rows),
            "data":      rows,
        }


# ── Survey row helpers ────────────────────────────────────────────────────────

def _img_url(stitching_dir: pathlib.Path, gate: str, date_part: str, cont: str, side: str) -> Optional[str]:
    rel = f"{gate}/{date_part}/{cont}/{side}.jpg"
    if (stitching_dir / rel).is_file():
        return f"/v1/container/img?p={rel}"
    return None


def _normalize_survey_row(row: dict, stitching_dir: pathlib.Path) -> None:
    row["ContainerNo"] = (row.get("CONTAINER_NO") or "").strip()
    row["GateInDate"]  = row.get("GATE_IN_DATE") or None
    row["GateOutDate"] = row.get("GATE_OUT_DATE") or None
    row["Status"]      = row.get("INVENTORY_STATUS") or ""
    row["ContSize"]    = row.get("Cont_Size") or ""
    row["ContType"]    = row.get("Cont_Type") or ""
    row["Process"]     = row.get("ProcessCode") or ""
    row["DocumentNo"]  = row.get("DOCUMENT_NO") or ""

    gate_raw          = (row.get("GateName") or "").strip()
    row["GateName"]   = gate_raw
    row["SurveyTime"] = row.get("SurveyTime") or row["GateInDate"] or None
    row["GateType"]   = "GATE_OUT" if row["GateOutDate"] or "OUT" in gate_raw.upper() else "GATE_IN"

    date_src = row["SurveyTime"] or row["GateInDate"]
    cont     = row["ContainerNo"]
    if cont and date_src and gate_raw:
        try:
            dp = str(date_src)[:10].replace("-", "")
            row["IMG_LEFT"]  = _img_url(stitching_dir, gate_raw, dp, cont, "left")
            row["IMG_RIGHT"] = _img_url(stitching_dir, gate_raw, dp, cont, "right")
            row["IMG_TOP"]   = _img_url(stitching_dir, gate_raw, dp, cont, "top")
        except Exception:
            row["IMG_LEFT"] = row["IMG_RIGHT"] = row["IMG_TOP"] = None
    else:
        row["IMG_LEFT"] = row["IMG_RIGHT"] = row["IMG_TOP"] = None
