"""
Request / response schemas for Reports.
"""
from typing import Optional

from pydantic import BaseModel


class GateReportRequest(BaseModel):
    container_no: Optional[str] = None
    from_date:    Optional[str] = None
    to_date:      Optional[str] = None


class DeviceLockReportRequest(BaseModel):
    from_date:       Optional[str] = None
    to_date:         Optional[str] = None
    equipment_names: Optional[str] = None
    report_type:     Optional[str] = "All"
    location:        Optional[str] = ""


class UpdateDeviceContainerRequest(BaseModel):
    eqp_trans_id: int
    cont_no:      str
