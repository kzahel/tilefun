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
