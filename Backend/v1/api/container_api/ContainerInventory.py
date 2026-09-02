from fastapi import APIRouter, HTTPException, Query, Depends
from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user
from pydantic import BaseModel, field_validator
from typing import Optional
import time

router = APIRouter()


@router.get("/kiosk-search")
def kiosk_container_search(term: str, top: Optional[int] = 20):
    db = SQLManager()
    try:
        result = db.execute_query("EXEC dbo.SP_KIOSK_CONTAINER_SEARCH ?, ?", (term.strip(), top))
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}
        rows = result.get("data", []) or []
        return {"status": "success", "count": len(rows), "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


def _fetch_container_live_status(plant_id: int, search_for: str):
    """Shared GET_CONTAINERLIVESTATUS paging + field-mapping logic used by
    both the authenticated /container-live-status endpoint and the public
    /kiosk-live-status endpoint (kiosk devices have no logged-in user).

    The SP is hard-paginated (25 rows/page with @SearchFor, 15 rows/page
    without) and returns no total-count column, but LiveStatus.jsx, the 3D
    yard view, and the dashboards all expect one call to return the whole
    in-yard list. So we page through the SP here and concatenate — with
    ~1200 containers in yard that's dozens of round-trips per call.
    """
    db = SQLManager()
    search_for = (search_for or "").strip()
    page_size  = 25 if search_for else 15
    try:
        rows = []
        page_index = 1
        while True:
            result = db.execute_query(
                "EXEC dbo.GET_CONTAINERLIVESTATUS ?, ?, ?",
                (page_index, search_for, plant_id),
            )
            if not result or result.get("status") != "success":
                return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}
            page_rows = result.get("data") or []
            rows.extend(page_rows)
            if len(page_rows) < page_size or page_index > 500:  # 500 = safety cap
                break
            page_index += 1
        mapped = [
            {
                "CONTAINER_NO":      r.get("ContainerNo"),
                "CONTAINER_SIZE":    r.get("ContainerSize"),
                "CONTAINER_TYPE":    r.get("ContainerType"),
                "CONTAINER_PROCESS": r.get("Process"),
                "INVENTORY_STATUS":  r.get("ContainerStatus"),
                "LOCATION_NAME":     r.get("ContainerLocation"),
                "YARD_TYPE":         r.get("YardType"),
                "GATE_IN_DATE":      r.get("GateInDate"),
                "TOSS_IN_DATE":      r.get("LastShiftDate"),
                "TIME_IN_YARD":      r.get("GateInTAT"),
                "OFFLOAD_TAT":       r.get("OffloadTAT"),
                "OFFLOAD_EQP":       r.get("EquipmentName"),
                "LATITUDE":          r.get("Latitude"),
                "LONGITUDE":         r.get("Longitude"),
                "OFFLOAD_LAT":       r.get("Latitude"),
                "OFFLOAD_LON":       r.get("Longitude"),
                "DOCUMENT_NO":       r.get("DocumentNo"),
                "BOOKING_NO":        r.get("BookingNo"),
                "MODE":              r.get("Mode"),
                "TERMINAL":          r.get("Terminal"),
                "NO_OF_MOVES":       r.get("NoOfMoves"),
                "YARD_IN_TIME":      r.get("YardInTime"),
                "YARD_OUT_TIME":     r.get("YardOutTime"),
                "RAIL_IN_DATETIME":  r.get("RailInDateTime"),
                "RAIL_OUT_DATETIME": r.get("RailOutDateTime"),
                "GATE_OUT_DATE":     r.get("GateOutDate"),
                "RELEASE_STATUS":    r.get("ReleaseStatus"),
                "MASTERTABLE":       r.get("ContainerLocation"),
                "BLOCK_NAME":        r.get("ContainerLocation"),
            }
            for r in rows
        ]
        return {"status": "success", "count": len(mapped), "data": mapped}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/container-live-status")
def get_container_live_status(
    plant_id:     int = Query(0),
    search_for:   Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Full in-yard live-status feed via GET_CONTAINERLIVESTATUS (authenticated)."""
    return _fetch_container_live_status(plant_id, search_for)


@router.get("/kiosk-live-status")
def get_kiosk_live_status(
    plant_id:   int = Query(0),
    search_for: Optional[str] = Query(None),
):
    """Same in-yard live-status feed as /container-live-status, unauthenticated —
    the public Container Locator kiosk (no logged-in user) uses this."""
    return _fetch_container_live_status(plant_id, search_for)


@router.get("/container-status-report")
def get_container_status_report(
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
):
    db = SQLManager()
    try:
        from datetime import datetime, timedelta
        fd = from_date or (datetime.today() - timedelta(days=180)).strftime("%Y-%m-%d")
        td = to_date   or datetime.today().strftime("%Y-%m-%d")
        # Use only date part — RPT_GATE_INOUT expects DATE params
        fd = fd[:10]
        td = td[:10]
        result = db.execute_query(
            "EXEC dbo.SP_MONTHLY_GATE_INOUT ?, ?",
            (fd, td),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": []}
        rows = result.get("data", []) or []
        return {"status": "success", "count": len(rows), "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/container-gate-report")
def get_container_gate_report(
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        from datetime import datetime, timedelta
        fd = from_date or datetime.today().strftime("%Y-%m-%d")
        td = to_date   or datetime.today().strftime("%Y-%m-%d")
        fd = fd[:10]
        td = td[:10]
        result = db.execute_query(
            "EXEC dbo.GET_CONTAINER_LIVE_STATUS_REPORT ?, ?, ?",
            (fd, td, current_user.get("plant_id", 1)),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": []}
        rows = result.get("data", []) or []
        return {"status": "success", "count": len(rows), "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/location-slots")
def get_location_slots(current_user: dict = Depends(get_current_user)):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_ESS_MST_SLOT_LIST ?",
            (current_user["plant_id"],),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "Query failed"), "data": []}
        rows = result.get("data", []) or []
        return {"status": "success", "count": len(rows), "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/yard-3d-inventory")
def get_yard_3d_inventory():
    db = SQLManager()
    try:
        response = db.execute_query("EXEC dbo.SP_YARD_3D_INVENTORY")
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/yard-3d-slot-list")
def get_yard_3d_slot_list():
    db = SQLManager()
    try:
        result = db.execute_query("EXEC dbo.SP_YARD_3D_SLOT_LIST")
        if result and result.get("status") == "success":
            return result
        return {"status": "error", "message": "No positioned containers", "data": []}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/container-live-status-3d")
def get_container_live_status_3d():
    """In-yard container list for the realistic 3D scene — ContainerLiveStatus_3D.

    Returns Cont_No/Cont_Size/Cont_Type/Last_Loc/LocationId/SlotId per container.
    SlotId is a direct FK into ESS_MST_LOCATION, letting the frontend place each
    container in its exact slot geometry instead of parsing the combined
    Last_Loc string (which was causing overlap/misalignment in the 3D view).
    """
    db = SQLManager()
    try:
        response = db.execute_query("EXEC dbo.ContainerLiveStatus_3D")
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/dashboard-yard-inventory")
def get_dashboard_yard_inventory(plant_id: int = Query(0)):
    """Yard inventory by block with real capacity/slot/utilization — GET_DASHBOARD_YARDINVENTORY.

    Returns one row per yard block (plus EMPTY/DOMESTIC rows) with
    YARDNAME, SIZE20, SIZE40, COUNT, TEUS, YARD_CAPACITY, SLOT, UTILIZATION.
    Powers the admin dashboard's Yard Inventory panel.
    """
    db = SQLManager()
    try:
        response = db.execute_query("EXEC dbo.GET_DASHBOARD_YARDINVENTORY ?", (plant_id,))
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/container-inout-24h")
def get_container_inout_24h():
    """Hourly gate-in / gate-out throughput for the last 24h — ContainerInOut_24Hours.

    Pre-bucketed and gap-filled server-side (one row per hour, zero-filled),
    driven by EKL_TRN_INVENTORY.GateInDate/GateOutDate. Powers the admin
    dashboard's Gate Throughput chart.
    """
    db = SQLManager()
    try:
        response = db.execute_query("EXEC dbo.ContainerInOut_24Hours")
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/container-info")
def get_container_info(container_no: str = ""):
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.SP_CONTAINER_INFO ?",
            (container_no.strip().upper(),),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/container-list")
def get_container_list(
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_CONTAINERLIST ?",
            (current_user.get("plant_id", 1),),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/container-tracking-data")
def get_container_tracking_data(
    container_no: str,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_CONTAINERTRACKING_DATA ?, ?",
            (container_no.strip().upper(), current_user.get("plant_id", 1)),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


class ContainerUploadRequest(BaseModel):
    container_nos: list[str]

    @field_validator("container_nos")
    @classmethod
    def _clean(cls, v):
        cleaned = [str(c).strip().upper() for c in (v or []) if str(c).strip()]
        if not cleaned:
            raise ValueError("container_nos must contain at least one container number")
        return cleaned


@router.post("/container-tracking-upload")
def get_container_tracking_upload(
    payload: ContainerUploadRequest,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        nos = payload.container_nos
        placeholders = ", ".join(["(?)"] * len(nos))
        query = f"""
            DECLARE @ContainerNo ConList;
            INSERT INTO @ContainerNo (ContainerNo) VALUES {placeholders};
            EXEC dbo.GET_UPLOADCONTAINERNO_DETAIL @ContainerNo;
        """
        result = db.execute_query(query, tuple(nos))
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/lifecycle-details")
def get_lifecycle_details(
    container_no: str,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_CONTAINERLIFECYCLE_DETAILS ?, ?",
            (container_no.strip().upper(), current_user.get("plant_id", 1)),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/lifecycle-offload-timeline")
def get_offload_timeline(
    master_id: int,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_OFFLOAD_TIMELINEDETAILS ?",
            (master_id,),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/lifecycle-gateinout")
def get_gateinout_timeline(
    master_id: int,
    container_no: str,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_GATEINOUT_TIMELINE ?, ?",
            (master_id, container_no.strip().upper()),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/daily-utilisation")
def get_daily_utilisation(
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
    group_by:  Optional[str] = None,
):
    from datetime import datetime, timedelta

    def _parse(val: Optional[str]) -> Optional[str]:
        if not val:
            return None
        return val.strip().replace("T", " ")

    today  = datetime.today()
    f_date = _parse(from_date) or (today - timedelta(days=29)).strftime("%Y-%m-%d")
    t_date = _parse(to_date)   or today.strftime("%Y-%m-%d")
    grp    = (group_by or "").strip().lower()

    ALLOWED = {"process", "size", "type", "status"}
    if grp and grp not in ALLOWED:
        return {"status": "error", "message": f"group_by must be one of {sorted(ALLOWED)}"}

    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.SP_DAILY_UTILISATION ?, ?, ?",
            (f_date, t_date, grp or None),
        )
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
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@router.get("/container-inventory")
def get_container_inventory(
    page_index: int = Query(1, ge=1),
    search_for: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Paginated in-yard inventory via GET_CONTAINERLIVESTATUS.

    The SP fixes its own page size (25 rows/page when @SearchFor is given,
    15 rows/page otherwise) and returns no total-count column, so pagination
    here is "load more"-style: has_next_page is inferred from whether the
    page came back full, not from a real total.
    """
    db = SQLManager()
    search_for = (search_for or "").strip()
    plant_id   = current_user.get("plant_id", 1)
    try:
        result = db.execute_query(
            "EXEC dbo.GET_CONTAINERLIVESTATUS ?, ?, ?",
            (page_index, search_for, plant_id),
        )
        if result["status"] != "success":
            raise HTTPException(status_code=500, detail=result["message"])

        rows      = result.get("data") or []
        page_size = 25 if search_for else 15

        return {
            "status":          "success",
            "page_index":      page_index,
            "page_size":       page_size,
            "records_on_page": len(rows),
            "has_next_page":   len(rows) == page_size,
            "data":            rows,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close_connection()


# ── Update Physical Container Location ────────────────────────────────────────

class UpdateLocationRequest(BaseModel):
    container_no: str
    location: str  # Block:Row:Column:Stack  e.g. "B2:C:8:2"

    @field_validator("container_no")
    @classmethod
    def clean_container_no(cls, v: str) -> str:
        v = v.strip().upper().replace(" ", "")
        if not v:
            raise ValueError("container_no cannot be empty")
        return v

    @field_validator("location")
    @classmethod
    def clean_location(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("location cannot be empty")
        parts = [p.strip() for p in v.split(":")]
        if len(parts) < 4 or any(p == "" for p in parts):
            raise ValueError("location must be Block:Row:Column:Stack  e.g. B2:C:8:2")
        return v


@router.post("/update-physical-location")
def update_physical_container_location(body: UpdateLocationRequest):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.UPD_PHYSICAL_CONTAINER_LOCATION ?, ?",
            (body.container_no, body.location),
            commit=True,
        )
        if not result or result.get("status") != "success":
            raise HTTPException(status_code=500, detail=result.get("message", "SP failed"))

        rows      = result.get("data") or []
        sp_result = rows[0].get("Result") if rows else None

        if sp_result == 2:
            raise HTTPException(
                status_code=404,
                detail=f"Location '{body.location}' not found. Check Block:Row:Column:Stack values.",
            )
        if sp_result != 1:
            raise HTTPException(status_code=500, detail=f"Unexpected SP result: {sp_result}")

        return {
            "status":       "success",
            "message":      f"Container {body.container_no} location updated to {body.location}",
            "container_no": body.container_no,
            "location":     body.location,
            "updated_by":   "mobile",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    finally:
        db.close_connection()


# ── Rail Plan Management ────────────────────────────────────────────────────

@router.get("/rail-plan-list")
def get_rail_plan_list(
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_RAIL_PLAN_NAME_LIST ?",
            (current_user.get("plant_id", 1),),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/rail-plan-detail")
def get_rail_plan_detail(
    rail_plan_name: str,
    is_job_allotted: int = Query(..., ge=0, le=1),
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_RAIL_PLAN_LIST ?, ?, ?",
            (current_user.get("plant_id", 1), rail_plan_name, is_job_allotted),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data)}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


class RailPlanTaskRequest(BaseModel):
    rail_plan_name: str
    type: str  # ACTIVATE | DEACTIVATE | DELETE

    @field_validator("type")
    @classmethod
    def _valid_type(cls, v):
        vv = str(v).strip().upper()
        if vv not in ("ACTIVATE", "DEACTIVATE", "DELETE"):
            raise ValueError("type must be one of ACTIVATE, DEACTIVATE, DELETE")
        return vv


@router.post("/rail-plan-task")
def post_rail_plan_task(
    body: RailPlanTaskRequest,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        query = """
            DECLARE @IsSuccess INT = 0;
            DECLARE @ModifiedByUID uniqueidentifier = CONVERT(uniqueidentifier, ?);
            EXEC dbo.INS_RAIL_PLAN_TASK
                @PlantID      = ?,
                @RailPlanName = ?,
                @ModifiedBy   = @ModifiedByUID,
                @Type         = ?,
                @IsSuccess    = @IsSuccess OUTPUT;
        """
        params = (
            str(current_user.get("user_id", "")),
            current_user.get("plant_id", 1),
            body.rail_plan_name,
            body.type,
        )
        result = db.execute_query(query, params, commit=True)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed")}
        rows = result.get("data") or []
        is_success = rows[0].get("IsSuccess") if rows else None
        return {"status": "success", "is_success": is_success}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


class NewTaskRequest(BaseModel):
    rail_plan_name: str
    container_no: str
    is_job_allotted: bool


@router.post("/rail-plan-add-task")
def post_rail_plan_add_task(
    body: NewTaskRequest,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        query = """
            DECLARE @IsSuccess INT = 0;
            DECLARE @ModifiedByUID uniqueidentifier = CONVERT(uniqueidentifier, ?);
            EXEC dbo.INS_NEW_TASK
                @PlantID        = ?,
                @RailPlanName   = ?,
                @ContainerNo    = ?,
                @IsJobAllotted  = ?,
                @ModifiedBy     = @ModifiedByUID,
                @IsSuccess      = @IsSuccess OUTPUT;
        """
        params = (
            str(current_user.get("user_id", "")),
            current_user.get("plant_id", 1),
            body.rail_plan_name.strip(),
            body.container_no.strip().upper(),
            1 if body.is_job_allotted else 0,
        )
        result = db.execute_query(query, params, commit=True)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed")}
        rows = result.get("data") or []
        is_success = rows[0].get("IsSuccess") if rows else None
        return {"status": "success", "is_success": is_success}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


class DeleteRailPlanTaskRequest(BaseModel):
    job_id_list: list[int]
    plan_status: int  # 1 = complete task(s), 0 = delete rail-plan row(s)

    @field_validator("job_id_list")
    @classmethod
    def _non_empty(cls, v):
        if not v:
            raise ValueError("job_id_list must contain at least one id")
        return v


@router.post("/rail-plan-delete-task")
def post_rail_plan_delete_task(
    body: DeleteRailPlanTaskRequest,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        query = """
            DECLARE @ModifiedByUID uniqueidentifier = CONVERT(uniqueidentifier, ?);
            EXEC dbo.DEL_RAIL_PLAN_TASK ?, ?, @ModifiedByUID, ?;
        """
        params = (
            str(current_user.get("user_id", "")),
            current_user.get("plant_id", 1),
            ",".join(str(j) for j in body.job_id_list),
            body.plan_status,
        )
        result = db.execute_query(query, params, commit=True)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed")}
        rows = result.get("data") or []
        sp_result = rows[0].get("Result") if rows else None
        return {"status": "success", "result": sp_result}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


class RailPlanUploadRow(BaseModel):
    container_no: str
    container_size: str = ""
    to_location: str = ""


class RailPlanUploadRequest(BaseModel):
    rows: list[RailPlanUploadRow]

    @field_validator("rows")
    @classmethod
    def _non_empty(cls, v):
        if not v:
            raise ValueError("rows must contain at least one entry")
        return v


@router.post("/rail-plan-upload")
def post_rail_plan_upload(
    body: RailPlanUploadRequest,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        file_id    = int(time.time())
        plant_id   = current_user.get("plant_id", 1)
        modified_by = str(current_user.get("user_id", ""))

        placeholders = ", ".join(["(?, ?, ?, ?, ?, ?, CONVERT(uniqueidentifier, ?))"] * len(body.rows))
        params = []
        for idx, row in enumerate(body.rows, start=1):
            params.extend([
                idx,
                row.container_no.strip().upper(),
                row.container_size.strip(),
                row.to_location.strip(),
                file_id,
                plant_id,
                modified_by,
            ])

        query = f"""
            DECLARE @BulkRailPlan dbo.BULK_RAIL_PLAN;
            INSERT INTO @BulkRailPlan (SrNo, ContainerNo, ContainerSize, ToLocation, FileID, PlantId, ModifiedBy)
            VALUES {placeholders};
            EXEC dbo.UPLOAD_RAILPLAN_LIST_1 @BulkRailPlan;
        """
        result = db.execute_query(query, tuple(params), commit=True)
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed")}
        errors = result.get("data") or []
        if isinstance(errors, list) and errors and isinstance(errors[0], list):
            errors = errors[0]
        return {
            "status":         "success",
            "rail_plan_name": f"RailPlan_{file_id}",
            "file_id":        file_id,
            "total_rows":     len(body.rows),
            "error_count":    len(errors),
            "errors":         errors,
        }
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@router.get("/rail-movement-tat")
def get_rail_movement_tat(
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    from datetime import datetime

    today  = datetime.today().strftime("%Y-%m-%d")
    f_date = (from_date or today).strip().replace("T", " ")
    t_date = (to_date or today).strip().replace("T", " ")

    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_RAIL_SHIFTED_COUNT_WITH_TAT ?, ?, ?",
            (current_user.get("plant_id", 1), f_date, t_date),
        )
        data = result.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        return {"status": "success", "data": data, "total_records": len(data), "from_date": f_date, "to_date": t_date}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
