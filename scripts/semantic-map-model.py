#!/usr/bin/env python3
"""Read-only versioned semantic adapters (P01/P02/P03, E01/I01, RB01/E03/A01).

Default writes only semantic-model.json. --check never writes and emits stable JSON;
--summary prints a human summary. Full validation requires ignored originals.
--committed-only permits absent assets/ files, but never absent committed references
or present-file hash drift. Pillow is required. No approval or runtime bank is made.
"""
import argparse
from collections import Counter
import copy
import hashlib
import json
import re
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLAN = 'docs/tactical/053-semantic-tileset-map'
OUTPUT = ROOT / PLAN / 'semantic-model.json'
PINS = {
    'A01-animation-review.md': '7ee15c2663c88f4e7aded23d9f8023b8fc0203264f77527617fbd265fbfe9dce',
    'A01-animation.json': 'f0e5f627c4e8fe27c5de9c83c5b2ba98d60f273fd7361be07a914563a49e9f0c',
    'E03-playground-tubes-review.md': 'ab901c1a2859661332b15187060a3c38d3ad1e7d04ed69656128e83f49f8df88',
    'E03-playground-tubes.json': '4370a63a1308b9ccc844029bfe077bb304faac2e62826923c3ba5a685508143e',
    'RB01-room-builder-path-arch-review.md': '31461d71cb25c1fa5eb9c4287dc2df4f2ca491a6e26367a21d69153f22821601',
    'RB01-room-builder-path-arch.json': '88f2ebcf7f7509e3da1337f9e1bd2dde087f6b342e245f478fb94ddc07b2b6c4',
    'I01-interior-sofas.json': '75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df',
    'I01-interior-sofas-review.md': '1b93f7b2b438eb4f74f3e01f898b746bd5f0f7a5a36eb48e4b23f7651cc256fb',
    'E01-outdoor-seating.json': '9562c3956611af40245966284ad5614bbff9a7c11a07fac78c9b9a6a5c5bd62b',
    'E01-outdoor-seating-review.md': '5b85986b906910e857549c7528b33ef70b995fb7c5ec7276d1e65a01d6ee1ef0',
    'P01-trees.json': '3df0e42f9012644afe5cd1233f604b5dd74ec05c4c4f26253834dc2a05281ff6',
    'P02-scrapyard.json': '429d796ec87adb007a4febc267fabff14c1032cd197dc47ed50d729f65073957',
    'P03-cabinets.json': 'c22f7b16e24816a231883bad04cd29e43eac2ce81f09f444d4bc5ffad7875254',
    'P03-cabinets-topology.json': '409461fce1bb0eccb866569140ab2c17bdc7040940fb9ea359668d4fe93dcfc3',
    'P01-trees-review.md': '91e950cc52b1192608c8811141ab0b42f69f916c24f94694e4022871131d8b36',
    'P02-scrapyard-review.md': 'a05de021a8524e4f9fd6510dc517241567845bdf36ad936d7c24ba80bbcfcee3',
    'P03-cabinets-review.md': 'd785fad5cd8629d31ee1781287f5b1fbc9f50ea8d2af8a2d02adf221f18f7465',
}
INVENTORY_PIN = 'c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda'
RECONCILIATION_PIN = '4ed2e895cacdbead064ed184ec5215bc0bf71dd81a824ad7480c8ed958c7e9a1'
EXTERIORS = 'public/assets/tilesets/me-complete.png'
CATALOG = 'public/data/modern-interiors-atlas.json'
NORMALIZATION = 'RGBA bytes row-major; RGB=0 where alpha=0; translucent RGBA unchanged'
PILOT_ACCOUNTING = {'P01': {'records': 29, 'proposals': 29, 'direct': 21, 'composed': 8, 'derived': 0},
                    'P02': {'records': 29, 'proposals': 29, 'direct': 29, 'composed': 0, 'derived': 0},
                    'P03': {'records': 27, 'proposals': 9, 'direct': 8, 'composed': 1, 'derived': 18}}
PACKET_ACCOUNTING = {**PILOT_ACCOUNTING, 'E01': {'records': 27, 'proposals': 27, 'direct': 25, 'composed': 0, 'derived': 0, 'original-only': 2}, 'I01': {'records': 20, 'proposals': 18, 'direct': 18, 'derived': 2}}
PACKET_ACCOUNTING.update({'RB01': {'records': 25, 'proposals': 25, 'direct': 22, 'subfile-only': 3}, 'E03': {'records': 25, 'proposals': 25, 'direct': 25}, 'A01': {'records': 9, 'proposals': 2, 'temporal-frame': 9}})
GEOMETRY = {k: 'unknown' for k in ('anchor', 'footprint', 'collision', 'walkability', 'height')}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + '\n').encode()


def revision(value):
    return sha(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode())


def load(path):
    return json.loads(path.read_text())


def repo_path(root, path):
    require(isinstance(path, str) and not Path(path).is_absolute(), f'Invalid repository path: {path}')
    resolved = (root / path).resolve()
    require(resolved.is_relative_to(root.resolve()), f'Path escapes repository: {path}')
    return resolved


def normalized(im):
    im = im.convert('RGBA')
    raw = bytearray(im.tobytes())
    for i in range(0, len(raw), 4):
        if raw[i + 3] == 0:
            raw[i:i + 3] = bytes(3)
    return Image.frombytes('RGBA', im.size, bytes(raw))


def pixel_hash(im):
    return sha(normalized(im).tobytes())


def rect(value, space, kind='exported-frame', encoding='xywh'):
    return {'kind': kind, 'coordinateSpace': space, 'encoding': encoding,
            'halfOpen': True, 'value': value}


def xywh(bounds):
    values = bounds['value']
    require(bounds['halfOpen'] is True and bounds['encoding'] in ('xywh', 'xyxy'),
            'Bounds require explicit half-open encoding')
    require(len(values) == 4 and all(type(v) is int for v in values), 'Bounds need four integers')
    x, y, a, b = values
    w, h = (a, b) if bounds['encoding'] == 'xywh' else (a - x, b - y)
    require(x >= 0 and y >= 0 and w > 0 and h > 0, f'Invalid bounds: {values}')
    return x, y, w, h


def check_bounds(bounds, dimensions):
    x, y, w, h = xywh(bounds)
    require(x + w <= dimensions[0] and y + h <= dimensions[1],
            f'Bounds outside {dimensions}: {bounds}')
    return x, y, w, h


def crop(im, bounds):
    x, y, w, h = check_bounds(bounds, im.size)
    return im.crop((x, y, x + w, y + h))


def counterpart_signature(im, variant):
    raw = bytearray(normalized(im).tobytes())
    for i in range(0, len(raw), 4):
        p = tuple(raw[i:i + 4])
        if (variant == 'normal' and p == (167, 151, 150, 255)) or (
                variant == 'black-shadow' and p == (58, 58, 80, 100)):
            raw[i:i + 4] = bytes(4)
        elif p == (248, 248, 248, 255):
            raw[i:i + 4] = bytes((255, 255, 255, 255))
    return sha(raw)


def pixels(im):
    raw = im.tobytes()
    return [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]


def difference(a, b):
    require(a.size == b.size, 'Variant frames differ')
    changes = [(i % a.width, i // a.width, p, q)
               for i, (p, q) in enumerate(zip(pixels(a), pixels(b))) if p != q]
    body = [p for p in changes if p[3][3] > 0]
    outside = [p for p in changes if p[3][3] == 0]
    bbox = ([min(p[0] for p in changes), min(p[1] for p in changes),
             max(p[0] for p in changes) + 1, max(p[1] for p in changes) + 1] if changes else None)
    return {'differentPixels': len(changes), 'differenceBBoxXYXY': bbox,
            'onReferenceBodyPixels': len(body), 'outsideReferenceBodyPixels': len(outside),
            'bodyColorChanges': sorted({str((p[2], p[3])) for p in body}),
            'outsideColorChanges': sorted({str((p[2], p[3])) for p in outside})}


def seating_delta(a, b):
    require(a.size == b.size, 'E01 variant comparison frames differ')
    ar, br = a.tobytes(), b.tobytes()
    mask = bytes(255 if ar[i:i + 4] != br[i:i + 4] else 0 for i in range(0, len(ar), 4))
    changed = [i for i, value in enumerate(mask) if value]
    bbox = ([min(i % a.width for i in changed), min(i // a.width for i in changed),
             max(i % a.width for i in changed) + 1, max(i // a.width for i in changed) + 1] if changed else None)
    alpha_changes = sum(ar[i] != br[i] for i in range(3, len(ar), 4))
    return {'size': list(a.size), 'leftNormalizedRgbaSHA256': sha(ar), 'rightNormalizedRgbaSHA256': sha(br),
            'rgbaChangedPixels': len(changed), 'alphaChangedPixels': alpha_changes,
            'alphaMaskEqual': alpha_changes == 0, 'changedBoundsXYXY': bbox,
            'changedMaskSHA256': sha(mask), 'exactEqual': ar == br}


def table_dispositions(text, ids):
    """Read explicit Markdown table rows, preserving every cell and qualification."""
    rows = {}
    for line in text.splitlines():
        if line.startswith('|'):
            cells = [s.strip() for s in line.strip().strip('|').split('|')]
            if cells[0] in ids:
                require(cells[0] not in rows, f'Duplicate review disposition: {cells[0]}')
                rows[cells[0]] = {'memberId': cells[0], 'disposition': cells[1], 'qualifications': cells[2:]}
    require(set(rows) == set(ids), f'Missing explicit review dispositions: {set(ids) - set(rows)}')
    return [rows[key] for key in ids]


def field(value=None, evidence='Not established by this packet.', confidence=None, alternatives=None):
    return {'value': value, 'confidence': confidence, 'evidence': evidence,
            'alternatives': alternatives or [], 'disposition': 'unknown' if value is None else 'proposed'}


def fields_from(raw):
    result = copy.deepcopy(raw)
    for value in result.values():
        if isinstance(value, dict):
            value.setdefault('alternatives', [])
            value['disposition'] = 'unknown' if value.get('value') is None else 'proposed'
    return result


EXPANSION_PACKETS = {
    'RB01': ('RB01-room-builder-path-arch', 2, 25, 25),
    'E03': ('E03-playground-tubes', 2, 25, 25),
    'A01': ('A01-animation', 1, 9, 2),
}


def expansion_adapters(root, source, files, pins, records, proposals, relations, reviews, packets):
    """Explicit frozen RB01/E03/A01 adapters; no schema inference or approval."""
    for pid, (name, version, count, units) in EXPANSION_PACKETS.items():
        path = f'{PLAN}/packets/{name}.json'
        review_path = f'{PLAN}/packets/{name}-review.md'
        packet, text = load(root / path), (root / review_path).read_text()
        require((packet['schemaVersion'], packet['packetId'], packet['proposalRevision']) ==
                (version, pid, 1), f'Unsupported {pid} adapter version')
        require(PINS[name + '.json'] in text, f'{pid} review applicability mismatch')
        sources = {}
        for item in packet['sources']:
            sf = source(item['path'], item.get('pngSHA256', item.get('fileSHA256')),
                        item.get('size', item.get('dimensions')))
            files[sf]['normalizedPixelSha256'] = item['normalizedRgbaSHA256']
            if sf.endswith('.gif'):
                files[sf]['inventoryRole'] = 'supporting-GIF-outside-PNG-inventory'
            sources[item['id']] = sf
        for pin in packet['pins'].values():
            require(sha(repo_path(root, pin['path']).read_bytes()) == pin['sha256'], f'{pid} input pin drift')
            pins[pin['path']] = pin['sha256']
        ids = [c['id'] for c in packet['candidates']]
        dispositions = table_dispositions(text, ids)
        if pid == 'A01':
            for disposition in dispositions:
                disposition['sourceIndexLabel'] = disposition['disposition']
                disposition['disposition'] = disposition['qualifications'][0]
                disposition['qualifications'] = ['Retained temporal source occurrence; no gameplay contract.']
        master_id = packet['matching']['sheetDomains'][0]
        for candidate, disposition in zip(packet['candidates'], dispositions):
            uid = candidate['id']
            bounds = candidate.get('sourceRect', candidate.get('exportRect'))
            sid = candidate.get('primarySourceId', candidate.get('sourceStrip'))
            refs = [{'sourceFile': sources[sid], 'bounds': rect(bounds, 'source-file-pixels')}]
            aliases = []
            if pid == 'RB01':
                for alias in candidate['packedTileAliases'] + candidate['packedSheetOffsetAliases']:
                    refs.append({'sourceFile': sources[alias['sourceId']],
                                 'bounds': rect(alias['rect'], 'packed-atlas-pixels', 'packed-alias'),
                                 'packedAliasEvidence': alias, 'catalogFile': packet['pins']['packedIndex']['path'],
                                 'aliasSourceFile': sources[alias['originalSourceId']],
                                 'aliasSourceBounds': rect(alias['originalSourceRect'], 'source-file-pixels')})
            elif pid == 'E03':
                refs = [{'sourceFile': sources[a], 'bounds': rect(bounds, 'source-file-pixels')}
                        for a in candidate['namedExportAliases']]
            else:
                alias_path = 'public/assets/semantic-sources/' + (
                    'interiors-door-1.png' if candidate['actionHypothesis'] == 'opening' else 'interiors-door-1-locked.png')
                source(alias_path, files[sources[sid]]['sha256'], files[sources[sid]]['dimensions'])
                files[alias_path]['normalizedPixelSha256'] = files[sources[sid]]['normalizedPixelSha256']
                aliases = [{'sourceFile': alias_path, 'bounds': rect(bounds, 'source-file-pixels', 'integration-alias'),
                            'originSourceFile': sources[sid], 'lineage': 'byte-identical-copy-of-pinned-strip'}]
            occurrences = []
            for occurrence in candidate.get('occurrences', candidate.get('staticOccurrences', [])):
                ref = {'sourceFile': sources[occurrence['sourceId']],
                       'bounds': rect(occurrence['rect'], 'source-file-pixels'), 'lineage': occurrence['lineage']}
                if pid == 'E03' and occurrence['sourceId'] == master_id:
                    source(EXTERIORS, files[sources[master_id]]['sha256'], files[sources[master_id]]['dimensions'])
                    ref['aliasFile'] = EXTERIORS
                occurrences.append(ref)
            direct = any(o['sourceId'] == master_id for o in candidate.get('occurrences', []))
            lineage = ('temporal-frame' if pid == 'A01' else 'direct' if direct else 'subfile-only')
            record = {'id': uid, 'packetId': pid, 'sourceId': uid,
                      'sourceKind': 'temporal-animation-frame' if pid == 'A01' else 'source-component',
                      'primaryLineage': lineage, 'lineageDomain': 'temporal-strip' if pid == 'A01' else 'pinned-original-master',
                      'sourceIdentity': 'exact-pinned-frame-crop', 'frameDimensions': bounds[2:],
                      'normalizedPixelSha256': candidate['normalizedRgbaSHA256'], 'references': refs,
                      'occurrences': occurrences, 'integrationAliases': aliases,
                      'bounds': [rect([0, 0, *bounds[2:]], 'record-local-pixels'),
                                 rect(candidate['alphaVisibleRect'], 'record-local-pixels', 'alpha-visible')],
                      'independentDisposition': disposition, 'originalEvidence': candidate,
                      'searchEvidence': packet['matching']}
            if pid == 'A01':
                record.update(sourceFrameIndex=candidate['sourceFrameIndex'],
                              duplicateFrameIds=candidate['duplicateFrameIds'], staticLineage=candidate['primaryStaticLineage'])
            else:
                record['topology'] = candidate['topology']
                fields = fields_from(candidate['fields'])
                proposals.append({'id': uid, 'packetId': pid, 'members': [uid], 'unitType': 'source-component-proposal',
                                  'fields': fields, 'identity': fields['identity'], 'family': fields['family'],
                                  'componentRole': fields['role'], 'variant': fields['variant'], 'facing': fields['facing'],
                                  'topology': candidate['topology'], 'gameplayGeometry': GEOMETRY.copy(),
                                  'alternatives': fields['identity']['alternatives'], 'state': 'proposed', 'humanApproval': 'unregistered'})
            records.append(record)
        relations.append({'id': pid + ':search-domain', 'packetId': pid, 'kind': 'expansion-search-domain',
                          'members': ids, 'sources': [sources[s] for s in packet['matching']['sheetDomains']],
                          'originalEvidence': packet['matching'], 'limit': 'Listed correspondences replayed; exhaustive absence scans are not repeated by this adapter.'})
        if pid == 'A01':
            for sequence in packet['sequences']:
                proposals.append({'id': sequence['id'], 'packetId': pid, 'members': sequence['memberRecords'],
                                  'unitType': 'temporal-action-sequence', 'identity': sequence['logicalAnimationIdentity'],
                                  'family': field('brown-door-animation'), 'componentRole': field('temporal frame sequence; no spatial assembly'),
                                  'variant': field(), 'facing': field(), 'fields': {}, 'gameplayGeometry': GEOMETRY.copy(),
                                  'gameplayPlayback': sequence['gameplayPlayback'], 'alternatives': sequence['logicalAnimationIdentity']['alternatives'],
                                  'state': 'proposed', 'humanApproval': 'unregistered'})
                relations.append({'id': sequence['id'] + ':source-order', 'packetId': pid, 'kind': 'temporal-sequence',
                                  'members': sequence['memberRecords'], 'originalEvidence': sequence})
            for demo in packet['sourceGifDemonstrations']:
                relations.append({'id': demo['id'], 'packetId': pid, 'kind': 'supporting-GIF-demonstration',
                                  'members': [frame['exactSourceFrameIds'][0] for frame in demo['frames']],
                                  'sourceFile': sources[demo['sourceId']], 'originalEvidence': demo,
                                  'limit': 'Source demonstration timing and loop only; gameplay playback remains unknown.'})
            probe_dispositions = []
        else:
            experiments = packet['assemblyExperiments'] if pid == 'RB01' else packet['experiments']['assemblies']
            # E03 Markdown quotes the IDs; normalize only that syntax before exact row lookup.
            probe_text = text.split('Canonical recipe hashes below')[0] if pid == 'E03' else text
            probe_dispositions = table_dispositions(probe_text.replace('`', ''), [e['id'] for e in experiments])
            for experiment, disposition in zip(experiments, probe_dispositions):
                recipe = experiment['renderRecipe'] if pid == 'RB01' else {
                    k: experiment[k] for k in ('size', 'placements', 'operation')}
                if pid == 'E03':
                    require(revision(recipe) in text, 'E03 independent recipe receipt absent')
                relations.append({'id': pid + ':assembly:' + experiment['id'], 'packetId': pid,
                                  'kind': 'bounded-component-probe', 'members': [p['memberId'] for p in recipe['placements']],
                                  'operation': 'rgba-overwrite' if pid == 'RB01' else 'source-over',
                                  'renderRecipe': recipe, 'renderRecipeSha256': revision(recipe),
                                  'recipeCoordinateSpaces': {'sourceRect': 'record-local-pixels', 'targetOffset': 'probe-canvas-pixels'}, 'sourceFilesById': sources,
                                  'originalEvidence': experiment, 'independentDisposition': disposition,
                                  'humanApproval': 'unregistered', 'limit': 'Frozen finite layout only; no arbitrary compatibility validator.'})
            if pid == 'RB01':
                for experiment in packet['contextExperiments']:
                    relations.append({'id': pid + ':context:' + experiment['id'], 'packetId': pid,
                                      'kind': 'context-only-probe', 'members': [], 'operation': 'rgba-overwrite',
                                      'renderRecipe': experiment['renderRecipe'], 'sourceFilesById': sources,
                                      'originalEvidence': experiment, 'independentDisposition': {
                                          'disposition': 'Supported context only; not the fixed stone-frame body',
                                          'qualifications': ['Review context probes section; no additional semantic members.']}})
                relations.append({'id': pid + ':shadow-delta', 'packetId': pid, 'kind': 'master-subfile-alpha-difference',
                                  'members': [], 'sourceFilesById': sources, 'originalEvidence': packet['variantExperiments'][0]})
            else:
                for i, comparison in enumerate(packet['experiments']['comparisons']):
                    relations.append({'id': f'{pid}:comparison:{i}', 'packetId': pid, 'kind': 'component-pixel-comparison',
                                      'members': comparison['members'], 'originalEvidence': comparison})
                supplemental_rows = [line for line in text.splitlines() if line.startswith('|') and
                                     any(label in line for label in ('Rounded upward end:', 'Upper mouth branch:', 'Rounded upper branch:', 'Right-collar repeat:', 'Left-collar repeat:'))]
                require(len(supplemental_rows) == 5, 'E03 supplemental review scope drift')
                for row in supplemental_rows:
                    cells = [cell.strip() for cell in row.strip('|').split('|')]
                    label = cells[0].split(':')[0]
                    placements = [{'memberId': f'E03-{int(n):02}', 'offsetXY': [int(x), int(y)]}
                                  for n, x, y in re.findall(r'(\d+)@\((\d+),(\d+)\)', cells[0])]
                    require(len(placements) == 3, 'E03 supplemental recipe scope differs')
                    recipe = {'size': [64, 80], 'placements': placements,
                              'operation': 'Pillow RGBA alpha_composite in listed order; no scaling'}
                    require(revision(recipe) in text, 'E03 supplemental recipe receipt absent')
                    relations.append({'id': pid + ':reviewer:' + label.lower().replace(' ', '-'), 'packetId': pid,
                                      'kind': 'supplemental-component-review-probe', 'members': [p['memberId'] for p in placements],
                                      'operation': 'source-over', 'renderRecipe': recipe, 'renderRecipeSha256': revision(recipe),
                                      'originalEvidence': {'row': row, 'label': label, 'observation': cells[1],
                                                           'normalizedRgbaSHA256': cells[2].strip('`')},
                                      'independentDisposition': {'disposition': 'Supplemental bounded observation', 'qualifications': [cells[1]]},
                                      'source': review_path, 'humanApproval': 'unregistered',
                                      'limit': 'Reviewer challenge only; no update to frozen eight-probe tested-neighbor matrix.'})
        sr = [r for r in records if r['packetId'] == pid]
        pr = [p for p in proposals if p['packetId'] == pid]
        require((len(sr), len(pr)) == (count, units), f'{pid} count drift')
        reviews.append({'id': pid + ':independent-review', 'packetId': pid, 'kind': 'agent-review',
                        'proposalPath': path, 'proposalSha256': PINS[name + '.json'], 'proposalRevision': 1,
                        'sourcePins': [files[p] for p in sorted(set(sources.values()) | {a['sourceFile'] for r in sr for a in r['integrationAliases']})],
                        'sourceScope': 'All frozen packet source pins; integration copies separately pinned. GIFs support playback evidence outside PNG inventory.',
                        'memberRecords': ids, 'proposalUnits': [p['id'] for p in pr],
                        'applicability': 'exact-proposal-hash-and-member-records-only', 'reviewPath': review_path,
                        'reviewSha256': PINS[name + '-review.md'], 'recordDispositions': dispositions,
                        'proposalDispositions': dispositions if pid != 'A01' else [
                            {'memberId': p['id'], 'disposition': 'Supported bounded action sequence',
                             'qualifications': ['Source sequence and GIF demonstration only; gameplay timing/trigger/lock mechanics unknown.']} for p in pr],
                        'probeDispositions': probe_dispositions, 'originalText': text,
                        'observationOrder': 'See exact frozen independent review; not formally blinded.',
                        'humanApproval': 'unregistered', 'runtimePromotion': False})
        packets.append({'id': pid, 'proposalPath': path, 'proposalSha256': PINS[name + '.json'],
                        'revision': 1, 'sourceRecordCount': count, 'proposalUnitCount': units,
                        'proposalUnitDefinition': 'two action sequences, not nine spatial pieces' if pid == 'A01' else 'one frozen named component crop per proposal; no unique-object claim',
                        'state': 'proposed', 'coverageLimit': packet['coverage'],
                        'originalContext': {k: v for k, v in packet.items() if k not in ('candidates', 'sources')}})


def build_model(root=ROOT):
    """Pure adapter output is stable across full and committed-only installations."""
    packet_dir = root / PLAN / 'packets'
    pins = {f'{PLAN}/packets/{name}': digest for name, digest in PINS.items()}
    pins[f'{PLAN}/source-files.json'] = INVENTORY_PIN
    pins[f'{PLAN}/notes/2026-10-04-pilot-reconciliation.md'] = RECONCILIATION_PIN
    for path, digest in pins.items():
        require(sha(repo_path(root, path).read_bytes()) == digest, f'Frozen input hash drift: {path}')
    trees = load(packet_dir / 'P01-trees.json')
    scrap = load(packet_dir / 'P02-scrapyard.json')
    cabinets = load(packet_dir / 'P03-cabinets.json')
    topology = load(packet_dir / 'P03-cabinets-topology.json')
    seating = load(packet_dir / 'E01-outdoor-seating.json')
    sofas = load(packet_dir / 'I01-interior-sofas.json')
    require(sofas['schemaVersion'] == 2 and sofas['packetId'] == 'I01' and sofas['proposalRevision'] == 1, 'Unsupported I01 adapter version')
    require(seating['schemaVersion'] == 2 and seating['packetId'] == 'E01' and seating['proposalRevision'] == 1, 'Unsupported E01 adapter version')
    inventory = load(root / PLAN / 'source-files.json')
    inventory = {row[0]: dict(zip(inventory['columns'], row)) for row in inventory['files']}
    files, records, proposals, relations, reviews, packets = {}, [], [], [], [], []

    def source(path, digest, dimensions=None):
        inv = inventory.get(path)
        if inv:
            require(inv['sha256'] == digest, f'Inventory disagrees: {path}')
            dims = [inv['width'], inv['height']]
            require(dimensions is None or dimensions == dims, f'Inventory dimensions disagree: {path}')
            dimensions = dims
        value = {'path': path, 'sha256': digest, 'dimensions': dimensions,
                 'required': not path.startswith('assets/')}
        require(path not in files or all(files[path].get(k) == v for k, v in value.items()), f'Conflicting source pin: {path}')
        files.setdefault(path, value)
        return path

    exterior = source(EXTERIORS, trees['source']['sha256'], [trees['source']['width'], trees['source']['height']])
    original_exterior = source(trees['source']['path'], trees['source']['sha256'])
    # Committed master supplies deterministic P01 image hashes; original target
    # comparison is a separate validation result, never inferred from this replay.
    master_image = normalized(Image.open(root / EXTERIORS))
    image_by_id = {}
    occurrences = {r['id']: r for r in trees['experiments']['occurrences']}
    replacements = {r['result']: r for r in trees['relations'] if r['type'] == 'lower-strip-replacement'}
    raw_trees = {r['id']: r for r in trees['candidates']}
    for r in trees['candidates']:
        key = r['id']
        if key not in replacements:
            where = occurrences[key]['all_pixel_exact_master_occurrences'][0]
            image_by_id[key] = crop(master_image, rect(where, 'source-file-pixels'))
    for key, recipe in replacements.items():
        im = image_by_id[recipe['base']].copy()
        im.paste(image_by_id[recipe['patch']], tuple(recipe['replace_local_rect'][:2]))
        image_by_id[key] = im
    for r in trees['candidates']:
        key, uid = r['id'], 'P01:' + r['id']
        path = source(r['source_path'], r['source_sha256'])
        bounds = rect(r['source_rect'], 'source-file-pixels')
        primary = 'composed' if key in replacements else 'direct'
        occ = [{'sourceFile': original_exterior, 'bounds': rect(o, 'source-file-pixels'),
                'aliasFile': exterior} for o in occurrences[key]['all_pixel_exact_master_occurrences']]
        records.append({'id': uid, 'packetId': 'P01', 'sourceId': key,
                        'sourceKind': r['source_kind'], 'primaryLineage': primary,
                        'frameDimensions': list(image_by_id[key].size),
                        'normalizedPixelSha256': pixel_hash(image_by_id[key]),
                        'references': [{'sourceFile': path, 'bounds': bounds}], 'occurrences': occ,
                        'bounds': [rect([0, 0, *image_by_id[key].size], 'record-local-pixels'),
                                   rect(list(image_by_id[key].getbbox()), 'record-local-pixels', 'alpha-visible', 'xyxy')],
                        'searchEvidence': occurrences[key], 'originalEvidence': r})
        fields = fields_from(r['proposed_fields'])
        # Adopt the reconciliation, retaining the frozen wording in originalEvidence.
        if key.startswith('T'):
            fields['identity']['value'] = 'rounded-canopy tree'
            fields['identity']['evidence'] += ' Coordinator reconciliation: species unknown; prefer rounded-canopy tree.'
        proposals.append({'id': uid, 'packetId': 'P01', 'members': [uid],
                          'unitType': 'whole-sprite' if key.startswith('T') else 'component',
                          'fields': fields, 'identity': fields.get('identity', field()),
                          'family': fields.get('family', field()),
                          'componentRole': fields.get('component_role', field()),
                          'variant': {'palette': fields.get('palette', field()),
                                      'trunkTreatment': fields.get('trunk_treatment', field())},
                          'facing': fields.get('facing', field()), 'gameplayGeometry': GEOMETRY.copy(),
                          'alternatives': [], 'state': 'proposed', 'humanApproval': 'unregistered'})
    for i, r in enumerate(trees['relations']):
        value = {'id': f'P01:R{i + 1:02}', 'packetId': 'P01', 'kind': r['type'], 'originalEvidence': r}
        value['members'] = ['P01:' + x for x in r.get('members', [r[k] for k in ('base', 'patch', 'result') if k in r])]
        if r['type'] == 'lower-strip-replacement':
            base, patch, target = (raw_trees[r[k]] for k in ('base', 'patch', 'result'))
            value['recipe'] = {'operation': 'rgba-overwrite', 'canvasDimensions': [64, 64],
                               'targetRecord': 'P01:' + r['result'],
                               'outputPixelSha256': pixel_hash(image_by_id[r['result']]),
                               'layers': [{'sourceFile': exterior, 'sourceRecord': 'P01:' + r['base'],
                                           'bounds': rect(base['master_anchor'], 'source-file-pixels'), 'at': [0, 0]},
                                          {'sourceFile': exterior, 'sourceRecord': 'P01:' + r['patch'],
                                           'bounds': rect(patch['source_rect'], 'source-file-pixels'),
                                           'at': r['replace_local_rect'][:2]}],
                               'limit': 'Exact target comparison requires the pinned named target PNG. Alpha-over also matches these eight samples.'}
        relations.append(value)
    relations.append({'id': 'P01:experiments', 'packetId': 'P01', 'kind': 'experiment-evidence',
                      'members': ['P01:' + r['id'] for r in trees['candidates']],
                      'originalEvidence': {k: v for k, v in trees['experiments'].items() if k != 'occurrences'},
                      'limits': trees['experiments']['matching_limitation']})

    require(scrap['source']['sha256'] == files[exterior]['sha256'], 'Scrapyard master pin disagrees')
    for r in scrap['candidates']:
        refs = []
        for s in r['sources']:
            refs.append({'sourceFile': source(s['path'], s['sha256'], r['sourceSize']),
                         'bounds': rect(s['rect'], 'source-file-pixels')})
        uid = r['id']
        records.append({'id': uid, 'packetId': 'P02', 'sourceId': uid, 'sourceKind': 'named-single',
                        'primaryLineage': 'direct', 'frameDimensions': r['sourceSize'],
                        'normalizedPixelSha256': r['normalizedRgbaSHA256'], 'references': refs,
                        'occurrences': [{'sourceFile': exterior, 'bounds': rect(o['rect'], 'source-file-pixels'),
                                         'visibleBounds': rect(o['visibleBounds'], 'source-file-pixels', 'alpha-visible')}
                                        for o in r['masterOccurrences']],
                        'bounds': [rect([0, 0, *r['sourceSize']], 'record-local-pixels'),
                                   rect(r['sourceAlphaBounds'], 'record-local-pixels', 'alpha-visible', 'xyxy')],
                        'searchEvidence': r['matching'], 'originalEvidence': r})
        fields = fields_from(r['fields'])
        alternatives = r['alternatives'] + (['short ladder-like frame'] if uid == 'P02-09' else [])
        fields['identity']['alternatives'] = alternatives
        proposals.append({'id': uid, 'packetId': 'P02', 'members': [uid],
                          'unitType': 'source-image-proposal', 'fields': fields,
                          'identity': fields['identity'], 'family': fields['family'],
                          'componentRole': fields['role'], 'variant': fields_from({'appearance': r['variantHypothesis']}),
                          'facing': fields['facing'], 'gameplayGeometry': GEOMETRY.copy(),
                          'alternatives': alternatives, 'state': 'proposed', 'humanApproval': 'unregistered',
                          'discriminatingCheck': r['discriminatingCheck']})
    for i, r in enumerate(scrap['relations']):
        relations.append({'id': f'P02:R{i + 1:02}', 'packetId': 'P02', 'kind': r['relation'],
                          'members': r['members'], 'originalEvidence': r})
    relations.append({'id': 'P02:experiments', 'packetId': 'P02', 'kind': 'experiment-evidence',
                      'members': [r['id'] for r in scrap['candidates']], 'originalEvidence': scrap['experiments'],
                      'qualifications': ['Triangle subset has tied best offsets [38,0] and [39,0], each 40/174; identity/occlusion unknown.',
                                         'Occupied seam edges do not prove seamless texture or unlimited repetition.']})

    measurements = cabinets['measurements']
    csources = {k: source(v['path'], v['sha256'], v.get('dimensions')) for k, v in measurements['sources'].items()}
    catalog = load(root / CATALOG)
    aliases = {r['key']: r for r in catalog['entries']}
    correspondences = {r['record']: r['originalCorrespondence']
                       for p in cabinets['semanticProposals'] for r in p['sourceCorrespondences']}
    for r in measurements['records']:
        path = source(r['single']['path'], r['single']['sha256'], r['single']['dimensions'])
        correspondence = correspondences[r['id']]
        lineage = {'exact-whole-frame': 'direct', 'exact-composition': 'composed',
                   'counterpart-based-derived': 'derived'}[correspondence['kind']]
        records.append({'id': r['id'], 'packetId': 'P03', 'sourceId': r['id'], 'sourceKind': 'named-single',
                        'variant': r['variant'], 'vendorIndex': r['vendorIndex'], 'primaryLineage': lineage,
                        'frameDimensions': r['single']['dimensions'], 'normalizedPixelSha256': r['visibleRGBAHash'],
                        'references': [{'sourceFile': path, 'bounds': rect(r['singleSourceRect'], 'source-file-pixels')},
                                       {'sourceFile': csources['packedAtlas'], 'bounds': rect(r['packedRect'], 'packed-atlas-pixels', 'packed-alias'),
                                        'catalogFile': csources['packedCatalog'], 'aliasKey': r['packedAliasKey']}],
                        'occurrences': [{'sourceFile': csources['originalMaster'], 'bounds': rect(o, 'source-file-pixels')}
                                        for o in r['exactOriginalOccurrences']],
                        'bounds': [rect([0, 0, *r['single']['dimensions']], 'record-local-pixels'),
                                   rect(r['alphaBBoxXYXY'], 'record-local-pixels', 'alpha-visible', 'xyxy')],
                        'originalEvidence': r, 'searchEvidence': {'domain': csources['originalMaster'],
                            'algorithm': measurements['comparison'], 'negativeLimit': 'Only exact frames on this pinned master; no absence claim for identity or other sheets.'}})
        relationship = {'id': r['id'] + ':lineage', 'packetId': 'P03', 'kind': lineage,
                        'members': [r['id']], 'originalEvidence': correspondence}
        if lineage == 'composed':
            relationship['recipe'] = {'operation': 'rgba-overwrite', 'canvasDimensions': r['single']['dimensions'],
                                      'targetRecord': r['id'], 'outputPixelSha256': r['visibleRGBAHash'],
                                      'layers': [{'sourceFile': csources['originalMaster'], 'bounds': rect(s['sourceRect'], 'source-file-pixels'),
                                                  'at': s['targetRect'][:2],
                                                  'targetBounds': rect(s['targetRect'], 'record-local-pixels', 'composition-target'),
                                                  'inputId': r['id'] + (':upper-strip' if i == 0 else ':lower-strip'),
                                                  'supportOccurrences': [rect(o, 'source-file-pixels') for o in measurements['missing38Experiment'][
                                                      'upperStripOriginalOccurrences' if i == 0 else 'lowerStripOriginalOccurrences']]}
                                                 for i, s in enumerate(correspondence['composition'])],
                                      'limit': 'Not a whole-frame occurrence; original master needed for reconstruction.'}
        elif lineage == 'derived':
            relationship['members'].append(correspondence['normalRecord'])
        relations.append(relationship)
        relations.append({'id': r['id'] + ':variant', 'packetId': 'P03', 'kind': 'counterpart-correspondence',
                          'members': [r['id'], f"P03-{r['vendorIndex']}-shadowless"],
                          'normalization': measurements['bodyCanonicalizationHypothesis'],
                          'canonicalBodySha256': r['canonicalBodyHash'],
                          'matchesInCorpus': r['shadowlessCounterpartPoolMatches'],
                          'deltaFromShadowless': r['deltaFromShadowlessSameIndex'],
                          'limit': 'Conditional pilot normalization; raw source identity and on-body reflection changes remain separate.'})
    for p in cabinets['semanticProposals']:
        fields = fields_from({k: p[k] for k in ('identity', 'family', 'facing', 'segmentation', 'shadowVariants', 'assemblyRole')})
        if p['id'] not in {r['conceptId'] for r in topology['components']}:
            fields['assemblyRole']['evidence'] = 'Own closed source contours/frame and alpha-tight shadowless body bounds; modular 41-44 end-order experiment is not direct evidence for this object.'
        proposals.append({'id': p['id'], 'packetId': 'P03', 'members': p['memberRecords'],
                          'unitType': p['segmentation']['value'], 'fields': fields,
                          'identity': fields['identity'], 'family': fields['family'],
                          'componentRole': fields['assemblyRole'], 'variant': fields['shadowVariants'],
                          'facing': fields['facing'], 'gameplayGeometry': GEOMETRY.copy(),
                          'alternatives': (['mirror', 'glazing'] if p['id'] in ('P03-C38', 'P03-C40', 'P03-C42') else
                                           ['shelf', 'side table', 'other small open-front furniture'] if p['id'] == 'P03-C45' else []),
                          'state': 'proposed', 'humanApproval': 'unregistered', 'originalEvidence': p})
        for r in records:
            if r['id'] in p['memberRecords']:
                r['bounds'].append(rect(p['segmentation']['objectBodyRectLocal'], 'record-local-pixels', 'proposed-body'))
    corpus = []
    for entry in aliases.values():
        if entry.get('theme') == 'living-room' and entry['variant'] == 'shadowless':
            path = entry['sourcePath']
            item = inventory[path]
            source(path, item['sha256'])
            corpus.append({'path': path, 'sha256': item['sha256']})
    corpus.sort(key=lambda r: r['path'])
    require(len(corpus) == measurements['counterpartReferenceCorpus']['fileCount'] and
            sha(json.dumps(corpus, sort_keys=True).encode()) == measurements['counterpartReferenceCorpus']['sortedPathAndHashJSONFingerprint'],
            'Counterpart corpus identity changed')
    relations.append({'id': 'P03:counterpart-corpus', 'packetId': 'P03', 'kind': 'counterpart-corpus',
                      'members': [], 'files': corpus, 'originalEvidence': measurements['counterpartReferenceCorpus']})
    relations.append({'id': 'P03:topology', 'packetId': 'P03', 'kind': 'assembly-topology',
                      'members': [x for c in topology['components'] for x in c['memberRecords']],
                      'topology': topology, 'humanApproval': 'unregistered'})
    relations.append({'id': 'P03:experiments', 'packetId': 'P03', 'kind': 'experiment-evidence',
                      'members': [r['id'] for r in measurements['records']],
                      'originalEvidence': {k: v for k, v in measurements.items() if k not in ('records', 'sources')},
                      'challenges': cabinets['challenges'], 'assemblyProposals': cabinets['assemblyProposals']})
    # Versioned E01 adapter: exact full exports are authoritative, while
    # primaryLineage describes correspondence to the original master only.
    # Two original-only records have no master occurrence or invented recipe.
    seating_sources = {}
    for item in seating['sources']:
        path = source(item['path'], item['pngSHA256'], item['size'])
        files[path]['normalizedPixelSha256'] = item['normalizedRgbaSHA256']
        seating_sources[item['id']] = path
    for name, pin in seating['pins'].items():
        require(sha(repo_path(root, pin['path']).read_bytes()) == pin['sha256'], f'E01 input pin drift: {name}')
        pins[pin['path']] = pin['sha256']
    for r in seating['candidates']:
        uid = r['id']
        fields = fields_from(r['fields'])
        integration_aliases = []
        if uid in ('E01-05', 'E01-06'):
            alias_path = f"public/assets/semantic-sources/exteriors-bench-{5 if uid == 'E01-05' else 6}.png"
            origin = seating_sources[r['primarySourceId']]
            source(alias_path, files[origin]['sha256'], r['exportRect'][2:])
            files[alias_path]['normalizedPixelSha256'] = r['normalizedRgbaSHA256']
            integration_aliases.append({'sourceFile': alias_path, 'bounds': rect(r['exportRect'], 'source-file-pixels', 'integration-alias'),
                                        'originSourceFile': origin, 'lineage': 'byte-identical-copy-of-pinned-export',
                                        'scope': 'Serial integration alias; frozen proposal committedRendering remains unchanged. Does not create a master occurrence or human approval.'})
            relations.append({'id': uid + ':integration-alias', 'packetId': 'E01', 'kind': 'integration-source-alias',
                              'members': [uid], 'originSourceFile': origin, 'sourceFile': alias_path,
                              'sha256': files[origin]['sha256'], 'humanApproval': 'unregistered',
                              'limit': 'Source copy only; original-only master correspondence remains.'})
        records.append({'id': uid, 'packetId': 'E01', 'sourceId': uid, 'sourceKind': 'named-single',
                        'primaryLineage': 'direct' if r['masterOccurrences'] else 'original-only',
                        'lineageDomain': 'pinned-original-master',
                        'sourceIdentity': 'exact-pinned-whole-export',
                        'frameDimensions': r['exportRect'][2:],
                        'normalizedPixelSha256': r['normalizedRgbaSHA256'],
                        'references': [{'sourceFile': seating_sources[sid], 'bounds': rect(r['exportRect'], 'source-file-pixels')}
                                       for sid in r['namedExportAliases']],
                        'occurrences': [{'sourceFile': seating_sources[o['sourceId']],
                                         'bounds': rect(o['rect'], 'source-file-pixels'),
                                         'visibleBounds': rect(o['alphaVisibleRect'], 'source-file-pixels', 'alpha-visible'),
                                         'lineage': o['lineage']} for o in r['occurrences']],
                        'bounds': [rect(r['exportRect'], 'record-local-pixels'),
                                   rect(r['alphaVisibleRect'], 'record-local-pixels', 'alpha-visible')],
                        'integrationAliases': integration_aliases, 'legacyIndexAlias': r['legacyIndexAlias'],
                        'committedRendering': r['committedRendering'],
                        'searchEvidence': seating['matching'], 'originalEvidence': r})
        proposals.append({'id': uid, 'packetId': 'E01', 'members': [uid], 'unitType': 'whole-export-visual-proposal',
                          'fields': fields, 'identity': fields['identity'], 'family': fields['family'],
                          'componentRole': fields['role'], 'variant': fields['variant'], 'facing': fields['facing'],
                          'gameplayGeometry': GEOMETRY.copy(), 'alternatives': fields['identity']['alternatives'],
                          'topology': r['topology'], 'state': 'proposed', 'humanApproval': 'unregistered'})
    for i, relation in enumerate(seating['relations']):
        relations.append({'id': f'E01:R{i + 1:02}', 'packetId': 'E01', 'kind': relation['relation'],
                          'members': relation['members'], 'originalEvidence': relation})
    relations.append({'id': 'E01:experiments', 'packetId': 'E01', 'kind': 'experiment-evidence',
                      'members': [r['id'] for r in seating['candidates']], 'adapter': 'E01-outdoor-seating-v1',
                      'originalEvidence': seating['experiments'], 'limits': seating['matching']['limitation']})
    relations.append({'id': 'E01:search-domain', 'packetId': 'E01', 'kind': 'search-domain',
                      'members': [r['id'] for r in seating['candidates']],
                      'sources': [seating_sources[sid] for sid in seating['matching']['sheetDomains']],
                      'namedAliasDomain': seating['matching']['namedAliasDomain'],
                      'limit': 'Exact full-export master/theme correspondence only; no absent-source inference.'})
    sofa_sources = {}
    for item in sofas['sources']:
        path = source(item['path'], item['pngSHA256'], item['size'])
        files[path]['normalizedPixelSha256'] = item['normalizedRgbaSHA256']
        sofa_sources[item['id']] = path
    for name, pin in sofas['pins'].items():
        require(sha(repo_path(root, pin['path']).read_bytes()) == pin['sha256'], f'I01 input pin drift: {name}')
        pins[pin['path']] = pin['sha256']
    sofa_components = []
    for r in sofas['candidates']:
        uid = r['id']
        refs = [{'sourceFile': sofa_sources[a['sourceId']], 'bounds': rect(r['exportRect'], 'source-file-pixels')}
                for a in r['namedExportAliases']]
        for a in r['namedExportAliases']:
            refs.append({'sourceFile': sofa_sources[r['packedAlias']['sourceId']],
                         'bounds': rect(a['packedRect'], 'packed-atlas-pixels', 'packed-alias'),
                         'catalogFile': sofas['pins']['packedIndex']['path'], 'aliasKey': a['packedKey'],
                         'aliasSourceFile': sofa_sources[a['sourceId']], 'aliasSourceBounds': rect(r['exportRect'], 'source-file-pixels')})
        records.append({'id': uid, 'packetId': 'I01', 'sourceId': uid, 'sourceKind': 'named-single',
                        'variant': r['variant'], 'vendorIndex': r['vendorIndex'],
                        'primaryLineage': 'direct' if r['variant'] == 'normal' else 'derived',
                        'lineageDomain': 'pinned-original-master', 'sourceIdentity': 'exact-pinned-whole-export',
                        'frameDimensions': r['exportRect'][2:], 'normalizedPixelSha256': r['normalizedRgbaSHA256'],
                        'references': refs, 'occurrences': [{'sourceFile': sofa_sources[o['sourceId']],
                            'bounds': rect(o['rect'], 'source-file-pixels'), 'lineage': o['lineage']} for o in r['occurrences']],
                        'bounds': [rect(r['exportRect'], 'record-local-pixels'), rect(r['alphaVisibleRect'], 'record-local-pixels', 'alpha-visible')],
                        'topology': r['topology'], 'originalEvidence': r, 'searchEvidence': sofas['matching']})
        fields = fields_from(r['fields'])
        if r['variant'] == 'normal':
            members = [uid] + (['I01-19', 'I01-20'] if uid == 'I01-01' else [])
            proposals.append({'id': uid, 'packetId': 'I01', 'members': members,
                              'unitType': 'normal-export-proposal-with-render-counterparts', 'fields': fields,
                              'identity': fields['identity'], 'family': fields['family'], 'componentRole': fields['role'],
                              'variant': fields['variant'], 'facing': fields['facing'], 'topology': r['topology'],
                              'gameplayGeometry': GEOMETRY.copy(), 'alternatives': fields['identity']['alternatives'],
                              'state': 'proposed', 'humanApproval': 'unregistered'})
        sofa_components.append({'recordId': uid, 'role': fields['role']['value'],
                                'palette': fields['variant']['value'].split('; ')[0],
                                'facing': fields['facing']['value'], 'renderVariant': r['variant'],
                                'frameDimensions': r['exportRect'][2:], 'topology': r['topology']})
    relations.append({'id': 'I01:topology', 'packetId': 'I01', 'kind': 'closed-chain-topology',
                      'members': [c['recordId'] for c in sofa_components],
                      'topology': {'schema': 'closed-chain-topology-v1', 'components': sofa_components,
                                   'rules': [{'axis': 'x', 'startRole': 'front-left-cap', 'middleRoles': ['front-repeat-middle'],
                                              'endRole': 'front-right-cap', 'crossSize': 32,
                                              'advanceByRole': {'front-left-cap': 16, 'front-repeat-middle': 16, 'front-right-cap': 16}},
                                             {'axis': 'y', 'startRole': 'side-top-cap', 'middleRoles': ['side-repeat-middle'],
                                              'endRole': 'side-bottom-cap', 'crossSize': 32,
                                              'advanceByRole': {'side-top-cap': 32, 'side-repeat-middle': 16, 'side-bottom-cap': 16}}],
                                   'originalEvidence': sofas['completenessRules']}, 'humanApproval': 'unregistered'})
    for experiment in sofas['counterpartExperiments']:
        relations.append({'id': experiment['member'] + ':counterpart', 'packetId': 'I01', 'kind': 'bounded-shadow-counterpart',
                          'members': [experiment['member'], experiment['shadowlessReference']], 'originalEvidence': experiment,
                          'limit': 'Conditional observed-token removal only; no invented original-master occurrence.'})
    review_text = (packet_dir / 'I01-interior-sofas-review.md').read_text()
    assembly_dispositions = table_dispositions(review_text, [e['id'] for e in sofas['assemblyExperiments']])
    for experiment, disposition in zip(sofas['assemblyExperiments'], assembly_dispositions):
        relations.append({'id': 'I01:assembly:' + experiment['id'], 'packetId': 'I01', 'kind': 'rendered-assembly-probe',
                          'members': [p['memberId'] for p in experiment['placements']],
                          'originalEvidence': experiment, 'independentDisposition': disposition,
                          'humanApproval': 'unregistered', 'limit': 'Exact rendered layout only; validity, source equality and human approval are separate.'})
    relations.append({'id': 'I01:search-domain', 'packetId': 'I01', 'kind': 'search-domain',
                      'members': [r['id'] for r in sofas['candidates']],
                      'sources': [sofa_sources[sid] for sid in sofas['matching']['sheetDomains']],
                      'originalEvidence': sofas['matching'], 'limit': sofas['matching']['limitation']})
    relations.append({'id': 'I01:counterpart-corpus', 'packetId': 'I01', 'kind': 'bounded-shadow-corpus',
                      'members': [], 'files': [{'path': sofa_sources[c['sourceId']], 'vendorIndex': c['vendorIndex']}
                                               for c in sofas['counterpartCorpus']],
                      'limit': '240 shadowless Basement frames; bounded cap-4 observed-token signature only.'})
    for pid, file, packet in [('P01', 'P01-trees.json', trees), ('P02', 'P02-scrapyard.json', scrap),
                              ('P03', 'P03-cabinets.json', cabinets), ('E01', 'E01-outdoor-seating.json', seating),
                              ('I01', 'I01-interior-sofas.json', sofas)]:
        reviewfile = file.replace('.json', '-review.md')
        text = (packet_dir / reviewfile).read_text()
        pr = [p for p in proposals if p['packetId'] == pid]
        sr = [r for r in records if r['packetId'] == pid]
        ids = [p['id'].split(':')[-1] for p in pr]
        raw_ids = [r['sourceId'] for r in sr]
        review_sources = {ref['sourceFile'] for r in sr for ref in r['references'] + r.get('integrationAliases', []) + r['occurrences']}
        review_sources.update(ref['aliasFile'] for r in sr for ref in r['occurrences'] if 'aliasFile' in ref)
        review_sources.update(layer['sourceFile'] for rel in relations if rel['packetId'] == pid
                              for layer in rel.get('recipe', {}).get('layers', []))
        review_sources.update(path for rel in relations if rel['packetId'] == pid and rel['kind'] == 'search-domain'
                              for path in rel['sources'])
        if pid == 'I01':
            review_sources.update(sofa_sources.values())  # All 268 independently checked source pins.
        if pid == 'E01':
            review_sources.update(seating_sources.values())  # Review independently checked all 80 frozen source pins.
        review_sources.update(item['path'] for rel in relations if rel['packetId'] == pid and rel['kind'] == 'counterpart-corpus'
                              for item in rel['files'])
        reviews.append({'id': pid + ':independent-review', 'packetId': pid, 'kind': 'agent-review',
                        'proposalPath': f'{PLAN}/packets/{file}', 'proposalSha256': PINS[file],
                        'proposalRevision': 1, 'sourcePins': [files[path] for path in sorted(review_sources)],
                        'sourceScope': 'Record references, exact occurrence/alias sources, composition inputs, declared sheet search domains and conditional counterpart corpus; each raw hash/dimension pinned.',
                        'memberRecords': [r['id'] for r in sr], 'proposalUnits': [p['id'] for p in pr],
                        'applicability': 'exact-proposal-hash-only', 'reviewPath': f'{PLAN}/packets/{reviewfile}',
                        'reviewSha256': PINS[reviewfile], 'proposalDispositions': table_dispositions(text, ids),
                        'recordDispositions': table_dispositions(text, raw_ids) if pid in ('P03', 'I01') else [],
                        'observationOrder': ('Initial contact sheet before proposal JSON; coordinator brief and contact-sheet labels visible; mapper note before raw contexts; not blinded.' if pid == 'E01' else 'Initial observations before full proposal read; coordinator brief informed; not formally blinded.'),
                        'originalText': text, 'humanApproval': 'unregistered', 'runtimePromotion': False})
        packets.append({'id': pid, 'proposalPath': f'{PLAN}/packets/{file}', 'proposalSha256': PINS[file],
                        'revision': 1, 'sourceRecordCount': len(sr), 'proposalUnitCount': len(pr),
                        'state': 'proposed', 'coverageLimit': packet['coverage'],
                        'originalContext': {k: v for k, v in packet.items() if k not in
                                            ('candidates', 'semanticProposals', 'measurements', 'relations', 'experiments')}})
    expansion_adapters(root, source, files, pins, records, proposals, relations, reviews, packets)
    model = {'schema': 'semantic-tileset-model-v1',
             'versionedAdapters': {'pilots': ['P01-trees-v1', 'P02-scrapyard-v1', 'P03-cabinets-v1'], 'extensions': ['E01-outdoor-seating-v1', 'I01-interior-sofas-v1', 'RB01-room-builder-v1', 'E03-playground-tubes-v1', 'A01-animation-v1']},
             'lineageContract': 'Primary lineage describes correspondence to the packet original master except A01 temporal-strip records, whose static correspondence stays separate. Original-only preserves exact full named exports without inventing whole-master occurrences or recipes.', 'revisionAlgorithm': 'sha256 sorted compact ASCII JSON excluding top-level revision',
             'normalization': NORMALIZATION, 'inputPins': pins, 'packets': packets,
             'sourceFiles': [files[k] for k in sorted(files)], 'sourceRecords': records,
             'proposals': proposals, 'relationships': relations, 'reviews': reviews,
             'reconciliation': {'path': f'{PLAN}/notes/2026-10-04-pilot-reconciliation.md',
                                'sha256': RECONCILIATION_PIN, 'applied': ['P01 rounded-canopy identity', 'P02-09 ladder-like alternative',
                                  'P02 triangle tied maximizers', 'P03 own-contour whole-object evidence; reflection exceptions retained'],
                                'originalText': (root / PLAN / 'notes/2026-10-04-pilot-reconciliation.md').read_text()},
             'extensionContract': {'newPackets': 'Add a versioned adapter with explicit proposal/source pins, record and proposal unit IDs, typed bounds, searches and limits, relationship members, recipes, unknown fields and review scopes. No implicit fallback for unsupported schema.',
                                   'counting': 'Record, proposal, occurrence, tested assembly and human approval counts are independent; proposals never count as approved assets.',
                                   'review': 'Changed proposal/source/member identities require explicit new applicability; agent dispositions and topology validity are not human approval.',
                                   'measurement': 'Future packets record examined units, changed/unresolved fields, elapsed and owner effort. Unclocked pilots provide no throughput estimate.'}}
    model['revision'] = revision(model)
    return model


def standalone_policy(component):
    """Unknown eligibility never grants permission; allowed remains visual proposal only."""
    eligibility = component['topology']['standaloneEligibility']
    return {'allowed': eligibility == 'allowed as visual proposal only',
            'state': 'visual-proposal-only' if eligibility == 'allowed as visual proposal only' else
                     'forbidden-partial' if eligibility == 'forbidden; partial component' else 'unknown',
            'humanApproval': 'unregistered', 'gameplayGeometry': 'unknown'}


def check_closed_chain(topology, member_ids):
    """General closed-chain rules; front and side advances can have unequal sizes."""
    mapping = {c['recordId']: c for c in topology['components']}
    errors = [f'Unknown component record: {rid}' for rid in member_ids if rid not in mapping]
    members = [mapping[rid] for rid in member_ids if rid in mapping]
    rule = next((r for r in topology['rules'] if members and members[0]['role'] in
                 [r['startRole'], *r['middleRoles'], r['endRole']]), None)
    if len(members) < 2:
        errors.append('Components cannot stand alone; both caps are required.')
    if not rule:
        errors.append('No established complete-chain role; unknown eligibility is not permission.')
    elif members:
        if members[0]['role'] != rule['startRole'] or members[-1]['role'] != rule['endRole']:
            errors.append('Missing or reversed outer caps.')
        if any(c['role'] not in rule['middleRoles'] for c in members[1:-1]):
            errors.append('Internal members must be middles; closed caps cannot be internal.')
        axis = 0 if rule['axis'] == 'x' else 1
        first_edge, last_edge = ('left', 'right') if axis == 0 else ('top', 'bottom')
        for i, c in enumerate(members):
            if c['frameDimensions'][1 - axis] != rule['crossSize'] or c['frameDimensions'][axis] != rule['advanceByRole'].get(c['role']):
                errors.append(f'Wrong member dimensions at position {i}.')
            if any(c[key] != members[0][key] for key in ('palette', 'facing', 'renderVariant')):
                errors.append(f'Mixed palette/facing/render set at position {i}.')
            if standalone_policy(c)['state'] != 'forbidden-partial':
                errors.append(f'Unestablished component role at position {i}.')
            ports = c['topology']['requiredPortNeighborRoles']
            for edge, offset, opposite in ((first_edge, -1, last_edge), (last_edge, 1, first_edge)):
                n = i + offset
                if edge in ports:
                    if n < 0 or n >= len(members):
                        errors.append(f'Unconnected {edge} edge at position {i}.')
                    elif (members[n]['role'] not in ports[edge] or
                          c['role'] not in members[n]['topology']['requiredPortNeighborRoles'].get(opposite, []) or
                          members[n]['recordId'] not in c['topology']['compatibleSelectedMembers']):
                        errors.append(f'Incompatible {edge} neighbor at position {i}.')
                elif 0 <= n < len(members):
                    errors.append(f'Internal closed {edge} edge at position {i}.')
    offsets, advance = [], 0
    if rule and not errors:
        for c in members:
            offsets.append([advance, 0] if rule['axis'] == 'x' else [0, advance])
            advance += rule['advanceByRole'][c['role']]
    return {'valid': not errors, 'errors': errors, 'offsets': offsets,
            'visualStatus': 'not-evaluated', 'humanApproval': 'unregistered'}


def shadow_signature(im, token):
    raw = bytearray(normalized(im).tobytes())
    if token:
        for i in range(0, len(raw), 4):
            if list(raw[i:i + 4]) == token:
                raw[i:i + 4] = bytes(4)
    return sha(raw)


def sofa_delta(a, b):
    require(a.size == b.size, 'I01 variant frames differ')
    ar, br = a.tobytes(), b.tobytes()
    changed = [(i // 4, tuple(ar[i:i + 4]), tuple(br[i:i + 4]))
               for i in range(0, len(ar), 4) if ar[i:i + 4] != br[i:i + 4]]
    mask = Image.frombytes('L', a.size, bytes(255 if ar[i:i + 4] != br[i:i + 4] else 0 for i in range(0, len(ar), 4)))
    inside = sum(bool(q[3]) for _, p, q in changed)
    return {'size': list(a.size), 'inputNormalizedRgbaSHA256': sha(ar), 'referenceNormalizedRgbaSHA256': sha(br),
            'changedPixels': len(changed), 'onReferenceBodyPixels': inside,
            'outsideReferenceBodyPixels': len(changed) - inside,
            'changedBoundsXYXY': list(mask.getbbox()) if changed else None,
            'changedMaskSHA256': sha(mask.tobytes()),
            'changedColorPairs': [[list(p), list(q)] for p, q in sorted({(p, q) for _, p, q in changed})],
            'exactEqual': not changed}


def check_topology(topology, member_ids):
    """Validate named records against declared edges, roles and variant policy.

    Topology validity is metadata only; visual evidence and approval are separate.
    Unknown records are rejected. Members must be concrete variant record IDs.
    """
    if topology.get('schema') == 'closed-chain-topology-v1':
        return check_closed_chain(topology, member_ids)
    errors, members = [], []
    mapping = {rid: c for c in topology['components'] for rid in c['memberRecords']}
    for rid in member_ids:
        if rid not in mapping:
            errors.append(f'Unknown component record: {rid}')
        else:
            members.append(mapping[rid])
    if errors:
        return {'valid': False, 'errors': errors, 'visualStatus': 'not-evaluated', 'humanApproval': 'unregistered'}
    rule = topology['assemblyTopology']
    if len(members) < 2:
        errors.append('Components cannot stand alone; both ends are required.')
    if members:
        if members[0]['conceptId'] != rule['startConceptId']:
            errors.append('Missing left end first.')
        if members[-1]['conceptId'] != rule['endConceptId']:
            errors.append('Missing right end last.')
        if any(c['conceptId'] not in rule['middleConceptIds'] for c in members[1:-1]):
            errors.append('Internal members must be middles; closed ends cannot be internal.')
        if len(members) - 2 < rule['minimumMiddleCount']:
            errors.append('Insufficient middle members.')
        for index, c in enumerate(members):
            for side, offset, opposite in [('left', -1, 'right'), ('right', 1, 'left')]:
                neighbor = index + offset
                edge = c[side]
                if edge['state'] == 'join-required':
                    if neighbor < 0 or neighbor >= len(members):
                        errors.append(f'Unconnected {side} edge at position {index}.')
                    elif (members[neighbor]['conceptId'] not in edge['compatibleConceptIds'] or
                          c['conceptId'] not in members[neighbor][opposite]['compatibleConceptIds']):
                        errors.append(f'Incompatible {side} neighbor at position {index}.')
                elif edge['state'] == 'closed-end' and 0 <= neighbor < len(members):
                    errors.append(f'Internal closed {side} edge at position {index}.')
        # Variant labels come from each component's explicit ordered membership,
        # not suffix guessing; topology validation checks these lists against records.
        variants = topology['verifiedRenderSequences']['variants']
        selected = [variants[c['memberRecords'].index(rid)] for c, rid in zip(members, member_ids)]
        if rule['variantPolicy']['sameVariantRequired'] and len(set(selected)) > 1:
            errors.append('Mixed variants are outside the verified/conservative topology policy.')
    return {'valid': not errors, 'errors': errors, 'visualStatus': 'not-evaluated', 'humanApproval': 'unregistered'}


def review_applicability(review, proposal_sha256, members):
    return (review['proposalSha256'] == proposal_sha256 and
            review['memberRecords'] == members)


def finite_tube_ports(recipe, records):
    """Replay only the frozen image-axis continuation cuts; no eligibility verdict."""
    ports = []
    opposite = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}
    for i, placement in enumerate(recipe['placements']):
        rid = placement['memberId']
        x, y = placement['offsetXY']
        for port in records[rid]['topology']['openJoinEdges']:
            px, py = port['bandOriginXY']
            ports.append(({'placementIndex': i, 'memberId': rid, 'edge': port['edge'],
                           'globalBandOriginXY': [x + px, y + py]}, port['profile']))
    pairs, unmatched = [], []
    for i, (port, profile) in enumerate(ports):
        peers = [j for j, (other, other_profile) in enumerate(ports)
                 if other['placementIndex'] != port['placementIndex'] and
                 other['edge'] == opposite[port['edge']] and profile == other_profile and
                 other['globalBandOriginXY'] == port['globalBandOriginXY']]
        if len(peers) != 1:
            unmatched.append(port)
        elif i < peers[0]:
            pairs.append([port, ports[peers[0]][0]])
    return {'matchedPairs': pairs, 'unmatchedPorts': unmatched}


def validate_expansion(model, records, rendered, image, root):
    result = {'probeRastersVerified': {}, 'probeRastersUnavailable': [], 'supplementalProbeRastersVerified': 0,
              'originalProbeComparisonsVerified': 0, 'originalProbeComparisonsUnavailable': [],
              'pixelComparisonsVerified': 0, 'pixelComparisonsUnavailable': [],
              'GIFFramesVerified': 0, 'GIFDemonstrationsUnavailable': [],
              'temporalDeltasVerified': 0, 'masterSubfileAlphaDifferenceVerified': False}
    for relation in model['relationships']:
        pid, kind = relation['packetId'], relation['kind']
        if pid not in EXPANSION_PACKETS:
            continue
        evidence = relation.get('originalEvidence', {})
        if kind in ('bounded-component-probe', 'context-only-probe', 'supplemental-component-review-probe'):
            recipe = relation['renderRecipe']
            if pid == 'RB01':
                require(revision(recipe) == evidence['renderRecipeSHA256'], 'RB01 recipe receipt differs')
                require(relation['operation'] == 'rgba-overwrite' and recipe['operation'].startswith('normalized RGBA overwrite'), 'RB01 operation differs')
            else:
                require(relation['operation'] == 'source-over' and recipe['operation'].startswith('Pillow RGBA alpha_composite'), 'E03 operation differs')
                measured = finite_tube_ports(recipe, records) if kind != 'supplemental-component-review-probe' else None
                if measured is not None:
                    require(measured == evidence['portEvaluation'], 'E03 finite port evidence differs')
                    require((not measured['unmatchedPorts']) == (evidence['topologyValidity'] == 'valid'), 'E03 probe disposition differs')
            out = Image.new('RGBA', tuple(recipe['size']))
            unavailable = False
            parts = []
            for placement in recipe['placements']:
                if 'memberId' in placement:
                    part = rendered.get(placement['memberId'])
                else:
                    part = image(relation['sourceFilesById'][placement['sourceId']])
                if part is None:
                    unavailable = True
                    continue
                if 'sourceRect' in placement:
                    part = crop(part, rect(placement['sourceRect'], 'record-local-pixels' if 'memberId' in placement else 'source-file-pixels'))
                at = placement.get('targetOffset', placement.get('offsetXY'))
                check_bounds(rect([*at, *part.size], 'probe-canvas-pixels'), out.size)
                if relation['operation'] == 'source-over':
                    out.alpha_composite(part, tuple(at))
                else:
                    out.paste(part, tuple(at))
                parts.append(part)
            if unavailable:
                result['probeRastersUnavailable'].append(relation['id'])
                continue
            expected_hash = evidence.get('outputNormalizedRgbaSHA256', evidence.get('normalizedRgbaSHA256'))
            require(pixel_hash(out) == expected_hash, f'{pid} probe raster differs: {relation["id"]}')
            if kind == 'supplemental-component-review-probe':
                result['supplementalProbeRastersVerified'] += 1
            else:
                result['probeRastersVerified'][pid] = result['probeRastersVerified'].get(pid, 0) + 1
            if pid == 'RB01':
                for diagnostic in evidence.get('joinDiagnostics', []):
                    a, b = [rendered[rid] for rid in diagnostic['members']]
                    if diagnostic['axis'] == 'horizontal':
                        changes = [y for y in range(a.height) if a.getpixel((a.width - 1, y)) != b.getpixel((0, y))]
                    else:
                        changes = [x for x in range(a.width) if a.getpixel((x, a.height - 1)) != b.getpixel((x, 0))]
                    require(changes == diagnostic['differentAdjacentRGBAPositions'], 'RB01 join diagnostic differs')
                if kind == 'context-only-probe':
                    for side, a, b in [('left', parts[0], parts[1]), ('right', parts[1], parts[2])]:
                        changes = [y for y in range(a.height) if a.getpixel((a.width - 1, y)) != b.getpixel((0, y))]
                        require(changes == evidence[side + 'SeamDifferentRows'], 'RB01 context seam differs')
                if 'sourceComparison' in evidence:
                    comparison = evidence['sourceComparison']
                    original = image(relation['sourceFilesById'][comparison['sourceId']])
                    if original is None:
                        result['originalProbeComparisonsUnavailable'].append(relation['id'])
                    else:
                        target = crop(original, rect(comparison['rect'], 'source-file-pixels'))
                        require(pixel_hash(target) == comparison['referenceNormalizedRgbaSHA256'] and
                                (target.tobytes() == out.tobytes()) == comparison['exactNormalizedRGBAEqual'], 'RB01 source comparison differs')
                        result['originalProbeComparisonsVerified'] += 1
        elif kind == 'component-pixel-comparison':
            if any(r not in rendered for r in relation['members']):
                result['pixelComparisonsUnavailable'].append(relation['id'])
                continue
            a, b = [rendered[r] for r in relation['members']]
            if evidence['operation'] == 'horizontal-reflection':
                a = a.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            else:
                require(evidence['operation'] == 'identity', 'E03 comparison operation differs')
            measured = seating_delta(a, b)
            require(all(measured[k] == evidence[k] for k in evidence if k in measured), 'E03 pixel comparison differs')
            result['pixelComparisonsVerified'] += 1
        elif kind == 'master-subfile-alpha-difference':
            paths = relation['sourceFilesById']
            a, b = image(paths[evidence['subfileSourceId']]), image(paths[evidence['masterSourceId']])
            if a is not None and b is not None:
                a = crop(a, rect(evidence['subfileRect'], 'source-file-pixels'))
                b = crop(b, rect(evidence['masterRect'], 'source-file-pixels'))
                measured = seating_delta(a, b)
                require((measured['rgbaChangedPixels'], measured['alphaChangedPixels'], measured['changedMaskSHA256'], measured['changedBoundsXYXY']) ==
                        (evidence['changedPixels'], 176, evidence['changedMaskSHA256'], evidence['changedBoundsXYXY']) and
                        pixel_hash(a) == evidence['subfileNormalizedRgbaSHA256'] and pixel_hash(b) == evidence['masterNormalizedRgbaSHA256'], 'RB01 master/subfile shadow delta differs')
                values = Counter((p, q) for p, q in zip(pixels(a), pixels(b)) if p != q)
                require([{'subfile': list(p), 'master': list(q), 'pixels': n} for (p, q), n in values.items()] == evidence['changedRGBAValues'], 'RB01 shadow alpha values differ')
                result['masterSubfileAlphaDifferenceVerified'] = True
        elif kind == 'temporal-sequence':
            for delta in evidence['adjacentSourceFrameDeltas']:
                a, b = [rendered[r] for r in delta['members']]
                measured = seating_delta(a, b)
                require((measured['rgbaChangedPixels'], measured['alphaChangedPixels'], measured['changedBoundsXYXY'], measured['changedMaskSHA256']) ==
                        (delta['changedPixels'], delta['alphaChangedPixels'], delta['changedBoundsXYXY'], delta['maskSHA256']), 'A01 temporal delta differs')
                result['temporalDeltasVerified'] += 1
        elif kind == 'supporting-GIF-demonstration':
            path = relation['sourceFile']
            if image(path) is None:
                result['GIFDemonstrationsUnavailable'].append(relation['id'])
                continue
            with Image.open(root / path) as gif:
                require(gif.n_frames == evidence['decodedFrameCount'] and gif.info.get('loop') == evidence['loopExtension'], 'A01 GIF sequence differs')
                duration = 0
                for frame in evidence['frames']:
                    gif.seek(frame['decodedFrameIndex'])
                    decoded = normalized(gif)
                    require(pixel_hash(decoded) == frame['normalizedRgbaSHA256'] and gif.info.get('duration') == frame['durationMs'] and
                            gif.disposal_method == frame['decoderDisposalMethod'], 'A01 GIF frame/timing differs')
                    require(all(decoded.tobytes() == rendered[r].tobytes() for r in frame['exactSourceFrameIds']), 'A01 GIF/PNG correspondence differs')
                    duration += frame['durationMs']
                    result['GIFFramesVerified'] += 1
                require(duration == evidence['demonstrationCycleDurationMs'], 'A01 GIF cycle duration differs')
    return result


def validate_model(model, root=ROOT, committed_only=False):
    """Verify saved evidence; unavailable checks remain explicit in the result."""
    require(model['schema'] == 'semantic-tileset-model-v1', 'Unsupported semantic schema')
    digest_model = {k: v for k, v in model.items() if k != 'revision'}
    require(revision(digest_model) == model['revision'], 'Model revision drift')
    for path, digest in model['inputPins'].items():
        require(sha(repo_path(root, path).read_bytes()) == digest, f'Input pin drift: {path}')
    files = {s['path']: s for s in model['sourceFiles']}
    require(len(files) == len(model['sourceFiles']), 'Duplicate source file')
    images, missing = {}, []
    for path, s in files.items():
        p = repo_path(root, path)
        if not p.is_file():
            require(committed_only and not s['required'] and path.startswith('assets/'), f'Missing source reference: {path}')
            missing.append(path)
            continue
        require(sha(p.read_bytes()) == s['sha256'], f'Source hash drift: {path}')
        if s['dimensions'] is not None:
            with Image.open(p) as im:
                require(list(im.size) == s['dimensions'], f'Source dimensions drift: {path}')
    def image(path):
        require(path in files, f'Unpinned source reference: {path}')
        if path in missing:
            return None
        if path not in images:
            with Image.open(root / path) as raw:
                images[path] = normalized(raw)
        return images[path]
    for path, pin in files.items():
        if pin.get('normalizedPixelSha256') and path not in missing:
            require(pixel_hash(image(path)) == pin['normalizedPixelSha256'], f'Normalized source hash drift: {path}')
    records = {r['id']: r for r in model['sourceRecords']}
    proposals = {p['id']: p for p in model['proposals']}
    require(len(records) == len(model['sourceRecords']), 'Duplicate record ID')
    require(len(proposals) == len(model['proposals']), 'Duplicate proposal ID')
    require({p['id'] for p in model['packets']} == set(PACKET_ACCOUNTING), 'Unsupported packet adapter; register its explicit accounting contract')
    for pid, accounting in PACKET_ACCOUNTING.items():
        packet_records = [r for r in records.values() if r['packetId'] == pid]
        packet_proposals = [p for p in proposals.values() if p['packetId'] == pid]
        require(len(packet_records) == accounting['records'] and len(packet_proposals) == accounting['proposals'], f'Packet record/proposal accounting drift: {pid}')
        require(Counter(r['primaryLineage'] for r in packet_records) ==
                {k: accounting[k] for k in ('direct', 'composed', 'derived', 'original-only', 'subfile-only', 'temporal-frame') if accounting.get(k)}, f'Lineage accounting drift: {pid}')
    covered = Counter(rid for p in proposals.values() for rid in p['members'])
    require(covered == Counter(records.keys()), 'Proposal membership missing or duplicated')
    for p in proposals.values():
        require(p['humanApproval'] == 'unregistered' and p['state'] == 'proposed', 'Pilot approval/promotion must remain unregistered')
        require(p['gameplayGeometry'] == GEOMETRY, 'Gameplay geometry must remain unknown')
    rendered, verified_refs, verified_occurrences = {}, 0, 0
    for rid, record in records.items():
        for bounds in record['bounds']:
            require(bounds['coordinateSpace'] == 'record-local-pixels', f'Wrong record bounds space: {rid}')
            check_bounds(bounds, record['frameDimensions'])
        for ref in record['references'] + record.get('integrationAliases', []) + record['occurrences']:
            path = ref['sourceFile']
            require(path in files and files[path]['dimensions'], f'Missing source pin/dimensions: {rid}: {path}')
            expected_space = 'packed-atlas-pixels' if ref.get('aliasKey') or ref.get('packedAliasEvidence') else 'source-file-pixels'
            require(ref['bounds']['coordinateSpace'] == expected_space, f'Wrong source coordinate space: {rid}')
            check_bounds(ref['bounds'], files[path]['dimensions'])
            if 'visibleBounds' in ref:
                check_bounds(ref['visibleBounds'], files[path]['dimensions'])
            if ref.get('originSourceFile'):
                origin = ref['originSourceFile']
                require(origin in files and files[origin]['sha256'] == files[path]['sha256'] and
                        files[origin]['dimensions'] == files[path]['dimensions'], 'Integration alias differs from pinned original export')
            if ref.get('packedAliasEvidence'):
                alias = ref['packedAliasEvidence']
                catalog = load(root / ref['catalogFile'])
                key = alias.get('key', alias.get('sheetKey'))
                entry = next(e for e in catalog['entries'] if e['key'] == key)
                original = alias['originalSourceRect']
                require(entry['sourcePath'] == ref['aliasSourceFile'] and original == ref['aliasSourceBounds']['value'] and
                        any(o['sourceFile'] == ref['aliasSourceFile'] and o['bounds']['value'] == original for o in record['occurrences']), 'RB01 packed source lineage differs')
                original_image = image(ref['aliasSourceFile'])
                if original_image is not None:
                    require(pixel_hash(crop(original_image, ref['aliasSourceBounds'])) == record['normalizedPixelSha256'], 'RB01 packed alias original pixels differ')
                if 'key' in alias:
                    expected = entry['rect']
                    require(entry['sourceRect'] == original, 'RB01 packed tile source crop differs')
                else:
                    sx, sy, sw, sh = entry['sourceRect']
                    ox, oy, ow, oh = original
                    check_bounds(rect([ox - sx, oy - sy, ow, oh], 'sheet-local-pixels'), [sw, sh])
                    expected = [entry['rect'][0] + ox - sx, entry['rect'][1] + oy - sy, ow, oh]
                require(ref['bounds']['value'] == expected == alias['rect'] and alias['exactVerified'] is True, 'RB01 packed offset alias differs')
            if ref.get('aliasKey'):
                catalog = load(root / ref['catalogFile'])
                aliases = {a['key']: a for a in catalog['entries']}
                require(ref['aliasKey'] in aliases, f'Missing packed alias: {rid}')
                alias = aliases[ref['aliasKey']]
                require(alias['rect'] == ref['bounds']['value'] and
                        alias['sourcePath'] == ref.get('aliasSourceFile', record['references'][0]['sourceFile']) and
                        alias['sourceRect'] == ref.get('aliasSourceBounds', record['references'][0]['bounds'])['value'], f'Packed alias lineage drift: {rid}')
            im = image(path)
            if im is None and ref.get('aliasFile'):
                alias_file = ref['aliasFile']
                require(alias_file in files and files[alias_file]['sha256'] == files[path]['sha256'] and
                        files[alias_file]['dimensions'] == files[path]['dimensions'], 'Master alias pin differs')
                im = image(alias_file)
            if im is None:
                continue
            value = crop(im, ref['bounds'])
            require(list(value.size) == record['frameDimensions'], f'Frame dimensions drift: {rid}')
            require(pixel_hash(value) == record['normalizedPixelSha256'], f'Record pixels differ: {rid}: {path}')
            rendered[rid] = value
            if ref in record['occurrences']:
                verified_occurrences += 1
            else:
                verified_refs += 1
        if rid in rendered:
            alpha = next(b for b in record['bounds'] if b['kind'] == 'alpha-visible')
            ax, ay, aw, ah = xywh(alpha)
            require(list(rendered[rid].getbbox()) == [ax, ay, ax + aw, ay + ah], f'Alpha bounds drift: {rid}')
    recipes, exact_targets, replay_only, unavailable_recipes = 0, [], [], []
    for relation in model['relationships']:
        require(all(r in records or r in proposals for r in relation['members']), f'Unresolved relationship member: {relation["id"]}')
        if 'recipe' not in relation:
            continue
        recipes += 1
        recipe = relation['recipe']
        require(recipe['operation'] == 'rgba-overwrite', 'Unsupported composition operation')
        target = recipe['targetRecord']
        require(target in records and records[target]['primaryLineage'] == 'composed', 'Composition target lineage differs')
        require(recipe['canvasDimensions'] == records[target]['frameDimensions'], 'Composition canvas differs')
        out = Image.new('RGBA', tuple(recipe['canvasDimensions']))
        available = True
        for layer in recipe['layers']:
            path = layer['sourceFile']
            require(path in files, 'Unpinned composition source')
            check_bounds(layer['bounds'], files[path]['dimensions'])
            x, y, w, h = xywh(layer['bounds'])
            at = layer['at']
            if 'targetBounds' in layer:
                require(layer['targetBounds']['value'] == [*at, w, h], 'Typed composition target bounds differ')
            for support in layer.get('supportOccurrences', []):
                require(support['coordinateSpace'] == 'source-file-pixels', 'Wrong support coordinate space')
                check_bounds(support, files[path]['dimensions'])
            check_bounds(rect([*at, w, h], 'record-local-pixels'), out.size)
            im = image(path)
            if im is None:
                available = False
            else:
                part = crop(im, layer['bounds'])
                for support in layer.get('supportOccurrences', []):
                    require(crop(im, support).tobytes() == part.tobytes(), 'Composition support occurrence differs')
                out.paste(part, tuple(at))
        if not available:
            unavailable_recipes.append(target)
            continue
        require(pixel_hash(out) == recipe['outputPixelSha256'] == records[target]['normalizedPixelSha256'], f'Composition hash differs: {target}')
        if target in rendered:
            require(out.tobytes() == rendered[target].tobytes(), f'Composition target differs: {target}')
            exact_targets.append(target)
        else:
            replay_only.append(target)
    require(recipes == 9, 'Nine composed-lineage recipes required')
    topology = next(r['topology'] for r in model['relationships'] if r['kind'] == 'assembly-topology')
    require(topology['baseProposal']['sha256'] == PINS['P03-cabinets.json'], 'Topology proposal applicability differs')
    for c in topology['components']:
        require(c['standaloneAllowed'] is False and c['requiresAssembly'] is True, 'Partial standalone policy drift')
        require(c['memberRecords'] == proposals[c['conceptId']]['members'], 'Topology members differ')
        for rid, variant in zip(c['memberRecords'], topology['verifiedRenderSequences']['variants']):
            require(records[rid]['variant'] == variant and records[rid]['frameDimensions'] == topology['assemblyTopology']['memberFrameDimensions'], 'Topology variant/frame metadata differs')
    top_tests = []
    for variant in topology['verifiedRenderSequences']['variants']:
        for origin in ('proposal', 'independentReview'):
            for sequence in topology['verifiedRenderSequences'][origin]:
                members = [next(r for r in proposals[c]['members'] if records[r]['variant'] == variant) for c in sequence]
                require(check_topology(topology, members)['valid'], 'Positive topology evidence rejected')
                top_tests.append(members)
        for example in topology['invalidTopologyExamples']:
            members = [next(r for r in proposals[c]['members'] if records[r]['variant'] == variant) for c in example['members']]
            require(not check_topology(topology, members)['valid'], 'Negative topology evidence accepted')
    variants_checked = 0
    for relation in model['relationships']:
        if relation['kind'] == 'counterpart-correspondence':
            a, b = relation['members']
            require(counterpart_signature(rendered[a], records[a]['variant']) == relation['canonicalBodySha256'], f'Canonical counterpart differs: {a}')
            require(difference(rendered[a], rendered[b]) == relation['deltaFromShadowless'], f'Raw variant delta differs: {a}')
            variants_checked += 1
    tree_evidence = next(r['originalEvidence'] for r in model['relationships'] if r['id'] == 'P01:experiments')
    for evidence in tree_evidence['palette_comparisons']:
        a, b = rendered['P01:' + evidence['base']], rendered['P01:' + evidence['compared']]
        mapping, alpha_differences = {}, []
        for index, (p, q) in enumerate(zip(pixels(a), pixels(b))):
            if p[3] != q[3]:
                alpha_differences.append([index % a.width, index // a.width, p[3], q[3]])
            if p[3]:
                mapping.setdefault(p, set()).add(q)
        conflicts = [{'source_rgba': list(p), 'destination_rgba': sorted(map(list, qs))}
                     for p, qs in mapping.items() if len(qs) > 1]
        require(alpha_differences == evidence['alpha_difference_pixels'] and
                conflicts == evidence['color_mapping_exceptions'] and
                (not conflicts) == evidence['single_global_color_mapping'] and
                (a.tobytes() == b.tobytes()) == evidence['exact_normalized_rgba'], 'Tree palette/mask exceptions drift')
    corpus_relation = next(r for r in model['relationships'] if r['kind'] == 'counterpart-corpus')
    corpus_available = all(r['path'] not in missing for r in corpus_relation['files'])
    if corpus_available:
        pool = {}
        for r in corpus_relation['files']:
            key = (tuple(files[r['path']]['dimensions']), counterpart_signature(image(r['path']), 'shadowless'))
            pool.setdefault(key, []).append(int(Path(r['path']).stem.rsplit('_', 1)[1]))
        for relation in model['relationships']:
            if relation['kind'] == 'counterpart-correspondence':
                r = records[relation['members'][0]]
                matches = sorted(pool.get((tuple(r['frameDimensions']), relation['canonicalBodySha256']), []))
                require(matches == relation['matchesInCorpus'], 'Counterpart uniqueness differs')
    seating_evidence = next(r['originalEvidence'] for r in model['relationships'] if r['id'] == 'E01:experiments')
    seating_checked, seating_unavailable, partial_checked, partial_unavailable = 0, [], 0, []
    for experiment in seating_evidence['variantDeltas']:
        if any(rid not in rendered for rid in experiment['members']):
            seating_unavailable.append(experiment['members'])
            continue
        a, b = [rendered[rid] for rid in experiment['members']]
        if experiment['operation'] == 'horizontal-reflection':
            a = a.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        elif experiment['operation'] == 'target crop [0,16,48,32]':
            b = crop(b, rect([0, 16, 48, 32], 'record-local-pixels'))
        else:
            require(experiment['operation'] == 'identity', 'Unsupported E01 comparison operation')
        measured = seating_delta(a, b)
        require(all(experiment[key] == value for key, value in measured.items()), 'E01 variant delta differs')
        seating_checked += 1
    for experiment in seating_evidence['longBenchPartialCorrespondence']:
        if any(rid not in rendered for rid in experiment['members']):
            partial_unavailable.append(experiment['members'])
            continue
        a, b = [rendered[rid] for rid in experiment['members']]
        for kind in ('topCorrespondence', 'bottomCorrespondence'):
            expected = experiment[kind]
            measured = seating_delta(crop(a, rect(expected['shortRect'], 'record-local-pixels')),
                                     crop(b, rect(expected['longRect'], 'record-local-pixels')))
            require(all(expected[key] == value for key, value in measured.items()), 'E01 partial correspondence differs')
        short_bytes, long_bytes = a.tobytes(), b.tobytes()
        short_rows = {short_bytes[y * a.width * 4:(y + 1) * a.width * 4] for y in range(a.height)}
        unknown_rows = [y for y in range(b.height) if long_bytes[y * b.width * 4:(y + 1) * b.width * 4] not in short_rows]
        require(unknown_rows == experiment['longRowsWithoutAnyEqualShortRow'], 'E01 long-bench row exception differs')
        partial_checked += 1
    sofa_topology = next(r['topology'] for r in model['relationships'] if r['kind'] == 'closed-chain-topology')
    sofa_components = {c['recordId']: c for c in sofa_topology['components']}
    require(Counter(standalone_policy(c)['state'] for c in sofa_components.values()) ==
            {'forbidden-partial': 14, 'unknown': 4, 'visual-proposal-only': 2}, 'I01 standalone policy accounting differs')
    sofa_assemblies, sofa_assembly_unavailable, sofa_master_comparisons = 0, [], 0
    for relation in model['relationships']:
        if relation['kind'] != 'rendered-assembly-probe':
            continue
        experiment = relation['originalEvidence']
        result = check_topology(sofa_topology, relation['members'])
        require(result['valid'] == (experiment['topologyDisposition'] == 'proposed-valid'), 'I01 topology evidence differs')
        if result['valid']:
            require(result['offsets'] == [p['targetOffset'] for p in experiment['placements']], 'I01 assembly advance differs')
        if any(rid not in rendered for rid in relation['members']):
            sofa_assembly_unavailable.append(experiment['id'])
            continue
        require(experiment['operation'] == 'RGBA overwrite onto transparent canvas; no source resizing', 'Unsupported I01 assembly operation')
        out = Image.new('RGBA', tuple(experiment['size']))
        for placement in experiment['placements']:
            part = crop(rendered[placement['memberId']], rect(placement['sourceRect'], 'record-local-pixels'))
            check_bounds(rect([*placement['targetOffset'], *part.size], 'record-local-pixels'), out.size)
            out.paste(part, tuple(placement['targetOffset']))
        require(pixel_hash(out) == experiment['outputNormalizedRgbaSHA256'], 'I01 assembly hash differs')
        alpha = out.getchannel('A')
        for join in experiment['joinAlphaContinuity']:
            axis, seam = join['axis'], join['offset']
            require(axis in ('x', 'y') and 0 < seam < (out.width if axis == 'x' else out.height), 'Invalid I01 seam')
            occupied = [k for k in range(out.height if axis == 'x' else out.width)
                        if (alpha.getpixel((seam - 1, k)) and alpha.getpixel((seam, k)) if axis == 'x' else
                            alpha.getpixel((k, seam - 1)) and alpha.getpixel((k, seam)))]
            require(occupied == join['positionsOccupiedOnBothSides'], 'I01 join alpha evidence differs')
        master_path = next(r['sources'][0] for r in model['relationships'] if r['id'] == 'I01:search-domain')
        for occurrence in experiment['exactMasterOccurrences']:
            bounds = rect(occurrence, 'source-file-pixels')
            check_bounds(bounds, files[master_path]['dimensions'])
            if image(master_path) is not None:
                require(crop(image(master_path), bounds).tobytes() == out.tobytes(), 'I01 assembly master occurrence differs')
                sofa_master_comparisons += 1
        sofa_assemblies += 1
    sofa_corpus = next(r for r in model['relationships'] if r['kind'] == 'bounded-shadow-corpus')
    sofa_corpus_available = all(r['path'] not in missing for r in sofa_corpus['files'])
    sofa_counterparts = 0
    for relation in model['relationships']:
        if relation['kind'] != 'bounded-shadow-counterpart':
            continue
        experiment = relation['originalEvidence']
        a, b = [rendered[rid] for rid in relation['members']]
        require(shadow_signature(a, experiment['shadowToken']) == experiment['canonicalBodySHA256'], 'I01 shadow signature differs')
        require(sofa_delta(a, b) == experiment['deltaFromShadowless'], 'I01 raw counterpart delta differs')
        if sofa_corpus_available:
            matches = [c['vendorIndex'] for c in sofa_corpus['files'] if image(c['path']).size == a.size and
                       shadow_signature(image(c['path']), None) == experiment['canonicalBodySHA256']]
            require(matches == experiment['shadowlessPoolMatches'], 'I01 counterpart corpus differs')
        sofa_counterparts += 1
    expansion_report = validate_expansion(model, records, rendered, image, root)
    original_only = [r['id'] for r in records.values() if r['primaryLineage'] == 'original-only']
    for rid in original_only:
        require(not records[rid]['occurrences'] and records[rid]['sourceIdentity'] == 'exact-pinned-whole-export',
                'Original-only lineage cannot fabricate a master occurrence or erase exact source identity')
    review_results = []
    for review in model['reviews']:
        members = [r['id'] for r in records.values() if r['packetId'] == review['packetId']]
        current_sha = sha((root / review['proposalPath']).read_bytes())
        applies = review_applicability(review, current_sha, members)
        require(applies, f'Review does not apply: {review["id"]}')
        require(review['humanApproval'] == 'unregistered' and review['runtimePromotion'] is False, 'Agent review cannot approve/promote')
        review_results.append({'id': review['id'], 'applicable': applies, 'kind': review['kind'], 'humanApproval': review['humanApproval']})
    require(model == build_model(root), 'Canonical packet adapter contract drift (source, proposal, relationship or review scope)')
    limitations = ['Recorded occurrence/search evidence is preserved; this validator checks listed crops, not a new exhaustive absence scan.',
                   'Topology-valid sequences are not thereby rendered, seam-reviewed or human-approved.',
                   'Pilot proposal units are not unique-object counts or pack completeness.']
    limitations.append('RB01/E03 validate finite frozen probes only; open windows, weakened hypotheses and invalid layouts retain their exact dispositions. No general connector/height rule.')
    limitations.append('A01 has nine temporal source occurrences / eight pixel states / two action-sequence proposal units; 82 PNG sources and two supporting GIFs outside the PNG inventory. Demonstration timing is not gameplay timing.')
    if not expansion_report['masterSubfileAlphaDifferenceVerified']:
        limitations.append('RB01 original master/subfile 176-pixel alpha comparison unavailable; preserved evidence is not newly verified.')
    if expansion_report['GIFDemonstrationsUnavailable']:
        limitations.append('A01 supporting GIF originals unavailable; demonstration order/timing not newly verified. Committed PNG strip frames and adjacent deltas remain checked.')
    if missing:
        limitations.append('Original references are absent: their raw hashes/dimensions and independent target comparisons were not checked.')
    if seating_unavailable or partial_unavailable:
        limitations.append('Original-only long-bench sources unavailable; their mirror/partial-delta checks were not performed. Exact sources remain pinned.')
    if not sofa_corpus_available:
        limitations.append('240-file Basement counterpart corpus unavailable; conditional uniqueness not rechecked.')
    if missing:
        limitations.append('I01 listed original-master/theme occurrence and assembly source comparisons unavailable where originals are absent; committed packed frames still checked.')
    if not corpus_available:
        limitations.append('122-file counterpart corpus unavailable; recorded uniqueness claim not independently rechecked.')
    return {'ok': True, 'mode': 'committed-only' if committed_only else 'full', 'modelRevision': model['revision'],
            'sourceRecords': len(records), 'proposalUnits': len(proposals), 'componentAnimationValidation': expansion_report,
            'componentAnimationAccounting': {pid: {'sourceRecords': spec[2], 'proposalUnits': spec[3]} for pid, spec in EXPANSION_PACKETS.items()},
            'pilotAccounting': {'sourceRecords': 85, 'proposalUnits': 67, 'lineage': {'direct': 58, 'composed': 9, 'derived': 18}},
            'extensionAccounting': {'E01': {'sourceRecords': 27, 'proposalUnits': 27, 'lineage': {'direct': 25, 'original-only': 2}}, 'I01': {'sourceRecords': 20, 'proposalUnits': 18, 'lineage': {'direct': 18, 'derived': 2}}},
            'lineage': dict(sorted(Counter(r['primaryLineage'] for r in records.values()).items())),
            'sourceFilesVerified': len(files) - len(missing), 'sourceFilesUnavailable': missing,
            'recordReferencesVerified': verified_refs, 'recordOccurrencesVerified': verified_occurrences,
            'compositionRecipes': recipes, 'compositionsComparedToPinnedTargets': exact_targets,
            'compositionsReplayOnly': replay_only, 'compositionsUnavailable': unavailable_recipes,
            'variantDeltasVerified': variants_checked, 'counterpartCorpusRechecked': corpus_available,
            'E01VariantDeltasVerified': seating_checked, 'E01VariantDeltasUnavailable': seating_unavailable,
            'E01PartialComparisonsVerified': partial_checked, 'E01PartialComparisonsUnavailable': partial_unavailable,
            'I01AssemblyProbesVerified': sofa_assemblies, 'I01AssemblyProbesUnavailable': sofa_assembly_unavailable,
            'I01AssemblyMasterComparisonsVerified': sofa_master_comparisons,
            'I01CounterpartDeltasVerified': sofa_counterparts, 'I01CounterpartCorpusRechecked': sofa_corpus_available,
            'I01TopologyProbeDispositions': dict(Counter(r['originalEvidence']['topologyDisposition'] for r in model['relationships'] if r['kind'] == 'rendered-assembly-probe')),
            'originalOnlyRecordIds': original_only,
            'recordPixelsUnavailable': [rid for rid in records if rid not in rendered],
            'positiveTopologyCasesChecked': len(top_tests), 'reviews': review_results,
            'humanApprovedProposalUnits': 0, 'runtimePromotedProposalUnits': 0, 'limitations': limitations}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate pins and exact saved adapter output; emit deterministic JSON')
    parser.add_argument('--committed-only', action='store_true', help='Allow absent ignored originals with visible verification limits')
    parser.add_argument('--summary', action='store_true', help='Print concise human summary instead of JSON')
    args = parser.parse_args()
    try:
        expected = build_model()
        if args.check:
            model = load(OUTPUT)
            require(model == expected, 'Saved semantic-model.json differs from frozen packet adapter; regenerate explicitly')
        else:
            model = expected
        report = validate_model(model, committed_only=args.committed_only)
        if not args.check:
            OUTPUT.write_bytes(encoded(model))
        if args.summary:
            print(f"Semantic map: {report['sourceRecords']} source records / {report['proposalUnits']} proposal units. "
                  'Pilots: 85/67; E01: 27/27; I01: 20/18; RB01: 25/25; E03: 25/25; A01: 9 temporal frames/2 action sequences (8 pixel states). Human approvals: 0; runtime promotions: 0.')
            print(f"Compositions: {len(report['compositionsComparedToPinnedTargets'])} target comparisons, "
                  f"{len(report['compositionsReplayOnly'])} replay-only, {len(report['compositionsUnavailable'])} unavailable. "
                  f"Missing original references: {len(report['sourceFilesUnavailable'])}.")
            print('Agent reviews apply to exact frozen hashes. Cabinet/sofa topology validity is separate from rendering/approval.')
        else:
            print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (ValueError, KeyError, OSError, StopIteration, IndexError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}, sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
