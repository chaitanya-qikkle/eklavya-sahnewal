#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$SERVER_IP    = "13.203.238.227"
$REPO_URL     = "git@github.com:chaitanya-qikkle/eklavya-budget.git"
$DEPLOY_DIR   = "C:\eklavya-budget"
$BACKEND_DIR  = "$DEPLOY_DIR\Backend"
$FRONTEND_DIR = "$DEPLOY_DIR\Frontend"
$DIST_DIR     = "$FRONTEND_DIR\dist"
$VENV_DIR     = "$BACKEND_DIR\env"
$SERVICE_NAME = "BudgetCFS_API"
$API_PORT     = 5050
$SITE_NAME    = "BudgetCFS"
$IIS_PORT     = 8090

function Log($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function OK($msg)  { Write-Host "  [OK] $msg" -ForegroundColor Green }
function ERR($msg) { Write-Host "  [ERROR] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Yellow
Write-Host "  Budget CFS -- Server Setup  |  $SERVER_IP" -ForegroundColor Yellow
Write-Host "  ================================================================" -ForegroundColor Yellow
Write-Host ""

# STEP 1 -- Install Chocolatey
Log "STEP 1: Installing Chocolatey..."
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    OK "Chocolatey installed."
} else {
    OK "Chocolatey already present."
}

# STEP 2 -- Install Git, Python, Node.js, NSSM
Log "STEP 2: Installing Git, Python 3.11, Node.js 20, NSSM..."

$tools = @(
    @{ name="git";    cmd="git";    pkg="git"        },
    @{ name="python"; cmd="python"; pkg="python311"  },
    @{ name="node";   cmd="node";   pkg="nodejs-lts" },
    @{ name="nssm";   cmd="nssm";   pkg="nssm"       }
)
foreach ($t in $tools) {
    if (-not (Get-Command $t.cmd -ErrorAction SilentlyContinue)) {
        Log "Installing $($t.name)..."
        choco install $t.pkg -y --no-progress
    } else {
        OK "$($t.name) already installed."
    }
}

$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("PATH","User")

# STEP 3 -- Clone repo
Log "STEP 3: Cloning repository..."
if (Test-Path $DEPLOY_DIR) {
    Log "Repo already exists -- pulling latest..."
    Set-Location $DEPLOY_DIR
    git pull origin main
} else {
    git clone $REPO_URL $DEPLOY_DIR
}
OK "Repo ready at $DEPLOY_DIR"

# STEP 4 -- Python venv + backend deps
Log "STEP 4: Setting up Python virtual environment..."
Set-Location $BACKEND_DIR

if (-not (Test-Path $VENV_DIR)) {
    python -m venv env
}

& "$VENV_DIR\Scripts\pip.exe" install --upgrade pip -q
& "$VENV_DIR\Scripts\pip.exe" install -r requirements.txt -q
OK "Backend dependencies installed."

# STEP 5 -- Build React frontend
Log "STEP 5: Building React frontend..."
Set-Location $FRONTEND_DIR

$envContent = "VITE_API_BASE_URL=`nVITE_GOOGLE_MAPS_KEY=`n"
Set-Content ".env.production" $envContent -Encoding utf8

npm install --silent
npm run build

if (-not (Test-Path "$DIST_DIR\index.html")) {
    ERR "Frontend build failed -- index.html not found in dist\"
}
OK "Frontend built at $DIST_DIR"

# STEP 6 -- IIS Setup
Log "STEP 6: Configuring IIS..."
Import-Module WebAdministration -ErrorAction Stop

$features = @(
    "IIS-WebServerRole","IIS-WebServer","IIS-CommonHttpFeatures",
    "IIS-StaticContent","IIS-DefaultDocument","IIS-HttpErrors",
    "IIS-HttpCompressionStatic","IIS-HttpCompressionDynamic",
    "IIS-Security","IIS-RequestFiltering","IIS-Performance",
    "IIS-WebServerManagementTools","IIS-ManagementConsole"
)
foreach ($f in $features) {
    $feat = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue
    if ($feat -and $feat.State -ne "Enabled") {
        Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart | Out-Null
    }
}

$webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="API Proxy" stopProcessing="true">
          <match url="^(v1|api|uploads|health)(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$API_PORT/{R:1}{R:2}" />
        </rule>
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".webp" mimeType="image/webp" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
</configuration>
"@
$webConfig | Out-File "$DIST_DIR\web.config" -Encoding utf8
OK "web.config written."

if (Test-Path "IIS:\AppPools\$SITE_NAME") {
    Stop-WebAppPool $SITE_NAME -ErrorAction SilentlyContinue
    Remove-WebAppPool $SITE_NAME
}
New-WebAppPool -Name $SITE_NAME | Out-Null
Set-ItemProperty "IIS:\AppPools\$SITE_NAME" managedRuntimeVersion ""
Set-ItemProperty "IIS:\AppPools\$SITE_NAME" managedPipelineMode 1
Set-ItemProperty "IIS:\AppPools\$SITE_NAME" startMode 1

$default = Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue
if ($default) { Stop-Website "Default Web Site" -ErrorAction SilentlyContinue }

if (Get-Website -Name $SITE_NAME -ErrorAction SilentlyContinue) {
    Remove-Website -Name $SITE_NAME
}
New-Website -Name $SITE_NAME `
            -PhysicalPath $DIST_DIR `
            -Port $IIS_PORT `
            -ApplicationPool $SITE_NAME `
            -Force | Out-Null

Start-WebAppPool $SITE_NAME -ErrorAction SilentlyContinue
Start-Website    $SITE_NAME -ErrorAction SilentlyContinue
OK "IIS site '$SITE_NAME' running on port $IIS_PORT."

# STEP 7 -- Register FastAPI as Windows Scheduled Task (no NSSM needed)
Log "STEP 7: Registering FastAPI as Windows Scheduled Task..."

$UVICORN_EXE = "$VENV_DIR\Scripts\uvicorn.exe"
$TASK_NAME   = "BudgetCFS_API"

New-Item -ItemType Directory -Force "$BACKEND_DIR\logs" | Out-Null

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue

$action  = New-ScheduledTaskAction `
    -Execute $UVICORN_EXE `
    -Argument "main:app --host 0.0.0.0 --port $API_PORT --workers 4 --log-level info --access-log" `
    -WorkingDirectory $BACKEND_DIR

$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Budget CFS FastAPI backend on port $API_PORT" | Out-Null

Start-ScheduledTask -TaskName $TASK_NAME
OK "Scheduled Task '$TASK_NAME' registered and started."

# STEP 8 -- Firewall
Log "STEP 8: Opening firewall ports..."
Remove-NetFirewallRule -DisplayName "BudgetCFS HTTP" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "BudgetCFS API"  -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "BudgetCFS HTTP" -Direction Inbound -Protocol TCP -LocalPort $IIS_PORT -Action Allow | Out-Null
New-NetFirewallRule -DisplayName "BudgetCFS API"  -Direction Inbound -Protocol TCP -LocalPort $API_PORT -Action Allow | Out-Null
OK "Firewall ports $IIS_PORT and $API_PORT opened."

# DONE
$FULL_URL = "http://" + $SERVER_IP + ":" + $IIS_PORT
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : $FULL_URL/" -ForegroundColor White
Write-Host "  API Docs : $FULL_URL/api/docs" -ForegroundColor White
Write-Host "  Health   : $FULL_URL/health" -ForegroundColor White
Write-Host ""
Write-Host "  To update after git push:" -ForegroundColor Yellow
Write-Host "    cd $DEPLOY_DIR\deploy"
Write-Host "    .\update.ps1"
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host ""
