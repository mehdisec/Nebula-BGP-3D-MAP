#!/usr/bin/env bash
# =======================================================
# NEBULA // BGP RADAR - Linux / macOS 1-Line Installer
# =======================================================
set -e

echo -e "\033[1;36m=======================================================\033[0m"
echo -e "\033[1;36m 🛰️  NEBULA // BGP RADAR - 1-Line Installer & Launcher\033[0m"
echo -e "\033[1;36m=======================================================\033[0m"

echo -e "\n\033[1;33m[1/2] Installing Python dependencies...\033[0m"
python3 -m pip install --upgrade pip || pip install --upgrade pip
python3 -m pip install -r requirements.txt || pip install -r requirements.txt

echo -e "\n\033[1;32m[2/2] Launching Dashboard on http://localhost:8000 ...\033[0m"
python3 run.py || python run.py
