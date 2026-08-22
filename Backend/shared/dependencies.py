from fastapi import Depends

from middleware.auth_middleware import get_current_user as get_current_user_dict
from middleware.auth_middleware import get_optional_user as get_optional_user_dict
from shared.schemas import UserContext


async def get_current_user(user: dict = Depends(get_current_user_dict)) -> UserContext:
    return UserContext(**user)


async def get_optional_user(user: dict | None = Depends(get_optional_user_dict)) -> UserContext | None:
    if not user:
        return None
    return UserContext(**user)
