# Mesh Worker — Poisson Surface Reconstruction

Takes the sparse point cloud produced by the SFM worker and converts it
into a 3D mesh using Open3D Poisson surface reconstruction.

This worker is automatically triggered by the SFM worker — no manual
intervention needed once both workers are running.

---

## What it does

1. Waits for a job on the Redis queue (`queue:mesh`)
2. Downloads the sparse point cloud (`points3D.ply`) from S3
3. Estimates point normals
4. Runs Poisson surface reconstruction at depth 9
5. Removes low-density artifact vertices (bottom 10% by density)
6. Cleans mesh — removes degenerate triangles, duplicates, non-manifold edges
7. Uploads `mesh.obj` to S3
8. Reports MESH_COMPLETE back to the API

---

## File Structure

```
services/mesh-worker/
├── worker.py         ← Redis consumer loop, job orchestration
├── mesh_runner.py    ← Open3D Poisson reconstruction
├── storage.py        ← S3 download/upload helpers
├── api.py            ← API status update helper
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Pipeline Position

```
Browser → ZIP → [SFM Worker] → points3D.ply → [Mesh Worker] → mesh.obj → Browser
```

The SFM worker enqueues the mesh job automatically after SFM_COMPLETE.
The mesh worker listens on `queue:mesh` and processes it independently.

---

## Local Development

### 1. Start infrastructure

```bash
cd infrastructure
docker compose up -d
```

### 2. Create environment file

```bash
cp services/mesh-worker/.env.example services/mesh-worker/.env
```

### 3. Install dependencies

```bash
cd services/mesh-worker
pip install -r requirements.txt
```

Note: Open3D is ~500MB. First install takes a few minutes.

### 4. Run the worker

```bash
cd services/mesh-worker
python3 worker.py
```

---

## Docker

Build and run from repo root:

```bash
# Build
docker build -f services/mesh-worker/Dockerfile -t spatial-recon-mesh .

# Run (local infrastructure)
docker run --env-file services/mesh-worker/.env spatial-recon-mesh
```

---

## Deployment — Railway

1. Add a new service to your Railway project
2. Connect the same GitHub repo
3. Set **Root Directory** to `services/mesh-worker`
4. Railway detects the Dockerfile automatically
5. Add environment variables in the Railway dashboard:

```
REDIS_URL     rediss://default:[pw]@[host].upstash.io:6379
S3_ENDPOINT   https://[account].r2.cloudflarestorage.com
S3_BUCKET     spatialrecon
S3_ACCESS_KEY [key]
S3_SECRET_KEY [secret]
S3_REGION     auto
API_URL       https://[api-service].railway.app
```

Note: Open3D is CPU-only here. Mesh reconstruction on Railway free tier
will be slow for dense point clouds — adequate for the walking skeleton.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `REDIS_URL` | ✅ | Redis connection string |
| `S3_ENDPOINT` | ✅ | S3-compatible endpoint |
| `S3_BUCKET` | ✅ | Bucket name |
| `S3_ACCESS_KEY` | ✅ | S3 access key |
| `S3_SECRET_KEY` | ✅ | S3 secret key |
| `S3_REGION` | ✅ | Region (`auto` for R2) |
| `API_URL` | ✅ | FastAPI service URL |

---

## Walking Skeleton Limitations

- Poisson depth 9 — adequate for sparse clouds, not production quality
- No texture baking — mesh is geometry only, no colour
- No quality gates — MESH_COMPLETE even on low vertex count output
- CPU only — no GPU acceleration for Open3D in this configuration

These are addressed when building Levels 09 and 10 properly in Phase 3.

---

## What Comes Next

Once this worker produces a mesh, the next walking skeleton step is loading
it back into the browser via Three.js — closing the phone-to-3D loop
end to end for the first time.
