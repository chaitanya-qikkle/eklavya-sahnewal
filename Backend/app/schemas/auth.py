"""
Request / response schemas for authentication and user management.
"""
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)


class UserDetails(BaseModel):
    user_id:    int
    username:   str
    first_name: str
    last_name:  str
    email:      str
    role_id:    int
    role:       str
    plant_id:   int


class LoginResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user_details:  UserDetails


# ── User CRUD ─────────────────────────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    role_id:    int       = Field(..., gt=0)
    first_name: str       = Field(..., min_length=1, max_length=100)
    last_name:  str       = Field(..., min_length=0, max_length=100)
    username:   str       = Field(..., min_length=3, max_length=50)
    password:   str       = Field(..., min_length=3, max_length=100)
    email_id:   EmailStr
    created_by: int       = Field(default=1, gt=0)


class UserUpdateRequest(BaseModel):
    user_id:    int            = Field(..., gt=0)
    role_id:    int            = Field(..., gt=0)
    first_name: str            = Field(..., min_length=1, max_length=100)
    last_name:  str            = Field(..., min_length=0, max_length=100)
    username:   str            = Field(..., min_length=3, max_length=50)
    password:   Optional[str]  = Field(None, min_length=3, max_length=100)
    email_id:   EmailStr
    is_active:  bool           = True
    modified_by: int           = Field(default=1, gt=0)


class UserDeleteRequest(BaseModel):
    user_id:    int = Field(..., gt=0)
    deleted_by: int = Field(default=1, gt=0)


# ── Role CRUD ─────────────────────────────────────────────────────────────────

class RoleCreateRequest(BaseModel):
    role:     str           = Field(..., min_length=2, max_length=100)
    plant_id: Optional[int] = Field(None, gt=0)
    created_by: int         = Field(default=1, gt=0)

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
    plant_id:    Optional[int] = Field(None, gt=0)
    modified_by: int           = Field(default=1, gt=0)

    @field_validator("role")
    @classmethod
    def strip_role(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Role name cannot be blank")
        return v


class RoleDeleteRequest(BaseModel):
    role_id:    int = Field(..., gt=0)
    deleted_by: int = Field(default=1, gt=0)


# ── Menu CRUD ─────────────────────────────────────────────────────────────────

class MenuCreateRequest(BaseModel):
    menu_name:      str           = Field(..., min_length=1)
    parent_menu_id: Optional[int] = None
    menu_url:       Optional[str] = None
    menu_icon:      Optional[str] = None
    area:           Optional[str] = None
    controller:     Optional[str] = None
    action_result:  Optional[str] = None
    plant_name:     Optional[str] = None
    sort_order:     int           = 0
    created_by:     Optional[int] = 1


class MenuUpdateRequest(BaseModel):
    menu_id:        int
    menu_name:      str           = Field(..., min_length=1)
    parent_menu_id: Optional[int] = None
    menu_url:       Optional[str] = None
    menu_icon:      Optional[str] = None
    area:           Optional[str] = None
    controller:     Optional[str] = None
    action_result:  Optional[str] = None
    plant_name:     Optional[str] = None
    sort_order:     int           = 0
    is_active:      bool          = True
    modified_by:    Optional[int] = 1


class MenuDeleteRequest(BaseModel):
    menu_id:    int
    deleted_by: Optional[int] = 1


class RoleMenuSetRequest(BaseModel):
    role_id:    int
    menu_ids:   list[int] = Field(default_factory=list)
    created_by: Optional[int] = 1
