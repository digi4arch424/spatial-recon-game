import os
import httpx

API_URL = os.environ.get('API_URL', 'http://localhost:8000')


def update_status(reconstruction_id: str, status: str, **kwargs) -> None:
    """
    PATCH /reconstructions/{id}/status on the API service.

    kwargs can include any reconstruction fields:
    registered_frames, quality_score, sparse_cloud_path,
    failed_at_stage, error_message, etc.

    Raises on non-2xx response so the worker can handle failures.
    """
    payload = {'status': status, **kwargs}
    response = httpx.patch(
        f'{API_URL}/reconstructions/{reconstruction_id}/status',
        json=payload,
        timeout=30.0
    )
    response.raise_for_status()
