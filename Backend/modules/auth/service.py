from fastapi import HTTPException, status

from modules.auth.repository import AuthRepository
from modules.auth.schemas import LoginRequest, LoginResponse, UserDetails
from v1.api.auth.jwt_token import create_access_token, create_refresh_token


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    async def login(self, request: LoginRequest) -> tuple[str, LoginResponse]:
        sp_result = await self.repository.login(request.username, request.password)

        status_value = sp_result.get("STATUS") or sp_result.get("Status")
        message = sp_result.get("MSG") or sp_result.get("Message") or "Login successful"

        if status_value and str(status_value).lower() in {"failure", "0"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=message or "Invalid credentials",
            )

        user_id = sp_result.get("USER_ID")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Login response missing user id",
            )

        plant_id = sp_result.get("PLANT_ID")
        if plant_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Plant assignment missing for authenticated user",
            )

        role_name = sp_result.get("ROLE") or sp_result.get("ROLE_NAME") or "User"

        access_token = create_access_token(
            user_id=int(user_id),
            username=request.username,
            plant_id=int(plant_id),
        )
        refresh_token = create_refresh_token(user_id=int(user_id))

        response = LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            user_details=UserDetails(
                user_id=int(user_id),
                username=request.username,
                first_name=sp_result.get("FIRST_NAME") or "",
                last_name=sp_result.get("LAST_NAME") or "",
                email=sp_result.get("EMAIL_ID") or "",
                role_id=int(sp_result.get("ROLE_ID") or 0),
                role=role_name,
                plant_id=int(plant_id),
            ),
        )

        return message, response
