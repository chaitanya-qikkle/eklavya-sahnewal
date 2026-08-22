class DatabaseError(RuntimeError):
    """Raised when a database operation fails."""

    def __init__(self, message: str, detail: str | None = None):
        super().__init__(message)
        self.detail = detail
