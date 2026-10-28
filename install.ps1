# =======================================================
# NEBULA // BGP RADAR - Windows 1-Line Installer & Launcher
# =======================================================
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " 🛰️  NEBULA // BGP RADAR - 1-Line Installer & Launcher" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Installing Python dependencies..." -ForegroundColor Yellow
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Failed to install dependencies. Please verify Python 3.9+ is in PATH." -ForegroundColor Red
    Exit 1
}

Write-Host "`n[2/2] Launching Dashboard on http://localhost:8000 ..." -ForegroundColor Green
python run.py
