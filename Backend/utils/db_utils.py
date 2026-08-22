from db_configs.db_connection import get_db_connection
import logging

logger = logging.getLogger(__name__)


class SQLManager:
    def __init__(self):
        logger.debug("Initializing database connection...")
        self.conn = get_db_connection()
        
        if self.conn:
            logger.info("Database Connected")
        else:
            logger.error("Database Connection Failed")

    def execute_query(self, sql_query, params=None, commit=False, fetch_all=False):
        """
        Execute SQL query with parameters
        
        Args:
            sql_query: SQL query string
            params: Query parameters tuple
            commit: Whether to commit the transaction
            fetch_all: Whether to fetch all result sets
            
        Returns:
            dict: Response with status, message, and data
        """
        response = {}

        if self.conn is None:
            logger.warning("Connection lost, attempting to reconnect...")
            self.conn = get_db_connection()

        if self.conn is None:
            logger.error("Database connection unavailable")
            return {"status": "error", "message": "Database connection unavailable"}

        try:
            cursor = self.conn.cursor()
            cursor.execute(sql_query, params or ())

            # Multiple result sets
            if fetch_all:
                result_sets = []

                while True:
                    if cursor.description:
                        columns = [col[0] for col in cursor.description]
                        rows = cursor.fetchall()
                        result_sets.append(
                            [dict(zip(columns, row)) for row in rows]
                        )

                    if not cursor.nextset():
                        break

                response = {
                    "status": "success",
                    "message": "Query executed successfully",
                    "data": result_sets
                }

            # Single result set
            else:
                if cursor.description:
                    columns = [col[0] for col in cursor.description]
                    rows = cursor.fetchall()
                    response = {
                        "status": "success",
                        "message": "Query executed successfully",
                        "data": [dict(zip(columns, row)) for row in rows]
                    }
                else:
                    self.conn.commit()
                    response = {
                        "status": "success",
                        "message": "Executed successfully",
                        "rows_affected": cursor.rowcount
                    }

            if commit:
                self.conn.commit()
                logger.debug("Transaction committed")

            cursor.close()

        except Exception as e:
            if self.conn:
                self.conn.rollback()
                logger.error(f"Query execution failed, rolled back: {str(e)}")
            response = {"status": "error", "message": f"Database operation failed: {str(e)}"}

        return response

    def close_connection(self):
        """Close database connection"""
        if self.conn:
            try:
                self.conn.close()
                logger.debug("Database connection closed")
            except Exception as e:
                logger.error(f"Error closing connection: {str(e)}")
