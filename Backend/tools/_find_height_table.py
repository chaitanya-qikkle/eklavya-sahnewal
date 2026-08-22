from utils.db_utils import SQLManager

db = SQLManager()
try:
    print("\n=== Tables matching %EQUIPMENT%HEIGHT% ===")
    res = db.execute_query('EXEC dbo.SP_SYS_FIND_OBJECTS_BY_NAME ?', ('%EQUIPMENT%HEIGHT%',))
    for r in res.get('data', []):
        print(f"{r.get('schema_name')}.{r.get('object_name')} ({r.get('type_desc')})")

    print("\n=== Any tables named TBL_MST_EQUIPMENT_HEIGHT_SETTINGS ===")
    res = db.execute_query('EXEC dbo.SP_SYS_FIND_OBJECTS_BY_NAME ?', ('TBL_MST_EQUIPMENT_HEIGHT_SETTINGS',))
    rows = res.get('data', [])
    if not rows:
        print('None')
    else:
        for r in rows:
            print(f"{r.get('schema_name')}.{r.get('object_name')} ({r.get('type_desc')})")
finally:
    db.close_connection()
