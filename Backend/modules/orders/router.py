from fastapi import APIRouter, Depends
from core.db_executor import StoredProcedureExecutor, get_db_executor
from shared.dependencies import get_current_user
from shared.schemas import ApiResponse, UserContext

from .schemas import OrderCreateRequest, OrderResponseDto
from .repository import OrderRepository
from .service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])

def get_order_service(db: StoredProcedureExecutor = Depends(get_db_executor)) -> OrderService:
    """Dependency injection setup for the Order module"""
    repository = OrderRepository(db)
    return OrderService(repository)

@router.post("/", response_model=ApiResponse[OrderResponseDto])
async def create_order(
    request_data: OrderCreateRequest,
    user: UserContext = Depends(get_current_user),
    service: OrderService = Depends(get_order_service)
):
    """
    Creates a new order. 
    The user context (plant_id, user_id) is automatically extracted from the JWT token.
    All business logic is handled in the database stored procedure.
    """
    new_order = await service.create_new_order(request_data, user)
    
    return ApiResponse(
        success=True,
        message="Order created successfully.",
        data=new_order
    )
