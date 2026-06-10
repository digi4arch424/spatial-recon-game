import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as aioredis

from ..database import get_db
from ..storage import (
    upload_file,
    session_zip_path,
    frame_path,
    generate_presigned_upload_url,
)
from ..queue import get_redis, enqueue_sfm, enqueue_reconstruction

router = APIRouter()


# ── Request / response models ─────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    id:          str              # browser-generated session ID
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

class PresignResponse(BaseModel):
    url:     str
    s3_key:  str

class FrameManifestEntry(BaseModel):
    frame_number: int
    s3_key:       str
    timestamp:    int

class ManifestRequest(BaseModel):
    frames: List[FrameManifestEntry]

class ManifestResponse(BaseModel):
    session_id:        str
    reconstruction_id: str
    status:            str
    frame_count:       int


# ── POST /sessions ────────────────────────────────────────────────────────────
# Called from the browser when the user begins a scan session.
# Registers the session in the database.

@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: CreateSessionRequest,
    db:   AsyncSession = Depends(get_db)
):
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
            "device_info": str(body.device_info) if body.device_info else None,
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
        created_at=row.created_at,
    )


# ── GET /sessions/{session_id} ────────────────────────────────────────────────

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
        created_at=row.created_at,
    )


# ── GET /sessions/{session_id}/frames/{frame_number}/presign ──────────────────
# Returns a presigned PUT URL for a single frame.
# Called by the browser once per frame, immediately before uploading.
#
# Query param:
#   timestamp (int, required) — unix ms from browser IndexedDB, used to build
#   the canonical S3 key matching frame_path() in storage.py.
#
# Response:
#   { url: "https://...", s3_key: "sessions/.../frames/frame-001-{ts}.jpg" }
#
# The browser PUTs the raw JPEG bytes to `url` with Content-Type: image/jpeg.
# No auth header is needed — the presigned URL carries all credentials.

@router.get("/{session_id}/frames/{frame_number}/presign", response_model=PresignResponse)
async def presign_frame_upload(
    session_id:   str,
    frame_number: int,
    timestamp:    int = Query(..., description="Frame capture timestamp (unix ms)"),
    db:           AsyncSession = Depends(get_db),
):
    # Verify the session exists before issuing a presigned URL
    result = await db.execute(
        text("SELECT id FROM sessions WHERE id = :id"),
        {"id": session_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Session not found")

    s3_key = frame_path(session_id, frame_number, timestamp)
    url    = generate_presigned_upload_url(s3_key, content_type="image/jpeg", expires_in=300)

    return PresignResponse(url=url, s3_key=s3_key)


# ── POST /sessions/{session_id}/manifest ──────────────────────────────────────
# Called once after all frames have been uploaded directly to S3.
# Writes each frame record to the DB, creates a reconstruction record,
# and enqueues the SFM job with the full frame manifest.
#
# The manifest replaces the ZIP path: workers download individual frames
# rather than re-downloading and re-extracting a ZIP.
#
# Request body:
#   { "frames": [ { "frame_number": 1, "s3_key": "...", "timestamp": 12345 }, ... ] }

@router.post("/{session_id}/manifest", response_model=ManifestResponse, status_code=201)
async def submit_manifest(
    session_id: str,
    body:       ManifestRequest,
    db:         AsyncSession = Depends(get_db),
    redis:      aioredis.Redis = Depends(get_redis),
):
    # Verify session exists
    result = await db.execute(
        text("SELECT id, frame_count FROM sessions WHERE id = :id"),
        {"id": session_id}
    )
    session = result.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not body.frames:
        raise HTTPException(status_code=422, detail="Manifest must contain at least one frame")

    # Write frame records to DB
    # Uses INSERT ... ON CONFLICT DO NOTHING so retries are safe
    for entry in body.frames:
        await db.execute(
            text("""
                INSERT INTO frames (session_id, frame_number, timestamp, storage_path)
                VALUES (:session_id, :frame_number, :timestamp, :storage_path)
                ON CONFLICT (session_id, frame_number) DO NOTHING
            """),
            {
                "session_id":    session_id,
                "frame_number":  entry.frame_number,
                "timestamp":     entry.timestamp,
                "storage_path":  entry.s3_key,
            }
        )

    # Update session status and actual frame count
    frame_count = len(body.frames)
    await db.execute(
        text("""
            UPDATE sessions
            SET status = 'UPLOADED', frame_count = :frame_count
            WHERE id = :id
        """),
        {"id": session_id, "frame_count": frame_count}
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
            "total_frames": frame_count,
        }
    )

    # Enqueue SFM job with full frame manifest
    # Workers use this to download frames directly — no ZIP involved
    await enqueue_sfm(redis, {
        "reconstruction_id": reconstruction_id,
        "session_id":        session_id,
        "frame_manifest":    [
            {"frame_number": f.frame_number, "s3_key": f.s3_key}
            for f in body.frames
        ],
        "frame_count":       frame_count,
    })

    return ManifestResponse(
        session_id=session_id,
        reconstruction_id=reconstruction_id,
        status="UPLOADED",
        frame_count=frame_count,
    )


# ── POST /sessions/{session_id}/upload ───────────────────────────────────────
# Legacy ZIP upload endpoint — kept for backward compatibility and local testing.
# In production, the browser uses /presign + /manifest instead.

@router.post("/{session_id}/upload", response_model=UploadResponse)
async def upload_session(
    session_id: str,
    file:       UploadFile = File(...),
    db:         AsyncSession = Depends(get_db),
    redis:      aioredis.Redis = Depends(get_redis),
):
    result = await db.execute(
        text("SELECT id, frame_count FROM sessions WHERE id = :id"),
        {"id": session_id}
    )
    session = result.fetchone()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    zip_key = session_zip_path(session_id)
    try:
        upload_file(file.file, zip_key, content_type="application/zip")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")

    await db.execute(
        text("UPDATE sessions SET status = 'UPLOADED' WHERE id = :id"),
        {"id": session_id}
    )

    reconstruction_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO reconstructions (id, session_id, status, total_frames)
            VALUES (:id, :session_id, 'UPLOADED', :total_frames)
        """),
        {
            "id":           reconstruction_id,
            "session_id":   session_id,
            "total_frames": session.frame_count,
        }
    )

    await enqueue_reconstruction(redis, {
        "reconstruction_id": reconstruction_id,
        "session_id":        session_id,
        "zip_path":          zip_key,
        "frame_count":       session.frame_count,
    })

    return UploadResponse(
        session_id=session_id,
        reconstruction_id=reconstruction_id,
        status="UPLOADED",
        zip_path=zip_key,
    )
