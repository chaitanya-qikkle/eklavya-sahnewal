"""
Request / response schemas for Container and E-Survey operations.
"""
from pydantic import BaseModel, field_validator


class UpdateLocationRequest(BaseModel):
    """Update the physical slot location of a container."""
    container_no: str
    location: str  # Format: Block:Row:Column:Stack  e.g. "B2:C:8:2"

    @field_validator("container_no")
    @classmethod
    def clean_container_no(cls, v: str) -> str:
        v = v.strip().upper().replace(" ", "")
        if not v:
            raise ValueError("container_no cannot be empty")
        return v

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        v = v.strip()
        parts = [p.strip() for p in v.split(":")]
        if len(parts) < 4 or any(p == "" for p in parts):
            raise ValueError("location must be Block:Row:Column:Stack  e.g. B2:C:8:2")
        return v
