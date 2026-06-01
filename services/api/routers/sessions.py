import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis

from ..database import get_db
from ..storage import upload_file, session_zip_path
from ..queue import get_redis, enqueue_reconstruction

router = APIRouter()


# ── Request / response models ─────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    id:          str             # browser-generated session ID
    frame_count: int
    device_info: dict | None = None

class SessionResponse(BaseModel):
    id:          str
    status:      str
    frame_count: int
    created_at:  datetime

class UploadResponse(BaseModel):
    session_id:        str
    reconstruction_id: str
    status:            str
    zip_path:          str


# ── POST /sessions ────────────────────────────────────────────────────────────
# Called from the browser when the user completes a scan session.
# Registers the session in the database.

@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: CreateSessionRequest,
    db:   AsyncSession = Depends(get_db)
):
    # Check for duplicate session ID
    existing = await db.execute(
        text("SELECT id FROM sessions WHERE id = :id"),
        {"id": body.id}
    )
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="Session ID already exists")

    await db.execute(
        text("""
            INSERT INTO sessions (id, frame_count, device_info, status)
            VALUES (:id, :frame_count, :device_info::jsonb, 'EXPORTED')
        """),
        {
            "id":          body.id,
            "frame_count": body.frame_count,
            "device_info": str(body.device_info) if body.device_info else None
        }
    )

    result = await db.execute(
        text("SELECT id, status, frame_count, created_at FROM sessions WHERE id = :id"),
        {"id": body.id}
    )
    row = result.fetchone()
    return SessionResponse(
        id=row.id,
        status=row.status,
        frame_count=row.frame_count,
        created_at=row.created_at
    )


# ── GET /sessions/{session_id} ────────────────────────────────────────────────
# Returns session details and latest reconstruction status via the DB view.

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db:         AsyncSession = Depends(get_db)
):
    result = await db.execute(
        text("SELECT id, status, frame_count, created_at FROM sessions WHERE id = :id"),
        {"id": session_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(
        id=row.id,
        status=row.status,
        frame_count=row.frame_count,
        created_at=row.created_at
    )


# ── POST /sessions/{session_id}/upload ───────────────────────────────────────
# Receives the ZIP exported from the browser.
# Stores it in S3, creates a reconstruction record, enqueues the job.

@router.post("/{session_id}/upload", response_model=UploadResponse)
async def upload_session(
    session_id: str,
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
    redis:      aioredis.Redis = Depends(get_redis)
):
    # Verify session exists
    result = await db.execute(
        text("SELECT id, frame_count FROM sessions WHERE id = :id"),
        {"id": session_id}
    )
    session = result.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Upload ZIP to S3
    zip_key = session_zip_path(session_id)
    try:
        upload_file(file.file, zip_key, content_type="application/zip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")

    # Update session status
    await db.execute(
        text("UPDATE sessions SET status = 'UPLOADED' WHERE id = :id"),
        {"id": session_id}
    )

    # Create reconstruction record
    reconstruction_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO reconstructions (id, session_id, status, total_frames)
            VALUES (:id, :session_id, 'UPLOADED', :total_frames)
        """),
        {
            "id":           reconstruction_id,
            "session_id":   session_id,
            "total_frames": session.frame_count
        }
    )

    # Enqueue reconstruction job
    await enqueue_reconstruction(redis, {
        "reconstruction_id": reconstruction_id,
        "session_id":        session_id,
        "zip_path":          zip_key,
        "frame_count":       session.frame_count
    })

    return UploadResponse(
        session_id=session_id,
        reconstruction_id=reconstruction_id,
        status="UPLOADED",
        zip_path=zip_key
    )
