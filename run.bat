@echo off
title NEBULA // BGP RADAR
echo =======================================================
echo  NEBULA // BGP RADAR - 1-Click Installer and Launcher
echo =======================================================
echo.
echo [1/2] Installing requirements...
python -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install requirements. Please verify Python is installed.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo [2/2] Launching server on http://localhost:8000 ...
python run.py
pause
