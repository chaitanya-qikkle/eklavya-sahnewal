from utils.db_utils import SQLManager

db = SQLManager()
try:
    response = db.execute_query(
        'EXEC dbo.SP_ADMIN_SETUP_PLANT_ASSIGNMENT',
        fetch_all=True,
        commit=True,
    )

    if response.get('status') != 'success':
        raise SystemExit(response.get('message', 'Database operation failed'))

    result_sets = response.get('data') or []
    plant_row = result_sets[0][0] if len(result_sets) > 0 and result_sets[0] else {}
    roles = result_sets[1] if len(result_sets) > 1 else []

    print(f"Using Plant ID: {plant_row.get('PlantId')}")
    print('\n=== Updated Roles and Plant Assignments ===')
    for row in roles:
        print(f"Role ID: {row.get('ROLE_ID')}, Role: {row.get('ROLE')}, Plant ID: {row.get('PLANT_ID')}")
except Exception as e:
    print(f'Error: {e}')
finally:
    db.close_connection()
