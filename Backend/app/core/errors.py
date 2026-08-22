"""
Custom exception types used throughout the application.

Raising a typed exception lets the global error handlers (in main.py)
return consistent JSON responses without repeating try/except in every endpoint.
"""


class DatabaseError(Exception):
    """Raised when a database operation fails."""


class NotFoundError(Exception):
    """Raised when a requested resource does not exist."""


class ValidationError(Exception):
    """Raised when incoming data fails business-rule validation."""


class AuthenticationError(Exception):
    """Raised when credentials are invalid or the token is expired."""
