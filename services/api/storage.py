import boto3
from botocore.exceptions import ClientError
from .config import settings

# ── S3 client ─────────────────────────────────────────────────────────────────
# Compatible with Cloudflare R2, MinIO, and AWS S3.
# endpoint_url switches between providers — AWS S3 uses None.

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint or None,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region
    )


# ── Path helpers ──────────────────────────────────────────────────────────────
# All S3 paths follow the convention established in the schema design:
# sessions/{session_id}/{stage}/{filename}
# These helpers are the single source of truth for path construction.

def frame_path(session_id: str, frame_number: int, timestamp: int) -> str:
    return f"sessions/{session_id}/frames/frame-{frame_number:03d}-{timestamp}.jpg"

def frame_thumb_path(session_id: str, frame_number: int) -> str:
    return f"sessions/{session_id}/frames/thumbs/frame-{frame_number:03d}.jpg"

def session_zip_path(session_id: str) -> str:
    return f"sessions/{session_id}/upload/session-{session_id}.zip"

def sparse_cloud_path(session_id: str) -> str:
    return f"sessions/{session_id}/reconstruction/sparse/points3D.ply"

def dense_cloud_path(session_id: str) -> str:
    return f"sessions/{session_id}/reconstruction/dense/cloud.ply"

def mesh_path(session_id: str) -> str:
    return f"sessions/{session_id}/reconstruction/mesh/mesh.obj"

def textured_mesh_path(session_id: str) -> str:
    return f"sessions/{session_id}/reconstruction/textured/mesh.obj"

def splat_path(session_id: str) -> str:
    return f"sessions/{session_id}/reconstruction/splat/scene.splat"

def object_segment_path(session_id: str, object_id: str) -> str:
    return f"sessions/{session_id}/objects/{object_id}/segment.ply"


# ── Upload helper ─────────────────────────────────────────────────────────────

def upload_file(file_obj, s3_key: str, content_type: str = "application/octet-stream") -> str:
    """
    Upload a file-like object to S3.
    Returns the full S3 path on success.
    Raises ClientError on failure.
    """
    client = get_s3_client()
    client.upload_fileobj(
        file_obj,
        settings.s3_bucket,
        s3_key,
        ExtraArgs={"ContentType": content_type}
    )
    return s3_key


# ── Download helper ───────────────────────────────────────────────────────────

def generate_presigned_url(s3_key: str, expiry_seconds: int = 3600) -> str:
    """
    Generate a time-limited pre-signed URL for browser download.
    Used to serve meshes, splats, and point clouds to the frontend.
    """
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key},
        ExpiresIn=expiry_seconds
    )


# ── Existence check ───────────────────────────────────────────────────────────

def file_exists(s3_key: str) -> bool:
    client = get_s3_client()
    try:
        client.head_object(Bucket=settings.s3_bucket, Key=s3_key)
        return True
    except ClientError:
        return False
