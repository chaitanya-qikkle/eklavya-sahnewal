# Eklavya — Yard Management System (YMS)

A full-stack web + desktop application for managing container yards, gate operations, equipment tracking, and real-time 3D yard visualization.

---

## Project Structure

```
eklavya-main/
├── Frontend/          # React web app + Tauri desktop wrapper
├── Backend/           # FastAPI Python backend
├── deploy/            # Server deployment & IIS setup scripts
├── docs/              # Reference files (CAD layouts, SQL setup)
└── README.md
```

---

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 18, React Router 7, Redux Toolkit, Vite   |
| UI        | Tailwind CSS, Framer Motion                     |
| 3D Yard   | Three.js + React Three Fiber                    |
| Desktop   | Tauri 2.x (Windows installer + auto-update)     |
| Backend   | FastAPI (Python 3.11), Uvicorn                  |
| Database  | SQL Server via ODBC + stored procedures         |
| Auth      | JWT (access + refresh tokens)                   |

---

## Getting Started

### Backend

```bash
cd Backend
python -m venv env
env\Scripts\activate        
pip install -r requirements.txt
uvicorn main:app --reload --port 5000
```

Requires a `.env` file (copy from `.env.example` or set manually):
```
JWT_SECRET_KEY=...
ACCESS_TOKEN_EXPIRE_MINUTES=480
REFRESH_TOKEN_EXPIRE_DAYS=30
DB_SERVER=...
DB_DATABASE=YMS_EKLAVYA
DB_USERNAME=...
DB_PASSWORD=...
```

### Frontend (Web)

```bash
cd Frontend
npm install
npm run dev          # dev server at localhost:5173
npm run build        # production build → dist/
```

### Frontend (Desktop / Tauri)

```bash
cd Frontend
npm run tauri:dev    # desktop dev mode
npm run tauri:build  # builds .exe/.msi installer
```

---

## Key Modules

### Frontend (`Frontend/src/`)

| Folder          | Purpose                                          |
|-----------------|--------------------------------------------------|
| `modules/gate/` | Gate In / Gate Out operations                    |
| `modules/container/` | Container inventory, e-survey inspection   |
| `modules/yard3d/` | 3D yard visualization, live equipment tracking |
| `modules/dashboard/` | KPI dashboards                              |
| `modules/machine/` | Equipment / machine management               |
| `modules/report/` | Reports & exports                             |
| `modules/auth/` | Login, session management                        |
| `modules/userSettings/` | User profile, roles, menu config          |
| `store/`        | Redux state + RTK Query API definitions          |
| `components/`   | Shared UI components (Navbar, Footer, etc.)      |
| `config/`       | API base URL config                              |

### Backend (`Backend/`)

| Folder / File        | Purpose                                       |
|----------------------|-----------------------------------------------|
| `main.py`            | FastAPI app entry, routes, static files       |
| `v1/api/`            | All REST endpoints (auth, container, master, reports) |
| `v1/api/master_api/` | CRUD for master data (plant, yard, block, equipment, etc.) |
| `v1/api/container_api/` | Container inventory & e-survey            |
| `v1/api/auth/`       | Login, JWT, user & role management            |
| `middleware/`        | Auth, rate limiting, request logging          |
| `utils/db_utils.py`  | SQL query executor                            |
| `tools/`             | Debug & one-time setup scripts (not production) |
| `modules/`           | v2 modular API (in progress)                  |

### Deployment (`deploy/`)

| File                 | Purpose                                       |
|----------------------|-----------------------------------------------|
| `deploy.bat`         | Full deploy (pull, build frontend, restart)   |
| `start_server.bat`   | Start FastAPI server                          |
| `stop_server.bat`    | Stop FastAPI server                           |
| `install_service.bat`| Install as Windows service                    |
| `setup_iis.ps1`      | Configure IIS reverse proxy                   |

---

## API Overview

- **v1 API** — `/v1/...` — Complete CRUD for all business domains
- **v2 API** — `/api/v2/...` — New modular structure (auth, orders, device ingest) — in progress
- **Static files** — `/uploads/`, `/stitching/`, `/downloads/`, `/Images/`
- **SPA fallback** — All unmatched routes serve `index.html`

---

## Database

- SQL Server: `YMS_EKLAVYA`
- Schema reference JSON in `Backend/StoredProcedures/_schema/`
