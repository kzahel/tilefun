"""Coarse geometric rejection diagnostics; passing does not establish asset quality."""
import numpy as np


def geometry_checks(vertices, faces):
    vertices = np.asarray(vertices)
    faces = np.asarray(faces)
    bounds = np.array([vertices.min(axis=0), vertices.max(axis=0)])
    extents = bounds[1] - bounds[0]
    tolerance = np.maximum(extents * .005, 1e-6)
    area_sum, boundary_sum = 0., 0.
    normal_covariance = np.zeros((3, 3), dtype=float)
    for start in range(0, len(faces), 200000):
        triangles = vertices[faces[start:start + 200000]]
        cross = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
        lengths = np.linalg.norm(cross, axis=1)
        areas = lengths / 2
        normals = cross / np.maximum(lengths[:, None], 1e-12)
        normal_covariance += (normals.T * areas) @ normals
        boundary = np.zeros(len(triangles), dtype=bool)
        for axis in range(3):
            boundary |= np.all(np.abs(triangles[:, :, axis] - bounds[0, axis]) <= tolerance[axis], axis=1)
            boundary |= np.all(np.abs(triangles[:, :, axis] - bounds[1, axis]) <= tolerance[axis], axis=1)
        area_sum += float(areas.sum())
        boundary_sum += float(areas[boundary].sum())
    return {"axisExtents": extents.tolist(), "axisExtentRatio": float(min(extents) / max(extents)),
            "boundaryBoxSurfaceAreaFraction": boundary_sum / area_sum if area_sum else 1,
            "areaWeightedNormalConcentration": float(np.linalg.eigvalsh(normal_covariance).max() / area_sum) if area_sum else 1,
            "method": "Boundary faces within 0.5% of axis extent; largest eigenvalue of area-weighted unoriented face-normal covariance / total area",
            "limit": "Coarse agent-selected degeneracy/box/plane screens; not accepted shape, fidelity or clipping quality"}
