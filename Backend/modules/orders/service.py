from .repository import OrderRepository
from .schemas import OrderCreateRequest, OrderResponseDto
from shared.schemas import UserContext

class OrderService:
    def __init__(self, repository: OrderRepository):
        self.repository = repository
        
    async def create_new_order(self, order_data: OrderCreateRequest, user: UserContext) -> OrderResponseDto:
        """
        Orchestrates the order creation. Passes data from the router to the repository.
        """
        db_result = await self.repository.create_order(
            plant_id=user.plant_id,
            user_id=user.user_id,
            item_name=order_data.item_name,
            quantity=order_data.quantity,
            remarks=order_data.remarks
        )
        
        # db_result format is expected to be: {"OrderID": 123, "ItemName": "Widget", "Status": "Pending"}
        # Map database response keys to our consistent Pydantic DTO
        return OrderResponseDto(
            order_id=db_result.get("OrderID", 0),
            item_name=db_result.get("ItemName", ""),
            status=db_result.get("Status", "Unknown")
        )
