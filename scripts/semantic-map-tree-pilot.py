#!/usr/bin/env python3
"""Reproduce P01 matching, exact reconstruction, palette and forest probes."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT / 'docs/tactical/053-semantic-tileset-map/packets/P01-trees.json'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('/tmp/tilefun-semantic-trees'))
    parser.add_argument('--verify', action='store_true', help='Compare measured evidence with saved packet')
    args = parser.parse_args()
    packet = json.loads(PACKET.read_text())
    source = ROOT / packet['source']['path']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == packet['source']['sha256']
    assert source.read_bytes() == (ROOT / packet['source']['alias']).read_bytes()
    master = Image.open(source).convert('RGBA')
    assert master.size == (2816, 8224)
    spec = importlib.util.spec_from_file_location('semantic_match', ROOT / 'scripts/semantic-map-match.py')
    match = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(match)
    matcher = match.Matcher(master)
    all_pixel_matcher = match.Matcher(master, grid=1)
    args.out.mkdir(parents=True, exist_ok=True)
    assets, occurrences = {}, []
    for candidate in packet['candidates']:
        path = ROOT / candidate['source_path']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == candidate['source_sha256']
        image = Image.open(path).convert('RGBA')
        x, y, w, h = candidate['source_rect']
        assert x >= 0 and y >= 0 and w > 0 and h > 0
        assert x+w <= image.width and y+h <= image.height
        image = image.crop((x, y, x+w, y+h))
        assets[candidate['id']] = image
        found = matcher.find(image)
        if candidate.get('master_anchor'):
            assert candidate['master_anchor'] in found
        occurrences.append(dict(id=candidate['id'], source_rect=candidate['source_rect'],
                                grid16_exact_master_occurrences=found,
                                all_pixel_exact_master_occurrences=all_pixel_matcher.find(image)))
    # Whole single comparison atlas.
    contact = Image.new('RGBA', (768, 768), (56, 62, 70, 255))
    cd = ImageDraw.Draw(contact)
    for n in range(1, 13):
        x, y = ((n-1)//3)*192, ((n-1)%3)*256
        contact.alpha_composite(assets[f'T{n:02d}'].resize((192, 192), Image.Resampling.NEAREST), (x, y+24))
        cd.text((x+8, y+8), f'T{n:02d} / Tree_{n}', fill='white')
    contact.convert('RGB').save(args.out / 'tree-named-variants.png')
    # Retain actual master context: the lower repeats are NOT complete trees.
    context = Image.new('RGBA', (1024, 384), (56, 62, 70, 255))
    xd = ImageDraw.Draw(context)
    for i, y in enumerate([16, 448, 864, 1280]):
        crop = master.crop((2464, y, 2528, y+96))
        context.alpha_composite(crop.resize((256, 384), Image.Resampling.NEAREST), (i*256, 0))
        xd.text((i*256+4, 2), f'master (2464,{y},64,96)', fill='white')
    context.convert('RGB').save(args.out / 'master-tree-and-patches.png')
    reconstructed = []
    for relation in packet['relations']:
        if relation['type'] == 'lower-strip-replacement':
            image = assets[relation['base']].copy()
            image.paste(assets[relation['patch']], (0, 48))
            identical = match.normalized(image).tobytes() == match.normalized(assets[relation['result']]).tobytes()
            assert identical
            reconstructed.append(dict(base=relation['base'], patch=relation['patch'],
                                      result=relation['result'], exact_normalized_rgba=identical))
    palette = []
    ref = assets['T01']
    for cid in ['T04', 'T07', 'T10']:
        image = assets[cid]
        alpha_diffs = []
        mapping = {}
        for y in range(64):
            for x in range(64):
                p, q = ref.getpixel((x, y)), image.getpixel((x, y))
                if p[3] != q[3]:
                    alpha_diffs.append([x, y, p[3], q[3]])
                if p[3]:
                    mapping.setdefault(p, set()).add(q if q[3] else (0, 0, 0, 0))
        conflicts = [dict(source_rgba=list(p), destination_rgba=sorted([list(q) for q in qs]))
                     for p, qs in mapping.items() if len(qs) > 1]
        palette.append(dict(base='T01', compared=cid, alpha_difference_pixels=alpha_diffs,
                            exact_normalized_rgba=match.normalized(ref).tobytes() == match.normalized(image).tobytes(),
                            single_global_color_mapping=(len(conflicts) == 0), color_mapping_exceptions=conflicts))
    forest_contact = Image.new('RGBA', (1536, 1152), (56, 62, 70, 255))
    fd = ImageDraw.Draw(forest_contact)
    forest = []
    for row in range(3):
        ids = [f'F{row*3+i:02d}' for i in [1, 2, 3]]
        parts = [assets[cid] for cid in ids]
        width, height = sum(p.width for p in parts), max(p.height for p in parts)
        variants = [('ordered-top-aligned', parts), ('reversed-failed-order', list(reversed(parts)))]
        for variant, (name, ps) in enumerate(variants):
            assembly = Image.new('RGBA', (width, height))
            x, offsets, seams = 0, [], []
            for part in ps:
                assembly.alpha_composite(part, (x, 0))
                offsets.append([x, 0])
                x += part.width
            x = 0
            for left, right in zip(ps, ps[1:]):
                x += left.width
                # Diagnostic only: edge alpha mismatch is not a seam-quality metric.
                differences = [yy for yy in range(height)
                               if (left.getpixel((left.width-1, yy))[3] if yy < left.height else 0)
                               != (right.getpixel((0, yy))[3] if yy < right.height else 0)]
                seams.append(dict(x=x, alpha_edge_mismatch_rows=differences))
            px, py = variant*768, row*384
            forest_contact.alpha_composite(assembly.resize((width*3, height*3), Image.Resampling.NEAREST), (px, py+32))
            fd.text((px+8, py+8), f'Row {row+1}: {name}', fill='white')
            bg = Image.new('RGBA', assembly.size, (56, 62, 70, 255)); bg.alpha_composite(assembly)
            bg.convert('RGB').resize((width*4, height*4), Image.Resampling.NEAREST).save(args.out / f'forest-row{row+1}-{name}.png')
            if variant == 0:
                # Test whether a matching terrain background hides the rectangular ground patch.
                ground_rgba = parts[1].getpixel((64, parts[1].height-1))
                grass = Image.new('RGBA', assembly.size, ground_rgba); grass.alpha_composite(assembly)
                grass.convert('RGB').resize((width*4, height*4), Image.Resampling.NEAREST).save(args.out / f'forest-row{row+1}-matching-ground.png')
            forest.append(dict(row=row+1, arrangement=name,
                               members=ids if variant==0 else list(reversed(ids)),
                               size=[width, height], offsets=offsets, seams=seams,
                               matching_ground_rgba=list(ground_rgba) if variant==0 else None))
    forest_contact.convert('RGB').save(args.out / 'forest-assembly.png')
    measured = dict(matching_method='All original-master grid16 occurrences and all pixel-origin occurrences; exact visible RGBA and alpha, transparent RGB ignored.',
                    matching_limitation='No exact pixel-origin match does not exclude compressed components, reconstructable art, near-matches or semantic variants.',
                    occurrences=occurrences, exact_reconstructions=reconstructed,
                    palette_comparisons=palette, forest_assemblies=forest)
    (args.out / 'results.json').write_text(json.dumps(measured, indent=2)+'\n')
    if args.verify:
        assert measured == packet['experiments'], 'Measured evidence differs from durable packet'
    print(json.dumps(dict(candidates=len(assets), exact_matched_candidates=sum(bool(o['grid16_exact_master_occurrences']) for o in occurrences),
                          unmatched_whole_singles=[o['id'] for o in occurrences if not o['grid16_exact_master_occurrences']],
                          exact_reconstructions=len(reconstructed), verified=args.verify,
                          output_directory=str(args.out)), indent=2))


if __name__ == '__main__':
    main()
