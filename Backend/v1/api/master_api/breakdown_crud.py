from fastapi import APIRouter, Depends
from typing import Optional
from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user
from pydantic import BaseModel

breakdown_router = APIRouter()


class BreakdownSaveRequest(BaseModel):
    brkid: int = 0                    # 0 = insert, >0 = update
    vehicle_id: int                   # EqpID / VehicleID
    maintance_start: str              # "YYYY-MM-DD HH:MM:SS"
    maintance_end: Optional[str] = None
    reason: str


class BreakdownDeleteRequest(BaseModel):
    brkid: int


@breakdown_router.post("/add-breakdown")
def add_breakdown(request: BreakdownSaveRequest, current_user: dict = Depends(get_current_user)):
    """Insert new breakdown — calls INS_ESS_MST_BREAKDOWN with @BRKID=0."""
    return _upsert(request, current_user)


@breakdown_router.post("/update-breakdown")
def update_breakdown(request: BreakdownSaveRequest, current_user: dict = Depends(get_current_user)):
    """Update existing breakdown — calls INS_ESS_MST_BREAKDOWN with @BRKID>0."""
    return _upsert(request, current_user)


def _upsert(request: BreakdownSaveRequest, current_user: dict):
    db = SQLManager()
    try:
        query = """
            DECLARE @IsSuccess INT = 0;
            DECLARE @CreatedByUID uniqueidentifier = CONVERT(uniqueidentifier, ?);
            EXEC dbo.INS_ESS_MST_BREAKDOWN
                @BRKID          = ?,
                @VehicleID      = ?,
                @MaintanceStart = ?,
                @MaintanceEnd   = ?,
                @Reason         = ?,
                @PlantID        = ?,
                @CreatedBy      = @CreatedByUID,
                @IsSuccess      = @IsSuccess OUTPUT;
        """
        params = (
            str(current_user.get("user_id", "")),   # ? → @CreatedByUID (must be first)
            request.brkid,
            request.vehicle_id,
            request.maintance_start,
            request.maintance_end,
            request.reason,
            current_user.get("plant_id"),
        )
        result = db.execute_query(query, params, commit=True)
        if result and result.get("status") == "success":
            rows = result.get("data") or []
            first = rows[0] if rows else {}
            if first.get("result") == 1 or first.get("Result") == 1:
                return {"status": "success", "message": "Record saved successfully"}
            return {"status": "success", "message": "Record saved"}
        return {"status": "error", "message": result.get("message", "SP failed") if result else "No response"}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@breakdown_router.get("/get-breakdowns")
def get_breakdowns(
    eqp_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List breakdown records — calls GET_BREAKDOWN_DETAIL.

    The SP only accepts @PlantID (open breakdowns + today's, no date/eqp
    filter params exist), so eqp_id/from_date/to_date are applied here.
    """
    db = SQLManager()
    try:
        result = db.execute_query("EXEC dbo.GET_BREAKDOWN_DETAIL ?", (current_user.get("plant_id"),))
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": []}

        rows = result.get("data") or []

        # SP only returns EqpName (text), not an equipment ID, so eqp_id can't be filtered here.
        if from_date:
            rows = [r for r in rows if str(r.get("MaintanceStart") or "")[:10] >= from_date[:10]]
        if to_date:
            rows = [r for r in rows if str(r.get("MaintanceStart") or "")[:10] <= to_date[:10]]

        return {"status": "success", "message": f"{len(rows)} record(s)", "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@breakdown_router.get("/get-breakdowns-filtered")
def get_breakdowns_filtered(
    from_date: str,
    to_date: str,
    current_user: dict = Depends(get_current_user),
):
    """Date-ranged breakdown list — calls GET_BREAKDOWN_DETAIL_FILTER.

    Unlike GET_BREAKDOWN_DETAIL (today/open only), this SP takes an explicit
    date range and only returns closed breakdowns (MaintanceEnd IS NOT NULL).
    """
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.GET_BREAKDOWN_DETAIL_FILTER ?, ?, ?",
            (current_user.get("plant_id", 1), from_date, to_date),
        )
        if not result or result.get("status") != "success":
            return {"status": "error", "message": (result or {}).get("message", "SP failed"), "data": []}
        rows = result.get("data") or []
        return {"status": "success", "message": f"{len(rows)} record(s)", "data": rows}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}", "data": []}
    finally:
        db.close_connection()


@breakdown_router.get("/get-breakdown-by-id")
def get_breakdown_by_id(
    brkid: int,
    current_user: dict = Depends(get_current_user),
):
    """Fetch single breakdown by BRKID — calls GET_ESS_MST_BREAKDOWN_BYID."""
    db = SQLManager()
    try:
        result = db.execute_query("EXEC dbo.GET_ESS_MST_BREAKDOWN_BYID ?", (brkid,))
        if result and result.get("status") == "success":
            rows = result.get("data") or []
            return {"status": "success", "data": rows[0] if rows else {}}
        return {"status": "error", "message": (result or {}).get("message", "SP failed")}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@breakdown_router.post("/delete-breakdown")
def delete_breakdown(request: BreakdownDeleteRequest, current_user: dict = Depends(get_current_user)):
    """Delete breakdown — calls DEL_ESS_MST_BREAKDOWN."""
    db = SQLManager()
    try:
        result = db.execute_query(
            "EXEC dbo.DEL_ESS_MST_BREAKDOWN ?",
            (request.brkid,),
            commit=True,
        )
        if result and result.get("status") == "success":
            return {"status": "success", "message": "Record deleted"}
        return {"status": "error", "message": (result or {}).get("message", "Delete failed")}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


# Keep close endpoint — sets MaintanceEnd = now via update SP
@breakdown_router.post("/close-breakdown")
def close_breakdown(
    brkid: int,
    end_time: str,
    current_user: dict = Depends(get_current_user),
):
    """Close an open breakdown by setting MaintanceEnd."""
    db = SQLManager()
    try:
        # Fetch current record to get VehicleID and Reason
        rec_res = db.execute_query("EXEC dbo.GET_ESS_MST_BREAKDOWN_BYID ?", (brkid,))
        if not rec_res or rec_res.get("status") != "success":
            return {"status": "error", "message": "Record not found"}
        rec = (rec_res.get("data") or [{}])[0]

        vehicle_id = rec.get("VehicleID") or rec.get("VEHICLEID") or rec.get("EqpID")
        start      = rec.get("MaintanceStart") or rec.get("MAINTANCESTART")
        reason     = rec.get("Reason") or rec.get("REASON") or ""

        query = """
            DECLARE @IsSuccess INT = 0;
            DECLARE @CreatedByUID uniqueidentifier = CONVERT(uniqueidentifier, ?);
            EXEC dbo.INS_ESS_MST_BREAKDOWN
                @BRKID          = ?,
                @VehicleID      = ?,
                @MaintanceStart = ?,
                @MaintanceEnd   = ?,
                @Reason         = ?,
                @PlantID        = ?,
                @CreatedBy      = @CreatedByUID,
                @IsSuccess      = @IsSuccess OUTPUT;
        """
        params = (
            str(current_user.get("user_id", "")),   # ? → @CreatedByUID (must be first)
            brkid, vehicle_id, start, end_time, reason,
            current_user.get("plant_id"),
        )
        result = db.execute_query(query, params, commit=True)
        if result and result.get("status") == "success":
            return {"status": "success", "message": "Breakdown closed"}
        return {"status": "error", "message": (result or {}).get("message", "Close failed")}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
