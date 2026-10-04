"""Exact approved character and Modern Exteriors reference selection (no wildlife inputs)."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/wildlife-campaign-v2/manual-fox-01/references'
OUT.mkdir(parents=True, exist_ok=True)
atlas = Image.open(ROOT / 'public/assets/tilesets/me-complete.png').convert('RGBA')
selections = {'tree': [256, 96, 48, 64], 'cars-four-facings': [0, 1152, 208, 64], 'roof': [1920, 7312, 160, 160]}
canvas = Image.new('RGBA', (480, 1200), '#899982')
d = ImageDraw.Draw(canvas)
for i, name in enumerate(['person', 'cat', 'bear']):
    im = Image.open(ROOT / f'public/demos/pixel-characters/{name}-32.png')
    canvas.alpha_composite(im.resize((im.width*3, im.height*3), Image.Resampling.NEAREST), (0, i * 400 + 15))
    d.text((390, i * 400 + 45), name, fill='white')
canvas.save(OUT / 'approved-characters.png')
for name, (x, y, w, h) in selections.items():
    im = atlas.crop((x, y, x+w, y+h))
    im.save(OUT / f'{name}-native.png')
    im.resize((w*4, h*4), Image.Resampling.NEAREST).save(OUT / f'{name}-4x.png')
(OUT / 'source-rectangles.json').write_text(json.dumps(selections, indent=2))
