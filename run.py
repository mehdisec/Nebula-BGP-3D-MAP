"""
Convenience entry point to run the BGP 3D Radar application.
Usage: python run.py
"""

import sys
import uvicorn

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

if __name__ == "__main__":
    print("=" * 65)
    print("[*] Starting 3D BGP Topology & WHOIS Radar Server...")
    print("[*] Dashboard UI:  http://localhost:8000")
    print("[*] REST API Docs: http://localhost:8000/docs")
    print("=" * 65)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
