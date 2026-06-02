import os
import json
import subprocess
import struct
import numpy as np


# ── COLMAP executable ─────────────────────────────────────────────────────────
# Looks for COLMAP in PATH (Docker) then common install locations.

def _colmap_bin() -> str:
    import shutil
    path = shutil.which('colmap')
    if path:
        return path
    candidates = ['/usr/local/bin/colmap', '/usr/bin/colmap', '/opt/colmap/bin/colmap']
    for c in candidates:
        if os.path.isfile(c):
            return c
    raise RuntimeError('COLMAP executable not found. Is COLMAP installed?')


def _run(cmd: list[str], cwd: str) -> None:
    """Run a subprocess command, raising on non-zero exit."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if result.returncode != 0:
        raise RuntimeError(
            f'COLMAP command failed: {" ".join(cmd)}\n'
            f'STDERR: {result.stderr[-2000:]}'  # last 2000 chars
        )


# ── Main entry point ──────────────────────────────────────────────────────────

def run_sfm(work_dir: str, images_dir: str, use_gpu: bool = False) -> dict:
    """
    Run the full SfM pipeline on a directory of images.

    work_dir:   scratch directory for COLMAP database and output
    images_dir: directory containing extracted JPEG frames
    use_gpu:    True on GPU instances, False for CPU-only (walking skeleton)

    Returns dict with:
    {
        'sparse_ply_path':   absolute path to points3D.ply,
        'cameras_json_path': absolute path to cameras.json,
        'registered_frames': number of successfully registered images
    }
    """
    colmap   = _colmap_bin()
    db_path  = os.path.join(work_dir, 'database.db')
    sparse_dir = os.path.join(work_dir, 'sparse')
    os.makedirs(sparse_dir, exist_ok=True)

    gpu_flag = '1' if use_gpu else '0'

    # ── Step 1: Feature extraction ────────────────────────────────────────
    _run([
        colmap, 'feature_extractor',
        '--database_path',              db_path,
        '--image_path',                 images_dir,
        '--ImageReader.camera_model',   'PINHOLE',
        '--SiftExtraction.use_gpu',     gpu_flag,
        '--SiftExtraction.max_image_size', '1280',
    ], cwd=work_dir)

    # ── Step 2: Feature matching ──────────────────────────────────────────
    # Sequential matcher is faster than exhaustive for ordered image sequences
    # (walking around an object). Falls back to exhaustive for small sets.
    _run([
        colmap, 'sequential_matcher',
        '--database_path', db_path,
        '--SiftMatching.use_gpu', gpu_flag,
    ], cwd=work_dir)

    # ── Step 3: Sparse reconstruction (mapper) ────────────────────────────
    _run([
        colmap, 'mapper',
        '--database_path', db_path,
        '--image_path',    images_dir,
        '--output_path',   sparse_dir,
    ], cwd=work_dir)

    # ── Step 4: Convert binary model to text + PLY ────────────────────────
    # COLMAP outputs binary by default — convert for downstream tools
    model_dir = os.path.join(sparse_dir, '0')
    if not os.path.isdir(model_dir):
        raise RuntimeError(
            'COLMAP mapper produced no reconstruction. '
            'Check frame overlap and image quality.'
        )

    text_dir = os.path.join(sparse_dir, '0_text')
    os.makedirs(text_dir, exist_ok=True)
    _run([
        colmap, 'model_converter',
        '--input_path',  model_dir,
        '--output_path', text_dir,
        '--output_type', 'TXT',
    ], cwd=work_dir)

    _run([
        colmap, 'model_converter',
        '--input_path',  model_dir,
        '--output_path', os.path.join(work_dir, 'points3D.ply'),
        '--output_type', 'PLY',
    ], cwd=work_dir)

    # ── Step 5: Extract camera poses to JSON ──────────────────────────────
    cameras_json = _parse_cameras_txt(
        os.path.join(text_dir, 'images.txt')
    )
    cameras_json_path = os.path.join(work_dir, 'cameras.json')
    with open(cameras_json_path, 'w') as f:
        json.dump(cameras_json, f)

    registered_frames = len(cameras_json)

    return {
        'sparse_ply_path':   os.path.join(work_dir, 'points3D.ply'),
        'cameras_json_path': cameras_json_path,
        'registered_frames': registered_frames
    }


# ── Camera pose parser ────────────────────────────────────────────────────────
# Parses COLMAP images.txt into a JSON-serialisable list of camera poses.
# Each entry: { image_name, qw, qx, qy, qz, tx, ty, tz }

def _parse_cameras_txt(images_txt_path: str) -> list[dict]:
    poses = []
    try:
        with open(images_txt_path) as f:
            lines = [l for l in f if not l.startswith('#')]
        i = 0
        while i < len(lines):
            parts = lines[i].strip().split()
            if len(parts) < 9:
                i += 1
                continue
            poses.append({
                'image_name': parts[9],
                'qw': float(parts[1]),
                'qx': float(parts[2]),
                'qy': float(parts[3]),
                'qz': float(parts[4]),
                'tx': float(parts[5]),
                'ty': float(parts[6]),
                'tz': float(parts[7])
            })
            i += 2  # skip the points2D line
    except Exception:
        pass
    return poses
