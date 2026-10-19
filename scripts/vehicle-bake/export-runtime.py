"""Retain the accepted coupe's exact GLB and cardinal game-camera sprite fallback.

Run explicitly; normal builds never regenerate artwork. All inputs are frozen.
"""
import hashlib
import json
import math
from pathlib import Path
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REV = 'a-reduced-projection/mid-fenders-v3'
SOURCE = ROOT / 'public/demos/vehicle-bake' / REV
CAPTURE = ROOT / 'public/demos/vehicle-bake/captures/a-reduced-projection--mid-fenders-v3'
MODEL = ROOT / 'public/assets/models/vehicles/rosso-coupe-v3.glb'
SHEET = ROOT / 'public/assets/vehicles/rosso-coupe-v1.png'
EXPECTED = '05de49fc16a281db97fb6854d94252e44bb8f1502a5749e8580d95cba908df64'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

assert sha(SOURCE / 'model.glb') == EXPECTED
receipt = json.loads((CAPTURE / 'capture.json').read_text(encoding='utf-8'))
assert receipt['glbSha256'] == EXPECTED
review = json.loads((ROOT / 'public/demos/vehicle-bake/manifest.json').read_text(encoding='utf-8'))
candidate = next(c for c in review['candidates'] if c['id'] == 'a-reduced-projection--mid-fenders-v3')
pinned = {f['url']: f['sha256'] for f in candidate['files']}
proof = json.loads((ROOT / 'art-source/vehicle-bake' / REV / 'evidence/clearance.json').read_text())
assert proof['sourceGLBSha256'] == EXPECTED
length, width, height = map(math.ceil, proof['worldBounds']['size'])
assert (length, width, height) == (82, 36, 19)
sheet = Image.new('RGBA', (192, 224 * 4))
views = []
inputs = {str((SOURCE / 'model.glb').relative_to(ROOT)).replace('\\', '/'): EXPECTED}
for row, (direction, index) in enumerate([('south', 4), ('north', 12), ('west', 8), ('east', 0)]):
    source = CAPTURE / f'engine-{index}.png'
    assert sha(source) == pinned[source.relative_to(ROOT / 'public').as_posix()]
    frame = Image.open(source).convert('RGBA')
    assert frame.size == (128, 128)
    x0, y0, x1, y1 = frame.getbbox()
    assert 0 < x0 < x1 < 128 and 0 < y0 < y1 < 128
    sheet.paste(frame, (32, row * 224 + 80))
    side = direction in ('east', 'west')
    w, h = (length, width) if side else (width, length)
    views.append({'id': f'original-vehicle:rosso-coupe:{direction}',
                  'vehicleId': 'rosso-coupe', 'direction': direction,
                  'rect': [x0 + 32, y0 + row * 224 + 80, x1 - x0, y1 - y0],
                  'metadata': {'name': f'Red sports coupe · {direction}', 'category': 'vehicle',
                               'kind': 'prop', 'tags': ['vehicle', 'original', 'sports car'],
                               'settings': ['road'], 'facing': direction,
                               'anchor': [64 - x0, 64 - y0 + h / 2],
                               'footprint': [-w / 2, -h, w, h],
                               'colliders': [{'offsetX': 0, 'offsetY': 0, 'width': w,
                                              'height': h, 'zHeight': height}],
                               'depthOffset': -h / 2}})
    inputs[str(source.relative_to(ROOT)).replace('\\', '/')] = sha(source)
MODEL.parent.mkdir(parents=True, exist_ok=True)
SHEET.parent.mkdir(parents=True, exist_ok=True)
if MODEL.exists():
    assert sha(MODEL) == EXPECTED, 'Runtime model revision is immutable'
else:
    shutil.copyfile(SOURCE / 'model.glb', MODEL)
if SHEET.exists():
    assert Image.open(SHEET).convert('RGBA').tobytes() == sheet.tobytes(), 'Fallback revision is immutable'
else:
    sheet.save(SHEET)
entry = {'id': 'rosso-coupe', 'name': 'Red sports coupe',
         'sprite': 'assets/vehicles/rosso-coupe-v1.png',
         'mesh': {'assetId': 'rosso-coupe-authored-v3', 'path': 'assets/models/vehicles/rosso-coupe-v3.glb',
                  'radius': 64, 'lateralScale': 1},
         'performance': {'speed': 156, 'acceleration': 300, 'pushSpeed': 44, 'pushWeight': 120},
         'views': views}
catalog = ROOT / 'src/traffic/original-vehicles.json'
data = json.loads(catalog.read_text(encoding='utf-8')) if catalog.exists() else {'version': 1, 'vehicles': []}
position = next((i for i, v in enumerate(data['vehicles']) if v['id'] == entry['id']), len(data['vehicles']))
if position == len(data['vehicles']):
    data['vehicles'].append(entry)
else:
    data['vehicles'][position] = entry
if not catalog.exists() or json.loads(catalog.read_text(encoding='utf-8')) != data:
    catalog.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
evidence = {'modelSha256': EXPECTED, 'spriteSha256': sha(SHEET), 'inputs': inputs,
            'physicalBounds': [length, width, height], 'frameSize': [192, 224],
            'groundOrigin': [96, 144], 'rows': ['south', 'north', 'west', 'east'],
            'projection': 'Unchanged shared game projection; exact native pixels from retained actual GLB captures',
            'replay': 'python scripts/vehicle-bake/export-runtime.py'}
(ROOT / 'art-source/vehicle-bake/runtime-rosso-coupe-v3.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
print(json.dumps(evidence, indent=2))
