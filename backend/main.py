"""
FastAPI Server for 3D BGP Topology & WHOIS Radar.
Serves REST API and modern frontend static dashboard.
"""

import os
import time
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.bgp_service import bgp_service
from backend.models import BGPTraceResponse

app = FastAPI(
    title="3D BGP Topology & WHOIS Radar API",
    description="Interactive 3D network visualization and BGP routing intelligence engine",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

# Health Check
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "BGP-3D-Radar",
        "timestamp": int(time.time()),
        "version": "2.0.0"
    }

# Trace & Visualize IP / CIDR / ASN Endpoint
@app.get("/api/trace", response_model=BGPTraceResponse)
async def trace_endpoint(
    ip: Optional[str] = Query(None, description="Target IPv4/IPv6, CIDR, or ASN (e.g., 8.8.8.8, 1.1.1.0/24, AS15169)"),
    target: Optional[str] = Query(None, description="Target resource (IP, CIDR range, or ASN)"),
    depth: int = Query(10, ge=1, le=10, description="Maximum path length / hop depth (1 to 10)")
):
    query_resource = target or ip
    if not query_resource:
        raise HTTPException(status_code=400, detail="Missing required target parameter (e.g. ?target=8.8.8.8 or ?target=AS15169).")

    try:
        data = await bgp_service.trace_target(target=query_resource, max_depth=depth)
        return data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BGP Trace Engine Error: {str(e)}")

# Single AS Detail Endpoint
@app.get("/api/as/{asn}")
async def get_as_detail(asn: int):
    try:
        data = await bgp_service.get_as_detail(asn)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch AS{asn} details: {str(e)}")

# AS Announced Prefixes Endpoint
@app.get("/api/as/{asn}/prefixes")
async def get_as_prefixes(asn: int):
    try:
        data = await bgp_service.get_as_prefixes(asn)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch prefixes for AS{asn}: {str(e)}")

# Static Files & SPA Routing
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
async def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse(content={"message": "Frontend not found"}, status_code=404)

def serve_cli():
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"\n=======================================================")
    print(f" 🛰️  NEBULA // BGP RADAR Server")
    print(f" 🌐 Dashboard available at: http://localhost:{port}")
    print(f" 📡 API Docs available at:  http://localhost:{port}/docs")
    print(f"=======================================================\n")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)

if __name__ == "__main__":
    serve_cli()

