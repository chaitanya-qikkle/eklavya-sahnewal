from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional


class UserCreateRequest(BaseModel):
    role_id: int = Field(..., gt=0, description="Role ID")
    first_name: str = Field(..., min_length=1, max_length=100, description="First name")
    last_name: str = Field(default="", max_length=100, description="Last name")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=1, max_length=100, description="Password")
    email_id: EmailStr = Field(..., description="Email address")
    created_by: Optional[str] = Field(default="", description="Created by user ID")


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=1, max_length=100, description="Password")


class UserDeleteRequest(BaseModel):
    user_id: str = Field(..., description="User ID (UUID) to delete")
    deleted_by: str = Field(default="", description="Deleted by user ID (UUID)")


class UserUpdateRequest(BaseModel):
    user_id: str = Field(..., description="User ID (UUID)")
    role_id: int = Field(..., gt=0, description="Role ID")
    plant_id: int = Field(default=1, description="Plant ID")
    client_id: int = Field(default=1, description="Client ID")
    first_name: str = Field(..., min_length=1, max_length=200, description="First name")
    last_name: str = Field(default="", max_length=200, description="Last name")
    username: str = Field(..., min_length=3, max_length=200, description="Username")
    password: Optional[str] = Field(None, max_length=200, description="Password")
    email_id: EmailStr = Field(..., description="Email address")
    created_by: str = Field(default="", description="Created by user ID (UUID)")


class UserUpdatePasswordRequest(BaseModel):
    user_id: str = Field(..., description="User ID (UUID)")
    password: str = Field(..., min_length=1, max_length=50, description="New password")


class RoleCreateRequest(BaseModel):
    role: str = Field(..., min_length=2, max_length=100, description="Role name")
    plant_id: Optional[int] = Field(None, description="Plant ID")
    created_by: str = Field(default="", description="Created by user ID (UUID)")
    
    @field_validator('role')
    @classmethod
    def validate_role_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Role name cannot be empty or whitespace')
        return v.strip()


class RoleUpdateRequest(BaseModel):
    role_id: int = Field(..., gt=0, description="Role ID")
    role: str = Field(..., min_length=2, max_length=100, description="Role name")
    plant_id: Optional[int] = Field(None, description="Plant ID")
    modified_by: Optional[str] = Field(default="", description="Modified by user ID (UUID)")
    created_by: Optional[str] = Field(default="", description="Created by user ID (UUID)")
    
    @field_validator('role')
    @classmethod
    def validate_role_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Role name cannot be empty or whitespace')
        return v.strip()


class RoleDeleteRequest(BaseModel):
    role_id: int = Field(..., gt=0, description="Role ID to delete")
    deleted_by: str = Field(default="", description="Deleted by user ID (UUID)")
