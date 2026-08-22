from utils.db_utils import SQLManager

db = SQLManager()
try:
    print('Creating test user...')
    create_res = db.execute_query(
        'EXEC SP_USER_CREATE ?, ?, ?, ?, ?, ?, ?',
        (10, 'Test', 'User', 'testuser', 'testpass123', 'testuser@test.com', 1),
        commit=True,
    )
    if create_res.get('status') == 'success':
        print('✓ Test user created: testuser / testpass123')

    print('\n=== Testing SP_USER_LOGIN with test credentials ===')
    login_res = db.execute_query('EXEC SP_USER_LOGIN ?, ?', ('testuser', 'testpass123'))
    rows = login_res.get('data') or []

    if rows:
        result = rows[0]
        print(f"Status: {result.get('Status') or result.get('STATUS')}")
        print(f"Message: {result.get('Message') or result.get('MSG')}")
        print(f"User ID: {result.get('User_ID') or result.get('USER_ID')}")
        print(f"First Name: {result.get('First_Name') or result.get('FIRST_NAME')}")
        print(f"Last Name: {result.get('Last_Name') or result.get('LAST_NAME')}")
        print(f"Email: {result.get('Email') or result.get('EMAIL')}")
        print(f"Role ID: {result.get('Role_ID') or result.get('ROLE_ID')}")
        print(f"Role: {result.get('Role') or result.get('ROLE')}")
        print(f"Plant ID: {result.get('Plant_ID') or result.get('PLANT_ID')}")

except Exception as e:
    print(f'Error: {e}')
finally:
    db.close_connection()
