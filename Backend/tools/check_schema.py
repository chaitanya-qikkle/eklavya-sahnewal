from utils.db_utils import SQLManager

db = SQLManager()
try:
    print('=== TBL_MST_USER Columns ===')
    user_res = db.execute_query('EXEC dbo.SP_SYS_GET_TABLE_COLUMNS ?', ('TBL_MST_USER',))
    for row in user_res.get('data', []):
        print(f"{row.get('COLUMN_NAME')}: {row.get('DATA_TYPE')}")

    print('\n=== TBL_MST_ROLE Columns ===')
    role_res = db.execute_query('EXEC dbo.SP_SYS_GET_TABLE_COLUMNS ?', ('TBL_MST_ROLE',))
    for row in role_res.get('data', []):
        print(f"{row.get('COLUMN_NAME')}: {row.get('DATA_TYPE')}")
except Exception as e:
    print(f'Error: {e}')
finally:
    db.close_connection()
