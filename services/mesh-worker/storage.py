import os
import boto3

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


def download_file(s3_key: str, local_path: str) -> None:
    """Download a single file from S3 to local_path."""
    _s3().download_file(S3_BUCKET, s3_key, local_path)


def upload_file(local_path: str, s3_key: str) -> None:
    """Upload a local file to S3 at the given key."""
    _s3().upload_file(local_path, S3_BUCKET, s3_key)
