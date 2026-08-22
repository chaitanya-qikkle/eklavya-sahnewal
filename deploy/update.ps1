#Requires -RunAsAdministrator

# Auto-detect repo root (one level up from deploy folder)
$DEPLOY_DIR   = Split-Path -Parent $PSScriptRoot
$FRONTEND_DIR = "$DEPLOY_DIR\Frontend"
$BACKEND_DIR  = "$DEPLOY_DIR\Backend"
$SERVICE_NAME = "BudgetCFS_API"

function Log($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function OK($msg)  { Write-Host "  [OK] $msg" -ForegroundColor Green }

Write-Host ""
Write-Host "  ===============================================" -ForegroundColor Yellow
Write-Host "  Budget CFS -- Updating..." -ForegroundColor Yellow
Write-Host "  ===============================================" -ForegroundColor Yellow
Write-Host "  Repo root: $DEPLOY_DIR" -ForegroundColor Gray

# 1. Pull latest code
Log "Pulling latest from GitHub..."
Set-Location $DEPLOY_DIR
git pull origin main
OK "Code updated."

# 2. Backend deps -- use venv if exists, else system pip
Log "Updating backend dependencies..."
$VENV_PIP = "$BACKEND_DIR\env\Scripts\pip.exe"
if (Test-Path $VENV_PIP) {
    & $VENV_PIP install -r "$BACKEND_DIR\requirements.txt" -q
} else {
    python -m pip install -r "$BACKEND_DIR\requirements.txt" -q
}
OK "Backend deps OK."

# 3. Rebuild frontend
Log "Rebuilding frontend..."
Set-Location $FRONTEND_DIR
npm install --silent
npm run build
OK "Frontend rebuilt."

# 4. Restart API (Scheduled Task on server, skip on local)
$task = Get-ScheduledTask -TaskName $SERVICE_NAME -ErrorAction SilentlyContinue
if ($task) {
    Log "Restarting API scheduled task..."
    Stop-ScheduledTask  -TaskName $SERVICE_NAME -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-ScheduledTask -TaskName $SERVICE_NAME
    OK "API restarted."
} else {
    Write-Host "  [SKIP] Scheduled task not found (local machine -- skipping restart)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  ===============================================" -ForegroundColor Green
Write-Host "  Update complete!" -ForegroundColor Green
Write-Host "  ===============================================" -ForegroundColor Green
Write-Host ""
