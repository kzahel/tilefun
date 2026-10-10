"""Pixel-space silhouette ink, with alpha preserved exactly.

Reference implementation for a native-resolution GPU pass. Internal authored
lines remain in the UV atlas; color gradients and polygon edges are not inked.
"""
from PIL import Image


def ink(image, color=(58, 58, 80), mode="inner", threshold=128):
    if mode not in ("off", "inner", "outer"):
        raise ValueError("Outline mode must be off, inner or outer.")
    if len(color) != 3 or any(not isinstance(c, int) or c < 0 or c > 255 for c in color):
        raise ValueError("Outline color must contain three byte values.")
    original = image.convert("RGBA")
    result = original.copy()
    if mode == "off":
        return result
    w, h = original.size
    def occupied(x, y):
        return 0 <= x < w and 0 <= y < h and original.getpixel((x, y))[3] >= threshold
    for y in range(h):
        for x in range(w):
            here = occupied(x, y)
            neighbors = [occupied(x-1, y), occupied(x+1, y), occupied(x, y-1), occupied(x, y+1)]
            if mode == "inner" and here and not all(neighbors):
                # Preserve darker existing source ink rather than brighten it.
                before = original.getpixel((x, y))
                if sum(before[:3]) > sum(color):
                    result.putpixel((x, y), (*color, before[3]))
            elif mode == "outer" and not here and any(neighbors):
                result.putpixel((x, y), (*color, 255))
    return result
