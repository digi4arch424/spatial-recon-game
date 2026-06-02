"""
Mesh Worker — Surface reconstruction pipeline consumer.

Listens on the Redis mesh queue (queue:mesh).
For each job:
  1. Update status → MESH_RUNNING
  2. Download sparse point cloud from S3
  3. Run Open3D Poisson surface reconstruction
  4. Upload mesh.obj to S3
  5. Update status → MESH_COMPLETE
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

from storage      import download_file, upload_file
from api          import update_status
from mesh_runner  import run_mesh

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [MESH-WORKER] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__)

# ── Redis ─────────────────────────────────────────────────────────────────────

REDIS_URL      = os.environ['REDIS_URL']
QUEUE_MESH     = 'queue:mesh'


# ── S3 path helper ────────────────────────────────────────────────────────────

def _mesh_s3_key(session_id: str) -> str:
    return f'sessions/{session_id}/reconstruction/mesh/mesh.obj'


# ── Job processor ─────────────────────────────────────────────────────────────

def process_job(job: dict) -> None:
    """
    Process a single mesh reconstruction job.

    Job payload (enqueued by sfm-worker after SFM_COMPLETE):
    {
        "reconstruction_id": "uuid",
        "session_id":        "abc123",
        "sparse_cloud_path": "sessions/abc123/reconstruction/sparse/points3D.ply"
    }
    """
    reconstruction_id  = job['reconstruction_id']
    session_id         = job['session_id']
    sparse_cloud_path  = job['sparse_cloud_path']

    log.info(f'Job received — reconstruction={reconstruction_id} session={session_id}')

    work_dir = tempfile.mkdtemp(prefix=f'mesh_{session_id}_')

    try:
        # ── 1. Mark running ───────────────────────────────────────────────
        update_status(reconstruction_id, 'MESH_RUNNING')
        log.info('Status → MESH_RUNNING')

        # ── 2. Download sparse point cloud ────────────────────────────────
        local_ply = os.path.join(work_dir, 'points3D.ply')
        log.info(f'Downloading point cloud: {sparse_cloud_path}')
        download_file(sparse_cloud_path, local_ply)

        # ── 3. Run Poisson reconstruction ─────────────────────────────────
        log.info('Running Open3D Poisson reconstruction')
        result = run_mesh(work_dir, local_ply)
        log.info(
            f'Mesh complete — '
            f'{result["vertex_count"]} vertices, '
            f'{result["triangle_count"]} triangles '
            f'from {result["input_points"]} input points'
        )

        # ── 4. Upload mesh to S3 ──────────────────────────────────────────
        mesh_key = _mesh_s3_key(session_id)
        log.info(f'Uploading mesh → {mesh_key}')
        upload_file(result['mesh_path'], mesh_key)

        # ── 5. Mark complete ──────────────────────────────────────────────
        update_status(
            reconstruction_id,
            'MESH_COMPLETE',
            mesh_path=mesh_key
        )
        log.info('Status → MESH_COMPLETE')

    except Exception as exc:
        log.error(f'Job failed: {exc}')
        try:
            update_status(
                reconstruction_id,
                'FAILED',
                failed_at_stage='MESH',
                error_message=str(exc)[:500]
            )
        except Exception as api_exc:
            log.error(f'Could not update failure status: {api_exc}')

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        log.info(f'Cleaned up {work_dir}')


# ── Main loop ─────────────────────────────────────────────────────────────────

def main() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    log.info(f'Mesh Worker started. Listening on {QUEUE_MESH}')

    while True:
        try:
            result = client.brpop(QUEUE_MESH, timeout=0)
            if not result:
                continue
            _, raw = result
            job = json.loads(raw)
            process_job(job)

        except redis.RedisError as e:
            log.error(f'Redis error: {e} — retrying in 5s')
            import time; time.sleep(5)

        except Exception as e:
            log.error(f'Unexpected error in main loop: {e}')


if __name__ == '__main__':
    main()
