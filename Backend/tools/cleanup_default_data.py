from utils.db_utils import SQLManager

db = SQLManager()
try:
    print('Cleaning up default data...\n')

    response = db.execute_query(
        'EXEC dbo.SP_ADMIN_CLEANUP_DEFAULT_DATA',
        fetch_all=True,
        commit=True,
    )

    if response.get('status') != 'success':
        raise SystemExit(response.get('message', 'Database operation failed'))

    result_sets = response.get('data') or []
    summary = result_sets[0][0] if len(result_sets) > 0 and result_sets[0] else {}
    plants = result_sets[1] if len(result_sets) > 1 else []

    print('✓ Cleanup summary')
    print(f"Users deleted: {summary.get('UsersDeleted', 0)}")
    print(f"Roles updated: {summary.get('RolesUpdated', 0)}")
    print(f"Plants deleted: {summary.get('PlantsDeleted', 0)}")

    if plants:
        print('\n=== Remaining Plants ===')
        for row in plants:
            print(f"Plant ID: {row.get('PLANT_ID')}, Name: {row.get('PLANT_NAME')}, Code: {row.get('PLANT_CODE')}, Location: {row.get('LOCATION')}")
    else:
        print('\n(No plants in database)')

    print('\n✓ Cleanup completed!')
finally:
    db.close_connection()
