"""Explicit source extraction for unapproved Workshop previews; never run by builds.
Requires Pillow and the purchased 16px Modern Exteriors singles. No resampling.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Singles_16x16'
PREFIX = 'ME_Singles_Subway_and_Train_Station_16x16_'
names = []
for color in ['Grey', 'Brown']:
    names += [f'{color}_Rail_Modular_{axis}' for axis in ['Horizontal', 'Vertical']]
    names += [f'{color}_Rail_{side}_{end}_Corner' for side in ['Left', 'Right'] for end in ['Up', 'Bottom']]
    names += [f'{color}_Rail_Horizontal_Crossed_{side}' for side in ['Left', 'Right']]
for color in ['Blue', 'Green', 'Orange', 'Grey', 'White']:
    names += [f'Exterior_Train_{color}_{part}' for part in ['Left', 'Middle', 'Right']]
    names += [f'Train_{color}_{part}_Down' for part in ['Back', 'Middle', 'Front']
              if not (color == 'Orange' and part == 'Middle')]
names += ['High_Double_Tunnel_Cornice', 'High_Single_Tunnel_Cornice',
          'Small_Tunnel_Left_Side', 'Small_Tunnel_Right_Side',
          'Three_Seats_Grey_Bench_Frontal_1', 'Stairs_Complete_1',
          'Binary_Edge_Middle_Modular_Horizontal_Up_1',
          'Binary_Edge_Middle_Modular_Horizontal_Down_1']
canvas = Image.new('RGBA', (1024, 2048))
x = y = row = 0
entries = {}
for name in names:
    path = BASE / (PREFIX + name + '.png')
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    if x + w > 1024:
        x, y, row = 0, y + row + 8, 0
    canvas.paste(im, (x, y))
    entries[name] = {'rect': [x, y, w, h], 'bounds': list(im.getbbox()),
                     'source': str(path.relative_to(ROOT)),
                     'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    x += w + 8
    row = max(row, h)
canvas = canvas.crop((0, 0, 1024, y + row))
image = ROOT / 'public/assets/tilesets/railway-review-v1.png'
canvas.save(image)
manifest = {'version': 1, 'sheetId': 'railway-review-v1',
            'image': 'assets/tilesets/railway-review-v1.png',
            'sha256': hashlib.sha256(image.read_bytes()).hexdigest(),
            'width': canvas.width, 'height': canvas.height, 'sprites': entries}
(ROOT / 'src/railway/RailwaySource.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Packed {len(entries)} exact source sprites, {canvas.size}; unapproved preview only.')
