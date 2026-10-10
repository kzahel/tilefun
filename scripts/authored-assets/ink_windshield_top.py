"""Widen only the windshield's top ink so native side-view sampling retains it."""
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
    raise FileExistsError('Choose a new top-stroke output.')
recipe, geometry, aperture, config = map(read, [args.recipe, args.geometry, args.aperture, args.config])
view = next(v for v in recipe['views'] if v['id'] == 'east')
source = args.recipe.parent/view['source']
if digest(source) != view['sourceSha256']:
    raise ValueError('Frozen source changed.')
color = Image.open(source).convert('RGBA').getpixel(tuple(config['paletteSampleEast']))
if color[3] != 255:
    raise ValueError('Ink must be opaque.')
atlas = Image.open(args.atlas).convert('RGBA')
if atlas.size != (1024,1024):
    raise ValueError('Select the compact atlas.')
v = geometry['windshieldVertices'][:4]
bottom = [(a+b)/2 for a,b in zip(v[0],v[1])]
top = [(a+b)/2 for a,b in zip(v[3],v[2])]
height = math.sqrt(sum((a-b)**2 for a,b in zip(bottom,top)))
stroke = config['topStrokeWorldWidth']
if not aperture['insetTop']*height < stroke < height/4:
    raise ValueError('Top stroke must extend into glass by a bounded amount.')
s, hi = aperture['insetAcross'], 1-aperture['insetTop']
end = 1-stroke/height
x0,y0,x1,y1 = aperture['atlasRect']
changed = 0
for y in range(y0,y1):
    t = 1-(y+.5-y0)/(y1-y0)
    if not end <= t < hi:
        continue
    for x in range(x0,x1):
        u = (x+.5-x0)/(x1-x0)
        if s <= u < 1-s:
            changed += atlas.getpixel((x,y)) != color
            atlas.putpixel((x,y),color)
atlas.save(args.out)
write(args.out.with_suffix('.json'), {
    'recipeSha256':digest(args.recipe),'inputAtlasSha256':digest(args.atlas),
    'geometrySha256':digest(args.geometry),'apertureConfigSha256':digest(args.aperture),
    'topInkConfigSha256':digest(args.config),'atlasSha256':digest(args.out),
    'ink':color,'totalTopStrokeWorldWidth':stroke,'changedTopGlassTexels':changed,
    'status':'Authored top stroke extends into glass for native-pixel visibility; other paint/alpha/geometry fixed; unreviewed'})
print(f'Widened top stroke; {changed} top glass texels changed.')
