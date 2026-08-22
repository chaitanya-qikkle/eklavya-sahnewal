from fastapi import APIRouter
from v1.api.master_api.activity_crud import activity_router
from v1.api.master_api.inventory_entry_crud import inventory_entry_router
from v1.api.master_api.commodity_crud import commodity_router
from v1.api.master_api.cont_size_crud import cont_size_router
from v1.api.master_api.cont_type_crud import cont_type_router
from v1.api.master_api.customer_crud import customer_router
from v1.api.master_api.client_crud import client_router
from v1.api.master_api.line_crud import line_router
from v1.api.master_api.process_crud import process_router
from v1.api.master_api.equipment_crud import equipment_router
from v1.api.master_api.equipment_transaction_crud import equipment_transaction_router
from v1.api.master_api.device_data_crud import device_data_router
from v1.api.master_api.container_crud import container_router
from v1.api.master_api.yard_crud import yard_router
from v1.api.master_api.plant_crud import plant_router
from v1.api.master_api.block_crud import block_router
from v1.api.master_api.breakdown_crud import breakdown_router

master_router = APIRouter()


master_router.include_router(activity_router, prefix="/activity")
master_router.include_router(commodity_router, prefix="/commodity")
master_router.include_router(cont_size_router, prefix="/cont-size")
master_router.include_router(cont_type_router, prefix="/cont-type")
master_router.include_router(customer_router, prefix="/customer")
master_router.include_router(client_router, prefix="/client")
master_router.include_router(line_router, prefix="/line")
master_router.include_router(process_router, prefix="/process")
master_router.include_router(equipment_router, prefix="/equipment")
master_router.include_router(equipment_transaction_router, prefix="/equipment-transaction")
master_router.include_router(device_data_router, prefix="/device-data")
master_router.include_router(container_router, prefix="/container")
master_router.include_router(yard_router, prefix="/yard")
master_router.include_router(plant_router, prefix="/plant")
master_router.include_router(block_router, prefix="/block")
master_router.include_router(breakdown_router, prefix="/breakdown")
master_router.include_router(inventory_entry_router, prefix="/inventory-entry")
