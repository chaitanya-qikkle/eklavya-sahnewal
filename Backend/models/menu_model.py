from typing import List, Optional

from pydantic import BaseModel, Field


class MenuCreateRequest(BaseModel):
    menu_name: str = Field(..., min_length=1)
    parent_menu_id: Optional[int] = None
    menu_url: Optional[str] = None
    menu_icon: Optional[str] = None
    area: Optional[str] = None
    controller: Optional[str] = None
    action_result: Optional[str] = None
    plant_name: Optional[str] = None
    sort_order: int = 0
    created_by: Optional[int] = 1


class MenuUpdateRequest(BaseModel):
    menu_id: int
    menu_name: str = Field(..., min_length=1)
    parent_menu_id: Optional[int] = None
    menu_url: Optional[str] = None
    menu_icon: Optional[str] = None
    area: Optional[str] = None
    controller: Optional[str] = None
    action_result: Optional[str] = None
    plant_name: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    modified_by: Optional[int] = 1


class MenuDeleteRequest(BaseModel):
    menu_id: int
    deleted_by: Optional[int] = 1


class RoleMenuSetRequest(BaseModel):
    role_id: int
    menu_ids: List[int] = Field(default_factory=list)
    created_by: Optional[str] = '00000000-0000-0000-0000-000000000000'
