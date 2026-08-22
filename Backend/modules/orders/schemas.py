from pydantic import BaseModel, Field
from typing import Optional

class OrderCreateRequest(BaseModel):
    item_name: str = Field(..., max_length=100)
    quantity: int = Field(..., gt=0)
    remarks: Optional[str] = None

class OrderResponseDto(BaseModel):
    order_id: int
    item_name: str
    status: str
