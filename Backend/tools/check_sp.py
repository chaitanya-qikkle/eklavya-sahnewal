import sys
sys.path.insert(0, '.')
from utils.db_utils import SQLManager

db = SQLManager()
try:
    for sp_name in ['SP_CUSTOMER_ADD', 'SP_CUSTOMER_GET', 'SP_CUSTOMER_MODIFY', 'SP_CUSTOMER_DELETE']:
        response = db.execute_query('EXEC dbo.SP_SYS_GET_PROC_PARAMS ?', (sp_name,))
        print(f'\n{sp_name}:')
        if response.get('data'):
            for p in response['data']:
                print(f"  {p['PARAMETER_NAME']} ({p['DATA_TYPE']})")
        else:
            print('  No params found')
except Exception as e:
    print('Error:', e)
finally:
    db.close_connection()
