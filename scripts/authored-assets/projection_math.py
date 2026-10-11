"""Common affine screen mapping for camera fitting, UV sampling and comparison."""
import math


def project(world, camera):
    x, y, z = world
    a, e = map(math.radians, [camera["azimuth"], camera["elevation"]])
    sx = camera["horizontalScale"]
    sy = sx * camera["verticalStretch"]
    cx, cy = camera["origin"]
    return [cx + sx * (-math.sin(a) * x + math.cos(a) * y),
            cy + sy * (math.sin(e) * (math.cos(a) * x + math.sin(a) * y) - math.cos(e) * z)]


def raw_frame_size(vertices, cameras, canvas, margin=4):
    """Keep the whole mesh inside the origin-centered pre-registration render.

    A tall/long asset can project beyond half the comparison canvas even when its
    final affine registration fits. Overscan before that transform, at the same
    eight samples per world pixel; it must not crop geometry before comparison.
    """
    max_u = max_v = 0
    for camera in cameras:
        unit = {**camera, 'horizontalScale': 1, 'verticalStretch': 1, 'origin': [0, 0]}
        for point in vertices:
            u, v = project(point, unit)
            max_u, max_v = max(max_u, abs(u)), max(max_v, abs(v))
    width, height = canvas
    return (math.ceil(2*(max_u+margin)) if max_u > width/2 else width,
            math.ceil(2*(max_v+margin)) if max_v > height/2 else height)
