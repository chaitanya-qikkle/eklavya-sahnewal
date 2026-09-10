import numpy as np
from crnn_rs import process_image
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from PIL import Image
from io import BytesIO
from datetime import datetime
import traceback
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
app = FastAPI()






# Folder to save uploaded images
SAVE_FOLDER = "ocr_images"
os.makedirs(SAVE_FOLDER, exist_ok=True)


@app.post("/ocr")
async def extract_container_text(file: UploadFile = File(...)):
    try:
        # Read uploaded image
        contents = await file.read()

        # Convert bytes to PIL image
        image = Image.open(BytesIO(contents)).convert("RGB")

        # OCR
        recognized_text = process_image(image)  # e.g. "MSCU1234567"

        # If OCR fails
        if not recognized_text:
            recognized_text = "UNKNOWN"

        # Remove invalid filename characters
        recognized_text = "".join(
            c for c in recognized_text if c.isalnum() or c in ("_", "-")
        )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        ext = os.path.splitext(file.filename)[1]
        if not ext:
            ext = ".jpg"

        filename = f"{recognized_text}_{timestamp}{ext}"
        save_path = os.path.join(SAVE_FOLDER, filename)

        # Save image
        with open(save_path, "wb") as f:
            f.write(contents)

        return JSONResponse(
        content={
            "container_number": recognized_text,
            "saved_image": save_path
        },
        status_code=200
    )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "trace": traceback.format_exc()
            }
        )