import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from middleware.rate_limiter import limiter, rate_limit_exceeded_handler
from v1.api.routers.route import route
from slowapi.errors import RateLimitExceeded
from middleware.error_handler import setup_exception_handlers
from middleware.request_logger import RequestLoggingMiddleware
from modules.auth.router import router as auth_router
from modules.orders.router import router as orders_router
from modules.device_ingest.router import router as device_ingest_router
from app.api.router import api_router
import logging
import logging.handlers

# ── Logging — rotating file + console ─────────────────────────────────────────
LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

log_formatter = logging.Formatter(
    "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

class _SuppressInvalidHttp(logging.Filter):
    def filter(self, record):
        return "Invalid HTTP request received" not in record.getMessage()

class _SafeRotatingFileHandler(logging.handlers.RotatingFileHandler):
    """RotatingFileHandler that skips rotation when another process holds the file.
    On Windows, uvicorn's reloader and worker both open the log file; the second
    process gets PermissionError (WinError 32) during rename — suppress it."""
    def doRollover(self):
        try:
            super().doRollover()
        except PermissionError:
            pass

file_handler = _SafeRotatingFileHandler(
    LOG_DIR / "yms.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

logging.basicConfig(level=logging.INFO, handlers=[file_handler, console_handler])
logger = logging.getLogger(__name__)

_invalid_http_filter = _SuppressInvalidHttp()
logging.getLogger("uvicorn.error").addFilter(_invalid_http_filter)
logging.getLogger("uvicorn").addFilter(_invalid_http_filter)

# ── App ───────────────────────────────────────────────────────────────────────
APP_VERSION  = "1.0.0"
STATIC_IP    = os.getenv("STATIC_IP", "").strip()
PORT         = os.getenv("PORT", "5050").strip()
DEBUG_MODE   = os.getenv("DEBUG", "false").strip().lower() == "true"

app = FastAPI(
    title="YMS — Yard Management System",
    description="Enterprise Yard Management System API",
    version=APP_VERSION,
    docs_url="/api/docs" if DEBUG_MODE else None,
    redoc_url="/api/redoc" if DEBUG_MODE else None,
    openapi_url="/api/openapi.json" if DEBUG_MODE else None,
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# ── Custom exception handlers + request logging ───────────────────────────────
setup_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
# ALLOWED_ORIGINS=*  → allow every origin (suitable for internal LAN)
# ALLOWED_ORIGINS=http://a.com,http://b.com  → restrict to those origins
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").strip()

if _raw_origins == "*":
    allowed_origins      = ["*"]
    allow_credentials_ok = False   # FastAPI disallows credentials with wildcard
else:
    allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    # Always allow the static IP on the server port
    if STATIC_IP:
        for scheme in ("http", "https"):
            for port_suffix in ("", f":{PORT}", ":80", ":443"):
                origin = f"{scheme}://{STATIC_IP}{port_suffix}"
                if origin not in allowed_origins:
                    allowed_origins.append(origin)
    # Allow Tauri desktop app origins
    # Windows WebView2 uses http://tauri.localhost; macOS/Linux use tauri://localhost
    for tauri_origin in ("tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"):
        if tauri_origin not in allowed_origins:
            allowed_origins.append(tauri_origin)
    allow_credentials_ok = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials_ok,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "X-Total-Count"],
    max_age=3600,
)

# ── Health / info endpoints ───────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "service": "YMS API", "version": APP_VERSION}

@app.get("/api/info", tags=["System"])
async def api_info():
    return {
        "service": "YMS Yard Management System",
        "version": APP_VERSION,
        "docs": "/api/docs",
    }

# ── Uploads (must be mounted before the SPA catch-all) ───────────────────────
UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ── Gate survey stitched images ───────────────────────────────────────────────
STITCHING_DIR = Path(os.getenv("STITCHING_DIR", r"D:\stitching\outputs"))
try:
    STITCHING_DIR.mkdir(parents=True, exist_ok=True)
except (FileNotFoundError, OSError):
    STITCHING_DIR = Path(__file__).resolve().parent / "stitching_outputs"
    STITCHING_DIR.mkdir(parents=True, exist_ok=True)
logger.info("Serving stitching images from: %s", STITCHING_DIR)

import mimetypes
mimetypes.add_type("image/jpeg", ".jpg")
mimetypes.add_type("image/jpeg", ".jpeg")
mimetypes.add_type("image/png",  ".png")

@app.get("/stitching/{file_path:path}", include_in_schema=False)
async def serve_stitching(file_path: str):
    """Serve gate-camera stitched images with explicit image content-type."""
    target = (STITCHING_DIR / file_path).resolve()
    try:
        target.relative_to(STITCHING_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Bad path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    suffix = target.suffix.lower()
    media = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png" if suffix == ".png" else "application/octet-stream"
    return FileResponse(str(target), media_type=media, headers={"Cache-Control": "public, max-age=3600"})

# ── Downloads (EXE / APK installer files + update manifest) ──────────────────
DOWNLOADS_DIR = Path(__file__).resolve().parent / "downloads"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/downloads/{file_path:path}", include_in_schema=False)
async def serve_download(file_path: str):
    """Serve installer files: EXE, APK, and update manifest JSON."""
    target = (DOWNLOADS_DIR / file_path).resolve()
    try:
        target.relative_to(DOWNLOADS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Bad path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    suffix = target.suffix.lower()
    media_map = {
        ".exe": "application/octet-stream",
        ".apk": "application/vnd.android.package-archive",
        ".msi": "application/octet-stream",
        ".json": "application/json",
    }
    media = media_map.get(suffix, "application/octet-stream")
    filename = target.name
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if suffix == ".json":
        headers = {"Cache-Control": "no-cache"}
    return FileResponse(str(target), media_type=media, headers=headers)

# ── API Routers ───────────────────────────────────────────────────────────────
app.include_router(route)
app.include_router(auth_router, prefix="/api/v2")
app.include_router(orders_router, prefix="/api/v2")
app.include_router(device_ingest_router, prefix="/api")
app.include_router(api_router)          # clean architecture — /v1/* SP-based routes

# ── Frontend (React production build) ────────────────────────────────────────
# Path is resolved relative to this file: Backend/../Frontend/dist
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "Frontend" / "dist"

if FRONTEND_DIST.exists():
    logger.info("Serving React build from: %s", FRONTEND_DIST)

    # Mount /assets — JS/CSS bundles produced by Vite
    _assets_dir = FRONTEND_DIST / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="spa-assets")

    # Mount /Images — public images copied by Vite build
    _images_dir = FRONTEND_DIST / "Images"
    if _images_dir.exists():
        app.mount("/Images", StaticFiles(directory=str(_images_dir)), name="spa-images")
else:
    logger.warning(
        "Frontend build not found at %s  →  run:  cd Frontend && npm run build",
        FRONTEND_DIST,
    )

# ── SPA routes — ALWAYS registered (checks dist at request time) ──────────────
# These must come AFTER every API router and static mount.

@app.get("/", include_in_schema=False)
async def serve_root():
    """Serve the React app root."""
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(str(index))
    from fastapi.responses import JSONResponse
    return JSONResponse({
        "service": "YMS API",
        "version": APP_VERSION,
        "status": "running — frontend not built",
        "docs": "/api/docs",
        "hint": "On the server run:  cd Frontend && npm run build  then restart the server",
    })



@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    """
    Catch-all for React Router client-side routes.
    Real files in dist/ (yard-layout.json, favicon.ico, etc.) are served directly.
    Everything else returns index.html so React Router takes over.
    API paths that somehow reach here are rejected with 404.
    """
    # Hard-coded prefixes that belong to the backend — never serve SPA for these
    API_PREFIXES = ("v1/", "api/", "uploads/", "stitching/", "health")
    if any(full_path.startswith(p) for p in API_PREFIXES):
        raise HTTPException(status_code=404, detail="Not found")

    # Serve actual file if it exists in the build (e.g. yard-layout.json)
    candidate = FRONTEND_DIST / full_path
    if candidate.is_file():
        return FileResponse(str(candidate))

    # SPA fallback → let React Router handle routing
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(str(index))

    # Frontend not built yet
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=503,
        content={
            "error": "Frontend not built",
            "hint": "On the server run:  cd Frontend && npm run build  then restart",
            "docs": "/api/docs",
        },
    )
