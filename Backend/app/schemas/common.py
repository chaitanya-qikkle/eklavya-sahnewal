"""
Shared response/request types used across all domains.
"""
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard API envelope returned by every endpoint."""
    success: bool
    message: str
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response envelope."""
    success: bool
    message: str
    page: int
    page_size: int
    total_records: int
    total_pages: int
    has_next_page: bool
    data: List[T]


class UserContext(BaseModel):
    """Decoded JWT payload — injected into endpoints via Depends(get_current_user)."""
    user_id: int
    plant_id: int
    username: str
