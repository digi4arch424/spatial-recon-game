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
        region_name=S3_REGION
    )


# ── Download and extract session ZIP ─────────────────────────────────────────
# The ZIP from the browser has structure:
#   session-{id}/frame-001-{timestamp}.jpg
#   session-{id}/frame-002-{timestamp}.jpg
#
# COLMAP needs all images in a flat directory.
# This function extracts and flattens into dest_dir/images/.

def download_and_extract(s3_key: str, dest_dir: str) -> str:
    """
    Download ZIP from S3 and extract frames into dest_dir/images/.
    Returns the absolute path to the images directory.
    """
    zip_path   = os.path.join(dest_dir, 'session.zip')
    images_dir = os.path.join(dest_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)

    # Download
    _s3().download_file(S3_BUCKET, s3_key, zip_path)

    # Extract — flatten nested folder structure
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
