from fastapi import APIRouter, Depends

from core.db_executor import StoredProcedureExecutor, get_db_executor
from modules.auth.repository import AuthRepository
from modules.auth.schemas import LoginRequest, LoginResponse
from modules.auth.service import AuthService
from shared.schemas import ApiResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


def get_auth_service(db: StoredProcedureExecutor = Depends(get_db_executor)) -> AuthService:
    repository = AuthRepository(db)
    return AuthService(repository)


@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(
    request_data: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    message, payload = await service.login(request_data)
    return ApiResponse(success=True, message=message, data=payload)
