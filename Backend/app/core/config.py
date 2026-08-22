"""
Application configuration — reads all settings from environment variables.
Single source of truth for every config value used across the app.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Database ──────────────────────────────────────────────────────────────────
DB_SERVER   = os.getenv("DB_SERVER", "")
DB_DATABASE = os.getenv("DB_DATABASE", "YMS_EKLAVYA")
DB_USERNAME = os.getenv("DB_USERNAME", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_ENCRYPT  = os.getenv("DB_ENCRYPT", "yes")
DB_TRUST_CERT = os.getenv("DB_TRUST_CERT", "yes")

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET_KEY              = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM               = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
REFRESH_TOKEN_EXPIRE_DAYS   = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

# ── Server ────────────────────────────────────────────────────────────────────
STATIC_IP       = os.getenv("STATIC_IP", "").strip()
PORT            = os.getenv("PORT", "5000").strip()
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").strip()

# ── File paths ────────────────────────────────────────────────────────────────
STITCHING_DIR = os.getenv("STITCHING_DIR", r"D:\stitching\outputs")

# ── Rate limiting ─────────────────────────────────────────────────────────────
LOGIN_RATE_LIMIT_PER_MINUTE = int(os.getenv("LOGIN_RATE_LIMIT_PER_MINUTE", "10"))

APP_VERSION = "1.0.0"
