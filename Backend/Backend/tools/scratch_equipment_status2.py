import sys
sys.path.append('.')
from utils.db_utils import SQLManager

db = SQLManager()
try:
    r = db.execute_query("SELECT EqpID, Equipment_Name, Equipment_Code, DeviceID, IsDelete FROM ESS_MST_EQUIPMENT")
    rows = r.get('data') or []
    print(f"ESS_MST_EQUIPMENT: {len(rows)} rows")
    for row in rows:
        print(row)

    print()
    r2 = db.execute_query("SELECT KalmarNo, Location, DateTime, Latitude, Longitude FROM EKL_TRN_EQUIPMENT_STATUS")
    rows2 = r2.get('data') or []
    print(f"EKL_TRN_EQUIPMENT_STATUS: {len(rows2)} rows")
    for row in rows2:
        print(row)
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close_connection()
