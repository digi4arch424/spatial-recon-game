Infrastructure — Spatial Recon Game
This folder contains the data layer foundation for the walking skeleton
and all backend levels (L05–L20).
---
Services Overview
Service	Local (Docker)	Online (Free tier)	Purpose
PostgreSQL + pgvector	`pgvector/pgvector:pg16`	Supabase	Sessions, frames, reconstructions, semantic objects
Redis	`redis:7-alpine`	Upstash	Job queue, pipeline status pub/sub, CRDT state
Object Storage	MinIO	Cloudflare R2	All binary files — images, point clouds, meshes, splats
Graph DB	—	Neo4j Aura	Scene relationships (L17+)
---
Option A — Online Setup (Recommended)
No Docker required. Uses free-tier managed services.
1. PostgreSQL via Supabase
Create a free project at https://supabase.com
Go to SQL Editor and run `db/schema.sql` in full
Copy your connection string from Settings → Database
Save as `DATABASE_URL` in your environment
```
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```
2. Redis via Upstash
Create a free database at https://upstash.com
Copy the Redis URL from the dashboard
Save as `REDIS_URL` in your environment
```
REDIS_URL=rediss://default:[password]@[host].upstash.io:6379
```
3. Object Storage via Cloudflare R2
Create a free R2 bucket at https://dash.cloudflare.com → R2
Name the bucket: `spatialrecon`
Create an API token with R2 read/write permissions
Save credentials in your environment
```
S3_ENDPOINT=https://[account_id].r2.cloudflarestorage.com
S3_BUCKET=spatialrecon
S3_ACCESS_KEY=[access_key]
S3_SECRET_KEY=[secret_key]
S3_REGION=auto
```
---
Option B — Local Setup (Docker)
Full local stack. Requires Docker Desktop.
```bash
cd infrastructure
docker compose up -d
```
Services start at:
PostgreSQL:   `postgresql://postgres:postgres@localhost:5432/spatialrecon`
Redis:        `redis://localhost:6379`
MinIO S3 API: `http://localhost:9000`
MinIO Console: `http://localhost:9001` (admin / password123)
Schema is applied automatically on first start via the Docker init script.
To reset everything:
```bash
docker compose down -v
docker compose up -d
```
Local environment variables:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spatialrecon
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=spatialrecon
S3_ACCESS_KEY=admin
S3_SECRET_KEY=password123
S3_REGION=us-east-1
```
---
S3 Bucket Structure
All binary files follow one path convention. The session ID is the
root key across every system.
```
spatialrecon/
└── sessions/
    └── {session_id}/
        ├── frames/
        │   ├── frame-001-{timestamp}.jpg
        │   ├── frame-002-{timestamp}.jpg
        │   └── thumbs/
        │       └── frame-001.jpg
        ├── reconstruction/
        │   ├── sparse/
        │   │   └── points3D.ply
        │   ├── dense/
        │   │   └── cloud.ply
        │   ├── mesh/
        │   │   └── mesh.obj
        │   ├── textured/
        │   │   ├── mesh.obj
        │   │   └── mesh.mtl
        │   └── splat/
        │       └── scene.splat
        └── objects/
            └── {object_id}/
                └── segment.ply
```
---
Database Schema Summary
Six tables — see `db/schema.sql` for full definitions.
Table	Purpose	Key fields
`sessions`	Root entity, browser-created	`id` (browser-generated), `status`, `frame_count`
`frames`	Individual captured images	`session_id`, `frame_number`, `storage_path`, `is_blurry`
`reconstructions`	Pipeline run per session	`session_id`, `status`, all S3 path columns, `camera_poses`
`scene_objects`	Semantic 3D objects	`reconstruction_id`, `label`, `embedding` (vector), `centroid`
`spatial_anchors`	Real-world coordinate binding	`reconstruction_id`, `world_position`, `scale`
`collaborative_sessions`	Multi-user sync	`reconstruction_id`, `crdt_doc_key`, `participants`
---
Environment File Template
Create a `.env` file in each service directory. Never commit `.env` files.
The `.gitignore` already excludes them.
```env
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Object storage
S3_ENDPOINT=
S3_BUCKET=spatialrecon
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=

# API
API_PORT=8000
ENVIRONMENT=development
```
---
What Comes Next
Session	What gets built
Next	`services/api/` — FastAPI service skeleton
After	S3 upload endpoint — browser ZIP → bucket
After	Redis queue wiring — upload triggers reconstruction job
After	COLMAP worker skeleton — L05
