from fastapi import APIRouter
from v1.api.container_api.ContainerInventory import router
from v1.api.container_api.esurvey_crud import router as esurvey_router

container_router = APIRouter()

container_router.include_router(router, prefix="/container")
container_router.include_router(esurvey_router, prefix="/container")
