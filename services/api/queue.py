import json
import redis.asyncio as aioredis
from .config import settings

# ── Queue and channel names ───────────────────────────────────────────────────
# Single source of truth for all Redis key names used across the system.
# Workers and the API both import from here — no magic strings elsewhere.

QUEUE_RECONSTRUCTION  = "queue:reconstruction"   # List — LPUSH / BRPOP
CHANNEL_PIPELINE      = "channel:pipeline"        # Pub/sub — status updates to browser
KEY_COLLAB_DOC        = "collab:{id}:yjsdoc"      # Yjs CRDT document (Level 19)


# ── Redis dependency ──────────────────────────────────────────────────────────

async def get_redis():
    """
    FastAPI dependency — yields an async Redis client per request.
    """
    client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True
    )
    try:
        yield client
    finally:
        await client.aclose()


# ── Job helpers ───────────────────────────────────────────────────────────────

async def enqueue_reconstruction(client: aioredis.Redis, job: dict) -> None:
    """
    Push a reconstruction job onto the queue.
    Workers consume from the right with BRPOP.

    Job payload:
    {
        "reconstruction_id": "uuid",
        "session_id":        "abc123",
        "zip_path":          "sessions/abc123/upload/session-abc123.zip",
        "frame_count":       30
    }
    """
    await client.lpush(QUEUE_RECONSTRUCTION, json.dumps(job))


# ── Status pub/sub ────────────────────────────────────────────────────────────

async def publish_status(
    client: aioredis.Redis,
    reconstruction_id: str,
    status: str,
    detail: dict | None = None
) -> None:
    """
    Publish a pipeline status update to the browser via pub/sub.
    The WebSocket endpoint subscribes to CHANNEL_PIPELINE and
    forwards messages to the connected client.

    Message shape:
    {
        "reconstruction_id": "uuid",
        "status":            "SFM_RUNNING",
        "detail":            { ... }   # optional stage-specific data
    }
    """
    message = {
        "reconstruction_id": reconstruction_id,
        "status":            status,
        "detail":            detail or {}
    }
    await client.publish(CHANNEL_PIPELINE, json.dumps(message))
