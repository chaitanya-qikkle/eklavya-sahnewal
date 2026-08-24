"""
Request / response schemas for authentication and user management.

User identifiers (user_id, created_by, modified_by, deleted_by against a
user) are GUID strings — IND_MST_USER.UserID is a uniqueidentifier column
in the live database, not an int.
"""
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)


class UserDetails(BaseModel):
    user_id:    str
    username:   str
    first_name: str
    last_name:  str
    email:      str
    role_id:    int
    role:       str
    plant_id:   int
    client_id:  Optional[int] = None


class LoginResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user_details:  UserDetails


# ── User CRUD ─────────────────────────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    role_id:    int       = Field(..., gt=0)
    plant_id:   Optional[int] = None
    client_id:  Optional[int] = None
    first_name: str       = Field(..., min_length=1, max_length=100)
    last_name:  str       = Field(..., min_length=0, max_length=100)
    username:   str       = Field(..., min_length=3, max_length=50)
    password:   str       = Field(..., min_length=3, max_length=100)
    email_id:   EmailStr
    created_by: Optional[str] = None


class UserUpdateRequest(BaseModel):
    user_id:    str
    role_id:    int            = Field(..., gt=0)
    plant_id:   Optional[int]  = None
    client_id:  Optional[int]  = None
    first_name: str            = Field(..., min_length=1, max_length=100)
    last_name:  str            = Field(..., min_length=0, max_length=100)
    username:   str            = Field(..., min_length=3, max_length=50)
    password:   Optional[str]  = Field(None, min_length=3, max_length=100)
    email_id:   EmailStr
    modified_by: Optional[str] = None


class UserUpdatePasswordRequest(BaseModel):
    user_id:  str
    password: str = Field(..., min_length=1, max_length=50)


class UserDeleteRequest(BaseModel):
    user_id:    str
    deleted_by: Optional[str] = None


# ── Role CRUD ─────────────────────────────────────────────────────────────────

class RoleCreateRequest(BaseModel):
    role:       str           = Field(..., min_length=2, max_length=100)
    plant_id:   Optional[int] = None
    created_by: Optional[str] = None

    @field_validator("role")
    @classmethod
    def strip_role(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Role name cannot be blank")
        return v


class RoleUpdateRequest(BaseModel):
    role_id:     int           = Field(..., gt=0)
    role:        str           = Field(..., min_length=2, max_length=100)
    plant_id:    Optional[int] = None
    modified_by: Optional[str] = None

    @field_validator("role")
    @classmethod
    def strip_role(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Role name cannot be blank")
        return v


class RoleDeleteRequest(BaseModel):
    role_id:    int = Field(..., gt=0)
    deleted_by: Optional[str] = None


# ── Menu CRUD ─────────────────────────────────────────────────────────────────

class MenuCreateRequest(BaseModel):
    menu_name:      str           = Field(..., min_length=1)
    parent_menu_id: Optional[int] = None
    menu_url:       Optional[str] = None
    menu_icon:      Optional[str] = None
    area:           Optional[str] = None
    controller:     Optional[str] = None
    action_result:  Optional[str] = None
    plant_id:       Optional[int] = None
    created_by:     Optional[str] = None


class MenuUpdateRequest(BaseModel):
    menu_id:        int
    menu_name:      str           = Field(..., min_length=1)
    parent_menu_id: Optional[int] = None
    menu_url:       Optional[str] = None
    menu_icon:      Optional[str] = None
    area:           Optional[str] = None
    controller:     Optional[str] = None
    action_result:  Optional[str] = None
    plant_id:       Optional[int] = None
    modified_by:    Optional[str] = None


class MenuDeleteRequest(BaseModel):
    menu_id:    int
    deleted_by: Optional[str] = None


class RoleMenuSetRequest(BaseModel):
    role_id:    int
    menu_ids:   list[int] = Field(default_factory=list)
    created_by: Optional[str] = None
