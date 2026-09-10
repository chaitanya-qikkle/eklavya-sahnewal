"""Reach Stacker container-number OCR — from GDL_RS_OCR_API (root-level
standalone project). Ported into the main backend as a normal APIRouter so it
runs in the same uvicorn process/app instead of a separate service:
YOLO (reach_stacker.pt) crops the container-number plate, a CRNN model
(crnn_044800_loss0.2275.pt) reads the text off the crop.

Frontend contract (unchanged from the original standalone /ocr endpoint):
  POST /v1/ocr/ocr  (multipart file upload)
    -> { container_number: str, saved_image: str }
"""
import logging
import os
import traceback
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from .crnn_rs import process_image

router = APIRouter()
logger = logging.getLogger(__name__)

# Folder to save uploaded images — same relative-to-module convention as the
# original standalone script (./ocr_images), just anchored under this
# package instead of the process's cwd.
SAVE_FOLDER = os.path.join(os.path.dirname(__file__), "ocr_images")
os.makedirs(SAVE_FOLDER, exist_ok=True)


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
        save_path = os.path.join(SAVE_FOLDER, filename)

        with open(save_path, "wb") as f:
            f.write(contents)

        return JSONResponse(
            content={
                "container_number": recognized_text,
                "saved_image": save_path,
            },
            status_code=200,
        )
    except Exception as e:
        logger.exception("OCR error")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "trace": traceback.format_exc()},
        )
