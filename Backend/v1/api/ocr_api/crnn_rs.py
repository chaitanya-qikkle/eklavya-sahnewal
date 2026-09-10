import torch
import cv2
import numpy as np
import re
import torch.nn.functional as F
from ultralytics import YOLO
import os

from .model import CRNN
from .ctc_decoder import ctc_decode

# --- Model Setup ---
chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
label2char = {i + 1: c for i, c in enumerate(chars)}
num_classes = len(chars) + 1

ocr_model = CRNN(1, 80, 400, num_classes, map_to_seq_hidden=64, rnn_hidden=128, leaky_relu=True)
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, 'crnn_044800_loss0.2275.pt')
ocr_model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu'))
ocr_model.eval()
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
ocr_model.to(device)

# Load YOLO Model
YOLO_MODEL_PATH = os.path.join(BASE_DIR, 'reach_stacker.pt')
yolo = YOLO(YOLO_MODEL_PATH)


# --- Resize with padding ---
def resize_with_padding(img, target_h=80, target_w=400, pad_color=(0, 0, 0)):
    h, w = img.shape[:2]
    scale = min(target_w / w, target_h / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_w = target_w - new_w
    pad_h = target_h - new_h
    top = pad_h // 2
    bottom = pad_h - top
    left = pad_w // 2
    right = pad_w - left

    padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=pad_color)
    return padded


def preprocess_crop(crop, target_h=80, target_w=400):
    """Preprocess crop exactly as during inference."""

    # Rotate portrait crops
    if crop.shape[0] > crop.shape[1]:
        crop = cv2.rotate(crop, cv2.ROTATE_90_COUNTERCLOCKWISE)

    padded = resize_with_padding(crop, target_h, target_w)

    gray = cv2.cvtColor(padded, cv2.COLOR_BGR2GRAY)

    normed = (gray.astype(np.float32) / 127.5) - 1.0

    tensor = torch.FloatTensor(normed).unsqueeze(0).unsqueeze(0)

    return tensor


# --- Checksum Validation ---
def is_valid_container_number(number):
    if not re.fullmatch(r'[A-Z]{4}[0-9]{7}', number):
        return False
    char_map = {'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17, 'H': 18, 'I': 19, 'J': 20, 'K': 21, 'L': 23, 'M': 24,
                'N': 25, 'O': 26, 'P': 27, 'Q': 28, 'R': 29, 'S': 30, 'T': 31, 'U': 32, 'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38}
    digits = []
    for i, char in enumerate(number[:10]):
        val = int(char) if char.isdigit() else char_map.get(char, 0)
        digits.append(val * (2 ** i))
    checksum = sum(digits) % 11
    if checksum == 10:
        checksum = 0
    return checksum == int(number[-1])


# --- Main Inference Function ---
def process_image(image):
    try:
        original_frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    except Exception:
        return "invalid img"

    # Try original image first, then 180° rotated image
    for frame in [original_frame, cv2.rotate(original_frame, cv2.ROTATE_180)]:

        results = yolo(frame)[0]

        if results.boxes is None or len(results.boxes) == 0:
            continue

        boxes_all = results.boxes.xyxy.cpu().numpy().astype(int)
        confidences = results.boxes.conf.cpu().numpy()

        draw_texts = []

        for box, conf in zip(boxes_all, confidences):

            if conf < 0.75:
                continue

            x1, y1, x2, y2 = box

            cropped_img = frame[y1:y2, x1:x2]

            if cropped_img.size == 0:
                continue

            # OCR preprocessing
            input_tensor = preprocess_crop(cropped_img).to(device)

            with torch.no_grad():
                output = ocr_model(input_tensor)
                log_probs = F.log_softmax(output, dim=2)

                decoded_list, confidence_list = ctc_decode(
                    log_probs,
                    label2char=label2char,
                    method="greedy"
                )

            text = ''.join(decoded_list[0]).upper()
            confidence = confidence_list[0]

            filtered = re.sub(r'[^A-Z0-9]', '', text)
            corrected = filtered[:11]

            if len(corrected) == 11 and is_valid_container_number(corrected):
                draw_texts.append((corrected, confidence, x1, y1))

        # If any valid OCR result found
        if draw_texts:

            # Highest confidence first
            draw_texts.sort(key=lambda x: x[1], reverse=True)

            seen = set()
            final_lines = []

            for text, confidence, x, y in draw_texts:

                if text not in seen:
                    seen.add(text)
                    final_lines.append(text)

            if final_lines:
                return ", ".join(final_lines)

    # Neither original nor rotated image produced a valid OCR
    return "00000000000"
