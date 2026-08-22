import pyodbc
from db_configs.configs import DB_CONFIG
from typing import Optional
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

pyodbc.pooling = True


def _select_sql_server_driver(requested_driver: Optional[str]) -> Optional[str]:
    available = pyodbc.drivers()

    if requested_driver and requested_driver in available:
        return requested_driver

    # Prefer modern SQL Server drivers when present
    for candidate in (
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "SQL Server",
    ):
        if candidate in available:
            return candidate

    return None


def get_db_connection():
    """
    Get a database connection
    Returns a new connection each time
    """
    selected_driver = _select_sql_server_driver(DB_CONFIG.get('driver'))
    if not selected_driver:
        logger.error(
            "Database Connection Error: No SQL Server ODBC driver found. "
            "Install 'ODBC Driver 18 for SQL Server' (recommended) and try again. "
            f"Available drivers: {pyodbc.drivers()}"
        )
        return None

    conn_str = (
        f"DRIVER={{{selected_driver}}};"
        f"SERVER={DB_CONFIG['server']};"
        f"DATABASE={DB_CONFIG['database']};"
        f"UID={DB_CONFIG['username']};" 
        f"PWD={DB_CONFIG['password']};" 
    )

    # Driver 18 defaults to Encrypt=yes and may require certificate trust settings
    encrypt = DB_CONFIG.get("encrypt", "yes")
    trust_server_certificate = DB_CONFIG.get("trust_server_certificate", "yes")
    conn_str += f"Encrypt={encrypt};TrustServerCertificate={trust_server_certificate};"
    
    try:
        conn = pyodbc.connect(conn_str, timeout=10)
        logger.info("Database Connection Successful")
        return conn
    except Exception as e:
        logger.error(f"Database Connection Error: {e}")
        return None


@contextmanager
def get_db_session():
    """
    Context manager for database connections
    Automatically handles connection cleanup
    
    Usage:
        with get_db_session() as conn:
            cursor = conn.cursor()
            # ... use connection
    """
    conn = get_db_connection()
    if not conn:
        raise Exception("Failed to establish database connection")
    
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database transaction error: {e}")
        raise
    finally:
        conn.close()
        logger.debug("Database connection closed")