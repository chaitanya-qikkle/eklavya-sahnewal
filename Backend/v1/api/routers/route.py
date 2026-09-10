import logging

from v1.api.auth.auth_router import auth_router
from v1.api.master_api.router import master_router
from v1.api.container_api.router import container_router
from v1.api.reports_api.router import report_router
from v1.api.assets_api.Assets import assets_router
from fastapi import APIRouter

logger = logging.getLogger(__name__)

route = APIRouter()

route.include_router(auth_router,prefix="/v1",tags=["AUTH"])
route.include_router(master_router,prefix="/v1", tags=["MASTER"])
route.include_router(container_router,prefix="/v1",tags=["CONTAINER"])
route.include_router(report_router,prefix="/v1",tags=["REPORTS"])
route.include_router(assets_router,prefix="/v1/assets",tags=["ASSETS"])

# OCR pulls in torch/ultralytics/opencv — heavy deps that may not be
# installed in every environment. Import defensively so a missing-deps
# environment loses only /v1/ocr/* instead of crashing the whole backend.
try:
    from v1.api.ocr_api.router import router as ocr_router
    # Mounted at the app root (no /v1 prefix) so it matches the original
    # standalone service's URL — POST http://<server>/ocr
    route.include_router(ocr_router,tags=["OCR"])
except Exception:
    logger.exception(
        "OCR module failed to load (torch/ultralytics/opencv missing?) — "
        "/v1/ocr/* endpoints are disabled. Run: pip install -r requirements.txt"
    )


