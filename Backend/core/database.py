from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

# Ensure you have your connection string in your .env
# Example for aioodbc: "mssql+aioodbc://user:password@server/database?driver=ODBC+Driver+17+for+SQL+Server"
DATABASE_URL = os.getenv("DATABASE_URL", "mssql+aioodbc://user:password@server/database?driver=ODBC+Driver+17+for+SQL+Server")

# Setup the connection pool
engine = create_async_engine(
    DATABASE_URL, 
    pool_size=20, 
    max_overflow=10, 
    echo=False # Set to True for query logging
)

async def get_db_connection():
    """Dependency to provide a database connection"""
    async with engine.begin() as conn:
        yield conn
