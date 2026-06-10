import os
import zipfile
import boto3

# ── Config from environment ───────────────────────────────────────────────────

S3_ENDPOINT   = os.environ['S3_ENDPOINT']
S3_BUCKET     = os.environ['S3_BUCKET']
S3_ACCESS_KEY = os.environ['S3_ACCESS_KEY']
S3_SECRET_KEY = os.environ['S3_SECRET_KEY']
S3_REGION     = os.environ.get('S3_REGION', 'auto')


def _s3():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
    )


# ── Manifest-based frame download ─────────────────────────────────────────────
# Replaces download_and_extract(). Downloads individual frames from S3 using
# the manifest list provided by the API, rather than a monolithic ZIP.
#
# Advantages over ZIP:
#   - No re-download of the full session on retry — only missing frames
#   - No unzip step — frames land directly in dest_dir/images/
#   - Works with direct browser PUT upload (no ZIP was ever created)

def download_frames_from_manifest(manifest: list[dict], dest_dir: str) -> str:
    """
    Download frames listed in the manifest from S3 into dest_dir/images/.

    Args:
        manifest:  List of { "frame_number": int, "s3_key": str } dicts,
                   as provided in the SFM job payload from the API.
        dest_dir:  Scratch working directory (temp dir from worker).

    Returns:
        Absolute path to the images directory (dest_dir/images/).

    Raises:
        ValueError: if manifest is empty or no frames were downloaded.
        Exception:  propagates S3 download errors for individual frames.
    """
    if not manifest:
        raise ValueError("Frame manifest is empty — nothing to download")

    images_dir = os.path.join(dest_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)

    client = _s3()
    downloaded = 0

    for entry in manifest:
        s3_key       = entry['s3_key']
        frame_number = entry['frame_number']

        # Preserve the original filename from the S3 key so COLMAP gets
        # a stable, sortable name regardless of timestamp in the key.
        filename = os.path.basename(s3_key)
        local_path = os.path.join(images_dir, filename)

        client.download_file(S3_BUCKET, s3_key, local_path)
        downloaded += 1

    if downloaded == 0:
        raise ValueError(f"No frames downloaded — manifest had {len(manifest)} entries but all failed")

    return images_dir


# ── Legacy ZIP download (kept for backward compat / local testing) ────────────
# Used when a job payload has zip_path instead of frame_manifest.
# Can be removed once all jobs flow through the manifest path.

def download_and_extract(s3_key: str, dest_dir: str) -> str:
    """
    Download ZIP from S3 and extract frames into dest_dir/images/.
    Returns the absolute path to the images directory.
    """
    zip_path   = os.path.join(dest_dir, 'session.zip')
    images_dir = os.path.join(dest_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)

    _s3().download_file(S3_BUCKET, s3_key, zip_path)

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.namelist():
            filename = os.path.basename(member)
            if not filename or not filename.endswith('.jpg'):
                continue
            source = zf.open(member)
            target_path = os.path.join(images_dir, filename)
            with open(target_path, 'wb') as target:
                target.write(source.read())

    return images_dir


# ── Upload a single file to S3 ────────────────────────────────────────────────

def upload_file(local_path: str, s3_key: str) -> None:
    """Upload a local file to S3 at the given key."""
    _s3().upload_file(local_path, S3_BUCKET, s3_key)
