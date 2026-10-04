#!/usr/bin/env python3
"""Reproduce a source-pinned assignment ledger; no source pixels or reviews change.

Uses committed survey/pilot evidence, not a new segmentation or matching search.
--check compares bytes without writing and needs no ignored originals or Pillow.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sys

REPO = Path(__file__).resolve().parent.parent
BASE = 'docs/tactical/053-semantic-tileset-map'
OUTPUT = BASE + '/coverage-ledger.json'
REGISTRY = BASE + '/mapping-registry.json'
MODEL = BASE + '/semantic-model.json'
MODEL_PIN = 'c2a0ad9364cf99f0cc6d6e50f772335b6915c4c40187dab1a331608973b6f118'
I01_PROPOSAL_PIN = '75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df'
I01_REVIEW_PIN = '1b93f7b2b438eb4f74f3e01f898b746bd5f0f7a5a36eb48e4b23f7651cc256fb'
E01_PROPOSAL_PIN = '9562c3956611af40245966284ad5614bbff9a7c11a07fac78c9b9a6a5c5bd62b'
E01_REVIEW_PIN = '5b85986b906910e857549c7528b33ef70b995fb7c5ec7276d1e65a01d6ee1ef0'
FROZEN = {
    'S02-exteriors-regions.json': 'dea87c451f573270590135211f43a2d0a9cf27cf5f56b8c90227c44dec07b771',
    'S02-interiors-regions.json': 'f4f6d6d5f35677a96102e62b1a5a83fc8975d1c2938c1fc1551274fb9fc942a1',
    'P01-trees.json': '3df0e42f9012644afe5cd1233f604b5dd74ec05c4c4f26253834dc2a05281ff6',
    'P02-scrapyard.json': '429d796ec87adb007a4febc267fabff14c1032cd197dc47ed50d729f65073957',
    'P03-cabinets.json': 'c22f7b16e24816a231883bad04cd29e43eac2ce81f09f444d4bc5ffad7875254',
}
CORRECTIONS = {
    'E10': {'evidence': 'Grass/earth shape variants followed by climbing frames, slides and modular colored playground tubes/tunnels and connectors.',
            'families': ['terrain samples', 'play structures', 'playground tubes/tunnels and connectors', 'fencing']},
    'E15': {'name': 'Ambulances and streets/roundabouts',
            'evidence': 'White/red ambulance views and component pieces with cross/112 markings, above roundabout and sidewalk layouts.',
            'families': ['ambulance views and components', 'roundabout assemblies', 'sidewalk and crossing pieces']},
    'E18': {'name': 'Hospital, helipad and medical beds/stretchers',
            'evidence': 'HOSPITAL/Emergency labels, roof H markers, wheeled medical beds/stretchers with empty and patient variants, and helicopters.',
            'families': ['hospital assemblies', 'medical beds/stretchers and patients', 'helipad', 'helicopters']},
    'E45': {'name': 'Mansion and gothic-style architecture tail'},
}
MASTER_GROUPS = {'exteriors-master', 'interiors-master', 'interiors-room-builder-master'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def fingerprint(rows):
    return sha(b''.join((json.dumps(r[:4], ensure_ascii=False, separators=(',', ':')) + '\n').encode()
                        for r in sorted(rows)))


def rectangle(value):
    return [value[k] for k in ('x', 'y', 'w', 'h')] if isinstance(value, dict) else list(value)


def check_rect(rect, dimensions):
    if (len(rect) != 4 or any(type(v) is not int for v in rect) or
            min(rect[:2]) < 0 or min(rect[2:]) <= 0 or
            rect[0] + rect[2] > dimensions[0] or rect[1] + rect[3] > dimensions[1]):
        raise ValueError(f'Invalid source rectangle {rect} in {dimensions}')


def intersects(a, b):
    return (a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and
            a[1] < b[1] + b[3] and b[1] < a[1] + a[3])


def stage(state='no-evidence', scope='none', evidence=(), record_ids=()):
    return {'state': state, 'scope': scope, 'evidence': list(evidence), 'recordIds': list(record_ids)}


class Evidence:
    def __init__(self, root):
        self.root = root
        self.pins = {}

    def read(self, path, expected=None):
        data = (self.root / path).read_bytes()
        actual = sha(data)
        if expected is not None and actual != expected:
            raise ValueError(f'Pin mismatch: {path}; expected {expected}, got {actual}')
        self.pins[path] = {'path': path, 'sha256': actual}
        return data

    def json(self, path, expected=None):
        return json.loads(self.read(path, expected))


def json_pointer(value, pointer):
    if not pointer.startswith('/'):
        raise ValueError('Member JSON pointer must be absolute')
    for token in pointer[1:].split('/'):
        token = token.replace('~1', '/').replace('~0', '~')
        value = value[int(token)] if isinstance(value, list) else value[token]
    return value


def registrations(evidence, region_ids, group_ids, source_ref):
    registry = evidence.json(REGISTRY)
    if registry.get('schemaVersion') != 1:
        raise ValueError('Unsupported mapping registry schema')
    result = []
    seen = set()
    for registration in registry['registrations']:
        packet_id = registration['packetId']
        if packet_id in seen:
            raise ValueError('Duplicate registry packet ID: ' + packet_id)
        seen.add(packet_id)
        if registration['assignmentState'] not in ('assigned', 'investigating', 'proposal-ready', 'review-ready', 'reconciled'):
            raise ValueError('Invalid registry assignment state: ' + packet_id)
        if set(registration['regionIds']) - region_ids or set(registration['sourceGroupIds']) - group_ids:
            raise ValueError('Unknown registry region/group: ' + packet_id)
        packet = registration.get('proposal')
        review = registration.get('independentReview')
        members = registration.get('memberRecords', [])
        proposal = None
        if registration['assignmentState'] in ('proposal-ready', 'review-ready', 'reconciled') and not packet:
            raise ValueError('Completed assignment stage requires pinned proposal')
        if registration['assignmentState'] in ('review-ready', 'reconciled') and not review:
            raise ValueError('Review assignment stage requires pinned independent review')
        if packet:
            if not packet['path'].startswith(BASE + '/packets/'):
                raise ValueError('Registered proposal must live in packet folder')
            proposal = evidence.json(packet['path'], packet['sha256'])
        elif members or registration.get('sourceRefs') or review:
            raise ValueError('Draft assignment cannot claim members, sources or review without pinned proposal')
        member_ids = set()
        for member in members:
            if member['id'] in member_ids:
                raise ValueError('Duplicate registered member ID')
            member_ids.add(member['id'])
            node = json_pointer(proposal, member['jsonPointer'])
            if not isinstance(node, dict) or node.get('id') != member['id']:
                raise ValueError('Registered member ID/pointer mismatch')
        for ref in registration.get('sourceRefs', []):
            source_ref(ref['path'], ref['sha256'], ref['rect'])
        if review:
            review_text = evidence.read(review['path'], review['sha256']).decode()
            if packet['sha256'] not in review_text:
                raise ValueError('Registered review does not pin exact proposal')
        # Registration validates evidence references, not a future packet's semantics.
        result.append({**registration, 'coverageCredit': False,
                       'normalization': 'pending explicit packet adapter/model validation; no source-unit or semantic count credited',
                       'stages': {'surveyed': stage('related-context', 'listed region/group context only'),
                                  'investigated': stage('registered-proposal' if packet else 'in-progress', 'assignment/proposal registration only', [packet['path']] if packet else []),
                                  'independentlyReviewed': stage('registered-evidence' if review else 'no-evidence', 'review reference only; applicability requires explicit normalization', [review['path']] if review else []),
                                  'ownerFeedback': stage(), 'accepted': stage()}})
    return result


def e01_expansion(evidence, source_ref, masters):
    path = BASE + '/packets/E01-outdoor-seating.json'
    review_path = BASE + '/packets/E01-outdoor-seating-review.md'
    packet = evidence.json(path, E01_PROPOSAL_PIN)
    review_text = evidence.read(review_path, E01_REVIEW_PIN).decode()
    if E01_PROPOSAL_PIN not in review_text:
        raise ValueError('E01 review applicability mismatch')
    model = evidence.json(MODEL, MODEL_PIN)
    if model.get('versionedAdapters', {}).get('extensions') != ['E01-outdoor-seating-v1', 'I01-interior-sofas-v1']:
        raise ValueError('Unsupported normalized extension adapters')
    model_records = {r['id']: r for r in model['sourceRecords'] if r['packetId'] == 'E01'}
    model_files = {r['path']: r for r in model['sourceFiles']}
    source_table = {r['id']: r for r in packet['sources']}
    for value in source_table.values():
        source_ref(value['path'], value['pngSHA256'], [0, 0, *value['size']])
    if packet['schemaVersion'] != 2 or len(model_records) != 27:
        raise ValueError('E01 schema/accounting mismatch')
    result = []
    for candidate in packet['candidates']:
        rid = candidate['id']
        normalized = model_records[rid]
        kind = 'exact-direct' if candidate['masterOccurrences'] else 'original-only'
        if (normalized['originalEvidence'] != candidate or
                normalized['primaryLineage'] != ('direct' if kind == 'exact-direct' else 'original-only')):
            raise ValueError('E01 normalized source lineage differs')
        refs = []
        for sid in candidate['namedExportAliases']:
            source = source_table[sid]
            refs.append(source_ref(source['path'], source['pngSHA256'], candidate['exportRect']))
        master_aliases, supplemental = [], []
        for occurrence in candidate['occurrences']:
            source = source_table[occurrence['sourceId']]
            ref = source_ref(source['path'], source['pngSHA256'], occurrence['rect'])
            if source['path'] == masters['exteriors']['alias']:
                if source['pngSHA256'] != masters['exteriors']['sha256']:
                    raise ValueError('E01 committed/original master alias pin differs')
                master_aliases.append(ref)
            else:
                if ref['scopeGroup'] != 'exteriors-theme-sheets':
                    raise ValueError('Unsupported E01 supplemental occurrence domain')
                supplemental.append(ref)
        master_rects = [o['rect'] for o in candidate['masterOccurrences']]
        if [r['rect'] for r in master_aliases] != master_rects:
            raise ValueError('E01 original/committed master lineage differs')
        integration = []
        for alias in normalized.get('integrationAliases', []):
            original = next(r for r in refs if r['path'] == alias['originSourceFile'])
            pin = model_files[alias['sourceFile']]
            if pin['sha256'] != original['sha256'] or alias['bounds']['value'] != original['rect']:
                raise ValueError('E01 integration alias differs from original export')
            evidence.read(alias['sourceFile'], pin['sha256'])
            integration.append({'path': alias['sourceFile'], 'sha256': pin['sha256'],
                                'rect': alias['bounds']['value'], 'originSource': original,
                                'scope': 'byte-identical committed export copy; no original-master occurrence or semantic approval'})
        if kind == 'original-only' and (master_rects or supplemental):
            raise ValueError('Original-only E01 record cannot gain a sheet occurrence')
        for rect in master_rects:
            check_rect(rect, masters['exteriors']['dimensions'])
        result.append({'id': rid, 'packet': 'E01', 'sources': refs,
                       'normalizedPixelSHA256': candidate['normalizedRgbaSHA256'],
                       'frameDimensions': candidate['exportRect'][2:],
                       'lineage': {'kind': kind, 'master': 'exteriors', 'rects': master_rects,
                                   'scope': 'primary original-master correspondence only; original-only still has exact whole-export source identity'},
                       'committedMasterAliases': master_aliases, 'supplementalOccurrences': supplemental,
                       'integrationAliases': integration, 'regionLinks': [],
                       'stages': {'surveyed': stage('context-only', 'survey does not individually segment this export'),
                                  'investigated': stage('evidenced', 'pinned bounded E01 record', [path], [rid]),
                                  'independentlyReviewed': stage('evidenced', 'explicit E01 member disposition; bounded source/interpretation limits', [review_path], [rid]),
                                  'ownerFeedback': stage(), 'accepted': stage()}})
    if Counter(r['lineage']['kind'] for r in result) != {'exact-direct': 25, 'original-only': 2}:
        raise ValueError('E01 primary lineage accounting differs')
    if sum(len(r['supplementalOccurrences']) for r in result) != 25:
        raise ValueError('E01 supplemental occurrence accounting differs')
    return result


def i01_expansion(evidence, source_ref, masters):
    path, review_path = BASE + '/packets/I01-interior-sofas.json', BASE + '/packets/I01-interior-sofas-review.md'
    packet = evidence.json(path, I01_PROPOSAL_PIN)
    text = evidence.read(review_path, I01_REVIEW_PIN).decode()
    model = evidence.json(MODEL, MODEL_PIN)
    normalized = {r['id']: r for r in model['sourceRecords'] if r['packetId'] == 'I01'}
    table = {r['id']: r for r in packet['sources']}
    if (packet['schemaVersion'] != 2 or len(normalized) != 20 or I01_PROPOSAL_PIN not in text or
            'I01-interior-sofas-v1' not in model['versionedAdapters']['extensions']):
        raise ValueError('I01 schema/accounting/review applicability mismatch')
    result = []
    for candidate in packet['candidates']:
        rid = candidate['id']
        kind = 'exact-direct' if candidate['variant'] == 'normal' else 'counterpart-derived'
        if normalized[rid]['originalEvidence'] != candidate or normalized[rid]['primaryLineage'] != ('direct' if kind == 'exact-direct' else 'derived'):
            raise ValueError('I01 normalized source lineage differs')
        refs = [source_ref(table[a['sourceId']]['path'], table[a['sourceId']]['pngSHA256'], candidate['exportRect'])
                for a in candidate['namedExportAliases']]
        supplemental, master_refs = [], []
        for occurrence in candidate['occurrences']:
            src = table[occurrence['sourceId']]
            ref = source_ref(src['path'], src['pngSHA256'], occurrence['rect'])
            if ref['path'] == masters['interiors']['path']:
                master_refs.append(ref)
            else:
                if ref['scopeGroup'] not in ('interiors-theme-normal', 'interiors-theme-black-shadow', 'interiors-theme-shadowless'):
                    raise ValueError('Unsupported I01 supplemental domain')
                supplemental.append(ref)
        if kind == 'counterpart-derived' and master_refs:
            raise ValueError('I01 render counterpart cannot gain an original-master occurrence')
        packed = table[candidate['packedAlias']['sourceId']]
        evidence.read(packed['path'], packed['pngSHA256'])
        result.append({'id': rid, 'packet': 'I01', 'sources': refs,
                       'normalizedPixelSHA256': candidate['normalizedRgbaSHA256'], 'frameDimensions': candidate['exportRect'][2:],
                       'lineage': {'kind': kind, 'master': 'interiors', 'rects': [r['rect'] for r in master_refs],
                                   'contextRects': [] if kind == 'exact-direct' else [o['rect'] for o in packet['candidates'][0]['occurrences'] if table[o['sourceId']]['path'] == masters['interiors']['path']],
                                   'scope': 'exact original-master frames separate from bounded cap-4 counterpart context; context is not an occurrence'},
                       'packedAliases': [{'path': packed['path'], 'sha256': packed['pngSHA256'], 'key': a['packedKey'],
                                          'rect': a['packedRect'], 'originalSource': refs[i],
                                          'coordinateSpace': 'packed-atlas-pixels'} for i, a in enumerate(candidate['namedExportAliases'])],
                       'committedMasterAliases': [], 'supplementalOccurrences': supplemental,
                       'integrationAliases': [], 'regionLinks': [], 'topology': candidate['topology'],
                       'stages': {'surveyed': stage('context-only', 'survey does not individually segment this export'),
                                  'investigated': stage('evidenced', 'pinned bounded I01 record', [path], [rid]),
                                  'independentlyReviewed': stage('evidenced', 'exact I01 per-record disposition; unresolved roles and bounded rendering retained', [review_path], [rid]),
                                  'ownerFeedback': stage(), 'accepted': stage()}})
    if (Counter(r['lineage']['kind'] for r in result) != {'exact-direct': 18, 'counterpart-derived': 2} or
            sum(len(r['sources']) for r in result) != 28 or sum(len(r['supplementalOccurrences']) for r in result) != 28 or
            sum(len(r['lineage']['rects']) for r in result) != 18):
        raise ValueError('I01 occurrence/alias accounting differs')
    return result


def build(root=REPO):
    evidence = Evidence(root)
    manifest = evidence.json(BASE + '/source-manifest.json')
    inventory = evidence.json(BASE + '/source-files.json', manifest['sourceFiles']['sha256'])
    rows = inventory['files']
    files = {r[0]: dict(zip(inventory['columns'], r)) for r in rows}
    if len(files) != len(rows):
        raise ValueError('Duplicate source path in inventory')
    originals = [r for r in rows if r[5] != 'committed-reference']
    if fingerprint(originals) != manifest['revision']['includedOriginalPNGsFingerprint']:
        raise ValueError('Included source-set fingerprint mismatch')
    for group, metrics in manifest['groups'].items():
        subset = [r for r in rows if r[5] == group]
        if len(subset) != metrics['pngCount'] or fingerprint(subset) != metrics['fingerprint']:
            raise ValueError(f'Inventory group mismatch: {group}')
    for pin in manifest['anchorFiles']:
        source = files[pin['path']]
        if (source['sha256'], source['width'], source['height']) != (pin['sha256'], pin['width'], pin['height']):
            raise ValueError('Anchor pin mismatch: ' + pin['path'])
    # Verify portable actual inputs. Ignored original pixels are deliberately not required.
    for pin in manifest['anchorFiles'] + manifest['committedIndexAndBuilderInputs']:
        if pin['path'].startswith(('public/', 'scripts/')):
            evidence.read(pin['path'], pin['sha256'])
    proposals = {}
    reviews = {}
    for name, digest in FROZEN.items():
        path = BASE + '/packets/' + name
        proposals[name] = evidence.json(path, digest)
        review_name = name.replace('-regions.json', '-review.md').replace('.json', '-review.md')
        review_path = BASE + '/packets/' + review_name
        text = evidence.read(review_path).decode()
        if digest not in text:
            raise ValueError('Independent review does not pin proposal: ' + review_path)
        reviews[name] = review_path
    reconciliation = BASE + '/notes/2026-10-04-pilot-reconciliation.md'
    owner_note = BASE + '/notes/2026-10-04-family-contact-sheets.md'
    evidence.read(reconciliation)
    owner_text = evidence.read(owner_note).decode()
    topology_path = BASE + '/packets/P03-cabinets-topology.json'
    evidence.json(topology_path)
    for required in ['2d060fe37cb5fc93b76c21827a4a9abe29910c01aca433bd61cd6de26f245092',
                     '2cb786c', '[0,48,16,96,32]', 'three depicted varied-offset']:
        if required not in owner_text:
            raise ValueError('Owner acceptance provenance missing: ' + required)

    def source_ref(path, digest, rect):
        if path not in files or files[path]['sha256'] != digest:
            raise ValueError('Source pin mismatch: ' + path)
        check_rect(rect, [files[path]['width'], files[path]['height']])
        return {'path': path, 'sha256': digest, 'rect': rect, 'scopeGroup': files[path]['scopeGroup']}

    ex = proposals['S02-exteriors-regions.json']
    interior = proposals['S02-interiors-regions.json']
    masters = {'exteriors': ex['source'], **interior['sources']}
    for key, master in masters.items():
        dims = master.get('dimensions', [master.get('width'), master.get('height')])
        master['dimensions'] = dims
        source_ref(master['path'], master['sha256'], [0, 0, *dims])

    records = []
    p1 = proposals['P01-trees.json']
    occurrences = {o['id']: o['all_pixel_exact_master_occurrences'] for o in p1['experiments']['occurrences']}
    candidate_by_id = {r['id']: r for r in p1['candidates']}
    for c in p1['candidates']:
        rects = occurrences[c['id']]
        lineage = {'kind': 'exact-direct', 'master': 'exteriors', 'rects': rects}
        if not rects:
            rel = next(r for r in p1['relations'] if r.get('result') == c['id'])
            base = candidate_by_id[rel['base']]
            patch = candidate_by_id[rel['patch']]
            lineage = {'kind': 'exact-composition', 'master': 'exteriors',
                       'rects': [base['master_anchor'], patch['source_rect']],
                       'recipe': rel, 'wholeFrameAbsent': True}
        records.append({'id': 'P01/' + c['id'], 'packet': 'P01',
                        'sources': [source_ref(c['source_path'], c['source_sha256'], c['source_rect'])],
                        'lineage': lineage})
    p2 = proposals['P02-scrapyard.json']
    for c in p2['candidates']:
        records.append({'id': c['id'], 'packet': 'P02',
                        'sources': [source_ref(s['path'], s['sha256'], s['rect']) for s in c['sources']],
                        'lineage': {'kind': 'exact-direct', 'master': 'exteriors',
                                    'rects': [o['rect'] for o in c['masterOccurrences']]}})
    p3 = proposals['P03-cabinets.json']
    correspondences = {s['record']: s['originalCorrespondence'] for c in p3['semanticProposals']
                       for s in c['sourceCorrespondences']}
    for c in p3['measurements']['records']:
        corr = correspondences[c['id']]
        kind = corr['kind']
        rects = corr.get('sourceRects', [s['sourceRect'] for s in corr.get('composition', [])])
        if kind == 'counterpart-based-derived':
            parent = correspondences[corr['normalRecord']]
            rects = parent.get('sourceRects', [s['sourceRect'] for s in parent.get('composition', [])])
        records.append({'id': c['id'], 'packet': 'P03',
                        'sources': [source_ref(c['single']['path'], c['single']['sha256'], c['singleSourceRect'])],
                        'packedAlias': {'path': p3['measurements']['sources']['packedAtlas']['path'],
                                        'sha256': p3['measurements']['sources']['packedAtlas']['sha256'],
                                        'key': c['packedAliasKey'], 'rect': c['packedRect']},
                        'lineage': {'kind': {'exact-whole-frame': 'exact-direct',
                                            'counterpart-based-derived': 'counterpart-derived'}.get(kind, kind),
                                    'master': 'interiors', 'rects': rects, 'correspondence': corr}})
    if len({r['id'] for r in records}) != len(records):
        raise ValueError('Duplicate pilot record ID')
    for r in records:
        for rect in r['lineage']['rects']:
            check_rect(rect, masters[r['lineage']['master']]['dimensions'])
        r['regionLinks'] = []

    regions = []
    survey_sets = [(ex['regions'], 'exteriors', 'theme-search-window', 'S02-exteriors-regions.json'),
                   (ex['pilot_windows'], 'exteriors', 'pilot-search-window', 'S02-exteriors-regions.json'),
                   (ex['unclassified_regions'], 'exteriors', 'residual-accounting-window', 'S02-exteriors-regions.json'),
                   (interior['regions'], None, None, 'S02-interiors-regions.json')]
    for raw_regions, master_id, role, proposal_name in survey_sets:
        for raw in raw_regions:
            master_key = master_id or raw['source']
            master = masters[master_key]
            rect = rectangle(raw['rect'])
            ref = source_ref(master['path'], master['sha256'], rect)
            region_id = 'S02-exteriors/' + raw['id'] if master_key == 'exteriors' else raw['id']
            current = {k: v for k, v in raw.items() if k not in ('rect', 'id', 'source', 'independentReview', 'humanApproval')}
            correction = CORRECTIONS.get(raw['id'], {})
            current.update(correction)
            if raw['id'] == 'S02-F-wooden-cabinet-pilot':
                current['observedFamilies'] = 'Complete wooden cabinets and horizontal assembly components; reflective panels may be mirrored or glazed. Side-facing whole-object interpretation refuted for pilot 41–44.'
                correction = {'observedFamilies': current['observedFamilies']}
            linked = []
            for r in records:
                lin = r['lineage']
                if lin['master'] == master_key and any(intersects(rect, p) for p in lin['rects']):
                    linked.append(r['id'])
                    r['regionLinks'].append({'regionId': region_id,
                                             'relation': 'counterpart-lineage-context' if lin['kind'] == 'counterpart-derived'
                                             else 'source-rectangle-intersection'})
            proposal_path = BASE + '/packets/' + proposal_name
            stage_evidence = [proposal_path, reviews[proposal_name]]
            stages = {'surveyed': stage('evidenced', 'whole-source survey / this navigation window', [proposal_path]),
                      'investigated': stage('partial' if linked else 'no-evidence', 'listed pilot records only' if linked else 'individual semantics unassigned', [], linked),
                      'independentlyReviewed': stage('evidenced', 'survey window only; pilot record reviews remain separate', stage_evidence),
                      'ownerFeedback': stage(), 'accepted': stage()}
            packets = sorted({r['packet'] for r in records if r['id'] in linked})
            if linked:
                stages['investigated']['evidence'] = [BASE + '/packets/' + next(n for n in FROZEN if n.startswith(p + '-')) for p in packets]
                stages['ownerFeedback'] = stage('related-feedback', 'pilot sheet/selected members, not whole region', [owner_note], linked)
            accepted = [r for r in linked if r in ('P01/F02', 'P01/F05', 'P01/F08')]
            if accepted:
                stages['accepted'] = stage('bounded-example-only', 'three forest composition recipes; no region/member/geometry approval', [owner_note], accepted)
            regions.append({'id': region_id, 'master': master_key, 'role': role or raw['role'],
                            'source': ref, 'currentInterpretation': current,
                            'supersedesFrozenFields': correction,
                            'correctionEvidence': ([reconciliation, reviews['P03-cabinets.json'], topology_path] if raw['id'] == 'S02-F-wooden-cabinet-pilot' else [reconciliation, reviews[proposal_name]]) if correction else [],
                            'stages': stages, 'pilotRecordIds': linked,
                            'assignment': {'state': 'partial-pilot' if linked else 'unassigned',
                                           'owner': None, 'next': 'Segment bounded objects and verify all occurrences/relations; retain unknown geometry.'},
                            'caveats': ['Search/accounting rectangle, not tight bounds or exclusive family membership.',
                                        'Intersection can clip a frame; links do not count unique objects or completed pixels.',
                                        'Counterpart lineage does not establish a raw master occurrence.']})
    if len({r['id'] for r in regions}) != len(regions):
        raise ValueError('Duplicate region ID')
    for r in records:
        if not r['regionLinks']:
            raise ValueError('Unassigned pilot master lineage: ' + r['id'])
        packet_file = next(n for n in FROZEN if n.startswith(r['packet'] + '-'))
        r['stages'] = {'surveyed': stage('context-only', 'master survey does not independently segment this record'),
                       'investigated': stage('evidenced', 'pinned pilot record', [BASE + '/packets/' + packet_file], [r['id']]),
                       'independentlyReviewed': stage('evidenced', 'explicit pilot disposition with retained qualifications', [reviews[packet_file], reconciliation], [r['id']]),
                       'ownerFeedback': stage('related-feedback', 'sheet/selected-member feedback, not per-record acceptance', [owner_note]),
                       'accepted': stage()}

    groups = []
    for group, metrics in manifest['groups'].items():
        paths = sorted({s['path'] for r in records for s in r['sources'] if s['scopeGroup'] == group})
        refs = [r['id'] for r in records if any(s['scopeGroup'] == group for s in r['sources'])]
        region_ids = [r['id'] for r in regions if r['source']['scopeGroup'] == group]
        group_survey_evidence = sorted({pin for r in regions if r['id'] in region_ids for pin in r['stages']['surveyed']['evidence']})
        group_pilot_evidence = sorted({BASE + '/packets/' + n for r in records if r['id'] in refs for n in FROZEN if n.startswith(r['packet'] + '-')})
        group_review_evidence = sorted({reviews[n] for n in FROZEN if BASE + '/packets/' + n in group_survey_evidence + group_pilot_evidence})
        groups.append({'id': group, 'kind': 'master' if group in MASTER_GROUPS else 'reference' if group == 'committed-reference' else 'supplemental',
                       'sourceInventory': {**metrics, 'path': BASE + '/source-files.json',
                                           'sha256': manifest['sourceFiles']['sha256'], 'selector': {'scopeGroup': group}},
                       'regionIds': region_ids, 'pilotReferencedPNGPaths': paths,
                       'pilotReferencedPNGPathCount': len(paths), 'pilotRecordIds': refs,
                       'assignment': {'state': 'master-surveyed-partial-semantics' if region_ids else 'partial-pilot' if refs else 'unassigned', 'owner': None},
                       'stages': {'surveyed': stage('evidenced' if region_ids else 'no-evidence', 'master navigation only' if region_ids else 'inventory is not visual survey', group_survey_evidence),
                                  'investigated': stage('partial' if refs else 'no-evidence', 'listed pilot records only', group_pilot_evidence, refs),
                                  'independentlyReviewed': stage('related-evidence' if refs or region_ids else 'no-evidence', 'listed surveys/pilots only', group_review_evidence),
                                  'ownerFeedback': stage('related-feedback' if refs else 'no-evidence', 'sheet-level only', [owner_note] if refs else []),
                                  'accepted': stage()},
                       'caveats': ['PNG occurrences and distinct file hashes are inventory counts, not assets, semantics or approval.',
                                   'Master/sheet path reference never means the whole PNG is semantically investigated.',
                                   'Unreferenced files remain unassigned even when a duplicate or packed alias is known.']})

    expanded = e01_expansion(evidence, source_ref, masters) + i01_expansion(evidence, source_ref, masters)
    for record in expanded:
        for region in regions:
            if region['master'] == record['lineage']['master']:
                for key, relation in [('rects', 'exact-master-source-rectangle-intersection'), ('contextRects', 'counterpart-lineage-context')]:
                    if any(intersects(region['source']['rect'], r) for r in record['lineage'].get(key, [])):
                        record['regionLinks'].append({'regionId': region['id'], 'relation': relation})
        if record['lineage']['kind'] == 'exact-direct' and not record['regionLinks']:
            raise ValueError('Unassigned expansion exact master occurrence')
    for region in regions:
        linked = [r['id'] for r in expanded if any(l['regionId'] == region['id'] for l in r['regionLinks'])]
        region['expandedRecordIds'] = linked
        if linked:
            region['stages']['investigated']['state'] = 'partial'
            region['stages']['investigated']['scope'] = 'listed pilot/expansion records only'
            region['stages']['investigated']['recordIds'].extend(linked)
            region['stages']['investigated']['evidence'].extend(sorted({BASE + '/packets/' + ('E01-outdoor-seating.json' if r['packet'] == 'E01' else 'I01-interior-sofas.json') for r in expanded if r['id'] in linked}))
            region['assignment']['state'] = 'partial-mapped-records'
        region['expandedIndependentReviewEvidence'] = sorted({BASE + '/packets/' + ('E01-outdoor-seating-review.md' if r['packet'] == 'E01' else 'I01-interior-sofas-review.md') for r in expanded if r['id'] in linked})
    for group in groups:
        group_refs = [(r, ref) for r in expanded for ref in r['sources'] + r['supplementalOccurrences'] + r['committedMasterAliases'] if ref['scopeGroup'] == group['id']]
        primary_refs = []
        if group['id'] in ('exteriors-master', 'interiors-master'):
            for record in expanded:
                if group['id'] != record['lineage']['master'] + '-master':
                    continue
                master = masters[record['lineage']['master']]
                for rect in record['lineage']['rects']:
                    ref = source_ref(master['path'], master['sha256'], rect)
                    primary_refs.append({'recordId': record['id'], 'source': ref, 'proof': 'Exact pinned original-master occurrence; alias is not an additional record or occurrence count'})
                    group_refs.append((record, ref))
        group['expandedPrimaryMasterReferences'] = primary_refs
        ids = sorted({r['id'] for r, ref in group_refs})
        paths = sorted({ref['path'] for r, ref in group_refs})
        group['expandedRecordIds'] = ids
        group['expandedReferencedPNGPaths'] = paths
        group['expandedReferencedPNGPathCount'] = len(paths)
        group['expandedSupplementalOccurrenceCount'] = sum(len([ref for ref in r['supplementalOccurrences'] if ref['scopeGroup'] == group['id']]) for r in expanded)
        if ids:
            group['stages']['investigated'] = stage('partial', 'listed pilot/expansion references only; no whole-PNG completion', group['stages']['investigated']['evidence'] + sorted({BASE + '/packets/' + ('E01-outdoor-seating.json' if r['packet'] == 'E01' else 'I01-interior-sofas.json') for r, ref in group_refs}), group['pilotRecordIds'] + ids)
            group['stages']['independentlyReviewed'] = stage('related-evidence', 'listed survey/pilot/expansion records only', group['stages']['independentlyReviewed']['evidence'] + sorted({BASE + '/packets/' + ('E01-outdoor-seating-review.md' if r['packet'] == 'E01' else 'I01-interior-sofas-review.md') for r, ref in group_refs}))
            group['assignment']['state'] = 'partial-mapped-records'

    registered = registrations(evidence, {r['id'] for r in regions}, {g['id'] for g in groups}, source_ref)
    for registration in registered:
        contracts = {'E01-outdoor-seating': ('E01', E01_PROPOSAL_PIN, E01_REVIEW_PIN, 'E01-outdoor-seating-v1', 27, 27),
                     'I01-interior-sofas': ('I01', I01_PROPOSAL_PIN, I01_REVIEW_PIN, 'I01-interior-sofas-v1', 20, 18)}
        if registration['packetId'] in contracts:
            pid, proposal_pin, review_pin, adapter, record_count, proposal_count = contracts[registration['packetId']]
            members = [r['id'] for r in expanded if r['packet'] == pid]
            if {m['id'] for m in registration['memberRecords']} != set(members):
                raise ValueError(pid + ' registered/model membership mismatch')
            if registration['proposal']['sha256'] != proposal_pin or registration['independentReview']['sha256'] != review_pin:
                raise ValueError(pid + ' registration applicability differs')
            registration['stages']['investigated'] = stage('evidenced', f'{record_count} explicit normalized bounded {pid} records; no whole-region completeness', [registration['proposal']['path'], MODEL], members)
            registration['stages']['independentlyReviewed'] = stage('evidenced', f'exact {pid} proposal/member dispositions preserved by reviewed explicit model adapter', [registration['independentReview']['path'], MODEL], members)
            registration['coverageCredit'] = True
            registration['normalization'] = {'adapter': adapter, 'modelPath': MODEL, 'modelSHA256': MODEL_PIN, 'sourceRecords': record_count, 'proposalUnits': proposal_count, 'limit': 'bounded records only; no region/family/pixel completion'}
    for region in regions:
        region['packetAssignments'] = [{'packetId': p['packetId'], 'state': p['assignmentState']}
                                       for p in registered if region['id'] in p['regionIds']]
    for group in groups:
        group['packetAssignments'] = [{'packetId': p['packetId'], 'state': p['assignmentState']}
                                      for p in registered if group['id'] in p['sourceGroupIds']]

    acceptance = {'id': 'owner-2026-10-04-varied-forest-interiors', 'state': 'accepted',
                  'scope': 'three depicted interior-fill compositions only', 'evidence': owner_note,
                  'checkpointCommit': '2cb786c', 'probeScriptSHA256': '2d060fe37cb5fc93b76c21827a4a9abe29910c01aca433bd61cd6de26f245092',
                  'source': {'path': masters['exteriors']['path'], 'sha256': masters['exteriors']['sha256']},
                  'members': [{'recordId': 'P01/' + rid, 'sourceRect': candidate_by_id[rid]['master_anchor'], 'horizontalPeriod': period}
                              for rid, period in [('F02', 128), ('F05', 128), ('F08', 112)]],
                  'recipe': {'verticalStep': 48, 'rowOffsets': [0, 48, 16, 96, 32], 'background': '#479757',
                             'drawOrder': 'back-to-front', 'interiorCropWidth': 256, 'displayScale': 2},
                  'excluded': ['edges/caps', 'infinite/chunked placement', 'seeded phase selection', 'collision', 'whole-family semantics']}
    return {'schemaVersion': 1, 'kind': 'semantic-source-assignment-ledger',
            'sourceRevision': manifest['revision'], 'coordinates': manifest['coordinates'],
            'evidencePins': list(evidence.pins.values()),
            'verification': {'mode': 'committed-evidence-and-portable-inputs',
                             'originalPNGBytesVerified': False,
                             'limits': 'No new pixel search, alpha metric, object denominator or source-art approval. Restore originals and run source inventory/survey commands for pixel verification.'},
            'stageContract': {'surveyed': 'Broad navigation resolution only; inventory is not visual evidence.',
                              'investigated': 'Explicit bounded record/relationship claims with pinned proposal.',
                              'independentlyReviewed': 'Review explicitly pins exact proposal and states scope; never inherits across edits.',
                              'ownerFeedback': 'Discussion/question/positive feedback distinct from acceptance.',
                              'accepted': 'Explicit human decision on exact bounded source/recipe; no propagation to region, variant, topology or geometry.'},
            'accounting': {'surveyWindows': len(regions), 'surveyWindowsByMaster': dict(Counter(r['master'] for r in regions)),
                           'inventoryGroups': len(groups), 'originalPNGPaths': len(originals),
                           'pilotSourceRecords': len(records), 'pilotProposalUnits': 67,
                           'expandedSourceRecords': len(expanded), 'expandedProposalUnits': 45,
                           'allNormalizedSourceRecords': len(records) + len(expanded),
                           'allNormalizedProposalUnits': 112,
                           'expansionPacketAccounting': {pid: {'sourceRecords': sum(r['packet'] == pid for r in expanded), 'proposalUnits': units} for pid, units in [('E01', 27), ('I01', 18)]},
                           'expansionPackedAliasReferences': sum(len(r.get('packedAliases', [])) for r in expanded),
                           'expansionPrimaryMasterLineageRecords': dict(Counter(r['lineage']['kind'] for r in expanded)),
                           'expansionNamedExportReferences': sum(len(r['sources']) for r in expanded),
                           'expansionSupplementalExactOccurrences': sum(len(r['supplementalOccurrences']) for r in expanded),
                           'expansionCommittedIntegrationAliases': sum(len(r['integrationAliases']) for r in expanded),
                           'primaryMasterLineageRecords': dict(Counter(r['lineage']['kind'] for r in records)),
                           'explicitOwnerAcceptedCompositionExamples': 3,
                           'semanticCompletion': 'unknown; no exhaustive object/family denominator',
                           'countsAreNot': ['unique objects', 'completed-source percentage', 'human-approved source members']},
            'regions': regions, 'sourceGroups': groups, 'pilotRecords': records, 'expandedRecords': expanded, 'registeredPackets': registered, 'acceptanceScopes': [acceptance],
            'gaps': {'individualSemantics': 'Every master region retains unsegmented/unassigned content beyond explicitly linked pilot records; no region is complete.',
                     'exteriorsResiduals': [r['id'] for r in regions if r['role'] == 'residual-accounting-window'],
                     'supplementalUnassignedGroups': [g['id'] for g in groups if g['kind'] == 'supplemental' and not g['pilotRecordIds'] and not g['expandedRecordIds']],
                     'supplementalPartialGroups': [g['id'] for g in groups if g['kind'] == 'supplemental' and (g['pilotRecordIds'] or g['expandedRecordIds'])],
                     'annotation': 'Five Room Builder search windows can overlap art; only alpha residuals outside family windows were dispositioned as captions/arrows.',
                     'duplicates': '6,224 Exteriors theme singles are byte-identical same-name complete singles. Distinct paths remain occurrences; no semantic completion inherited.',
                     'packedAliases': 'Interiors atlas is a selection, not either master. Packed rect never supplies original-master coordinates. Unindexed/unreferenced does not prove missing art.',
                     'assemblyAndGeometry': 'Cabinet 41–44 and I01 front/side topology constrain component use; four lower-seat roles remain unknown. Arbitrary assemblies, terrain compatibility, collision and runtime enforcement remain unaccepted.'},
            'readyBoundedPackets': [
                {'key': 'room-builder-path-arch', 'regions': ['S02-R11', 'S02-R09'],
                 'scope': 'RB01: 17 floor pieces, six fixed arch body cells and two shadow companions; bounded recipes and master/subfile shadow differences retained.', 'state': next((r['assignmentState'] for r in registered if r['packetId'] == 'RB01-room-builder-path-arch'), 'ready-unassigned'), 'supersededByRegistration': 'RB01-room-builder-path-arch'},
                {'key': 'interiors-sofa-contrast', 'regions': ['S02-I16', 'S02-F-large-sofa-probe'],
                 'scope': 'Bounded Basement sofa component/seat packet I01 independently reviewed; explicit20-record/18-unit normalization retains partial/unknown placement and independent exact review.', 'state': next((r['assignmentState'] for r in registered if r['packetId'] == 'I01-interior-sofas'), 'ready-unassigned'), 'supersededByRegistration': 'I01-interior-sofas'},
                {'key': 'exteriors-playground-tubes', 'regions': ['S02-exteriors/E10'],
                 'scope': 'E03: 25 crawl-tube components, explicit continuation ports, bounded positive/negative assemblies and unresolved rounded/collared roles.', 'state': next((r['assignmentState'] for r in registered if r['packetId'] == 'E03-playground-tubes'), 'ready-unassigned'), 'supersededByRegistration': 'E03-playground-tubes'},
                {'key': 'supplemental-animation-reconciliation', 'groups': ['exteriors-animations', 'interiors-animations'],
                 'scope': 'A01 investigates one Interiors door family; other Interiors animations and an Exteriors animation trial remain unassigned. Source frame order, GIF demonstration playback and game behavior stay separate.', 'state': 'partially-registered' if any(r['packetId'] == 'A01-animation' for r in registered) else 'ready-unassigned', 'registeredPacketIds': [r['packetId'] for r in registered if r['packetId'] == 'A01-animation']}],
            'registrationContract': ['Add each new packet as a new pinned proposal and separately pinned independent review; retain frozen snapshots.',
                                     'Register explicit source paths/hashes/local rects; original-master occurrences, compositions and counterpart-derived lineage remain different kinds.',
                                     'Record all found occurrences and search limits. Region links use source lineage/intersection, never a label-only match.',
                                     'Keep packet assignment owner/state separate from evidence stages; unassigned residual/supplemental domains remain visible.',
                                     'Add assignments/proposal/review pins in mapping-registry.json. MemberRecords use exact IDs and JSON pointers; sourceRefs retain path/hash/local rectangle. Registry validation earns no semantic coverage credit.',
                                     'Use an explicit new packet adapter/model normalization with regression tests before crediting registered records; append without inflating region completeness.',
                                     'Owner feedback and acceptance require dated exact scope/provenance. No approval from agent dispositions or positive comments.',
                                     'Do not publish percentages until segmentation denominator and source union/duplicate treatment are independently proven.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--repo', type=Path, default=REPO, help='Evidence root (also used by corruption tests)')
    args = parser.parse_args()
    try:
        result = encode(build(args.repo))
        output = args.repo / OUTPUT
        if args.check:
            if not output.exists() or output.read_bytes() != result:
                raise ValueError('Coverage ledger is stale; run python3 scripts/semantic-map-coverage.py')
        else:
            output.write_bytes(result)
        counts = json.loads(result)['accounting']
        print(f"{'Checked' if args.check else 'Wrote'} source assignment ledger: {counts['surveyWindows']} windows, {counts['inventoryGroups']} groups, {counts['pilotSourceRecords']} pilot + {counts['expandedSourceRecords']} expanded records; semantic completeness unknown.")
    except (ValueError, KeyError, OSError, StopIteration) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
