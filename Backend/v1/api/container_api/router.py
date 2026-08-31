from fastapi import APIRouter
from v1.api.container_api.ContainerInventory import router
from v1.api.container_api.esurvey_crud import router as esurvey_router
from v1.api.container_api.gate_detection_crud import router as gate_detection_router
from v1.api.container_api.rail_in_crud import router as rail_in_router

container_router = APIRouter()

container_router.include_router(router, prefix="/container")
container_router.include_router(esurvey_router, prefix="/container")
container_router.include_router(gate_detection_router, prefix="/container")
container_router.include_router(rail_in_router, prefix="/container")
