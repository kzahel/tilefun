"""Versioned native-pixel finishing. Geometry and authored markings own coverage.

Never grow alpha to make an outline. Palette shades may darken a surface edge;
eyes, noses, fur patches and paint masters retain their own actual colors.
Normal builds load committed sheets, not this authoring module.
"""
import math
from PIL import Image, ImageDraw

POLICY = 'wildlife-paint-v1'


def snap(value):
    return math.floor(value + .5)


def xy(point):
    return tuple(snap(value) for value in point[:2])


def hull(points):
    points = sorted(set(xy(p) for p in points))
    lower, upper = [], []
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    for target, sequence in [(lower, points), (upper, reversed(points))]:
        for point in sequence:
            while len(target) > 1 and cross(target[-2], target[-1], point) <= 0:
                target.pop()
            target.append(point)
    return lower[:-1] + upper[:-1] if len(points) > 1 else points


def polygon(draw, points, color):
    if len(points) > 2:
        draw.polygon(points, fill=color)
    elif len(points) == 2:
        draw.line(points, fill=color)
    elif points:
        draw.point(points[0], fill=color)


def rgba_palette(colors):
    return {key: tuple(bytes.fromhex(value.removeprefix('#'))) + (255,)
            for key, value in colors.items()}


def surface_paint(size, volumes, palette):
    """Stable source material ordering, without an exterior dark halo."""
    image = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(image)
    def order(volume):
        return (-volume['depth'], volume['name'], volume['key'],
                tuple(tuple(point) for point in volume['points']))
    for volume in sorted(volumes, key=order):
        points = volume['points']
        # Unordered full mesh vertices need a hull; exported 2D face polygons
        # already own their contour (including face-owned markings).
        points = hull(points) if points and len(points[0]) > 2 else [xy(p) for p in points]
        polygon(draw, points, palette[volume['key']])
    return image


def shaded_edge(image, palette):
    """Shade inside existing coverage using retained coat colors only."""
    def luminance(color):
        return .2126*color[0] + .7152*color[1] + .0722*color[2]
    shades = {}
    for key in ['B', 'H']:
        if key not in palette:
            continue
        color = palette[key]
        choices = [candidate for name, candidate in palette.items()
                   if name not in ['K', 'N', 'E']
                   and .50*luminance(color) <= luminance(candidate) <= .88*luminance(color)]
        if choices:
            shades[color] = min(choices, key=lambda c: sum((c[i]-color[i])**2 for i in range(3)))
    result = image.copy()
    width, height = image.size
    source, target = image.load(), result.load()
    box = image.getbbox()
    if not box:
        return result
    for y in range(box[1], box[3]):
        for x in range(box[0], box[2]):
            color = source[x, y]
            if color not in shades:
                continue
            if any(not (0 <= x+dx < width and 0 <= y+dy < height)
                   or not source[x+dx, y+dy][3]
                   for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]):
                target[x, y] = shades[color]
    assert result.getchannel('A').tobytes() == image.getchannel('A').tobytes()
    return result


def compose_surface(size, record, palette):
    return shaded_edge(surface_paint(size, record['volumes'], palette), palette)


def affine_paint(image, old_anchor, old_basis, anchor, basis):
    """Move retained paint through actual projected rigid-part bases."""
    a, b = basis[0]
    c, d = basis[1]
    determinant = a*d-b*c
    if abs(determinant) < 1e-5:
        return None  # A painted plane is edge-on; its source surface owns coverage.
    inverse = [[d/determinant, -b/determinant], [-c/determinant, a/determinant]]
    matrix = [[sum(old_basis[i][k]*inverse[k][j] for k in range(2))
               for j in range(2)] for i in range(2)]
    transform = (matrix[0][0], matrix[0][1], old_anchor[0]-matrix[0][0]*anchor[0]-matrix[0][1]*anchor[1],
                 matrix[1][0], matrix[1][1], old_anchor[1]-matrix[1][0]*anchor[0]-matrix[1][1]*anchor[1])
    return image.transform(image.size, Image.Transform.AFFINE, transform, Image.Resampling.NEAREST)


def letter_image(part, palette, size, anchor):
    image = Image.new('RGBA', (size, size))
    offset = part['offset']
    for y, row in enumerate(part['pixels']):
        for x, key in enumerate(row):
            target = snap(anchor[0])+offset[0]+x, snap(anchor[1])+offset[1]+y
            if key != '.' and 0 <= target[0] < size and 0 <= target[1] < size:
                image.putpixel(target, palette[key])
    return image
