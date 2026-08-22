# Backend Architecture Guide

> **YMS — Yard Management System**  
> FastAPI · Python 3.11 · SQL Server (stored procedures via pyodbc)

---

## Folder Structure

```
Backend/
│
├── main.py                   ← FastAPI app setup (CORS, middleware, routers, static files)
│
├── app/                      ← NEW organised architecture
│   ├── core/                 ← Application-wide infrastructure
│   │   ├── config.py         ← All config read from .env  (one place for secrets/settings)
│   │   ├── database.py       ← SQLManager (sync) + SPExecutor (async) + db_session()
│   │   ├── security.py       ← JWT create/verify + FastAPI get_current_user dependency
│   │   └── errors.py         ← Custom exception types (DatabaseError, NotFoundError, …)
│   │
│   ├── schemas/              ← Pydantic request/response models, split by domain
│   │   ├── common.py         ← ApiResponse[T], PaginatedResponse[T], UserContext
│   │   ├── auth.py           ← LoginRequest, LoginResponse, UserCreate/Update/Delete, …
│   │   ├── master.py         ← Plant/Yard/Block/Activity/Commodity/… Add/Update/Delete
│   │   ├── container.py      ← UpdateLocationRequest
│   │   └── reports.py        ← GateReportRequest, DeviceLockReportRequest, …
│   │
│   ├── repositories/         ← Database access layer (SQL/SP calls ONLY — no logic)
│   │   ├── base.py           ← BaseRepository with _exec() / _exec_all() helpers
│   │   ├── auth_repository.py
│   │   ├── master_repository.py
│   │   ├── container_repository.py
│   │   └── reports_repository.py
│   │
│   ├── services/             ← Business logic (validates SP results, raises HTTP errors)
│   │   ├── auth_service.py
│   │   ├── master_service.py
│   │   ├── container_service.py
│   │   └── reports_service.py
│   │
│   └── api/                  ← HTTP layer (FastAPI routers — no SQL, no business logic)
│       ├── router.py         ← Aggregates all domain routers under /v1
│       ├── auth_router.py
│       ├── master_router.py
│       ├── container_router.py
│       └── reports_router.py
│
├── v1/                       ← LEGACY code (kept for compatibility, not touched)
│   └── api/
│       ├── auth/             ← login, create_user, jwt_token, menu_crud, role_crud
│       ├── master_api/       ← 17 CRUD files (plant, yard, block, activity, …)
│       ├── container_api/    ← ContainerInventory, esurvey_crud
│       └── reports_api/      ← Report.py
│
├── modules/                  ← v2 modular API (auth, orders, device_ingest)
│   ├── auth/                 ← router → service → repository (async SP executor)
│   ├── orders/
│   └── device_ingest/
│
├── models/                   ← Pydantic models used by v1 code
│   ├── master_model.py
│   ├── user_model.py
│   └── menu_model.py
│
├── middleware/               ← FastAPI middleware
│   ├── auth_middleware.py    ← JWT validation (used by v1 code)
│   ├── error_handler.py      ← Global exception handlers
│   ├── rate_limiter.py       ← slowapi rate limiting
│   └── request_logger.py     ← Request/response logging
│
├── core/                     ← v2 infrastructure (db_executor, errors)
├── db_configs/               ← DB connection config (pyodbc)
├── shared/                   ← Shared schemas used by v2 modules
├── utils/                    ← SQLManager used by v1 (legacy)
├── StoredProcedures/         ← All SQL stored procedure files (31 total)
├── tools/                    ← One-time setup/debug scripts (not part of the app)
├── uploads/                  ← File uploads (client logos, etc.)
└── logs/                     ← Rotating log files
```

---

## Request Flow

```
HTTP Request
    │
    ▼
main.py  (FastAPI app)
    │  CORS · Rate Limiting · Request Logging · Error Handlers
    ▼
app/api/<domain>_router.py      ← Validates input (Pydantic), calls service
    │
    ▼
app/services/<domain>_service.py  ← Business logic, validates SP results
    │
    ▼
app/repositories/<domain>_repository.py  ← SQL/SP execution via SQLManager
    │
    ▼
app/core/database.py  (SQLManager / SPExecutor)
    │
    ▼
SQL Server (stored procedures)
```

---

## Layer Responsibilities

| Layer | Location | Responsibility | What it must NOT do |
|-------|----------|---------------|---------------------|
| **Config** | `app/core/config.py` | Read `.env` into constants | Anything else |
| **Database** | `app/core/database.py` | Connect, execute, return raw dict | Business logic |
| **Security** | `app/core/security.py` | JWT creation + FastAPI auth dependency | DB access |
| **Schemas** | `app/schemas/` | Pydantic request/response models | Logic |
| **Repository** | `app/repositories/` | SQL/SP calls, return raw DB result | Business logic, HTTP |
| **Service** | `app/services/` | Validate results, apply rules, raise errors | SQL, HTTP response objects |
| **Router** | `app/api/` | HTTP in/out, call service | SQL, business logic |

---

## Adding a New Domain (step-by-step)

1. **Schema** — create `app/schemas/<domain>.py` with Add/Update/Delete request models
2. **Repository** — create `app/repositories/<domain>_repository.py`, extend `BaseRepository`
3. **Service** — create `app/services/<domain>_service.py`, inject repository via constructor
4. **Router** — create `app/api/<domain>_router.py`, define endpoints, call service
5. **Register** — add `include_router(...)` in `app/api/router.py`

Example for a new "Gate" domain:
```python
# app/api/router.py
from app.api.gate_router import router as gate_router
api_router.include_router(gate_router)
```

---

## Environment Variables (`.env`)

| Variable | Purpose |
|----------|---------|
| `DB_SERVER` | SQL Server hostname/IP |
| `DB_DATABASE` | Database name (default: `YMS_EKLAVYA`) |
| `DB_USERNAME` | SQL login username |
| `DB_PASSWORD` | SQL login password |
| `JWT_SECRET_KEY` | HMAC key for JWT signing |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default: 480) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime (default: 30) |
| `STATIC_IP` | Server LAN IP (added to CORS allowed origins) |
| `PORT` | Uvicorn port (default: 5000) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (`*` = allow all) |
| `STITCHING_DIR` | Path to gate-camera stitched images |

---

## Running the Server

```bash
cd Backend
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

API docs: http://localhost:5000/api/docs

---


