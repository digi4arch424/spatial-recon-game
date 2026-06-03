# =============================================================================
# SPATIAL RECON — Mesh Worker
# Open3D Poisson surface reconstruction from COLMAP sparse point cloud.
#
# Build from repo root:
# docker build -f services/mesh-worker/Dockerfile -t spatial-recon-mesh .
# =============================================================================

FROM python:3.11-slim

# ── System dependencies ───────────────────────────────────────────────────────
# Open3D requires libGL and other graphics libraries even in headless mode.
# libgomp1: OpenMP parallelism used by Open3D internally
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
# Open3D is large (~500MB) — copied first to maximise Docker layer cache
COPY services/mesh-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Worker source ─────────────────────────────────────────────────────────────
COPY services/mesh-worker/ .

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# ── Health check ──────────────────────────────────────────────────────────────
# Verifies Open3D and Redis imports load correctly on startup
HEALTHCHECK --interval=60s --timeout=15s --start-period=30s --retries=3 \
  CMD python3 -c "import open3d; import redis; print('ok')" || exit 1

CMD ["python3", "worker.py"]
