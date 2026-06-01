import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis

from ..database import get_db
from ..storage import generate_presigned_url
from ..queue import get_redis, publish_status, CHANNEL_PIPELINE

router = APIRouter()


# ── Request / response models ─────────────────────────────────────────────────

class ReconstructionResponse(BaseModel):
    id:                  str
    session_id:          str
    status:              str
    quality_score:       int | None = None
    registered_frames:   int | None = None
    total_frames:        int | None = None
    failed_at_stage:     str | None = None
    error_message:       str | None = None
    sparse_cloud_path:   str | None = None
    dense_cloud_path:    str | None = None
    mesh_path:           str | None = None
    textured_mesh_path:  str | None = None
    splat_path:          str | None = None

class StatusUpdateRequest(BaseModel):
    """Called by pipeline workers to advance reconstruction status."""
    status:              str
    registered_frames:   int | None = None
    total_frames:        int | None = None
    quality_score:       int | None = None
    sparse_cloud_path:   str | None = None
    dense_cloud_path:    str | None = None
    mesh_path:           str | None = None
    textured_mesh_path:  str | None = None
    splat_path:          str | None = None
    failed_at_stage:     str | None = None
    error_message:       str | None = None


# ── GET /reconstructions/{reconstruction_id} ──────────────────────────────────
# Returns full reconstruction record.
# S3 paths are converted to pre-signed URLs for browser consumption.

@router.get("/{reconstruction_id}", response_model=ReconstructionResponse)
async def get_reconstruction(
    reconstruction_id: str,
    db:                AsyncSession = Depends(get_db)
):
    result = await db.execute(
        text("SELECT * FROM reconstructions WHERE id = :id"),
        {"id": reconstruction_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Reconstruction not found")

    return ReconstructionResponse(
        id=str(row.id),
        session_id=row.session_id,
        status=row.status,
        quality_score=row.quality_score,
        registered_frames=row.registered_frames,
        total_frames=row.total_frames,
        failed_at_stage=row.failed_at_stage,
        error_message=row.error_message,
        sparse_cloud_path=generate_presigned_url(row.sparse_cloud_path)   if row.sparse_cloud_path  else None,
        dense_cloud_path=generate_presigned_url(row.dense_cloud_path)     if row.dense_cloud_path   else None,
        mesh_path=generate_presigned_url(row.mesh_path)                   if row.mesh_path          else None,
        textured_mesh_path=generate_presigned_url(row.textured_mesh_path) if row.textured_mesh_path else None,
        splat_path=generate_presigned_url(row.splat_path)                 if row.splat_path         else None
    )


# ── PATCH /reconstructions/{reconstruction_id}/status ────────────────────────
# Called by pipeline workers (COLMAP, OpenMVS, mesh, splat workers)
# to advance the reconstruction through its status stages.
# Also publishes the new status to Redis pub/sub for WebSocket clients.

@router.patch("/{reconstruction_id}/status", response_model=ReconstructionResponse)
async def update_reconstruction_status(
    reconstruction_id: str,
    body:              StatusUpdateRequest,
    db:                AsyncSession = Depends(get_db),
    redis:             aioredis.Redis = Depends(get_redis)
):
    # Build dynamic SET clause from non-null fields
    updates = {"status": body.status}
    for field in [
        "registered_frames", "total_frames", "quality_score",
        "sparse_cloud_path", "dense_cloud_path", "mesh_path",
        "textured_mesh_path", "splat_path",
        "failed_at_stage", "error_message"
    ]:
        value = getattr(body, field)
        if value is not None:
            updates[field] = value

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = reconstruction_id

    await db.execute(
        text(f"UPDATE reconstructions SET {set_clause} WHERE id = :id"),
        updates
    )

    # Publish status update to browser via pub/sub
    await publish_status(redis, reconstruction_id, body.status)

    # Return updated record
    return await get_reconstruction(reconstruction_id, db)


# ── WebSocket /reconstructions/{reconstruction_id}/ws ────────────────────────
# Browser connects here to receive real-time pipeline status updates.
# Subscribes to the Redis pub/sub channel and forwards messages.
# Closes cleanly when the browser disconnects.

@router.websocket("/{reconstruction_id}/ws")
async def reconstruction_websocket(
    websocket:         WebSocket,
    reconstruction_id: str
):
    await websocket.accept()

    # Each WebSocket gets its own Redis connection for pub/sub
    redis = aioredis.from_url(
        __import__("os").environ.get("REDIS_URL", "redis://localhost:6379"),
        encoding="utf-8",
        decode_responses=True
    )
    pubsub = redis.pubsub()
    await pubsub.subscribe(CHANNEL_PIPELINE)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            # Only forward messages for this reconstruction
            if data.get("reconstruction_id") == reconstruction_id:
                await websocket.send_json(data)
                # Close once terminal state reached
                if data["status"] in ("COMPLETE", "FAILED"):
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(CHANNEL_PIPELINE)
        await pubsub.aclose()
        await redis.aclose()
