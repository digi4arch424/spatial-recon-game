# =============================================================================
# SPATIAL RECON — API Service
# Build context: repo root
# docker build -f services/api/Dockerfile -t spatial-recon-api .
# =============================================================================

FROM python:3.12-slim

# System dependencies for asyncpg and boto3
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install Python dependencies ───────────────────────────────────────────────
# Copied before source so Docker layer cache is reused on code-only changes
COPY services/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy source ───────────────────────────────────────────────────────────────
# Full repo copied so relative imports (services.api.main) resolve correctly
COPY services/ ./services/

# ── Python path ───────────────────────────────────────────────────────────────
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# ── Start ─────────────────────────────────────────────────────────────────────
# 2 workers for the walking skeleton — scale up in production
CMD ["sh", "-c", "uvicorn services.api.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
