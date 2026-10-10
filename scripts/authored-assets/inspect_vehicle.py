"""Native silhouette and optional model-space window-edge inspection."""
import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pipeline import digest, read, write
from projection_math import project
from silhouette_report import difference, measure


def line(a, b):
    steps = max(abs(a[0]-b[0]), abs(a[1]-b[1]))
    return list(dict.fromkeys((round(a[0]+(b[0]-a[0])*k/max(1, steps)),
                               round(a[1]+(b[1]-a[1])*k/max(1, steps))) for k in range(steps+1)))


def inspect(run, output, windshield=None):
    output.mkdir(parents=True, exist_ok=False)
    recipe = read(run / 'recipe.json')
    sheet = Image.new('RGB', (1184, 338), '#253139')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    contours, edges = {}, {}
    vertices = read(windshield)['windshieldVertices'][:4] if windshield else None
    for col, view in enumerate(recipe['views']):
        name = view['id']
        source = Image.open(run / f'{name}-source.png').convert('RGBA')
        rendered = Image.open(run / f'{name}-render.png').convert('RGBA')
        contours[name] = measure(source, rendered)
        tile = difference(source, rendered).resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(tile, (col*296+20, 36))
        draw.text((col*296+20, 10), name, fill='white', font=font)
        if vertices:
            pixels = []
            for u in [.08, .92]:
                t = .90
                point = [vertices[0][k]*(1-u)*(1-t)+vertices[1][k]*u*(1-t)
                         +vertices[2][k]*u*t+vertices[3][k]*(1-u)*t for k in range(3)]
                pixels.append(tuple(math.floor(v) for v in project(point, view['camera'])))
            segment = line(*pixels)
            color = recipe['pixelStyle']['outlineColor']
            samples = [{'pixel': p, 'rgba': rendered.getpixel(p)} for p in segment]
            valid = all(s['rgba'][3] == 255 and max(abs(a-b) for a,b in zip(s['rgba'][:3], color)) <= 1 for s in samples)
            edges[name] = {'topBandT': .90, 'samples': samples, 'continuousNativeSegment': len(segment), 'visible': valid}
            if not valid:
                raise ValueError(f'{name}: top window ink is discontinuous at native scale; inspect width/camera/occlusion.')
    draw.text((16, 309), 'White: source contour · gray: overlap · red: missing · blue: extra (sprite shadow included)', fill='white', font=font)
    sheet.save(output / 'silhouette.png')
    orbits = Image.new('RGB', (1024, 256), '#53636b')
    for k in range(4):
        im = Image.open(run / f'orbit-{k}.png').convert('RGBA')
        orbits.paste(im, (k*256, 0), im)
    orbits.save(output / 'orbit-strip.png')
    write(output / 'inspection.json', {'recipeSha256': digest(run/'recipe.json'), 'silhouettes': contours,
          'windshieldGeometrySha256': digest(windshield) if windshield else None, 'topEdge': edges,
          'limits': 'IoU includes painted shadows; contours do not measure internal fender/window fit. Optional t=.90 top-band probe belongs to the configured compact aperture, not every asset.'})
    print('Native contour report and optional window top-edge check complete.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--windshield', type=Path)
    args = parser.parse_args()
    inspect(args.run.resolve(), args.out.resolve(), args.windshield.resolve() if args.windshield else None)
