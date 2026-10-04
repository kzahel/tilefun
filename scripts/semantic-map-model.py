#!/usr/bin/env python3
"""Read-only semantic packet adapter/validator (P01/P02/P03 and E01 v1).

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
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLAN = 'docs/tactical/053-semantic-tileset-map'
OUTPUT = ROOT / PLAN / 'semantic-model.json'
PINS = {
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
PACKET_ACCOUNTING = {**PILOT_ACCOUNTING, 'E01': {'records': 27, 'proposals': 27, 'direct': 25, 'composed': 0, 'derived': 0, 'original-only': 2}}
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
        require(path not in files or files[path] == value, f'Conflicting source pin: {path}')
        files[path] = value
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
    for pid, file, packet in [('P01', 'P01-trees.json', trees), ('P02', 'P02-scrapyard.json', scrap),
                              ('P03', 'P03-cabinets.json', cabinets), ('E01', 'E01-outdoor-seating.json', seating)]:
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
                        'recordDispositions': table_dispositions(text, raw_ids) if pid == 'P03' else [],
                        'observationOrder': ('Initial contact sheet before proposal JSON; coordinator brief and contact-sheet labels visible; mapper note before raw contexts; not blinded.' if pid == 'E01' else 'Initial observations before full proposal read; coordinator brief informed; not formally blinded.'),
                        'originalText': text, 'humanApproval': 'unregistered', 'runtimePromotion': False})
        packets.append({'id': pid, 'proposalPath': f'{PLAN}/packets/{file}', 'proposalSha256': PINS[file],
                        'revision': 1, 'sourceRecordCount': len(sr), 'proposalUnitCount': len(pr),
                        'state': 'proposed', 'coverageLimit': packet['coverage'],
                        'originalContext': {k: v for k, v in packet.items() if k not in
                                            ('candidates', 'semanticProposals', 'measurements', 'relations', 'experiments')}})
    model = {'schema': 'semantic-tileset-model-v1',
             'versionedAdapters': {'pilots': ['P01-trees-v1', 'P02-scrapyard-v1', 'P03-cabinets-v1'], 'extensions': ['E01-outdoor-seating-v1']},
             'lineageContract': 'Primary lineage describes correspondence to the packet original master. Original-only preserves exact full named exports without inventing whole-master occurrences or recipes.', 'revisionAlgorithm': 'sha256 sorted compact ASCII JSON excluding top-level revision',
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


def check_topology(topology, member_ids):
    """Validate named records against declared edges, roles and variant policy.

    Topology validity is metadata only; visual evidence and approval are separate.
    Unknown records are rejected. Members must be concrete variant record IDs.
    """
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
            images[path] = normalized(Image.open(root / path))
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
                {k: accounting[k] for k in ('direct', 'composed', 'derived', 'original-only') if accounting.get(k)}, f'Lineage accounting drift: {pid}')
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
            expected_space = 'packed-atlas-pixels' if ref.get('aliasKey') else 'source-file-pixels'
            require(ref['bounds']['coordinateSpace'] == expected_space, f'Wrong source coordinate space: {rid}')
            check_bounds(ref['bounds'], files[path]['dimensions'])
            if 'visibleBounds' in ref:
                check_bounds(ref['visibleBounds'], files[path]['dimensions'])
            if ref.get('originSourceFile'):
                origin = ref['originSourceFile']
                require(origin in files and files[origin]['sha256'] == files[path]['sha256'] and
                        files[origin]['dimensions'] == files[path]['dimensions'], 'Integration alias differs from pinned original export')
            if ref.get('aliasKey'):
                catalog = load(root / ref['catalogFile'])
                aliases = {a['key']: a for a in catalog['entries']}
                require(ref['aliasKey'] in aliases, f'Missing packed alias: {rid}')
                alias = aliases[ref['aliasKey']]
                require(alias['rect'] == ref['bounds']['value'] and
                        alias['sourcePath'] == record['references'][0]['sourceFile'] and
                        alias['sourceRect'] == record['references'][0]['bounds']['value'], f'Packed alias lineage drift: {rid}')
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
    if missing:
        limitations.append('Original references are absent: their raw hashes/dimensions and independent target comparisons were not checked.')
    if seating_unavailable or partial_unavailable:
        limitations.append('Original-only long-bench sources unavailable; their mirror/partial-delta checks were not performed. Exact sources remain pinned.')
    if not corpus_available:
        limitations.append('122-file counterpart corpus unavailable; recorded uniqueness claim not independently rechecked.')
    return {'ok': True, 'mode': 'committed-only' if committed_only else 'full', 'modelRevision': model['revision'],
            'sourceRecords': len(records), 'proposalUnits': len(proposals),
            'pilotAccounting': {'sourceRecords': 85, 'proposalUnits': 67, 'lineage': {'direct': 58, 'composed': 9, 'derived': 18}},
            'extensionAccounting': {'E01': {'sourceRecords': 27, 'proposalUnits': 27, 'lineage': {'direct': 25, 'original-only': 2}}},
            'lineage': dict(sorted(Counter(r['primaryLineage'] for r in records.values()).items())),
            'sourceFilesVerified': len(files) - len(missing), 'sourceFilesUnavailable': missing,
            'recordReferencesVerified': verified_refs, 'recordOccurrencesVerified': verified_occurrences,
            'compositionRecipes': recipes, 'compositionsComparedToPinnedTargets': exact_targets,
            'compositionsReplayOnly': replay_only, 'compositionsUnavailable': unavailable_recipes,
            'variantDeltasVerified': variants_checked, 'counterpartCorpusRechecked': corpus_available,
            'E01VariantDeltasVerified': seating_checked, 'E01VariantDeltasUnavailable': seating_unavailable,
            'E01PartialComparisonsVerified': partial_checked, 'E01PartialComparisonsUnavailable': partial_unavailable,
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
                  'Pilots: 85/67 (58 direct, 9 composed, 18 derived); E01: 27/27 (25 direct, 2 original-only). Human approvals: 0; runtime promotions: 0.')
            print(f"Compositions: {len(report['compositionsComparedToPinnedTargets'])} target comparisons, "
                  f"{len(report['compositionsReplayOnly'])} replay-only, {len(report['compositionsUnavailable'])} unavailable. "
                  f"Missing original references: {len(report['sourceFilesUnavailable'])}.")
            print('Agent reviews apply to exact frozen hashes. Cabinet topology validity is separate from rendering/approval.')
        else:
            print(json.dumps(report, indent=2, sort_keys=True))
        return 0
    except (ValueError, KeyError, OSError, StopIteration, IndexError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}, sort_keys=True))
        return 1


if __name__ == '__main__':
    sys.exit(main())
