#Requires -RunAsAdministrator
param(
    [int]   $Port        = 8080,
    [int]   $FastApiPort = 5000,
    [string]$SiteName    = "YMS"
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
$DIST = Join-Path $ROOT "Frontend\dist"

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   YMS IIS Setup  |  Site: $SiteName  |  Port: $Port" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify React build exists
Write-Host "[1/6] Checking frontend build..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $DIST "index.html"))) {
    Write-Host "  [ERROR] index.html not found in: $DIST" -ForegroundColor Red
    Write-Host "  Build first:  cd Frontend && npm run build" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Found: $DIST" -ForegroundColor Green

# 2. Enable required IIS Windows features
Write-Host "[2/6] Enabling IIS Windows features..." -ForegroundColor Cyan
$features = @(
    "IIS-WebServerRole",
    "IIS-WebServer",
    "IIS-CommonHttpFeatures",
    "IIS-StaticContent",
    "IIS-DefaultDocument",
    "IIS-HttpErrors",
    "IIS-HttpCompressionStatic",
    "IIS-HttpCompressionDynamic",
    "IIS-Security",
    "IIS-RequestFiltering",
    "IIS-Performance",
    "IIS-WebServerManagementTools",
    "IIS-ManagementConsole"
)
foreach ($f in $features) {
    $feat = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction SilentlyContinue
    if ($feat -and $feat.State -ne "Enabled") {
        Write-Host "  Enabling $f ..."
        Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart | Out-Null
    }
}
Write-Host "  IIS features OK." -ForegroundColor Green

# 3. Check ARR + URL Rewrite
Write-Host "[3/6] Checking ARR and URL Rewrite..." -ForegroundColor Cyan
Import-Module WebAdministration -ErrorAction Stop

$arrDll     = "C:\Windows\System32\inetsrv\arr.dll"
$rewriteDll = "C:\Windows\System32\inetsrv\rewrite.dll"

$missingModules = @()
if (-not (Test-Path $arrDll))     { $missingModules += "Application Request Routing (ARR)" }
if (-not (Test-Path $rewriteDll)) { $missingModules += "URL Rewrite" }

if ($missingModules.Count -gt 0) {
    Write-Host "  [ACTION REQUIRED] Install these IIS modules:" -ForegroundColor Yellow
    foreach ($m in $missingModules) {
        Write-Host "    - $m" -ForegroundColor Yellow
    }
    Write-Host "  ARR        : https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Cyan
    Write-Host "  URL Rewrite: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Cyan
    Write-Host "  After installing, re-run: .\setup_iis.ps1" -ForegroundColor Yellow
    $ans = Read-Host "  Continue without API proxy? [y/N]"
    if ($ans -ne "y") { exit 1 }
} else {
    try {
        Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' `
            -filter "system.webServer/proxy" -name "enabled" -value $true
        Write-Host "  ARR global proxy: enabled." -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] Could not enable ARR proxy: $_" -ForegroundColor Yellow
        Write-Host "  Enable manually: IIS Manager > server > ARR > Server Proxy Settings > Enable proxy" -ForegroundColor Yellow
    }
}

# 4. Application Pool
Write-Host "[4/6] Configuring App Pool '$SiteName'..." -ForegroundColor Cyan
if (Test-Path "IIS:\AppPools\$SiteName") {
    Write-Host "  Removing old pool..."
    Stop-WebAppPool -Name $SiteName -ErrorAction SilentlyContinue
    Remove-WebAppPool -Name $SiteName
}
New-WebAppPool -Name $SiteName | Out-Null
Set-ItemProperty "IIS:\AppPools\$SiteName" managedRuntimeVersion ""
Set-ItemProperty "IIS:\AppPools\$SiteName" managedPipelineMode   1
Set-ItemProperty "IIS:\AppPools\$SiteName" startMode             1
Write-Host "  App pool '$SiteName' created." -ForegroundColor Green

# 5. Website
Write-Host "[5/6] Creating IIS site '$SiteName' on port $Port..." -ForegroundColor Cyan

$conflicting = Get-Website | Where-Object {
    $_.Bindings.Collection | Where-Object { $_.bindingInformation -like "*:${Port}:*" }
} | Select-Object -First 1

if ($conflicting -and $conflicting.Name -ne $SiteName) {
    Write-Host "  [ERROR] Port $Port already used by site '$($conflicting.Name)'." -ForegroundColor Red
    Write-Host "  Run:  .\setup_iis.ps1 -Port 8081" -ForegroundColor Yellow
    exit 1
}

if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
    Write-Host "  Removing old site..."
    Remove-Website -Name $SiteName
}

New-Website -Name $SiteName `
            -PhysicalPath $DIST `
            -Port $Port `
            -ApplicationPool $SiteName `
            -Force | Out-Null

Write-Host "  Site '$SiteName' created at $DIST on port $Port." -ForegroundColor Green

# 6. Firewall
Write-Host "[6/6] Opening firewall port $Port..." -ForegroundColor Cyan
$fwRule = "YMS Frontend HTTP $Port"
Remove-NetFirewallRule -DisplayName $fwRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $fwRule `
                    -Direction Inbound -Protocol TCP `
                    -LocalPort $Port -Action Allow | Out-Null
Write-Host "  Firewall rule added for TCP $Port." -ForegroundColor Green

# Start
Start-WebAppPool -Name $SiteName -ErrorAction SilentlyContinue
Start-Website    -Name $SiteName -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend  : http://127.0.0.1:$Port/" -ForegroundColor White
Write-Host "   API docs  : http://127.0.0.1:$Port/api/docs" -ForegroundColor White
Write-Host "   Health    : http://127.0.0.1:$Port/health" -ForegroundColor White
Write-Host ""
Write-Host "   FastAPI stays on port $FastApiPort (run .\start_server.bat)."
Write-Host "   IIS proxies /v1 /api /uploads /health to 127.0.0.1:$FastApiPort."
Write-Host ""
Write-Host "   To go live on port 80 later:  .\setup_iis.ps1 -Port 80"
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host ""
