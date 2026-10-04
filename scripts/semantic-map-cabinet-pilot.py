#!/usr/bin/env python3
"""Reproduce P03 cabinet source/alias comparisons and temporary visual evidence."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'assets/interiors/1_Interiors/16x16/Interiors_16x16.png'
CATALOG = ROOT / 'public/data/modern-interiors-atlas.json'
VARIANTS = ('normal', 'black-shadow', 'shadowless')
INDICES = tuple(range(37, 46))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pin(path):
    im = Image.open(path)
    return {'path': str(path.relative_to(ROOT)), 'sha256': sha(path), 'dimensions': list(im.size)}


def index_of(entry):
    return int(Path(entry['sourcePath']).stem.rsplit('_', 1)[1])


def rgba_hash(im):
    return hashlib.sha256(im.tobytes()).hexdigest()


def body_signature(im, variant):
    """Pilot-specific hypothesis, verified by raw delta counts in the report."""
    raw = bytearray(im.tobytes())
    for offset in range(0, len(raw), 4):
        pixel = tuple(raw[offset:offset + 4])
        if pixel[3] == 0 or (variant == 'normal' and pixel == (167, 151, 150, 255)) or (
                variant == 'black-shadow' and pixel == (58, 58, 80, 100)):
            raw[offset:offset + 4] = bytes(4)
        elif pixel == (248, 248, 248, 255):
            raw[offset:offset + 4] = bytes((255, 255, 255, 255))
    return (im.size, hashlib.sha256(raw).hexdigest())


def difference(a, b):
    if a.size != b.size:
        raise ValueError('Different-sized pixel comparison')
    ar, br = a.tobytes(), b.tobytes()
    changed = []
    for offset in range(0, len(ar), 4):
        p, q = tuple(ar[offset:offset + 4]), tuple(br[offset:offset + 4])
        if p != q:
            changed.append(((offset // 4) % a.width, (offset // 4) // a.width, p, q))
    bbox = None
    if changed:
        bbox = [min(p[0] for p in changed), min(p[1] for p in changed),
                max(p[0] for p in changed) + 1, max(p[1] for p in changed) + 1]
    body = [p for p in changed if p[3][3] > 0]
    outside = [p for p in changed if p[3][3] == 0]
    return {'differentPixels': len(changed), 'differenceBBoxXYXY': bbox,
            'onReferenceBodyPixels': len(body), 'outsideReferenceBodyPixels': len(outside),
            'bodyColorChanges': sorted({str((p[2], p[3])) for p in body}),
            'outsideColorChanges': sorted({str((p[2], p[3])) for p in outside})}


def concatenate(images):
    result = Image.new('RGBA', (sum(im.width for im in images), max(im.height for im in images)))
    x = 0
    for im in images:
        result.paste(im, (x, 0))
        x += im.width
    return result


def presentation(im, scale=4, background='#dedede'):
    bg = Image.new('RGBA', im.size, background)
    bg.alpha_composite(im)
    return bg.convert('RGB').resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('/tmp/tilefun-semantic-cabinets'))
    parser.add_argument('--verify-proposal', action='store_true')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location('semantic_match', ROOT / 'scripts/semantic-map-match.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    normalized, Matcher = module.normalized, module.Matcher
    catalog = json.loads(CATALOG.read_text())
    packed_path = ROOT / 'public' / catalog['atlas']
    packed = normalized(Image.open(packed_path))
    entries = [e for e in catalog['entries'] if e.get('theme') == 'living-room']
    selected = {(e['variant'], index_of(e)): e for e in entries if index_of(e) in INDICES}
    if len(selected) != 27:
        raise ValueError('The pilot needs exactly 27 distinct source records')
    images = {key: normalized(Image.open(ROOT / e['sourcePath'])) for key, e in selected.items()}
    master = normalized(Image.open(MASTER))
    matcher = Matcher(master, grid=1)
    # Search the entire 122-file shadowless pool, not assumed same-number pairs.
    pool, corpus = {}, []
    for e in entries:
        if e['variant'] == 'shadowless':
            path = ROOT / e['sourcePath']
            im = normalized(Image.open(path))
            pool.setdefault(body_signature(im, 'shadowless'), []).append(index_of(e))
            corpus.append({'path': e['sourcePath'], 'sha256': sha(path)})
    corpus.sort(key=lambda r: r['path'])
    records = []
    for n in INDICES:
        for variant in VARIANTS:
            entry, im = selected[variant, n], images[variant, n]
            x, y, w, h = entry['rect']
            if min(x, y) < 0 or x + w > packed.width or y + h > packed.height or (w, h) != im.size:
                raise ValueError('Packed alias rectangle invalid')
            alias = packed.crop((x, y, x + w, y + h))
            delta = difference(im, alias)
            if delta['differentPixels']:
                raise ValueError(f'Packed alias differs: {entry["key"]}')
            counterparts = sorted(pool.get(body_signature(im, variant), []))
            records.append({'id': f'P03-{n}-{variant}', 'vendorIndex': n, 'variant': variant,
                            'single': pin(ROOT / entry['sourcePath']), 'alphaBBoxXYXY': list(im.getbbox()),
                            'exactOriginalOccurrences': matcher.find(im),
                            'packedAliasKey': entry['key'], 'packedRect': entry['rect'],
                            'singleSourceRect': entry['sourceRect'], 'packedVisiblePixelsExact': True,
                            'visibleRGBAHash': rgba_hash(im),
                            'shadowlessCounterpartPoolMatches': counterparts,
                            'deltaFromShadowlessSameIndex': difference(im, images['shadowless', n]),
                            'canonicalBodyHash': body_signature(im, variant)[1]})
    missing = images['normal', 38]
    raw_target = master.crop((144, 480, 176, 528))
    composed = raw_target.copy()
    top = master.crop((112, 480, 144, 496))
    composed.paste(top, (0, 0))
    overlay = raw_target.copy()
    overlay.alpha_composite(top, (0, 0))
    trimmed = missing.crop(missing.getbbox())
    experiment = {
        'candidate': 'P03-38-normal', 'candidateFrame': [0, 0, 32, 48],
        'hypothesizedOriginalFrame': [144, 480, 32, 48],
        'differenceBeforeReconstruction': difference(missing, raw_target),
        'alphaTrimmedCandidateRectXYXY': list(missing.getbbox()),
        'alphaTrimmedExactOriginalOccurrences': matcher.find(trimmed),
        'upperStripCandidateRect': [0, 0, 32, 16], 'upperStripOriginalOccurrences': matcher.find(missing.crop((0, 0, 32, 16))),
        'lowerStripCandidateRect': [0, 16, 32, 32], 'lowerStripOriginalOccurrences': matcher.find(missing.crop((0, 16, 32, 48))),
        'composition': [{'sourceRect': [112, 480, 32, 16], 'targetRect': [0, 0, 32, 16]},
                        {'sourceRect': [144, 496, 32, 32], 'targetRect': [0, 16, 32, 32]}],
        'replacementExact': composed.tobytes() == missing.tobytes(),
        'alphaOverlayExact': overlay.tobytes() == missing.tobytes(),
        'reconstructionHash': rgba_hash(composed),
        'paddingOnlyExplanationRefuted': not matcher.find(trimmed),
    }
    sequences = {'closed-two-end-pieces': [41, 44], 'solid-expanded': [41, 43, 44],
                 'reflective-expanded': [41, 42, 44], 'mixed-expanded': [41, 42, 43, 44],
                 'uncapped-original-sampler': [42, 43], 'wrong-end-order': [44, 42, 41]}
    assembly_records = []
    montage = Image.new('RGB', (960, len(sequences) * 225), '#dedede')
    draw = ImageDraw.Draw(montage)
    for row, (name, ns) in enumerate(sequences.items()):
        for vi, variant in enumerate(VARIANTS):
            assembled = concatenate([images[variant, n] for n in ns])
            montage.paste(presentation(assembled), (vi * 320 + 8, row * 225 + 25))
            draw.text((vi * 320 + 8, row * 225 + 5), f'{name}: {variant}', fill='black')
            # Alpha continuity within the occupied body is necessary, not proof of correct semantic assembly.
            rows_with_gaps = []
            for y in range(4, 42):
                occupied = [x for x in range(assembled.width) if assembled.getpixel((x, y))[3] > 0]
                if occupied and len(occupied) != occupied[-1] - occupied[0] + 1:
                    rows_with_gaps.append(y)
            assembly_records.append({'name': name, 'members': ns, 'variant': variant,
                                     'dimensions': list(assembled.size), 'visibleRGBAHash': rgba_hash(assembled),
                                     'internalAlphaGapRows4to41': rows_with_gaps,
                                     'exactOriginalOccurrences': matcher.find(assembled)})
    montage.save(args.out / 'assemblies.png')
    variants_image = Image.new('RGB', (9 * 180, 3 * 280), '#dedede')
    draw = ImageDraw.Draw(variants_image)
    for vi, variant in enumerate(VARIANTS):
        for ni, n in enumerate(INDICES):
            variants_image.paste(presentation(images[variant, n]), (ni * 180 + 20, vi * 280 + 50))
            draw.text((ni * 180 + 5, vi * 280 + 10), f'{variant} #{n}', fill='black')
    variants_image.save(args.out / 'variants.png')
    presentation(master.crop((96, 464, 256, 592)), 5).save(args.out / 'master-context.png')
    reconstruction_image = Image.new('RGB', (4 * 176, 250), '#dedede')
    draw = ImageDraw.Draw(reconstruction_image)
    for col, (name, im) in enumerate([('single #38', missing), ('master raw', raw_target),
                                     ('source top #37', top), ('composed exact', composed)]):
        reconstruction_image.paste(presentation(im), (col * 176 + 8, 30))
        draw.text((col * 176 + 8, 8), name, fill='black')
    reconstruction_image.save(args.out / '38-reconstruction.png')
    backgrounds = Image.new('RGB', (4 * 256, 3 * 240), 'white')
    draw = ImageDraw.Draw(backgrounds)
    for col, background in enumerate(('#ffffff', '#dedede', '#2d604f', '#171725')):
        for row, variant in enumerate(VARIANTS):
            backgrounds.paste(presentation(images[variant, 38], 4, background), (col * 256 + 48, row * 240 + 35))
            draw.text((col * 256 + 8, row * 240 + 8), f'{variant} on {background}', fill='black')
    backgrounds.save(args.out / 'shadow-backgrounds.png')
    for n in range(41, 46):
        presentation(images['normal', n], 12).save(args.out / f'detail-{n}.png')
    result = {'sources': {'originalMaster': pin(MASTER), 'packedAtlas': pin(packed_path),
                          'packedCatalog': {'path': str(CATALOG.relative_to(ROOT)), 'sha256': sha(CATALOG)}},
              'comparison': 'Exact RGBA with hidden RGB at alpha=0 normalized; original search checks every pixel origin',
              'scope': {'singleRecords': 27, 'uniqueVendorIndices': 9, 'normalExactOriginalFiles': sum(
                  bool(r['exactOriginalOccurrences']) for r in records if r['variant'] == 'normal'),
                  'otherVariantExactOriginalFiles': sum(bool(r['exactOriginalOccurrences']) for r in records if r['variant'] != 'normal')},
              'counterpartReferenceCorpus': {'variant': 'shadowless', 'fileCount': len(corpus),
                  'sortedPathAndHashJSONFingerprint': hashlib.sha256(json.dumps(corpus, sort_keys=True).encode()).hexdigest()},
              'bodyCanonicalizationHypothesis': 'Remove normal RGBA167,151,150,255 ground pixels; remove black-shadow RGBA58,58,80,100 pixels; map opaque white248 to255. Verified separately by raw per-pixel deltas, not universal pack rule.',
              'records': records, 'missing38Experiment': experiment, 'assemblyExperiments': assembly_records}
    (args.out / 'findings.json').write_text(json.dumps(result, indent=2) + '\n')
    if args.verify_proposal:
        proposal_path = ROOT / 'docs/tactical/053-semantic-tileset-map/packets/P03-cabinets.json'
        saved = json.loads(proposal_path.read_text())
        if saved['measurements'] != result:
            raise ValueError('Saved P03 measurements differ from source evidence')
    print(json.dumps(result['scope']))
    print('Reconstructed #38 exact:', experiment['replacementExact'])
    print('All paired indices independently match the reference pool:',
          all(r['shadowlessCounterpartPoolMatches'] == [r['vendorIndex']] for r in records))


if __name__ == '__main__':
    main()
