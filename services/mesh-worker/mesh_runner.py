import os
import numpy as np
import open3d as o3d


def run_mesh(work_dir: str, ply_path: str) -> dict:
    """
    Run Poisson surface reconstruction on a sparse point cloud.

    work_dir:  scratch directory for output files
    ply_path:  local path to COLMAP points3D.ply

    Returns dict with:
    {
        'mesh_path':      absolute path to mesh.obj,
        'vertex_count':   number of mesh vertices,
        'triangle_count': number of mesh triangles
    }

    Raises RuntimeError if the point cloud is empty or reconstruction fails.
    """

    # ── Load point cloud ──────────────────────────────────────────────────
    pcd = o3d.io.read_point_cloud(ply_path)
    if len(pcd.points) == 0:
        raise RuntimeError('Point cloud is empty — SfM may have failed.')

    point_count = len(pcd.points)

    # ── Estimate normals ──────────────────────────────────────────────────
    # Normals are required for Poisson reconstruction.
    # Search radius and max neighbours tuned for sparse COLMAP output.
    pcd.estimate_normals(
        search_param=o3d.geometry.KDTreeSearchParamHybrid(
            radius=0.1,
            max_nn=30
        )
    )
    pcd.orient_normals_consistent_tangent_plane(k=100)

    # ── Poisson surface reconstruction ────────────────────────────────────
    # depth=9 is a good balance for the walking skeleton —
    # fine enough detail without excessive compute time.
    # Higher depth (10-12) for production quality.
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pcd,
        depth=9,
        width=0,
        scale=1.1,
        linear_fit=False
    )

    # ── Remove low-density vertices ───────────────────────────────────────
    # Poisson fills in areas with no data — low density vertices are
    # artifacts. Remove the bottom 10% by density.
    densities      = np.asarray(densities)
    density_cutoff = np.quantile(densities, 0.10)
    vertices_to_remove = densities < density_cutoff
    mesh.remove_vertices_by_mask(vertices_to_remove)

    if len(mesh.vertices) == 0:
        raise RuntimeError(
            'Mesh reconstruction produced no vertices. '
            'Point cloud may be too sparse or too noisy.'
        )

    # ── Mesh cleanup ──────────────────────────────────────────────────────
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    mesh.compute_vertex_normals()

    # ── Export ────────────────────────────────────────────────────────────
    mesh_path = os.path.join(work_dir, 'mesh.obj')
    o3d.io.write_triangle_mesh(mesh_path, mesh, write_vertex_normals=True)

    return {
        'mesh_path':      mesh_path,
        'vertex_count':   len(mesh.vertices),
        'triangle_count': len(mesh.triangles),
        'input_points':   point_count
    }
