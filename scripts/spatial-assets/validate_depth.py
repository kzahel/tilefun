"""GPU check of depth order, image row direction and camera inversion."""
import numpy as np
from bake import raster


# Two coincident projected triangles at different ray depths. The near one must
# win regardless of submission order. Their asymmetric footprint detects flips.
uv = np.array([[1, 1], [7, 1], [1, 7]], dtype=np.float32)
anchor = np.array([4, 8], dtype=np.float32)
vertices = []
for depth in [-3, 5]:
    x = uv[:, 0] - anchor[0]
    row = uv[:, 1] - anchor[1]
    vertices.extend(np.column_stack([x, (row + np.sqrt(2) * depth) / 2,
                                    (np.sqrt(2) * depth - row) / 2]))
vertices = np.array(vertices)
faces = np.array([[0, 1, 2], [3, 4, 5]])
for order in [faces, faces[::-1].copy()]:
    depth, valid, positions = raster(vertices, order, 8, 8, anchor)
    assert valid[1, 1] and not valid[6, 6], "Row orientation/coverage mismatch"
    np.testing.assert_allclose(depth[valid], 5, atol=1e-5)
    rows, cols = np.indices(depth.shape)
    np.testing.assert_allclose(positions[:, :, 0][valid] + anchor[0], (cols + 0.5)[valid], atol=1e-5)
    np.testing.assert_allclose((anchor[1] + positions[:, :, 1] - positions[:, :, 2])[valid],
                               (rows + 0.5)[valid], atol=1e-5)
    delta = rows + 0.5 - anchor[1]
    y = (delta + np.sqrt(2) * depth) / 2
    z = (np.sqrt(2) * depth - delta) / 2
    np.testing.assert_allclose(y[valid], positions[:, :, 1][valid], atol=1e-5)
    np.testing.assert_allclose(z[valid], positions[:, :, 2][valid], atol=1e-5)
    assert np.isnan(depth[~valid]).all(), "Uncovered pixels must stay invalid"
print("CUDA depth ordering, pixel centers, row orientation and inverse projection pass")
