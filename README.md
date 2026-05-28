# 🎮 Spatial Recon Game

[![Deploy Level 01](https://github.com/DigiArch424/spatial-recon-game/actions/workflows/deploy-l01.yml/badge.svg)](https://github.com/DigiArch424/spatial-recon-game/actions/workflows/deploy-l01.yml)
[![Live Demo](https://img.shields.io/badge/Live-GitHub%20Pages-blue)](https://digiarch424.github.io/spatial-recon-game/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A web-based, open-source distributed 3D reconstruction engine, gamified across 20 levels.
Each level is a real subsystem. Each subsystem maps to a real deployment environment.

**Live:** https://digi4arch424.github.io/spatial-recon-game/

---

## Architecture Overview

| Layer | Levels | Target | Stack |
|---|---|---|---|
| 🌐 Browser | 1–3 | GitHub Pages / Vercel | WebRTC, Three.js, Vite |
| ⚙️ Edge/WASM | 4–6 | Cloudflare Workers | OpenCV.js, COLMAP, FastAPI |
| ☁️ GPU Cloud | 7–14 | RunPod / K8s | OpenMVS, Nerfstudio, WebGPU |
| 🧠 AI/Spatial OS | 15–20 | AI microservices | SAM, CLIP, Neo4j, WebXR |

---

## Levels

### 🟢 Browser Layer (Levels 1–3)
- **[L01] Camera Spawn** — `apps/web-capture` — WebRTC single-frame capture ✅
- [L02] Frame Collector — multi-frame capture + IndexedDB session state
- [L03] Scene Sampling Mode — guided AR overlay capture UX

### 🟡 Edge / WASM Layer (Levels 4–6)
- [L04] Feature Vision — OpenCV.js feature detection per frame
- [L05] Structure-from-Motion Core — COLMAP / FastAPI microservice
- [L06] Pose Graph Engine — camera trajectory reconstruction

### ☁️ GPU Cloud Layer (Levels 7–14)
- [L07] Sparse Reconstruction — COLMAP point cloud output
- [L08] Dense Reconstruction — OpenMVS depth fusion
- [L09] Mesh Forging — Open3D surface reconstruction
- [L10] Texture Binding — Blender CLI UV bake
- [L11] Pipeline Orchestrator — Temporal.io / Dagster job graph
- [L12] Gaussian Splat World — Nerfstudio training
- [L13] Real-Time Splat Renderer — WebGPU viewer
- [L14] Streaming Reconstruction Loop — live incremental pipeline

### 🧠 AI + Spatial OS Layer (Levels 15–20)
- [L15] Semantic Scene Layer — SAM + CLIP + vector DB
- [L16] Parametric Engine — neural implicit → CAD primitives
- [L17] Scene Graph Intelligence — Neo4j knowledge graph
- [L18] WebXR Spatial Mode — AR anchoring + overlay
- [L19] Shared Spatial Worlds — multi-user CRDT sync
- [L20] Production Spatial OS — full distributed spatial platform

---

## Quick Start

```bash
git clone https://github.com/DigiArch424/spatial-recon-game.git
cd spatial-recon-game/apps/web-capture
npm install
npm run dev
# → http://localhost:5173/spatial-recon-game/
```

## Deployment

Level 1 auto-deploys to GitHub Pages on every push to `main` that touches `apps/web-capture/`.

To enable on a new repo:
1. Go to **Settings → Pages → Source → GitHub Actions**
2. Push to `main` — the workflow handles the rest

---

## Principles
- 100% online-first — no local installs required to view or run
- Open source libraries only throughout
- Each level/module deploys independently
- Progressive complexity: Browser → Edge → GPU → AI

## Repo
https://github.com/DigiArch424/spatial-recon-game
