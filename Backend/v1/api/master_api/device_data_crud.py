from fastapi import APIRouter, Depends
from typing import Optional

from utils.db_utils import SQLManager
from middleware.auth_middleware import get_current_user


device_data_router = APIRouter()


def _normalize_datetime(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.replace("T", " ")


@device_data_router.get("/get-device-data-latest")
def get_device_data_latest(current_user: dict = Depends(get_current_user)):
    """Return latest unlock packet datetime per DEVICE_IMEI."""
    db = SQLManager()
    try:
        response = db.execute_query(
            """
            SELECT ET.DeviceID AS DEVICE_IMEI,
                   MAX(ET.TransDate) AS LAST_TRANSACTION_DATE
            FROM EKL_TRN_EQUIPMENT_TRANSACTION ET
            JOIN ESS_MST_EQUIPMENT EE ON EE.DeviceId = ET.DeviceID
            WHERE ET.PacketType = 'UK' AND ISNULL(EE.IsDelete, 0) = 0
            GROUP BY ET.DeviceID
            """,
            fetch_all=True,
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()



@device_data_router.get("/get-device-data-live-locations")
def get_device_data_live_locations(current_user: dict = Depends(get_current_user)):
    """Return latest GPS (PacketID=1) position plus the machine's current
    lock/unlock state per device.

    Packet semantics in EKL_TRN_EKDEVICEDATA:
        PacketID = 1  -> normal GPS movement
        PacketID = 7  -> LOCK   (container picked up / twist-locks engaged)
        PacketID = 8  -> UNLOCK (container placed down / twist-locks released)

    The machine is "carrying" a container in the interval between a lock (7)
    and the next unlock (8). We fetch the most recent lock and the most
    recent unlock per Kalmar and derive PACKET_STATE by comparing them:
        7 -> last event was a lock  -> currently carrying
        8 -> last event was unlock  -> just dropped a container
        1 -> no lock/unlock history -> plain movement
    """
    db = SQLManager()
    try:
        response = db.execute_query(
            """
            -- Single scan: get max DeviceTransID per KalmarNo per relevant PacketID
            WITH agg AS (
                SELECT
                    KalmarNo,
                    MAX(CASE WHEN PacketID = 1 THEN DeviceTransID END) AS p1_id,
                    MAX(CASE WHEN PacketID = 7 THEN DeviceTransID END) AS lk_id,
                    MAX(CASE WHEN PacketID = 8 THEN DeviceTransID END) AS uk_id
                FROM EKL_TRN_EKDEVICEDATA WITH (NOLOCK)
                WHERE PacketID IN (1, 7, 8)
                  AND KalmarNo IS NOT NULL AND KalmarNo != ''
                GROUP BY KalmarNo
            )
            SELECT
                P1.DeviceIMEI                                         AS DEVICE_IMEI,
                P1.KalmarNo                                           AS KALMAR_NO,
                TRY_CONVERT(float, P1.Latitude)                       AS LAT,
                TRY_CONVERT(float, P1.Longitude)                      AS LNG,
                P1.DateTime                                           AS LAST_AT,
                LK.DateTime                                           AS LAST_LK_AT,
                UK.DateTime                                           AS LAST_UK_AT,
                ISNULL(LK.ContainerNo, ISNULL(LK.RFIDDATA, ''))      AS LK_CONTAINER,
                ISNULL(UK.ContainerNo, ISNULL(UK.RFIDDATA, ''))      AS UK_CONTAINER,
                ISNULL(P1.ContainerNo, ISNULL(P1.RFIDDATA, ''))      AS RFIDDATA,
                P1.PacketID                                           AS PACKET_ID,
                CASE
                    WHEN LK.DateTime IS NOT NULL
                         AND (UK.DateTime IS NULL OR LK.DateTime > UK.DateTime) THEN 7
                    WHEN UK.DateTime IS NOT NULL THEN 8
                    ELSE 1
                END                                                   AS PACKET_STATE,
                ISNULL(P1.Location, '')                               AS LOCATION
            FROM agg A
            INNER JOIN EKL_TRN_EKDEVICEDATA P1 WITH (NOLOCK) ON P1.DeviceTransID = A.p1_id
            INNER JOIN ESS_MST_EQUIPMENT    EQ WITH (NOLOCK)
                    ON EQ.Equipment_Name = P1.KalmarNo AND ISNULL(EQ.IsDelete, 0) = 0
            LEFT  JOIN EKL_TRN_EKDEVICEDATA LK WITH (NOLOCK) ON LK.DeviceTransID = A.lk_id
            LEFT  JOIN EKL_TRN_EKDEVICEDATA UK WITH (NOLOCK) ON UK.DeviceTransID = A.uk_id
            """,
            fetch_all=True,
        )
        data = response.get("data") or []
        if isinstance(data, list) and data and isinstance(data[0], list):
            data = data[0]
        for row in data:
            lat = row.get("LAT")
            lng = row.get("LNG")
            row["LAT"] = float(lat) if lat is not None else None
            row["LNG"] = float(lng) if lng is not None else None
        response["data"] = [r for r in data if r["LAT"] is not None and r["LNG"] is not None]
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@device_data_router.get("/get-device-details")
def get_device_details(
    kalmar_no: str,
    current_user: dict = Depends(get_current_user),
):
    """Return last 15 unlock transactions for an equipment using GET_DEVICEDETAILS SP."""
    db = SQLManager()
    try:
        response = db.execute_query(
            "EXEC dbo.GET_DEVICEDETAILS ?",
            (kalmar_no,),
        )
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()


@device_data_router.get("/get-device-data")
def get_device_data(
    device_id: Optional[str] = None,
    container_no: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    top: int = 50,
    packet_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
):
    db = SQLManager()
    try:
        try:
            top_n = int(top)
        except Exception:
            top_n = 50
        top_n = max(1, min(top_n, 500))

        query = "EXEC dbo.SP_DEVICE_DATA_LIST ?, ?, ?, ?, ?, ?, ?, ?"
        params = (
            current_user["plant_id"],
            device_id,
            int(packet_id) if packet_id is not None else None,
            container_no,
            _normalize_datetime(from_date),
            _normalize_datetime(to_date),
            1,
            top_n,
        )

        response = db.execute_query(query, params)
        return response
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}
    finally:
        db.close_connection()
