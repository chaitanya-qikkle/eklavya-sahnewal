"""Reach Stacker container-number OCR — from GDL_RS_OCR_API (root-level
standalone project). Ported into the main backend as a normal APIRouter so it
runs in the same uvicorn process/app instead of a separate service:
YOLO (reach_stacker.pt) crops the container-number plate, a CRNN model
(crnn_044800_loss0.2275.pt) reads the text off the crop.

Frontend contract (unchanged from the original standalone /ocr endpoint):
  POST /ocr  (multipart file upload)
    -> { container_number: str, saved_image: str }
"""
import logging
import os
import traceback
from datetime import datetime
from io import BytesIO

from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from .crnn_rs import process_image

router = APIRouter()
logger = logging.getLogger(__name__)

# Folder to save uploaded images — project root (one level above Backend/),
# same env-var-override convention as STITCHING_DIR/UPLOADS_DIR elsewhere in
# this backend, so it can be repointed per-deployment without a code change.
PROJECT_ROOT = Path(__file__).resolve().parents[4]  # .../Backend/v1/api/ocr_api -> project root
SAVE_FOLDER = Path(os.getenv("OCR_IMAGES_DIR", str(PROJECT_ROOT / "ocr_images")))
SAVE_FOLDER.mkdir(parents=True, exist_ok=True)


@router.post("/ocr")
async def extract_container_text(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(BytesIO(contents)).convert("RGB")

        recognized_text = process_image(image)  # e.g. "MSCU1234567"
        if not recognized_text:
            recognized_text = "UNKNOWN"

        recognized_text = "".join(
            c for c in recognized_text if c.isalnum() or c in ("_", "-")
        )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = os.path.splitext(file.filename or "")[1] or ".jpg"
        filename = f"{recognized_text}_{timestamp}{ext}"
        save_path = SAVE_FOLDER / filename

        with open(save_path, "wb") as f:
            f.write(contents)

        return JSONResponse(
            content={
                "container_number": recognized_text,
                "saved_image": str(save_path),
            },
            status_code=200,
        )
    except Exception as e:
        logger.exception("OCR error")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "trace": traceback.format_exc()},
        )
