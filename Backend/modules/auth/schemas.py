from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


class UserDetails(BaseModel):
    user_id: int
    username: str
    first_name: str
    last_name: str
    email: str
    role_id: int
    role: str
    plant_id: int


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user_details: UserDetails
