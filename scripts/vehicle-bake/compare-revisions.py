"""Before/after inspection from actual shared-engine captures, with fixed registration."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/demos/vehicle-bake'
parser = argparse.ArgumentParser()
parser.add_argument('--before', required=True)
parser.add_argument('--after', required=True)
parser.add_argument('--output', default='wheel-review.png')
args = parser.parse_args()
manifest = json.loads((OUT / 'manifest.json').read_text())
candidates = {c['id']: c for c in manifest['candidates']}
sheet = Image.new('RGB', (1200, 1000), '#1c2526')
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default(size=16)
small = ImageFont.load_default(size=13)
draw.text((24, 18), 'RED COUPE / WHEEL AND FENDER CORRECTION',
          font=ImageFont.load_default(size=23), fill='#eee5d4')
draw.text((24, 54), 'Actual textured GLBs with shared pixel outline. Fixed camera, scale and anchor; 2x native pixels.',
          font=small, fill='#a8c0ab')
for row, (candidate_id, mode, label) in enumerate([
        (args.before, 'study', 'Before'), (args.after, 'study', 'Revised'),
        (args.after, 'engine', 'Revised / game camera')]):
    candidate = candidates[candidate_id]
    folder = OUT / 'captures' / candidate_id
    receipt = json.loads((folder / 'capture.json').read_text())
    assert receipt['glbSha256'] == candidate['audit']['sha256']
    y = 110 + row * 280
    draw.text((24, y + 60), label, font=font, fill='#dfb27f')
    draw.text((24, y + 86), f"{candidate['audit']['triangles']:,} triangles", font=small, fill='#a8c0ab')
    for column, index in enumerate((0, 2, 8, 10)):
        frame = Image.open(folder / f'{mode}-{index}.png').convert('RGBA')
        frame = frame.resize((256, 256), Image.Resampling.NEAREST)
        x = 220 + column * 245
        sheet.paste(frame, (x, y), frame)
        draw.text((x + 42, y - 12), f'{index * 22.5:g} degrees', font=small, fill='#89a18b')
draw.text((24, 966), 'Four independent rolling wheels. Art review pending; no production activation.',
          font=small, fill='#a8c0ab')
sheet.save(OUT / args.output)
print(OUT / args.output)
