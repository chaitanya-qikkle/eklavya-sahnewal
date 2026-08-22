"""
Reports service — business logic for report generation and data exports.
All queries go through stored procedures via ReportsRepository.
"""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status

from app.repositories.reports_repository import ReportsRepository


def _parse_datetime(val: Optional[str]) -> Optional[str]:
    """Parse datetime-local / ISO inputs → DD/MM/YYYY HH:MM for SP CONVERT(DATETIME,?,103)."""
    if not val:
        return None
    raw = str(val).strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(raw, fmt).strftime("%d/%m/%Y %H:%M")
        except ValueError:
            pass
    try:
        return datetime.strptime(raw, "%Y-%m-%d").strftime("%d/%m/%Y %H:%M")
    except ValueError:
        return raw


class ReportsService:
    def __init__(self, repo: ReportsRepository):
        self.repo = repo

    def get_gate_report(
        self,
        container_no: Optional[str],
        from_date: Optional[str],
        to_date: Optional[str],
    ) -> dict:
        if from_date:
            try:
                datetime.strptime(from_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid from_date. Use YYYY-MM-DD")
        if to_date:
            try:
                datetime.strptime(to_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid to_date. Use YYYY-MM-DD")

        result = self.repo.get_gate_report(from_date or "", to_date or "", container_no or "")
        if result.get("status") != "success":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("message"))

        data = result.get("data", [])
        return {"status": "success", "message": f"Found {len(data)} record(s).", "total_records": len(data), "data": data}

    def get_device_lock_report(
        self,
        from_date: Optional[str],
        to_date: Optional[str],
        equipment_names: Optional[str],
        report_type: Optional[str],
        location: Optional[str],
        plant_id: int,
    ) -> dict:
        rtype = (report_type or "All").strip()
        if rtype not in ("Missing", "Non Missing", "All"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="report_type must be Missing, Non Missing, or All")
        ids = [x.strip() for x in (equipment_names or "").split(",") if x.strip()]
        fd  = _parse_datetime(from_date) or "01/01/1900 00:00"
        td  = _parse_datetime(to_date)   or "31/12/2099 23:59"

        result = self.repo.get_device_lock_report(rtype, ",".join(ids), fd, td, plant_id, (location or "").strip())
        if result.get("status") != "success":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("message", "DB error"))

        data = result.get("data") or []
        return {"status": "success", "message": f"Found {len(data)} record(s).", "total_records": len(data), "data": data}

    def get_device_raw_data(
        self,
        machine: Optional[str],
        from_date: Optional[str],
        to_date: Optional[str],
    ) -> dict:
        result = self.repo.get_device_raw_data(
            (machine or "").strip(),
            _parse_datetime(from_date) or "01/01/1900 00:00",
            _parse_datetime(to_date)   or "31/12/2099 23:59",
        )
        if result.get("status") != "success":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("message", "DB error"))

        all_sets = result.get("data") or []
        data = next((s for s in reversed(all_sets) if s), [])
        return {"status": "success", "message": f"Found {len(data)} record(s).", "total_records": len(data), "data": data}

    def update_device_container(self, eqp_trans_id: int, cont_no: str, plant_id: int, user_id: int) -> dict:
        result = self.repo.update_device_container(plant_id, eqp_trans_id, cont_no, user_id)
        if result.get("status") != "success":
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=result.get("message", "DB error"))

        data    = result.get("data", [])
        success = data and data[0].get("Result", data[0].get("RESULT", 0)) == 1
        if not success:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Failed to update container")

        return {"status": "success", "message": "Container updated successfully"}
