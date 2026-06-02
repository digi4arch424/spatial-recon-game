"""
SFM Worker — Structure-from-Motion pipeline consumer.

Listens on the Redis reconstruction queue.
For each job:
  1. Update status → SFM_RUNNING
  2. Download and extract frames from S3
  3. Run COLMAP SfM pipeline
  4. Upload sparse point cloud + camera poses to S3
  5. Update status → SFM_COMPLETE
  6. On any failure → update status → FAILED

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

from storage      import download_and_extract, upload_file
from api          import update_status
from colmap_runner import run_sfm

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SFM-WORKER] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__)

# ── Redis ─────────────────────────────────────────────────────────────────────

REDIS_URL             = os.environ['REDIS_URL']
QUEUE_RECONSTRUCTION  = 'queue:reconstruction'
QUEUE_MESH            = 'queue:mesh'
USE_GPU               = os.environ.get('USE_GPU', '0') == '1'


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

    Job payload (from sessions router):
    {
        "reconstruction_id": "uuid",
        "session_id":        "abc123",
        "zip_path":          "sessions/abc123/upload/session-abc123.zip",
        "frame_count":       30
    }
    """
    reconstruction_id = job['reconstruction_id']
    session_id        = job['session_id']
    zip_path          = job['zip_path']

    log.info(f'Job received — reconstruction={reconstruction_id} session={session_id}')

    # Working directory — cleaned up after job regardless of outcome
    work_dir = tempfile.mkdtemp(prefix=f'sfm_{session_id}_')

    try:
        # ── 1. Mark running ───────────────────────────────────────────────
        update_status(reconstruction_id, 'SFM_RUNNING')
        log.info('Status → SFM_RUNNING')

        # ── 2. Download + extract frames ──────────────────────────────────
        log.info(f'Downloading ZIP: {zip_path}')
        images_dir = download_and_extract(zip_path, work_dir)
        image_count = len([f for f in os.listdir(images_dir) if f.endswith('.jpg')])
        log.info(f'Extracted {image_count} frames to {images_dir}')

        if image_count < 3:
            raise ValueError(f'Too few frames for SfM: {image_count} (minimum 3)')

        # ── 3. Run COLMAP ────────────────────────────────────────────────
        log.info(f'Running COLMAP SfM (GPU={USE_GPU})')
        result = run_sfm(work_dir, images_dir, use_gpu=USE_GPU)
        log.info(f'COLMAP complete — registered {result["registered_frames"]} frames')

        # ── 4. Upload outputs to S3 ───────────────────────────────────────
        sparse_key  = _sparse_cloud_s3_key(session_id)
        cameras_key = _cameras_s3_key(session_id)

        log.info(f'Uploading sparse cloud → {sparse_key}')
        upload_file(result['sparse_ply_path'],   sparse_key)

        log.info(f'Uploading camera poses → {cameras_key}')
        upload_file(result['cameras_json_path'], cameras_key)

        # ── 5. Mark complete ──────────────────────────────────────────────
        update_status(
            reconstruction_id,
            'SFM_COMPLETE',
            registered_frames=result['registered_frames'],
            sparse_cloud_path=sparse_key,
            quality_score=_quality_score(result['registered_frames'], image_count)
        )
        log.info('Status → SFM_COMPLETE')

        # ── 6. Enqueue mesh job ───────────────────────────────────────────
        mesh_job = {
            'reconstruction_id': reconstruction_id,
            'session_id':        session_id,
            'sparse_cloud_path': sparse_key
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
                error_message=str(exc)[:500]
            )
        except Exception as api_exc:
            log.error(f'Could not update failure status: {api_exc}')

    finally:
        # Always clean up temp directory
        shutil.rmtree(work_dir, ignore_errors=True)
        log.info(f'Cleaned up {work_dir}')


def _quality_score(registered: int, total: int) -> int:
    """
    Simple quality signal: percentage of frames successfully registered.
    Below 50% = poor reconstruction. Above 80% = good.
    """
    if total == 0:
        return 0
    return min(int((registered / total) * 100), 100)


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    log.info(f'SFM Worker started. Listening on {QUEUE_RECONSTRUCTION}')
    log.info(f'GPU mode: {USE_GPU}')

    while True:
        try:
            # BRPOP blocks until a job arrives (timeout=0 = block forever)
            result = client.brpop(QUEUE_RECONSTRUCTION, timeout=0)
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
