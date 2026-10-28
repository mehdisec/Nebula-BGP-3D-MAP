# 🛰️ Nebula BGP 3D MAP: Interactive 3D & 2D Global Routing Topology & WHOIS Radar

<div align="center">

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black.svg?logo=three.js&logoColor=white)](https://threejs.org/)
[![BGP Routing](https://img.shields.io/badge/BGP-RIS%20Collectors-cyan.svg)](https://stat.ripe.net/)
[![License](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/Author-mehdisec-purple.svg?logo=github)](https://github.com/mehdisec)

**An interactive 3D and 2D Autonomous System (AS) network topology visualizer and BGP routing intelligence radar.**

[English Documentation](README.md) • [راهنمای فارسی](README_FA.md)

<br/>

<p align="center">
  <img src="assets/preview.png" alt="Nebula BGP 3D MAP Dashboard Preview" width="100%">
</p>

</div>

---

## 📖 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
  - [1. 3D Radial Topology Engine](#1--3d-radial-topology-engine)
  - [2. 2D Planar Orthogonal Map Mode](#2--2d-planar-orthogonal-map-mode)
  - [3. Announced Prefixes & Multi-Format Export](#3--announced-prefixes--multi-format-export-txt-csv-json)
  - [4. Deep AS Inspector & Peering Relationships](#4--deep-as-inspector--peering-relationships)
  - [5. 2-Second Hover Holographic HUD](#5--2-second-hover-holographic-hud)
- [⚡ Quick Start (1-Line Installation)](#-quick-start-1-line-installation)
  - [Windows (PowerShell)](#windows-powershell)
  - [Linux & macOS (Bash)](#linux--macos-bash)
  - [Python Package (pip)](#python-package-pip)
- [📡 REST API Endpoints](#-rest-api-endpoints)
- [🏗️ Architecture & Technology Stack](#️-architecture--technology-stack)
- [👤 Author](#-author)
- [📄 License](#-license)

---

## 🔭 Overview

**NEBULA-BGP** resolves any **IPv4, IPv6, CIDR prefix range (e.g., `8.8.8.0/24`), or Autonomous System Number (e.g., `AS15169`)** to generate an interactive real-time multi-hop routing graph and full WHOIS/RDAP intelligence radar.

Using live telemetry from **23+ global RIPE RIS Route Collectors** and route tables, it reconstructs actual upstream transit paths, Tier-1 backbone meshes, and direct peering relationships across up to **10 concentric radial hop shells**.

---

## ✨ Key Features

### 1. 🌌 3D Radial Topology Engine
- **Concentric Hop Shells (0 to 10 Hops):** Core Target Origin sits at $(0, 0, 0)$ with glowing orbital rings radiating outward to edge vantage points.
- **Color-Coded Network Tiers:**
  - 🔵 **Hop 0 (Core Target):** Neon Cyan (`#00f0ff`)
  - 🔷 **Hop 1 (Direct Peers & Upstreams):** Sky Blue (`#38bdf8`)
  - 🟣 **Hop 2 (Tier-1 Global Backbones):** Bright Purple (`#a855f7`)
  - 🟡 **Hop 3–5 (Regional Transits):** Amber / Gold (`#fbbf24`)
  - 🔴 **Hop 6–10 (Edge Networks):** Rose / Crimson (`#f43f5e`)
- **Tier-1 Backbone Mesh:** Models real settlement-free cross-peering sessions between global backbones (Level 3, Telia/Arelion, NTT, Cogent, Tata, Hurricane Electric, Zayo, etc.).
- **Animated Packet Flow:** Glowing particle pulses along BGP links in 3D mode.

### 2. 🗺️ 2D Planar Orthogonal Map Mode
- **1-Click 2D Toggle:** Instant switch button (`🗺️ 2D Map` / `🌐 3D View`) positioned in the top-left header.
- **Strictly Non-Overlapping Concentric Rings:** Mathematically distributes nodes evenly on 2D orbital perimeters ($R = 140 \times \text{Hop}$), preventing any node from collapsing to the center.
- **Clean Static Architecture:** Zero particle movement or camera shaking in 2D mode for clean network diagrams.
- **High-Contrast Prominent Links:** 93% opacity with thick, distinct lines (`1.8px – 4.2px`).
- **In-Place AS Highlighting:** Selecting an AS highlights its node with a neon halo and illuminates all of its connected links without displacing or moving the global map center.

### 3. 📋 Announced Prefixes & Multi-Format Export (.TXT, .CSV, .JSON)
- **Left Sidebar Prefixes Inspector:** Automatically opens when clicking any AS node to list all announced IPv4 & IPv6 CIDRs fetched directly from RIPE RIS.
- **Live Search & Protocol Tabs:** Instant text filter and tabs for `All`, `IPv4`, and `IPv6` with counter badges.
- **1-Click Prefix Trace:** Click the "Trace" button on any prefix to instantly recalculate the network topology for that specific subnet.
- **Full AS Specification Export:**
  - 📄 **`.TXT`**: Formatted executive report with AS header, registry identity, organization, country, and numbered prefix inventory.
  - 📊 **`.CSV`**: Spreadsheet-ready table with ASN, organization, country, IP version, prefix, and CIDR length.
  - 📦 **`.JSON`**: Complete structured JSON document with full AS specification, statistics, and categorized arrays.

### 4. 🔬 Deep AS Inspector & Peering Relationships
- **Right Sidebar Intelligence Panel:**
  - **Target Summary:** IP geolocation, ISP, organization, coordinates, and prefix.
  - **AS Inspector:** Detailed ASN profile, power ranking, registration date, abuse contact, and interactive peer chips.
  - **WHOIS & RDAP:** Cleanly parsed NetRange, OrgName, Address, and Abuse contacts.
  - **Looking Glass Paths:** Raw observed BGP AS-Paths collected across worldwide vantage points.

### 5. ⏱️ 2-Second Hover Holographic HUD
- **Hover Countdown Progress Ring:** Circular SVG timer (`2.0s → 0s`) tracks continuous hover next to the cursor.
- **Locked AS Hologram Card:** Prevents accidental tooltips and opens a comprehensive AS status card with one-click inspection.

---

## ⚡ Quick Start (1-Line Installation)

### Windows (PowerShell)
Open PowerShell in the project directory and run:
```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
*Or single-command line:*
```powershell
python -m pip install -r requirements.txt; python run.py
```

### Linux & macOS (Bash)
Open terminal in the project directory and run:
```bash
chmod +x install.sh && ./install.sh
```
*Or single-command line:*
```bash
python3 -m pip install -r requirements.txt && python3 run.py
```

### Windows Batch Launcher
Double-click `run.bat` or run:
```cmd
run.bat
```

### Python Package (pip)
Install the package locally:
```bash
pip install -e .
nebula-bgp
```

After launching, open your browser at:
👉 **`http://localhost:8000`**

---

## 📡 REST API Endpoints

Interactive Swagger documentation is available at **`http://localhost:8000/docs`**.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/trace?target={ip/cidr/asn}&depth={1-10}` | Trace BGP route propagation and generate 2D/3D topology graph |
| `GET` | `/api/as/{asn}` | Fetch full AS profile, organization, country, and peering metadata |
| `GET` | `/api/as/{asn}/prefixes` | Fetch all announced IPv4 and IPv6 CIDR prefixes for an AS |
| `GET` | `/api/health` | Service health status and engine version |

---

## 🏗️ Architecture & Technology Stack

```
d:\1\BGP\
├── backend/
│   ├── main.py            # FastAPI REST API, CLI entrypoint & static mounting
│   ├── bgp_service.py     # BGP Looking Glass engine, RIPE RIS client & topology graph builder
│   ├── as_database.py     # Curated Tier-1 & major backbone networks database
│   ├── models.py          # Pydantic data schemas
│   └── cache.py           # In-memory high performance TTL cache
├── frontend/
│   ├── index.html         # Cyberpunk dark dashboard with Left & Right sidebars
│   ├── css/style.css      # Custom neon glassmorphism & layout stabilization
│   ├── js/
│   │   ├── app.js         # Core controller, search, tabs & TXT/CSV/JSON export logic
│   │   ├── visualizer3d.js# 3D radial sphere & 2D planar map engine (Three.js + ForceGraph)
│   │   └── hover_hud.js   # 2-second continuous hover ring & holographic AS HUD
│   └── vendor/            # Three.js & 3d-force-graph
├── install.ps1            # 1-line PowerShell installer & launcher (Windows)
├── install.sh             # 1-line Bash installer & launcher (Linux/macOS)
├── run.bat                # 1-click batch launcher
├── setup.py               # Python package configuration
├── requirements.txt       # Python dependencies
└── run.py                 # Convenience server launcher
```

- **Backend:** Python 3.9+, FastAPI, Uvicorn, HTTPX (async), Pydantic v2.
- **Frontend:** HTML5, Vanilla JavaScript (ES6+), Three.js (r128), 3d-force-graph, Tailwind CSS.
- **Data Providers:** RIPE NCC RIS, RIPE Stat APIs, PeeringDB, ARIN/RIPE/APNIC RDAP.

---

## 👤 Author
**mehdisec**
- GitHub: [@mehdisec](https://github.com/mehdisec)

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
