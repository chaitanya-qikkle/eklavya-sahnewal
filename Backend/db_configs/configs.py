import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'server': os.getenv('DB_SERVER', 'localhost'),
    'database': os.getenv('DB_DATABASE', 'YMS_EKLAVYA'),
    'username': os.getenv('DB_USERNAME', 'sa'),
    'password': os.getenv('DB_PASSWORD', ''),
    'driver': os.getenv('DB_DRIVER', 'ODBC Driver 18 for SQL Server'),
    'encrypt': os.getenv('DB_ENCRYPT', 'yes'),
    'trust_server_certificate': os.getenv('DB_TRUST_SERVER_CERTIFICATE', 'yes')
}