#!/usr/bin/env python3
"""Recreate S02 local visual evidence; never modifies source images."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'interiors': ROOT / 'assets/interiors/1_Interiors/16x16/Interiors_16x16.png',
    'room-builder': ROOT / 'assets/interiors/1_Interiors/16x16/Room_Builder_16x16.png',
}


def panel(im, rect, scale=2):
    x, y, w, h = rect
    crop = im.crop((x, y, x + w, y + h)).convert('RGBA')
    bg = Image.new('RGBA', crop.size, '#dedede')
    bg.alpha_composite(crop)
    body = bg.convert('RGB').resize((w * scale, h * scale), Image.Resampling.NEAREST)
    out = Image.new('RGB', (body.width + 48, body.height + 32), '#ffffff')
    out.paste(body, (48, 32))
    d = ImageDraw.Draw(out)
    d.text((2, 4), str(rect), fill='black')
    for yy in range(((y + 127) // 128) * 128, y + h, 128):
        at = 32 + (yy - y) * scale
        d.text((2, at), str(yy), fill='black')
        d.line((43, at, 48, at), fill='black')
    return out


def normalized(im):
    result = im.convert('RGBA')
    invisible = result.getchannel('A').point(lambda a: 255 if a == 0 else 0)
    result.paste((0, 0, 0, 0), mask=invisible)
    return result


def subfile_probe(out):
    master = normalized(Image.open(SOURCES['room-builder']))
    raw = master.tobytes()
    results = []
    for path in sorted((SOURCES['room-builder'].parent / 'Room_Builder_subfiles').glob('*.png')):
        original = Image.open(path).convert('RGBA')
        bbox = original.getbbox()
        candidate = normalized(original.crop(bbox))
        expected = candidate.tobytes()
        w, h = candidate.size
        start, matches = 0, []
        while True:
            offset = raw.find(expected[:w * 4], start)
            if offset < 0:
                break
            start = offset + 1
            if offset % 4:
                continue
            x = (offset // 4) % master.width
            y = offset // (master.width * 4)
            if x + w <= master.width and y + h <= master.height:
                if master.crop((x, y, x + w, y + h)).tobytes() == expected:
                    matches.append([x, y, w, h])
        results.append({'path': str(path.relative_to(ROOT)),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'sourceCrop': list(bbox), 'originalMatches': matches})
    (out / 'room-subfile-matches.json').write_text(json.dumps({
        'comparison': 'Alpha-trimmed visible RGBA; all pixel origins; transparent RGB normalized',
        'candidates': results}, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=Path('/tmp/tilefun-semantic-interiors'))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    subfile_probe(args.out)
    evidence = {'sources': {}, 'crops': []}
    for key, path in SOURCES.items():
        im = Image.open(path)
        evidence['sources'][key] = {'path': str(path.relative_to(ROOT)), 'dimensions': list(im.size),
                                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        if key == 'interiors':
            rects = [(0, y, im.width, min(1024, im.height - y)) for y in range(0, im.height, 960)]
        else:
            rects = [(x, y, min(640, im.width - x), min(960, im.height - y))
                     for y in (0, 848) for x in (0, 576)]
        panels = []
        for i, rect in enumerate(rects):
            name = f'{key}-{i:02d}.png'
            p = panel(im, rect, 2 if key == 'interiors' else 1)
            p.save(args.out / name)
            panels.append(p)
            evidence['crops'].append({'source': key, 'path': name, 'rect': list(rect)})
        if key == 'interiors':
            stride = im.width + 48
            overview = Image.new('RGB', (len(panels) * stride, 1072), 'white')
            for i, rect in enumerate(rects):
                overview.paste(panel(im, rect, 1), (i * stride, 0))
            overview.save(args.out / 'interiors-overview.png')
        else:
            panel(im, (0, 0, *im.size), 1).save(args.out / 'room-builder-overview.png')
    proposal_path = ROOT / 'docs/tactical/053-semantic-tileset-map/packets/S02-interiors-regions.json'
    if proposal_path.exists():
        proposal = json.loads(proposal_path.read_text())
        for source_key, source in proposal['sources'].items():
            actual = evidence['sources'][source_key]
            if source['sha256'] != actual['sha256'] or source['dimensions'] != actual['dimensions']:
                raise ValueError(f'Source pin changed: {source_key}')
            size = actual['dimensions']
            region_mask = Image.new('L', tuple(size))
            family_mask = Image.new('L', tuple(size))
            region_draw = ImageDraw.Draw(region_mask)
            family_draw = ImageDraw.Draw(family_mask)
            for region in proposal['regions']:
                if region['source'] != source_key:
                    continue
                x, y, w, h = region['rect']
                if min(x, y) < 0 or min(w, h) <= 0 or x + w > size[0] or y + h > size[1]:
                    raise ValueError(f'Out-of-bounds region: {region["id"]}')
                region_draw.rectangle((x, y, x + w - 1, y + h - 1), fill=255)
                if region['role'] != 'annotation-search-window':
                    family_draw.rectangle((x, y, x + w - 1, y + h - 1), fill=255)
            alpha = Image.open(SOURCES[source_key]).getchannel('A').point(lambda a: 255 if a else 0)
            outside = ImageChops.subtract(alpha, region_mask)
            saved = proposal['coverage'][source_key]
            actual_coverage = {
                'occupiedPixels': sum(alpha.histogram()[1:]),
                'occupiedPixelsOutsideProposedWindows': sum(outside.histogram()[1:]),
                'outsideWindowsBBox': list(outside.getbbox()) if outside.getbbox() else None,
            }
            if 'occupiedPixelsOutsideFamilyWindows' in saved:
                actual_coverage['occupiedPixelsOutsideFamilyWindows'] = sum(
                    ImageChops.subtract(alpha, family_mask).histogram()[1:])
            for field, value in actual_coverage.items():
                if saved[field] != value:
                    raise ValueError(f'Coverage mismatch: {source_key}/{field}')
        im = Image.open(SOURCES['room-builder']).convert('RGBA')
        mask = Image.new('L', im.size)
        draw = ImageDraw.Draw(mask)
        for region in proposal['regions']:
            if region['source'] == 'room-builder' and region['role'] != 'annotation-search-window':
                x, y, w, h = region['rect']
                draw.rectangle((x, y, x + w - 1, y + h - 1), fill=255)
        uncovered = ImageChops.subtract(im.getchannel('A'), mask)
        bg = Image.new('RGBA', im.size, '#dedede')
        bg.paste(im, (0, 0), uncovered)
        bg.crop((784, 0, 1216, 672)).resize((864, 1344), Image.Resampling.NEAREST).save(
            args.out / 'room-builder-unclassified.png')
    (args.out / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence['sources'], indent=2))


if __name__ == '__main__':
    main()
