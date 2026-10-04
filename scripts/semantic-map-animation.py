#!/usr/bin/env python3
"""Bounded native16 door animation proposal: exact source frames, static aliases,
and separately pinned GIF demonstrations. --check is read-only; originals required.
No runtime definitions, source assets, catalogs, coverage or approval are changed.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PLAN = 'docs/tactical/053-semantic-tileset-map'
OUTPUT = ROOT / PLAN / 'packets/A01-animation.json'
LEDGER = PLAN + '/source-files.json'
LEDGER_PIN = 'c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda'
INDEX = 'public/data/modern-interiors-atlas.json'
INDEX_PIN = 'c2beaba7bbd767b14df8cb7faa042908adbda89e0a43a7fd5c37cb5101a9a02e'
ATLAS = 'public/assets/tilesets/modern-interiors-atlas.png'
BASE = 'assets/interiors/3_Animated_objects/16x16/'
STRIPS = [('opening', BASE + 'spritesheets/animated_door_1.png', 5),
          ('closed-perturbation', BASE + 'spritesheets/animated_door_1_locked.png', 4)]
MATCH_SCRIPT = 'scripts/semantic-map-match.py'
SPEC = importlib.util.spec_from_file_location('semantic_animation_match', ROOT / MATCH_SCRIPT)
MATCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MATCH)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + '\n').encode()


def sid(path):
    return 'src-' + sha(path.encode())[:16]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def field(value, evidence, confidence='high', alternatives=()):
    return {'value': value, 'confidence': confidence, 'evidence': evidence,
            'alternatives': list(alternatives), 'disposition': 'unknown' if value is None else 'proposed'}


def frame_delta(a, b):
    require(a.size == b.size, 'Frame comparison needs identical dimensions')
    ar, br = a.tobytes(), b.tobytes()
    mask = Image.frombytes('L', a.size, bytes(255 if ar[i:i + 4] != br[i:i + 4] else 0
                                           for i in range(0, len(ar), 4)))
    return {'changedPixels': sum(bool(v) for v in mask.tobytes()),
            'changedBoundsXYXY': list(mask.getbbox()) if mask.getbbox() else None,
            'alphaChangedPixels': sum(ar[i] != br[i] for i in range(3, len(ar), 4)),
            'maskSHA256': sha(mask.tobytes())}


def build(capture_dir=None):
    require(sha((ROOT / LEDGER).read_bytes()) == LEDGER_PIN, 'Source ledger drift')
    require(sha((ROOT / INDEX).read_bytes()) == INDEX_PIN, 'Packed index drift')
    ledger = json.loads((ROOT / LEDGER).read_text())
    inventory = {r[0]: dict(zip(ledger['columns'], r)) for r in ledger['files']}
    index = json.loads((ROOT / INDEX).read_text())
    sources, images = {}, {}

    def read(path, supporting=False):
        if path not in images:
            raw = (ROOT / path).read_bytes()
            image = MATCH.normalized(Image.open(ROOT / path))
            if not supporting:
                pin = inventory[path]
                require(sha(raw) == pin['sha256'] and list(image.size) == [pin['width'], pin['height']], 'Source drift: ' + path)
            sources[sid(path)] = {'id': sid(path), 'path': path, 'fileSHA256': sha(raw),
                                  'dimensions': list(image.size), 'normalizedRgbaSHA256': sha(image.tobytes()),
                                  'scopeGroup': 'supporting-native16-GIF-outside-PNG-inventory' if supporting else inventory[path]['scopeGroup']}
            images[path] = image
        return images[path]

    frames, candidates, sequences = {}, [], []
    for action, path, count in STRIPS:
        strip = read(path)
        require(strip.size == (count * 16, 32), 'Unexpected source strip frame geometry')
        ids = []
        for order in range(count):
            rid = f'A01-{len(candidates) + 1:02}'
            bounds = [order * 16, 0, 16, 32]
            im = strip.crop((bounds[0], 0, bounds[0] + 16, 32))
            require(im.getbbox(), 'Empty frame has no proposed art identity')
            frames[rid] = im
            ids.append(rid)
            bbox = im.getbbox()
            candidates.append({'id': rid, 'sourceStrip': sid(path), 'sourceFrameIndex': order,
                               'sourceRect': bounds, 'frameDimensions': [16, 32],
                               'alphaVisibleRect': [bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]],
                               'normalizedRgbaSHA256': sha(im.tobytes()), 'actionHypothesis': action,
                               'identity': field('brown hinged door animation frame', 'Handled rectangular panel with an upper inset; turning/narrowing panel in first strip, closed-panel shifts in second.'),
                               'staticOccurrences': [], 'namedExportAliases': [], 'packedOccurrences': [],
                               'alphaTightExportCounterparts': [],
                               'duplicateFrameIds': [], 'humanApproval': 'unregistered',
                               'gameplayGeometry': {k: None for k in ['anchor', 'footprint', 'collision', 'walkability', 'height']}})
        sequences.append({'id': 'A01:' + action, 'memberRecords': ids, 'sourceOrder': 'left-to-right strip frame indexes; 16x32 untrimmed source frames',
                          'logicalAnimationIdentity': field('door opening progression' if action == 'opening' else 'closed door perturbation / locked-attempt demonstration',
                              'Pixels progressively turn/narrow the panel.' if action == 'opening' else 'Panel remains closed; edge/inset/handle shifts. The filename supplies locked context, not gameplay mechanics.',
                              alternatives=[] if action == 'opening' else ['closed-door shake', 'failed opening attempt']),
                          'proposedPlaybackOrder': ids, 'orderStatus': 'source-order proposal; companion GIF comparison separately recorded',
                          'gameplayPlayback': {'frameDurationsMs': None, 'loop': None, 'trigger': None, 'reverseClosing': None, 'lockMechanics': None},
                          'humanApproval': 'unregistered'})

    # Search every fitting source-pixel origin; source theme names never substitute
    # for exact pixel identity. Room Builder remains a distinct master domain.
    domain_groups = {'interiors-master', 'interiors-room-builder-master', 'interiors-theme-normal',
                     'interiors-theme-black-shadow', 'interiors-theme-shadowless'}
    domains = sorted(path for path, row in inventory.items() if row['scopeGroup'] in domain_groups)
    for path in domains:
        matcher = MATCH.Matcher(read(path), grid=1)
        for record in candidates:
            for bounds in matcher.find(frames[record['id']]):
                record['staticOccurrences'].append({'sourceId': sid(path), 'rect': bounds, 'lineage': 'exact-whole-frame-normalized-RGBA',
                                                    'domain': inventory[path]['scopeGroup']})
    singles = [e for e in index['entries'] if e['sourceKind'] == 'single']
    same_size = [e for e in singles if e['sourceRect'][2:] == [16, 32]]
    frame_hashes = {r['normalizedRgbaSHA256'] for r in candidates}
    alias_pool = {}
    corpus = []
    for entry in same_size:
        path = entry['sourcePath']
        im = read(path)
        rect = entry['sourceRect']
        x, y, w, h = rect
        crop = im.crop((x, y, x + w, y + h))
        digest = sha(crop.tobytes())
        corpus.append([entry['key'], path, sources[sid(path)]['fileSHA256'], rect, digest])
        if digest in frame_hashes:
            alias_pool.setdefault(digest, []).append(entry)
    body_hashes = {r['id']: sha(frames[r['id']].crop(frames[r['id']].getbbox()).tobytes()) for r in candidates}
    body_pool, body_corpus = {}, []
    for entry in singles:
        path = entry['sourcePath']
        im = read(path)
        x, y, w, h = entry['sourceRect']
        exported = im.crop((x, y, x + w, y + h))
        bbox = exported.getbbox()
        if not bbox:
            continue
        tight = exported.crop(bbox)
        digest = sha(tight.tobytes())
        body_corpus.append([entry['key'], path, sources[sid(path)]['fileSHA256'], list(tight.size), digest])
        if digest in body_hashes.values():
            body_pool.setdefault((tuple(tight.size), digest), []).append((entry, list(bbox)))
    # Preserve exact selected aliases; retain the complete examined corpus identity
    # without ballooning the proposal into a new semantic assignment for all PNGs.
    keep = {sid(path) for path in domains} | {sid(path) for _, path, _ in STRIPS}
    for record in candidates:
        for entry in alias_pool.get(record['normalizedRgbaSHA256'], []):
            keep.add(sid(entry['sourcePath']))
            record['namedExportAliases'].append({'sourceId': sid(entry['sourcePath']), 'sourceRect': entry['sourceRect'],
                                                 'packedKey': entry['key'], 'packedRect': entry['rect'],
                                                 'renderVariant': entry['variant'], 'theme': entry['theme']})
    for record in candidates:
        tight = frames[record['id']].crop(frames[record['id']].getbbox())
        for entry, bbox in body_pool.get((tight.size, body_hashes[record['id']]), []):
            keep.add(sid(entry['sourcePath']))
            ax, ay, _, _ = entry['rect']
            record['alphaTightExportCounterparts'].append({'sourceId': sid(entry['sourcePath']),
                'sourceExportRect': entry['sourceRect'], 'sourceAlphaBBoxXYXY': bbox,
                'packedKey': entry['key'], 'packedExportRect': entry['rect'],
                'packedAlphaRect': [ax + bbox[0], ay + bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]],
                'exactAlphaTightRgbaSHA256': body_hashes[record['id']], 'renderVariant': entry['variant'],
                'lineage': 'exact-alpha-tight-body; export padding/frame differs unless whole-frame alias also listed',
                'limit': 'Only the untrimmed PNG frame stays the temporal record. This body match is not full-frame equality or world-placement geometry.'})
    atlas = read(ATLAS)
    keep.add(sid(ATLAS))
    packed_matcher = MATCH.Matcher(atlas, grid=1)
    for record in candidates:
        record['packedOccurrences'] = packed_matcher.find(frames[record['id']])
        for alias in record['namedExportAliases']:
            x, y, w, h = alias['packedRect']
            require(sha(atlas.crop((x, y, x + w, y + h)).tobytes()) == record['normalizedRgbaSHA256'], 'Packed alias pixels differ')
        for alias in record['alphaTightExportCounterparts']:
            x, y, w, h = alias['packedAlphaRect']
            require(sha(atlas.crop((x, y, x + w, y + h)).tobytes()) == alias['exactAlphaTightRgbaSHA256'], 'Packed alpha-tight counterpart differs')
        record['duplicateFrameIds'] = [other['id'] for other in candidates if other['id'] != record['id'] and other['normalizedRgbaSHA256'] == record['normalizedRgbaSHA256']]
        record['primaryStaticLineage'] = 'exact-static-master-counterpart' if any(o['domain'] == 'interiors-master' for o in record['staticOccurrences']) else 'animation-original-only-in-searched-static-domains'

    gif_evidence = []
    for sequence, (_, png_path, count) in zip(sequences, STRIPS):
        gif_path = png_path.replace('/spritesheets/', '/gif/').replace('.png', '.gif')
        read(gif_path, supporting=True)
        keep.add(sid(gif_path))
        gif = Image.open(ROOT / gif_path)
        observations = []
        for n in range(gif.n_frames):
            gif.seek(n)
            im = MATCH.normalized(gif.convert('RGBA'))
            digest = sha(im.tobytes())
            matches = [rid for rid in sequence['memberRecords'] if sha(frames[rid].tobytes()) == digest]
            observations.append({'decodedFrameIndex': n, 'normalizedRgbaSHA256': digest, 'durationMs': gif.info.get('duration'),
                                 'exactSourceFrameIds': matches,
                                 'deltaToSameIndexPngFrame': frame_delta(im, frames[sequence['memberRecords'][n]]) if n < len(sequence['memberRecords']) and im.size == (16, 32) else None,
                                 'decoderDisposalMethod': getattr(gif, 'disposal_method', None)})
        gif_evidence.append({'id': sequence['id'] + ':GIF', 'sourceId': sid(gif_path), 'frameDimensions': list(gif.size),
                             'decodedFrameCount': gif.n_frames, 'loopExtension': gif.info.get('loop'),
                             'loopMeaning': '0 means indefinite repeat in this source demonstration only',
                             'frames': observations, 'demonstrationCycleDurationMs': sum(o['durationMs'] for o in observations) if all(o['durationMs'] is not None for o in observations) else None,
                             'scope': 'Companion GIF demonstration, not a runtime timing/loop/trigger contract. Opening demonstration resets to closed; it supplies no closing sequence.'})
        sequence['companionGifEvidence'] = gif_evidence[-1]['id']
        sequence['adjacentSourceFrameDeltas'] = [{'members': [a, b], **frame_delta(frames[a], frames[b])}
                                                for a, b in zip(sequence['memberRecords'], sequence['memberRecords'][1:])]

    packet = {'schemaVersion': 1, 'packetId': 'A01', 'proposalRevision': 1, 'state': 'agent-proposal',
              'coordinates': {'origin': 'top-left', 'unit': 'native16 pixels', 'rect': '[x,y,width,height]; half-open',
                              'alphaDeltaBounds': '[left,top,right,bottom]; half-open', 'packedCoordinates': 'separate packed-atlas pixel space'},
              'pins': {'sourceLedger': {'path': LEDGER, 'sha256': LEDGER_PIN}, 'packedIndex': {'path': INDEX, 'sha256': INDEX_PIN},
                       'matcherImplementation': {'path': MATCH_SCRIPT, 'sha256': sha((ROOT / MATCH_SCRIPT).read_bytes())}},
              'scope': {'strips': [p for _, p, _ in STRIPS], 'sourceRecordCount': 9, 'logicalActionProposals': 2,
                        'logicalObjectFamilyProposal': 1, 'supportingGifSources': 2,
                        'exclusions': ['other door colors/facings', 'other animations', 'gameplay door/lock rules', 'source repacking', 'human approval']},
              'initialObservations': 'Unlabeled source pixels were enlarged and viewed before detailed labels/comparison. A brown handled inset panel becomes successively narrower/turned in the first strip. The second strip retains a closed panel with small edge/inset/handle shifts. Frame margins remain transparent and untrimmed; transparent source margins are not world-placement geometry.',
              'sources': [sources[k] for k in sorted(keep)], 'candidates': candidates,
              'sequences': sequences, 'sourceGifDemonstrations': gif_evidence,
              'matching': {'algorithm': 'semantic-map-match.py Matcher(grid=1), exact complete normalized RGBA verification',
                           'sheetDomains': [sid(p) for p in domains], 'packedAtlasDomain': sid(ATLAS),
                           'namedAliasCorpus': {'indexSingles': len(singles), 'sameSizeExportsRead': len(same_size),
                                                'columns': ['packedKey', 'sourcePath', 'sourceFileSHA256', 'sourceRect', 'normalizedFrameSHA256'],
                                                'sortedCorpusSHA256': sha(json.dumps(sorted(corpus), separators=(',', ':')).encode())},
                           'alphaTightAliasCorpus': {'allIndexedSinglesRead': len(singles), 'nonemptyExportCount': len(body_corpus),
                               'columns': ['packedKey', 'sourcePath', 'sourceFileSHA256', 'alphaTightDimensions', 'normalizedAlphaTightSHA256'],
                               'sortedCorpusSHA256': sha(json.dumps(sorted(body_corpus), separators=(',', ':')).encode()),
                               'limit': 'Exact normalized alpha-tight body comparisons with independent packed-body crop verification; padding/frame difference is retained, not renamed a whole-export alias.'},
                           'limit': 'No exact frame match excludes only this full untrimmed rectangle within the declared static sheets/atlas and indexed same-size singles. No absence claim for occlusion, alternate padding, clipped art or different pixel states.'},
              'topology': {'sourceFramesAreAssemblyParts': False, 'standaloneEligibility': 'unknown; animated door visual state does not establish independent world placement',
                           'limit': 'A sprite frame is a temporal state, not a spatial piece to concatenate. World opening/collision/anchor remain unknown.'},
              'coverage': {'sourceRecordCount': len(candidates), 'distinctFramePixels': len({r['normalizedRgbaSHA256'] for r in candidates}),
                           'masterOccurrenceCount': sum(o['domain'] == 'interiors-master' for r in candidates for o in r['staticOccurrences']),
                           'staticThemeOccurrenceCount': sum('theme' in o['domain'] for r in candidates for o in r['staticOccurrences']),
                           'uniqueStaticSourceRectangles': len({(o['sourceId'], tuple(o['rect'])) for r in candidates for o in r['staticOccurrences']}),
                           'animationOriginalOnlyRecordCount': sum(r['primaryStaticLineage'] == 'animation-original-only-in-searched-static-domains' for r in candidates),
                           'namedExportAliasCount': sum(len(r['namedExportAliases']) for r in candidates),
                           'alphaTightExportCounterpartCount': sum(len(r['alphaTightExportCounterparts']) for r in candidates),
                           'packedPixelOccurrenceCount': sum(len(r['packedOccurrences']) for r in candidates),
                           'semanticExhaustiveness': 'one bounded door family; no full animation, source-group or pack completion'},
              'review': {'independent': 'pending separate exact-hash artifact', 'human': 'unregistered; no approval or promotion'},
              'reproduce': {'check': 'python3 scripts/semantic-map-animation.py --check',
                            'capture': 'python3 scripts/semantic-map-animation.py --check --capture-dir /tmp/tilefun-semantic-A01'}}
    if capture_dir:
        capture_dir.mkdir(parents=True, exist_ok=True)
        canvas = Image.new('RGB', (5 * 160, 2 * 230), (233, 230, 222))
        draw = ImageDraw.Draw(canvas)
        for row, seq in enumerate(sequences):
            for column, rid in enumerate(seq['memberRecords']):
                x, y = column * 160, row * 230
                draw.text((x + 8, y + 8), f'{rid} source {column}', fill='black')
                im = frames[rid].resize((96, 192), Image.Resampling.NEAREST)
                canvas.paste(im, (x + 16, y + 28), im)
        canvas.save(capture_dir / 'frames.png')
        counterpart = next(o for o in candidates[0]['staticOccurrences'] if o['domain'] == 'interiors-master')
        master = images[sources[counterpart['sourceId']]['path']]
        x, y, _, _ = counterpart['rect']
        context = master.crop((max(0, x - 16), max(0, y - 32), min(master.width, x + 112), min(master.height, y + 80)))
        context.resize((context.width * 4, context.height * 4), Image.Resampling.NEAREST).save(capture_dir / 'static-context.png')
    return packet


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--capture-dir', type=Path)
    args = parser.parse_args()
    try:
        result = encoded(build(args.capture_dir))
        if args.check:
            require(OUTPUT.read_bytes() == result, 'A01 frozen proposal differs from source replay')
        else:
            require(not OUTPUT.exists(), 'Existing A01 proposal is frozen; do not overwrite it')
            OUTPUT.write_bytes(result)
        print(json.dumps({'ok': True, 'proposalSHA256': sha(result), 'coverage': json.loads(result)['coverage']}, sort_keys=True))
        return 0
    except (ValueError, KeyError, OSError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}, sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
