"""Author continuous source-palette ink in the windshield frame, outside the glass.

Run after 090 cleanup. No alpha, glass texel, other island or mesh changes.
"""
import argparse
import math
from pathlib import Path
from PIL import Image
from pipeline import digest, read, write

parser = argparse.ArgumentParser(description=__doc__)
for name in ['recipe', 'atlas', 'geometry', 'aperture', 'config', 'out']:
    parser.add_argument('--'+name, type=Path, required=True)
args = parser.parse_args()
if args.out.exists() or args.out.with_suffix('.json').exists():
    raise FileExistsError('Choose a new windshield ink output.')
recipe, geometry, aperture, config = map(read, [args.recipe, args.geometry, args.aperture, args.config])
view = next(v for v in recipe['views'] if v['id'] == 'east')
source = args.recipe.parent/view['source']
if digest(source) != view['sourceSha256']:
    raise ValueError('Frozen source changed.')
color = Image.open(source).convert('RGBA').getpixel(tuple(config['paletteSampleEast']))
if color[3] != 255:
    raise ValueError('Ink sample must be opaque.')
atlas = Image.open(args.atlas).convert('RGBA')
if atlas.size != (1024, 1024):
    raise ValueError('Select a compact 1024 atlas.')
vertices = geometry['windshieldVertices'][:4]
length = lambda a, b: math.sqrt(sum((x-y)**2 for x, y in zip(a, b)))
bottom_width, top_width = length(vertices[0], vertices[1]), length(vertices[3], vertices[2])
bottom = [(a+b)/2 for a, b in zip(vertices[0], vertices[1])]
top = [(a+b)/2 for a, b in zip(vertices[3], vertices[2])]
height = length(bottom, top)
band = config['borderWorldWidth']
if not 0 < band < min(height, top_width)/4:
    raise ValueError('Choose a bounded positive frame width.')
x0, y0, x1, y1 = aperture['atlasRect']
s, lo, hi = aperture['insetAcross'], aperture['insetBottom'], 1-aperture['insetTop']
counts = dict(top=0, bottom=0, left=0, right=0)
changed = 0
for y in range(y0, y1):
    t = 1-(y+.5-y0)/(y1-y0)
    width = bottom_width*(1-t)+top_width*t
    for x in range(x0, x1):
        u = (x+.5-x0)/(x1-x0)
        if s <= u < 1-s and lo <= t < hi:
            continue
        dx = max(s-u, 0, u-(1-s))*width
        dy = max(lo-t, 0, t-hi)*height
        # Square joins make one connected band at all four aperture corners.
        if max(dx, dy) <= band:
            atlas.putpixel((x, y), color)
            changed += 1
            for side, matched in [('top', t >= hi), ('bottom', t < lo), ('left', u < s), ('right', u >= 1-s)]:
                if matched:
                    counts[side] += 1
if not all(counts.values()):
    raise ValueError('Frame band must cover all four sides.')
atlas.save(args.out)
write(args.out.with_suffix('.json'), {
    'recipeSha256': digest(args.recipe), 'inputAtlasSha256': digest(args.atlas),
    'geometrySha256': digest(args.geometry), 'apertureConfigSha256': digest(args.aperture),
    'inkConfigSha256': digest(args.config), 'atlasSha256': digest(args.out),
    'ink': color, 'borderWorldWidth': band, 'paintedFrameTexels': changed, 'sides': counts,
    'status': 'Authored continuous dark frame band; glass/alpha/other islands unchanged; unreviewed'})
print('Continuous dark windshield frame on all four sides; glass untouched.')
