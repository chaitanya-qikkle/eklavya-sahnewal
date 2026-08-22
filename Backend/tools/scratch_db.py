import sys
sys.path.append('.')
from utils.db_utils import SQLManager

db = SQLManager()
try:
    response = db.execute_query('EXEC dbo.SP_SYS_GET_PROC_PARAMS ?', ('SP_EQUIPMENT_ADD',))
    for row in response.get('data', []):
        print(row)
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close_connection()
