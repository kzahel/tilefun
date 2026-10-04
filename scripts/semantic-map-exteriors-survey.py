#!/usr/bin/env python3
"""Reproduce S02 read-only master-sheet survey evidence; Pillow only."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT / 'docs/tactical/053-semantic-tileset-map/packets/S02-exteriors-regions.json'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('/tmp/tilefun-semantic-exteriors'))
    args = parser.parse_args()
    data = json.loads(PACKET.read_text())
    source = ROOT / data['source']['path']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == data['source']['sha256']
    assert source.read_bytes() == (ROOT / data['source']['alias']).read_bytes()
    im = Image.open(source).convert('RGBA')
    assert im.size == (data['source']['width'], data['source']['height'])
    args.out.mkdir(parents=True, exist_ok=True)
    bg = Image.new('RGBA', im.size, (56, 62, 70, 255))
    bg.alpha_composite(im)
    bg = bg.convert('RGB')
    bg.resize((704, 2056), Image.Resampling.NEAREST).save(args.out / 'overview.png')
    for y in range(0, im.height, 896):
        bottom = min(y + 1024, im.height)
        bg.crop((0, y, im.width, bottom)).resize(
            (1408, (bottom-y)//2), Image.Resampling.NEAREST
        ).save(args.out / f'band-{y:04d}.png')
    occupied = im.getchannel('A').point(lambda p: 255 if p else 0)
    mask = Image.new('L', im.size)
    draw = ImageDraw.Draw(mask)
    overview = bg.copy()
    overlay = ImageDraw.Draw(overview)
    for key in ('regions', 'pilot_windows', 'unclassified_regions'):
        for region in data[key]:
            rect = region['rect']
            x, y, w, h = (rect[f] for f in ('x', 'y', 'w', 'h'))
            assert x >= 0 and y >= 0 and w > 0 and h > 0
            assert x+w <= im.width and y+h <= im.height, region['id']
            if key == 'regions':
                draw.rectangle((x, y, x+w-1, y+h-1), fill=255)
                overlay.rectangle((x, y, x+w-1, y+h-1), outline='#ffd55f', width=3)
                overlay.text((x+4, y+4), region['id'], fill='#ffffff', stroke_width=2, stroke_fill='#000000')
            elif key == 'pilot_windows':
                bg.crop((x, y, x+w, y+h)).resize((w*2, h*2), Image.Resampling.NEAREST).save(args.out / f'{region["id"]}.png')
    overview.resize((1408, 4112), Image.Resampling.NEAREST).save(args.out / 'thematic-map.png')
    count = lambda m: m.histogram()[255]
    residual = ImageChops.subtract(occupied, mask)
    coverage = data['coverage']
    assert count(occupied) == coverage['occupied_pixels']
    assert count(ImageChops.multiply(occupied, mask)) == coverage['occupied_pixels_in_theme_windows']
    assert count(residual) == coverage['residual_occupied_pixels']
    residual_mask = Image.new('L', im.size)
    rd = ImageDraw.Draw(residual_mask)
    for region in data['unclassified_regions']:
        b = region['rect']; rd.rectangle((b['x'], b['y'], b['x']+b['w']-1, b['y']+b['h']-1), fill=255)
    assert count(ImageChops.subtract(residual, residual_mask)) == 0
    # Small annotated residual atlas is a gap-audit aid, not object segmentation.
    contact = Image.new('RGB', (1024, 320*((len(data['unclassified_regions'])+3)//4)), '#383e46')
    cd = ImageDraw.Draw(contact)
    for i, region in enumerate(data['unclassified_regions']):
        b = region['rect']; x, y = (i%4)*256, (i//4)*320
        crop = bg.crop((b['x'], b['y'], b['x']+b['w'], b['y']+b['h']))
        contact.paste(crop, (x, y+32))
        cd.text((x+4, y+4), f'{region["id"]} ({b["x"]},{b["y"]})', fill='white')
    contact.save(args.out / 'unclassified-residuals.png')
    print(json.dumps(dict(source_sha256=data['source']['sha256'], verified_alias=True,
                         regions=len(data['regions']), pilots=len(data['pilot_windows']),
                         unclassified_regions=len(data['unclassified_regions']),
                         coverage=coverage, evidence_directory=str(args.out)), indent=2))


if __name__ == '__main__':
    main()
