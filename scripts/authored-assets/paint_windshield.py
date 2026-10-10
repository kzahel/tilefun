"""Confine source windshield paint to its aperture; body paint guards side corners.

Coverage remains the retained projection diagnostic. This cleanup is authored.
"""
import argparse
import math
from pathlib import Path
from PIL import Image
from pipeline import digest, read, write

parser = argparse.ArgumentParser(description=__doc__)
for name in ['recipe', 'atlas', 'geometry', 'config', 'out']:
    parser.add_argument('--'+name, type=Path, required=True)
args = parser.parse_args()
if args.out.exists() or args.out.with_suffix('.json').exists():
    raise FileExistsError('Choose new windshield cleanup output.')
recipe, geometry, config = read(args.recipe), read(args.geometry), read(args.config)
sources = {}
for view in recipe['views']:
    path = args.recipe.parent/view['source']
    if digest(path) != view['sourceSha256']:
        raise ValueError('Frozen source changed.')
    sources[view['id']] = Image.open(path).convert('RGBA')
atlas = Image.open(args.atlas).convert('RGBA')
if atlas.size != (1024, 1024):
    raise ValueError('Select the compact 1024 atlas.')
palette = {name: sources['east'].getpixel(tuple(point)) for name, point in config['paletteSamplesEast'].items()}
glass = sources[config['glassSource']].crop(config['glassCrop'])
if glass.getextrema()[3][0] < 200:
    raise ValueError('Glass landmark crop contains unobserved source pixels.')
x0, y0, x1, y1 = config['atlasRect']
s, lo, hi = config['insetAcross'], config['insetBottom'], 1-config['insetTop']
for y in range(y0, y1):
    t = 1-(y+.5-y0)/(y1-y0)
    for x in range(x0, x1):
        u = (x+.5-x0)/(x1-x0)
        if s <= u < 1-s and lo <= t < hi:
            gx = min(glass.width-1, int((u-s)/(1-2*s)*glass.width))
            gy = min(glass.height-1, int((hi-t)/(hi-lo)*glass.height))
            color = glass.getpixel((gx, gy))
        else:
            color = palette['body']
            if t > hi:
                color = palette['highlight']
            if t < lo*.4 or abs(u-s) < .012 or abs(u-(1-s)) < .012:
                color = palette['outline']
        atlas.putpixel((x, y), color)

# Paint only the forward cabin wedge between windshield seam and leading side
# window boundary. Use real triangle/UV interpolation rather than a screen decal.
lower, upper = config['cabinFrontWindow']['lower'], config['cabinFrontWindow']['upper']
changed = {}
for label, triangles in geometry['cabinSurfaces'].items():
    painted = set()
    for tri in triangles:
        coords = [(u*1024, (1-v)*1024) for u, v in tri['uv']]
        a, b, c = coords
        det = (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
        for y in range(max(0, math.floor(min(p[1] for p in coords))), min(1024, math.ceil(max(p[1] for p in coords)))):
            for x in range(max(0, math.floor(min(p[0] for p in coords))), min(1024, math.ceil(max(p[0] for p in coords)))):
                dx, dy = x+.5-a[0], y+.5-a[1]
                wb = (dx*(c[1]-a[1])-(c[0]-a[0])*dy)/det
                wc = ((b[0]-a[0])*dy-(b[1]-a[1])*dx)/det
                weights = [1-wb-wc, wb, wc]
                if min(weights) < -1e-6:
                    continue
                wx, _, wz = [sum(weight*p[axis] for weight, p in zip(weights, tri['positions'])) for axis in range(3)]
                front = lower[0]+(upper[0]-lower[0])*min(1, max(0, (wz-lower[1])/(upper[1]-lower[1])))
                if wx < front:
                    color = palette['mid'] if wz > 19.5 else palette['body']
                    atlas.putpixel((x, y), color)
                    painted.add((x, y))
    changed[label] = len(painted)
atlas.save(args.out)
write(args.out.with_suffix('.json'), {
    'inputAtlasSha256': digest(args.atlas), 'recipeSha256': digest(args.recipe),
    'configSha256': digest(args.config), 'geometrySha256': digest(args.geometry),
    'atlasSha256': digest(args.out), 'glassSource': config['glassSource'],
    'glassCrop': config['glassCrop'], 'palette': palette, 'cabinCornerTexels': changed,
    'status': 'Authored windshield aperture/frame and cabin paint guard; coverage unchanged; unreviewed'})
print('Windshield glass confined to aperture; forward cabin wedges use body palette.')
