# 🎮 Spatial Recon Game

[![Deploy Web Capture](https://github.com/DigiArch424/spatial-recon-game/actions/workflows/deploy-l01.yml/badge.svg)](https://github.com/DigiArch424/spatial-recon-game/actions/workflows/deploy-l01.yml)
[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-blue)](https://digiarch424.github.io/spatial-recon-game/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A web-based, open-source distributed 3D reconstruction engine, gamified across 20 levels.
Each level is a real subsystem. Each subsystem maps to a real deployment environment.

**End goal:** Reconstructed real-world spaces with spatial coordinates, AR anchoring,
and 3D model placement.

**Live:** https://digiarch424.github.io/spatial-recon-game/

---

## Walking Skeleton Status

The system is being built as a thin vertical slice first — every layer connected
end to end before any layer is deepened. Current status:

| Component | Status | Notes |
|---|---|---|
| Browser capture (L01–L03) | ✅ Live | Camera, frames, guided scan, coverage map |
| Upload flow | ✅ Built | Browser → S3 → Redis → pipeline |
| FastAPI service | ✅ Built | Needs deployment to Railway |
| SFM worker (COLMAP) | ✅ Built | Needs deployment with COLMAP |
| Mesh worker (Open3D) | ✅ Built | Needs deployment to Railway |
| Three.js mesh viewer | ✅ Built | Loads mesh from S3 presigned URL |
| Database schema | ✅ Written | Needs Supabase project |
| Backend deployment | ⏳ Pending | See deployment guide below |

---

## Architecture Overview

| Layer | Levels | Target | Stack |
|---|---|---|---|
| 🌐 Browser | 1–3 | GitHub Pages | WebRTC, Three.js, Vite, IndexedDB |
| ⚙️ Edge / WASM | 4–6 | Cloudflare Workers | OpenCV.js, COLMAP, FastAPI |
| ☁️ GPU Cloud | 7–14 | RunPod / K8s | OpenMVS, Nerfstudio, WebGPU |
| 🧠 AI / Spatial OS | 15–20 | AI microservices | SAM, CLIP, Neo4j, WebXR |

---

## Level Checklist

### 🟢 Browser Layer — `apps/web-capture`

| Level | Name | Status | Key Capability |
|---|---|---|---|
| L01 | Camera Spawn | ✅ Complete | WebRTC single-frame capture, DigiArch424 HUD |
| L02 | Frame Collector | ✅ Complete | Multi-frame sessions, IndexedDB, blur detection, ZIP export |
| L03 | Scene Sampling Mode | ✅ Complete | Phase-guided capture, gyroscope, Three.js coverage map |

### 🟡 Edge / WASM Layer

| Level | Name | Status | Key Capability |
|---|---|---|---|
| L04 | Feature Vision | ⏳ Pending | OpenCV.js per-frame feature detection |
| L05 | SfM Core | ⏳ Pending | COLMAP / FastAPI microservice |
| L06 | Pose Graph Engine | ⏳ Pending | Camera trajectory reconstruction |

### ☁️ GPU Cloud Layer

| Level | Name | Status | Key Capability |
|---|---|---|---|
| L07 | Sparse Reconstruction | ⏳ Pending | COLMAP sparse point cloud |
| L08 | Dense Reconstruction | ⏳ Pending | OpenMVS depth fusion |
| L09 | Mesh Forging | ⏳ Pending | Open3D surface reconstruction |
| L10 | Texture Binding | ⏳ Pending | Blender CLI UV bake |
| L11 | Pipeline Orchestrator | ⏳ Pending | Temporal.io / Dagster |
| L12 | Gaussian Splat World | ⏳ Pending | Nerfstudio training |
| L13 | Real-Time Splat Renderer | ⏳ Pending | WebGPU viewer |
| L14 | Streaming Loop | ⏳ Pending | Live incremental pipeline |

### 🧠 AI + Spatial OS Layer

| Level | Name | Status | Key Capability |
|---|---|---|---|
| L15 | Semantic Scene Layer | ⏳ Pending | SAM + CLIP + vector DB |
| L16 | Parametric Engine | ⏳ Pending | Neural implicit → CAD primitives |
| L17 | Scene Graph Intelligence | ⏳ Pending | Neo4j knowledge graph |
| L18 | WebXR Spatial Mode | ⏳ Pending | AR anchoring + overlay |
| L19 | Shared Spatial Worlds | ⏳ Pending | Multi-user CRDT sync |
| L20 | Production Spatial OS | ⏳ Pending | Full distributed spatial platform |

---

## Project Structure

```
spatial-recon-game/
├── railway.toml                    # Railway deployment config
├── apps/
│   └── web-capture/                # Browser layer (L01–L03)
│       ├── public/
│       │   ├── favicon.svg
│       │   └── .nojekyll
│       ├── src/
│       │   ├── App.jsx
│       │   ├── api/
│       │   │   └── client.js
│       │   ├── db/
│       │   │   └── frameDB.js
│       │   ├── hooks/
│       │   │   ├── useCamera.js
│       │   │   ├── useDeviceOrientation.js
│       │   │   ├── useFrameStore.js
│       │   │   ├── useReconStatus.js
│       │   │   ├── useScanGuidance.js
│       │   │   ├── useTick.js
│       │   │   ├── useUpload.js
│       │   │   └── useWindowSize.js
│       │   ├── components/
│       │   │   ├── CoverageMap.jsx
│       │   │   ├── FrameStrip.jsx
│       │   │   ├── HudOverlays.jsx
│       │   │   ├── MeshViewer.jsx
│       │   │   ├── MobilePanel.jsx
│       │   │   └── Primitives.jsx
│       │   └── utils/
│       │       └── imageAnalysis.js
│       ├── index.html
│       ├── package.json
│       └── vite.config.js
├── infrastructure/
│   ├── db/
│   │   └── schema.sql              # PostgreSQL schema (6 tables)
│   ├── docker-compose.yml          # Local dev stack
│   └── README.md
└── services/
    ├── api/                        # FastAPI service
    │   ├── main.py
    │   ├── config.py
    │   ├── database.py
    │   ├── storage.py
    │   ├── queue.py
    │   ├── routers/
    │   │   ├── sessions.py
    │   │   └── reconstructions.py
    │   ├── Dockerfile
    │   └── requirements.txt
    ├── sfm-worker/                 # COLMAP SfM worker
    │   ├── worker.py
    │   ├── colmap_runner.py
    │   ├── storage.py
    │   ├── api.py
    │   ├── Dockerfile
    │   └── requirements.txt
    └── mesh-worker/                # Open3D mesh worker
        ├── worker.py
        ├── mesh_runner.py
        ├── storage.py
        ├── api.py
        ├── Dockerfile
        └── requirements.txt
```

---

## Backend Deployment (Walking Skeleton)

Three free online services + Railway. See `infrastructure/README.md` for full details.

### Required accounts
- [Supabase](https://supabase.com) — PostgreSQL database
- [Upstash](https://upstash.com) — Redis queue
- [Cloudflare R2](https://cloudflare.com/r2) — Object storage
- [Railway](https://railway.app) — API and worker deployment

### Steps
1. Create Supabase project → run `infrastructure/db/schema.sql`
2. Create Upstash Redis database
3. Create Cloudflare R2 bucket named `spatialrecon`
4. Deploy `services/api/` to Railway — set all env vars
5. Deploy `services/sfm-worker/` to Railway or RunPod
6. Deploy `services/mesh-worker/` to Railway
7. Set `VITE_API_URL` in `apps/web-capture/.env` → redeploy browser app

---

## Quick Start (Browser only)

```bash
git clone https://github.com/DigiArch424/spatial-recon-game.git
cd spatial-recon-game/apps/web-capture
npm install
npm run dev
```

---

## Principles
- 100% online-first — no local installs required to view or run
- Open source libraries only
- AR anchoring with real-world coordinates is the end goal
- Walking skeleton first — thin vertical slice before deepening any layer
- Progressive complexity: Browser → Edge → GPU → AI

## Repo
https://github.com/DigiArch424/spatial-recon-game
