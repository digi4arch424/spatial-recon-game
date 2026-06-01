from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine


# ── Lifespan ──────────────────────────────────────────────────────────────────
# Runs startup and shutdown logic around the app lifecycle.
# Disposes the DB connection pool cleanly on shutdown.

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await engine.dispose()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Spatial Recon API",
    version="0.1.0",
    description="Walking skeleton API — browser capture → reconstruction pipeline",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Tighten to GitHub Pages URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {
        "status":      "ok",
        "version":     "0.1.0",
        "environment": settings.environment
    }


# ── Routers ───────────────────────────────────────────────────────────────────
# Imported here once routers are built (next session).
# Placeholder structure shown for clarity.

# from .routers import sessions, reconstructions
# app.include_router(sessions.router,       prefix="/sessions",       tags=["sessions"])
# app.include_router(reconstructions.router, prefix="/reconstructions", tags=["reconstructions"])
