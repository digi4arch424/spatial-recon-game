"""
SFM Worker — Structure-from-Motion pipeline consumer.

Listens on the Redis SFM queue (queue:sfm, aliased as queue:reconstruction
for backward compatibility).

For each job:
  1. Update status → SFM_RUNNING
  2. Download frames from S3 via manifest (or ZIP for legacy jobs)
  3. Run COLMAP SfM pipeline
  4. Upload sparse point cloud + camera poses to S3
  5. Update status → SFM_COMPLETE
  6. Enqueue mesh job → queue:mesh
  7. On any failure → update status → FAILED

Environment variables required:
  REDIS_URL, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY,
  S3_SECRET_KEY, S3_REGION, API_URL
"""

import os
import json
import tempfile
import shutil
import logging

import redis
from dotenv import load_dotenv

from storage       import download_frames_from_manifest, download_and_extract, upload_file
from api           import update_status
from colmap_runner import run_sfm

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SFM-WORKER] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger(__name__)

# ── Redis ─────────────────────────────────────────────────────────────────────

REDIS_URL  = os.environ['REDIS_URL']
QUEUE_SFM  = 'queue:sfm'               # primary queue name
QUEUE_LEGACY = 'queue:reconstruction'  # backward compat — same physical queue via alias
QUEUE_MESH = 'queue:mesh'
USE_GPU    = os.environ.get('USE_GPU', '0') == '1'


# ── S3 path helpers ───────────────────────────────────────────────────────────
# Must match the convention in services/api/storage.py

def _sparse_cloud_s3_key(session_id: str) -> str:
    return f'sessions/{session_id}/reconstruction/sparse/points3D.ply'

def _cameras_s3_key(session_id: str) -> str:
    return f'sessions/{session_id}/reconstruction/sparse/cameras.json'


# ── Job processor ─────────────────────────────────────────────────────────────

def process_job(job: dict, redis_client) -> None:
    """
    Process a single reconstruction job.

    Accepts two payload shapes:

    Manifest (new — Session 2+):
    {
        "reconstruction_id": "uuid",
        "session_id":        "abc123",
        "frame_manifest":    [
            { "frame_number": 1, "s3_key": "sessions/.../frames/frame-001-{ts}.jpg" },
            ...
        ],
        "frame_count":       30
    }

    Legacy ZIP (old — kept for backward compat / local testing):
    {
        "reconstruction_id": "uuid",
        "session_id":        "abc123",
        "zip_path":          "sessions/abc123/upload/session-abc123.zip",
        "frame_count":       30
    }
    """
    reconstruction_id = job['reconstruction_id']
    session_id        = job['session_id']
    frame_manifest    = job.get('frame_manifest')   # present in new-style jobs
    zip_path          = job.get('zip_path')          # present in legacy jobs

    log.info(f'Job received — reconstruction={reconstruction_id} session={session_id}')

    if frame_manifest:
        log.info(f'Payload: manifest ({len(frame_manifest)} frames)')
    else:
        log.info(f'Payload: legacy ZIP — {zip_path}')

    work_dir = tempfile.mkdtemp(prefix=f'sfm_{session_id}_')

    try:
        # ── 1. Mark running ───────────────────────────────────────────────
        update_status(reconstruction_id, 'SFM_RUNNING')
        log.info('Status → SFM_RUNNING')

        # ── 2. Download frames ────────────────────────────────────────────
        if frame_manifest:
            log.info(f'Downloading {len(frame_manifest)} frames from manifest')
            images_dir = download_frames_from_manifest(frame_manifest, work_dir)
        else:
            log.info(f'Downloading and extracting ZIP: {zip_path}')
            images_dir = download_and_extract(zip_path, work_dir)

        image_count = len([f for f in os.listdir(images_dir) if f.endswith('.jpg')])
        log.info(f'Downloaded {image_count} frames to {images_dir}')

        if image_count < 3:
            raise ValueError(f'Too few frames for SfM: {image_count} (minimum 3)')

        # ── 3. Run COLMAP ─────────────────────────────────────────────────
        log.info(f'Running COLMAP SfM (GPU={USE_GPU})')
        result = run_sfm(work_dir, images_dir, use_gpu=USE_GPU)
        log.info(f'COLMAP complete — registered {result["registered_frames"]} frames')

        # ── 4. Upload outputs to S3 ───────────────────────────────────────
        sparse_key  = _sparse_cloud_s3_key(session_id)
        cameras_key = _cameras_s3_key(session_id)

        log.info(f'Uploading sparse cloud → {sparse_key}')
        upload_file(result['sparse_ply_path'], sparse_key)

        log.info(f'Uploading camera poses → {cameras_key}')
        upload_file(result['cameras_json_path'], cameras_key)

        # ── 5. Mark complete ──────────────────────────────────────────────
        update_status(
            reconstruction_id,
            'SFM_COMPLETE',
            registered_frames=result['registered_frames'],
            sparse_cloud_path=sparse_key,
            quality_score=_quality_score(result['registered_frames'], image_count),
        )
        log.info('Status → SFM_COMPLETE')

        # ── 6. Enqueue mesh job ───────────────────────────────────────────
        mesh_job = {
            'reconstruction_id': reconstruction_id,
            'session_id':        session_id,
            'sparse_cloud_path': sparse_key,
        }
        redis_client.lpush(QUEUE_MESH, json.dumps(mesh_job))
        log.info(f'Mesh job enqueued → {QUEUE_MESH}')

    except Exception as exc:
        log.error(f'Job failed: {exc}')
        try:
            update_status(
                reconstruction_id,
                'FAILED',
                failed_at_stage='SFM',
                error_message=str(exc)[:500],
            )
        except Exception as api_exc:
            log.error(f'Could not update failure status: {api_exc}')

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        log.info(f'Cleaned up {work_dir}')


def _quality_score(registered: int, total: int) -> int:
    if total == 0:
        return 0
    return min(int((registered / total) * 100), 100)


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    log.info(f'SFM Worker started. Listening on {QUEUE_SFM} (alias: {QUEUE_LEGACY})')
    log.info(f'GPU mode: {USE_GPU}')

    # Listen on queue:sfm. Because QUEUE_RECONSTRUCTION = QUEUE_SFM in queue.py,
    # both old-style and new-style jobs land on the same Redis list.
    while True:
        try:
            result = client.brpop(QUEUE_SFM, timeout=0)
            if not result:
                continue
            _, raw = result
            job = json.loads(raw)
            process_job(job, client)

        except redis.RedisError as e:
            log.error(f'Redis error: {e} — retrying in 5s')
            import time; time.sleep(5)

        except Exception as e:
            log.error(f'Unexpected error in main loop: {e}')


if __name__ == '__main__':
    main()
