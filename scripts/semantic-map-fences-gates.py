#!/usr/bin/env python3
"""Reproduce E05 low picket fences plus a separate garden-gate trial.

Only original native RGBA crops are used. --check compares frozen packet bytes;
--capture-dir writes disposable native and integer-zoom evidence, never assets.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'docs/tactical/053-semantic-tileset-map'
OUTPUT = PLAN / 'packets/E05-fences-gates.json'
BASE = 'assets/exteriors/Modern_Exteriors_16x16'
MASTER = 'public/assets/tilesets/me-complete.png'
LEDGER = 'docs/tactical/053-semantic-tileset-map/source-files.json'
INDEX = 'public/data/me-atlas-index.json'
MATCHER = 'scripts/semantic-map-match.py'
PINS = {LEDGER: 'c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda',
        INDEX: '248dec52d18da770669fe9b633697654f5789be3e7f12021222a36c8bad26dd2',
        MATCHER: 'f2ed8a0acb8031f390f767954fc63cafb699c0b5f1540731326f414497d31adc'}
MASTER_SHA = '1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737'
SPECS = [('Terrains_and_Fences', f'Fence_1_{i}') for i in range(1, 23)] + [('Garden', f'Gate_{i}') for i in range(1, 5)] + [('Garden', 'Bush_6')]
THEMES = [BASE + '/ME_Theme_Sorter_16x16/1_Terrains_and_Fences_16x16.png',
          BASE + '/ME_Theme_Sorter_16x16/17_Garden_16x16.png']
LIMIT = 'Finite source-image layouts only; matching port names do not establish arbitrary joins, collision or placement permission. No compatibility between the picket kit and garden-gate kit.'
LABELS = {
 1: 'Upper-left corner', 2: 'Upper horizontal section', 3: 'Upper-right corner',
 4: 'Right vertical section', 5: 'Right vertical section · alternate shading',
 6: 'Lower-right corner', 7: 'Lower horizontal section', 8: 'Lower-left corner',
 9: 'Left vertical section', 10: 'Left vertical section · alternate shading',
 11: 'Upper-left corner', 12: 'Upper-right corner',
 13: 'Lower-right corner', 14: 'Lower-left corner',
 15: 'Rising diagonal · lower half', 16: 'Rising diagonal · upper half',
 17: 'Falling diagonal · upper half', 18: 'Falling diagonal · lower half',
 19: 'Rising diagonal · alternate upper half', 20: 'Rising diagonal · alternate lower half',
 21: 'Falling diagonal · alternate lower half', 22: 'Falling diagonal · alternate upper half',
}
# Coordinates are image-plane join anchors, not world compass or geometry.
# Horizontal rail joins use a 16px export advance; vertical side posts are at x3/x10.
PORTS = {
 1: [('right', [16, 7], 'horizontal'), ('bottom', [3, 16], 'left-post')],
 2: [('left', [0, 7], 'horizontal'), ('right', [16, 7], 'horizontal')],
 3: [('left', [0, 7], 'horizontal'), ('bottom', [10, 16], 'right-post')],
 4: [('top', [10, 0], 'right-post'), ('bottom', [10, 16], 'right-post')],
 5: [('top', [10, 0], 'right-post'), ('bottom', [10, 16], 'right-post')],
 6: [('left', [0, 7], 'horizontal'), ('top', [10, 0], 'right-post')],
 7: [('left', [0, 7], 'horizontal'), ('right', [16, 7], 'horizontal')],
 8: [('right', [16, 7], 'horizontal'), ('top', [3, 0], 'left-post')],
 9: [('top', [3, 0], 'left-post'), ('bottom', [3, 16], 'left-post')],
 10: [('top', [3, 0], 'left-post'), ('bottom', [3, 16], 'left-post')],
 15: [('top', [0, 0], 'rising-diagonal-a')], 16: [('bottom', [0, 16], 'rising-diagonal-a')],
 17: [('bottom', [0, 16], 'falling-diagonal-a')], 18: [('top', [0, 0], 'falling-diagonal-a')],
 19: [('bottom', [0, 16], 'rising-diagonal-b')], 20: [('top', [0, 0], 'rising-diagonal-b')],
 21: [('top', [0, 0], 'falling-diagonal-b')], 22: [('bottom', [0, 16], 'falling-diagonal-b')],
}
for alternate, original in ((11, 1), (12, 3), (13, 6), (14, 8)):
    PORTS[alternate] = PORTS[original]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sid(path):
    return 'src-' + sha(path.encode())[:16]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=True) + '\n').encode()


def receipt(value):
    return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())


def field(value, evidence, confidence='high', alternatives=None):
    return {'value': value, 'confidence': confidence, 'evidence': evidence,
            'alternatives': alternatives or [], 'disposition': 'proposed' if value is not None else 'unknown'}


def delta(left, right):
    require(left.size == right.size, 'Comparison needs explicit frame alignment')
    a, b = left.tobytes(), right.tobytes()
    changes = [a[i:i+4] != b[i:i+4] for i in range(0, len(a), 4)]
    mask = Image.new('L', left.size)
    mask.putdata([255 if changed else 0 for changed in changes])
    return {'changedPixels': sum(changes), 'alphaChangedPixels': sum(a[i+3] != b[i+3] for i in range(0, len(a), 4)),
            'changedBoundsXYXY': list(mask.getbbox()) if mask.getbbox() else None,
            'exactNormalizedRGBAEqual': a == b, 'changedMaskSHA256': sha(mask.tobytes())}


def ports(placements, candidates):
    values = []
    opposite = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}
    for index, placement in enumerate(placements):
        x, y = placement['at']
        for port in candidates[placement['memberId']]['topology'].get('openJoinEdges', []):
            px, py = port['originXY']
            values.append({'placementIndex': index, 'memberId': placement['memberId'], 'edge': port['edge'],
                           'profile': port['profile'], 'globalOriginXY': [x+px, y+py]})
    pairs, unmatched = [], []
    for index, port in enumerate(values):
        peers = [j for j, other in enumerate(values) if other['placementIndex'] != port['placementIndex']
                 and other['edge'] == opposite[port['edge']] and other['profile'] == port['profile']
                 and other['globalOriginXY'] == port['globalOriginXY']]
        if len(peers) != 1:
            unmatched.append(port)
        elif index < peers[0]:
            pairs.append([port, values[peers[0]]])
    return {'matchedPairs': pairs, 'unmatchedPorts': unmatched}


def render(recipe, images):
    out = Image.new('RGBA', tuple(recipe['size']))
    for placement in recipe['placements']:
        im = images[placement['memberId']]
        x, y = placement['at']
        require(x >= 0 and y >= 0 and x+im.width <= out.width and y+im.height <= out.height, 'Probe placement outside canvas')
        require(placement['blend'] == 'over', 'Only ordered source-over recipes')
        out.alpha_composite(im, (x, y))
    return out


def build(capture_dir=None):
    for path, expected in PINS.items():
        require(sha((ROOT/path).read_bytes()) == expected, 'Input pin drift: '+path)
    spec = importlib.util.spec_from_file_location('semantic_match_E05', ROOT/MATCHER)
    match = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(match)
    ledger = json.loads((ROOT/LEDGER).read_text())['files']
    ledger_by_path = {row[0]: row for row in ledger}
    sources = {}
    loaded = {}

    def read(path):
        if path in loaded:
            return loaded[path]
        row = ledger_by_path[path]
        raw = (ROOT/path).read_bytes()
        require(sha(raw) == row[1], 'PNG pin drift: '+path)
        image = match.normalized(Image.open(ROOT/path))
        require(list(image.size) == row[2:4], 'Dimensions drift: '+path)
        sources[sid(path)] = {'id': sid(path), 'path': path, 'sha256': row[1], 'dimensions': list(image.size),
                              'normalizedRgbaSHA256': sha(image.tobytes())}
        loaded[path] = image
        return image

    master = read(MASTER)
    require(sha((ROOT/MASTER).read_bytes()) == MASTER_SHA, 'Committed master drift')
    original_master_path = BASE+'/Modern_Exteriors_Complete_Tileset.png'
    require(read(original_master_path).tobytes() == master.tobytes(), 'Original/committed masters differ')
    domain = {MASTER: master, **{path: read(path) for path in THEMES}}
    matchers = {path: match.Matcher(im, grid=1) for path, im in domain.items()}
    images = {}
    named_paths = {}
    for number, (theme, key) in enumerate(SPECS, 1):
        path = f'{BASE}/Modern_Exteriors_Complete_Singles_16x16/ME_Singles_{theme}_16x16_{key}.png'
        key_id = f'E05-{number:02}'
        named_paths[key_id] = path
        images[key_id] = read(path)
    identities = {(im.size, sha(im.tobytes())) for im in images.values()}
    aliases = {identity: [] for identity in identities}
    corpus = [row for row in ledger if row[5] in ('exteriors-complete-singles', 'exteriors-theme-singles')]
    checked = 0
    sizes = {identity[0] for identity in identities}
    for row in corpus:
        if tuple(row[2:4]) not in sizes:
            continue
        raw = (ROOT/row[0]).read_bytes()
        require(sha(raw) == row[1], 'Alias source pin drift: '+row[0])
        im = match.normalized(Image.open(ROOT/row[0]))
        identity = (im.size, sha(im.tobytes()))
        checked += 1
        if identity in aliases:
            read(row[0])
            aliases[identity].append(sid(row[0]))
    index = json.loads((ROOT/INDEX).read_text())['themes']
    candidates = []
    for number, ((theme, key), (key_id, im)) in enumerate(zip(SPECS, images.items()), 1):
        rect = index['ME_Singles_'+theme][key]
        require(list(im.size) == rect[2:], 'Indexed frame dimensions differ: '+key_id)
        x, y, w, h = rect
        require(master.crop((x, y, x+w, y+h)).tobytes() == im.tobytes(), 'Indexed committed pixels differ: '+key_id)
        alpha = im.getchannel('A').getbbox()
        bounds = [alpha[0], alpha[1], alpha[2]-alpha[0], alpha[3]-alpha[1]]
        occurrences = []
        for path, matcher in matchers.items():
            for found in matcher.find(im):
                occurrences.append({'sourceId': sid(path), 'rect': found, 'lineage': 'exact-whole-export-normalized-RGBA-all-integer-origins'})
        require(any(o['sourceId'] == sid(MASTER) and o['rect'] == rect for o in occurrences), 'Index lineage missing from matcher: '+key_id)
        is_fence = number <= 22
        is_gate = number in range(23, 27)
        gate_n = number-22
        label = LABELS[number] if is_fence else (('Narrow' if gate_n <= 2 else 'Wide')+' garden gate · '+('cool frame' if gate_n%2 else 'warm frame')) if is_gate else 'Upright shrub · hedge trial'
        facts = 'Dense low pickets and horizontal rails; gray/violet shading, with side-post and diagonal source cuts.' if is_fence else 'Barred arch gate framed by green hedge sides; foliage reaches the left and right export boundary.' if is_gate else 'An upright green shrub with a narrow rounded outer silhouette and outlined sides; no tile-bank role established.'
        role = LABELS[number] if is_fence else 'integrated gate with hedge side crops' if is_gate else 'whole upright shrub; experimental support only'
        open_ports = [{'edge': edge, 'originXY': origin, 'profile': profile} for edge, origin, profile in PORTS[number]] if is_fence else []
        topology = {'standaloneEligibility': 'forbidden' if is_fence else 'unknown' if is_gate else 'visual-proposal-only',
                    'requiredFamily': 'low-gray-picket-kit' if is_fence else 'garden-hedge-gate-trial',
                    'requiredNeighbors': [port['edge'] for port in open_ports] if is_fence else [],
                    'requiredNeighborsStatus': 'finite-example-required-cuts' if is_fence else 'unknown-cropped-hedge-boundaries' if is_gate else 'none-for-whole-shrub-visual-form',
                    'openJoinEdges': open_ports, 'compatibleMembers': [],
                    'joinMeasurements': {'horizontalAdvanceXY': [16,0], 'verticalAdvanceXY': [0,16], 'leftPostAlphaColumns': [3,7], 'rightPostAlphaColumns': [10,14], 'horizontalRailAnchorRow': 7} if is_fence and number<15 else {'pairedHalfAdvanceXY': [0,16]} if is_fence else None,
                    'closedOuterEnds': (['outer diagonal endpoint; inner seam requires paired half'] if number>=15 and is_fence else []),
                    'limits': LIMIT if is_fence else 'Cropped outer hedge sides are not mapped connectors. Hedge closure/extension is unresolved; no fence-kit connection or gate mechanics inferred.' if is_gate else 'Whole shrub silhouette only; adjacency to gate foliage does not establish a seamless hedge tile.',
                    'enforcement': 'proposal metadata only; runtime/catalog/editor unchanged'}
        if is_gate:
            topology['boundaryQuestions'] = ['left and right foliage continue to crop boundary; need for adjoining foliage or complete-object use is unresolved']
        candidates.append({'id': key_id, 'label': label, 'sourceId': sid(named_paths[key_id]),
            'sourceRect': [0, 0, im.width, im.height], 'sourceKey': {'theme': theme, 'key': key},
            'normalizedRgbaSHA256': sha(im.tobytes()), 'alphaVisibleRect': bounds,
            'committedRendering': {'sheetId': 'me-complete', 'sourceId': sid(MASTER), 'rect': rect,
                                   'operation': 'direct-crop', 'frameSize': list(im.size), 'offsetXY': [0,0],
                                   'normalizedRgbaSHA256': sha(im.tobytes())},
            'legacyIndexAlias': {'path': INDEX, 'theme': 'ME_Singles_'+theme, 'key': key, 'rect': rect,
                                 'coordinateSpace': 'original-master-pixels; not repacked'},
            'namedExportAliases': sorted(aliases[(im.size, sha(im.tobytes()))]), 'occurrences': occurrences,
            'fields': {'identity': field('low picket fence component' if is_fence else 'hedge-framed gate' if is_gate else 'upright garden shrub', facts,
                                         alternatives=['Wood versus metal material is unknown.'] if is_fence else ['Closed panel depicts appearance only; opening behavior is unknown.'] if is_gate else ['Not a proven repeating hedge module.']),
                       'family': field(topology['requiredFamily'], 'Bounded native exports; picket and garden sources are separate kits.'),
                       'role': field(role, facts, 'high' if is_fence else 'medium'),
                       'facing': field('image-plane axes only; world compass unknown', 'Left/right/top/bottom describe source-image placement.', 'medium'),
                       'variant': field('gray/violet picket style, named export '+str(number) if is_fence else ('cool' if gate_n%2 else 'warm')+' gate frame' if is_gate else 'green foliage', 'Exact source colors and separate pixel/alpha comparisons; no palette-transform assumption.')},
            'topology': topology, 'gameplayGeometry': {k: None for k in ('anchor','footprint','collision','walkability','height','gateOpening','gateTrigger')},
            'independentReview': 'pending', 'humanApproval': 'unregistered'})
    by_id = {row['id']: row for row in candidates}
    rect48 = [(1,0,0),(2,16,0),(3,32,0),(10,0,16),(4,32,16),(8,0,32),(7,16,32),(6,32,32)]
    rect64 = [(1,0,0),(2,16,0),(2,32,0),(3,48,0),(10,0,16),(9,0,32),(4,48,16),(5,48,32),(8,0,48),(7,16,48),(7,32,48),(6,48,48)]
    tests = [
        ('closed-picket-48', [48,48], rect48, 'supported-bounded-closed', 'Two upper corners, one top/bottom middle and one side-post row; every declared cut has a neighbor.'),
        ('closed-picket-48-duplicate-exports', [48,48], [(11,0,0),(2,16,0),(12,32,0),(9,0,16),(5,32,16),(14,0,32),(7,16,32),(13,32,32)], 'supported-bounded-closed', 'Duplicate corner exports preserve their separate names; the alternate vertical shade cells remain exact native pixels.'),
        ('closed-picket-64', [64,64], rect64, 'supported-bounded-closed', 'Two middle advances and two side-post rows; tested finite extension, not an unlimited enclosure rule.'),
        ('rising-diagonal-a', [16,32], [(16,0,0),(15,0,16)], 'supported-bounded-closed', 'Two halves at the same x and 16px y advance make a continuous short rising diagonal.'),
        ('falling-diagonal-a', [16,32], [(17,0,0),(18,0,16)], 'supported-bounded-closed', 'Two halves at the same x and 16px y advance make a continuous short falling diagonal.'),
        ('rising-diagonal-b', [16,32], [(19,0,0),(20,0,16)], 'supported-bounded-closed', 'Alternate source pair, preserved separately; no universal interchangeability.'),
        ('falling-diagonal-b', [16,32], [(22,0,0),(21,0,16)], 'supported-bounded-closed', 'Alternate source pair with slight edge/shadow differences; named pairing only.'),
        ('open-upper-run', [48,16], [(1,0,0),(2,16,0),(3,32,0)], 'supported-explicit-open-section', 'Horizontal joints align, but both downward side-post cuts need continuation. Not a complete isolated fence.'),
        ('reversed-upper-corners', [48,16], [(3,0,0),(2,16,0),(1,32,0)], 'invalid-unmatched-cuts', 'The corner rails point away from the middle; outer horizontal cuts and both downward cuts remain exposed.'),
        ('side-post-shift-one-pixel', [49,48], [(n,x+1 if n==4 else x,y) for n,x,y in rect48], 'invalid-unmatched-cuts', 'Moving only the right vertical row by one pixel disconnects both post joins.'),
        ('diagonal-export-width-step', [32,32], [(16,0,0),(15,16,16)], 'invalid-unmatched-cuts', 'Advancing by export width as well as height splits the diagonal into separate pieces; measured x advance is zero.'),
        ('isolated-upper-left-corner', [16,16], [(1,0,0)], 'invalid-unmatched-cuts', 'Cannot stand alone: rail cut right and side-post cut below remain unmatched.'),
        ('garden-gate-hedge-extension', [80,32], [(27,0,0),(23,16,0),(27,64,0)], 'unresolved-hedge-extension', 'Upright hedge blocks placed beside the gate remain a visual hypothesis; gate foliage differs from the block and dark outline seams persist.'),
        ('garden-gate-hedge-extension-low', [80,48], [(27,0,16),(23,16,0),(27,64,16)], 'weakened-hedge-alignment', 'A one-tile vertical shift exposes an irregular hedge silhouette; this does not resolve cropped side closure.'),
    ]
    experiments = []
    native = {}
    for key, size, parts, disposition, observation in tests:
        recipe = {'size': size, 'operation': 'ordered native RGBA source-over; no edits, scaling, reflection or trimming',
                  'placements': [{'memberId': f'E05-{n:02}', 'at': [x,y], 'blend': 'over'} for n,x,y in parts]}
        out = match.normalized(render(recipe, images))
        experiment = {'id': key, 'renderRecipe': recipe, 'renderRecipeSHA256': receipt(recipe),
                      'normalizedRgbaSHA256': sha(out.tobytes()), 'topologyDisposition': disposition,
                      'renderAssessment': observation, 'humanApproval': 'none', 'limit': LIMIT}
        if all(n<=22 for n,_,_ in parts):
            measured = ports(recipe['placements'], by_id)
            experiment['portEvaluation'] = measured
            diagnostics = []
            for pair in measured['matchedPairs']:
                first, second = pair
                horizontal = first['edge'] in ('left','right')
                if first['edge'] in ('left','top'):
                    first,second = second,first
                a,b = images[first['memberId']],images[second['memberId']]
                edge_a = [a.getpixel((a.width-1,y)) for y in range(a.height)] if horizontal else [a.getpixel((x,a.height-1)) for x in range(a.width)]
                edge_b = [b.getpixel((0,y)) for y in range(b.height)] if horizontal else [b.getpixel((x,0)) for x in range(b.width)]
                diagnostics.append({'members':[first['memberId'],second['memberId']],
                    'axis':'horizontal' if horizontal else 'vertical',
                    'bothOpaquePositions':[i for i,(p,q) in enumerate(zip(edge_a,edge_b)) if p[3] and q[3]],
                    'differentAdjacentRGBAPositions':[i for i,(p,q) in enumerate(zip(edge_a,edge_b)) if p!=q],
                    'alphaChangedPositions':[i for i,(p,q) in enumerate(zip(edge_a,edge_b)) if p[3]!=q[3]],
                    'limit':'Adjacent edge inequality is a diagnostic; shading/picket profiles can differ. It is not an automatic seam or gameplay verdict.'})
            experiment['seamDiagnostics'] = diagnostics
            require(bool(measured['unmatchedPorts']) == (disposition != 'supported-bounded-closed'), 'Unexpected closed/open port result: '+key)
            if disposition == 'supported-bounded-closed':
                for pair in measured['matchedPairs']:
                    for own, other in (pair, pair[::-1]):
                        relation = {'memberId': other['memberId'], 'ownEdge': own['edge'], 'neighborEdge': other['edge'],
                                    'relativeOffsetXY': [recipe['placements'][other['placementIndex']]['at'][i]-recipe['placements'][own['placementIndex']]['at'][i] for i in (0,1)],
                                    'experimentId': key}
                        if relation not in by_id[own['memberId']]['topology']['compatibleMembers']:
                            by_id[own['memberId']]['topology']['compatibleMembers'].append(relation)
        experiments.append(experiment)
        native[key] = out
    # Duplicate names never disappear; no transitive compatibility claim is made.
    duplicate_groups = []
    for identity in sorted(identities, key=lambda v: (v[0],v[1])):
        members = [key for key, im in images.items() if (im.size,sha(im.tobytes()))==identity]
        if len(members)>1:
            duplicate_groups.append({'members': members, 'normalizedRgbaSHA256': identity[1], 'meaning': 'exact duplicate pixels; separate named source records'})
    comparisons = [{'members': [f'E05-{a:02}',f'E05-{b:02}'], 'operation': 'identity', **delta(images[f'E05-{a:02}'],images[f'E05-{b:02}'])}
                   for a,b in [(1,11),(3,12),(6,13),(8,14),(4,5),(9,10),(18,21),(17,22),(23,24),(25,26)]]
    crop_comparisons = []
    gate = images['E05-23']
    for side,x in [('left',0),('right',32)]:
        crop_comparisons.append({'id': 'gate-'+side+'-hedge-versus-bush-6', 'members': ['E05-23','E05-27'],
                                'leftSourceRect': [x,0,16,32], 'rightSourceRect': [0,0,16,32],
                                **delta(gate.crop((x,0,x+16,32)),images['E05-27']),
                                'limit': 'The hedge support is not an exact replacement or inherited gate-side module.'})
    packet = {'schemaVersion': 1, 'packetId': 'E05', 'proposalRevision': 1, 'state': 'proposed',
        'coordinates': {'unit': 'native 16px art pixels', 'origin': 'top-left', 'rect': '[x,y,width,height]',
                        'packedCoordinates': 'none; committed master coordinates are original master pixels',
                        'joins': 'image-plane native offsets; not world compass, collision or movement geometry'},
        'pins': {path: {'path': path, 'sha256': digest} for path,digest in PINS.items()},
        'scope': {'familyLabel': 'Low picket fences and garden gates', 'selectedExports': ['Terrains_and_Fences/Fence_1_1…22','Garden/Gate_1…4','Garden/Bush_6 experimental support'],
                  'countMeaning': '27 exact native source exports; duplicate names retained. Two distinct kits, no cross-kit join.',
                  'exclusions': ['Terrains Fence_2/Fence_3 and Props_Fence banks','23-shrub Garden family is not a fence module bank; only Bush_6 is included as a bounded extension refutation','other gate families and animation strips','gate mechanics and gameplay geometry'],
                  'unmappedCapabilities': ['No T/cross junction export is identified in selected bank.', 'No independent straight end-cap export is established; corners close the tested enclosure and diagonal pairs have bounded outer ends.']},
        'sources': sorted(sources.values(),key=lambda row:row['path']),
        'masterLineage': {'originalSourceId': sid(original_master_path), 'committedSourceId': sid(MASTER),
                          'sheetId': 'me-complete', 'normalizedRGBAEqual': True,
                          'pngByteIdentical': sources[sid(original_master_path)]['sha256'] == sources[sid(MASTER)]['sha256'],
                          'coordinateSpace': 'same native original-master pixels; committed file is an alias, not another semantic record'},
        'candidates': candidates,
        'groups': [{'id':'pickets','label':'Low picket fence pieces','members':[f'E05-{n:02}' for n in range(1,23)]},
                   {'id':'garden-gates','label':'Garden gates','members':[f'E05-{n:02}' for n in range(23,27)]},
                   {'id':'hedge-support','label':'Experimental hedge support','members':['E05-27']}],
        'variantGroups': [{'id':'narrow-gate','members':['E05-23','E05-24'],'variants':['cool','warm']},
                          {'id':'wide-gate','members':['E05-25','E05-26'],'variants':['cool','warm']}],
        'matching': {'implementation': {'path': MATCHER,'sha256':PINS[MATCHER]}, 'comparison': 'RGBA zeroed only where alpha equals zero; entire untrimmed frame equality',
                     'sheetDomains':[sid(path) for path in domain], 'origins':'all fitting integer pixel origins in committed master and the two selected theme sheets',
                     'namedAliasDomain': {'scopeGroups':['exteriors-complete-singles','exteriors-theme-singles'],'totalFiles':len(corpus),'dimensionFilteredFilesRead':checked},
                     'limit':'No other theme-sheet absence claim; named export aliases are exact full-frame equality only; no occlusion, transformation, alternate scale or gameplay inference.'},
        'experiments': {'assemblies':experiments,'comparisons':comparisons,'gateHedgeComparisons':crop_comparisons},
        'duplicatePixelGroups':duplicate_groups,
        'contexts':[{'sourceId':sid(MASTER),'rect':[1328,2928,240,144]}],
        'completeness': {'picketClosed':'Every recorded continuation port must have exactly one opposite, same-profile neighbor at the same image-plane anchor; named finite recipes also require visual review.',
                         'picketOpen':'Open upper-run illustration requires continuing side posts and is not an isolated complete fence.',
                         'gardenGates':'Gate panels appear closed; outer hedge side closure and standalone eligibility remain unknown. The two hedge-extension trials do not grant compatibility.',
                         'repeatability':'Only 48px/64px closed enclosures and four 16×32 diagonal pairs tested; no arbitrary graph/length, missing junction or cross-kit rule.'},
        'review': {'independent':'pending','human':'unregistered; no approval','runtimePromotion':False},
        'coverage': {'sourceRecordCount':27,'picketRecords':22,'gateRecords':4,'experimentalSupportRecords':1,
                     'exactMasterRecords':27,'distinctSourcePixelStates':len(identities),'duplicateRecordGroups':len(duplicate_groups),
                     'positiveClosedAssemblyProbes':7,'positiveOpenSectionProbes':1,'negativeAssemblyProbes':4,'unresolvedGardenProbes':2,
                     'semanticExhaustiveness':'bounded kit only; broader fence/gate families remain unmapped'},
        'presentationProposal': {'familyLabel':'Low picket fences and garden gates','facts':[
            {'label':'Kits','value':'Picket fences and hedge-framed gates are separate; joining them is unproven.'},
            {'label':'Assembly','value':'Fence pieces cannot stand alone. Only the pictured enclosure and diagonal pairings are checked.'},
            {'label':'Gates','value':'Cool and warm frames, in two widths; linework and a few edge pixels also differ. Hedge-side extension and gate behavior are unknown.'},
            {'label':'Gameplay','value':'Collision, height, walkability and opening triggers are unknown.'}],
            'groups': [{'id':'pickets','title':'Picket pieces','memberIds':[f'E05-{n:02}' for n in range(1,23)]},
                       {'id':'garden-gates','title':'Garden gates','memberIds':['narrow-gate','wide-gate']},
                       {'id':'hedge-support','title':'Hedge trial piece','memberIds':['E05-27']}],
            'cards': [
                *[{'id': row['id'], 'label': row['label'], 'kind': 'component', 'memberRecords': [row['id']],
                   'facts': [{'label':'Use','value':'Needs matching neighbors on the '+' and '.join(row['topology']['requiredNeighbors'])+'.'},
                             {'label':'Material','value':'Gray/violet pickets and rails; wood versus metal is unknown.'}]}
                  for row in candidates[:22]],
                *[{'id': key, 'label': label, 'kind': 'unknown', 'memberRecords': members,
                   'facts': [{'label':'Use','value':'Outer hedge sides and standalone use are unresolved.'},
                             {'label':'Variants','value':'Cool and warm frames; linework and a few edge pixels also differ.'},
                             {'label':'Gameplay','value':'Opening, movement and collision are unknown.'}]}
                  for key,label,members in [('narrow-gate','Narrow garden gate',['E05-23','E05-24']),
                                            ('wide-gate','Wide garden gate',['E05-25','E05-26'])]],
                {'id':'E05-27','label':'Upright shrub','kind':'whole','memberRecords':['E05-27'],
                 'facts':[{'label':'Form','value':'Complete outlined shrub; not a proven repeating hedge module.'}]},
            ],
            'positiveExampleIds':[key for key,_,_,disposition,_ in tests if disposition.startswith('supported-')],
            'openExampleGroup':{'id':'open-upper-run','groupLabel':'Open fence sections'},
            'researchOnlyExampleIds':[key for key,_,_,disposition,_ in tests if not disposition.startswith('supported-')]},
        'reproduce': {'check':'python3 scripts/semantic-map-fences-gates.py --check',
                      'capture':'python3 scripts/semantic-map-fences-gates.py --check --capture-dir /tmp/tilefun-semantic-E05/reproduced'}}
    if capture_dir:
        capture_dir.mkdir(parents=True,exist_ok=True)
        for key,out in native.items():
            out.save(capture_dir/(key+'-native.png'))
            backing=Image.new('RGBA',out.size,'#cad9bf');backing.alpha_composite(out)
            backing.resize((out.width*6,out.height*6),Image.Resampling.NEAREST).convert('RGB').save(capture_dir/(key+'.png'))
        contact=Image.new('RGB',(1200,760),'#cad9bf');draw=ImageDraw.Draw(contact)
        for i,row in enumerate(candidates):
            x=(i%9)*132;y=(i//9)*240;im=images[row['id']];draw.text((x+3,y+3),row['id'],fill='black')
            scaled=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST);contact.paste(scaled,(x+3,y+25),scaled)
        contact.save(capture_dir/'contact.png')
        for i,context in enumerate(packet['contexts']):
            x,y,w,h=context['rect'];crop=master.crop((x,y,x+w,y+h));backing=Image.new('RGBA',crop.size,'#cad9bf');backing.alpha_composite(crop)
            backing.resize((w*4,h*4),Image.Resampling.NEAREST).convert('RGB').save(capture_dir/f'context-{i}.png')
    return packet


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--capture-dir',type=Path)
    args=parser.parse_args()
    try:
        packet=build(args.capture_dir);raw=encoded(packet)
        if args.check:
            require(OUTPUT.is_file() and OUTPUT.read_bytes()==raw,'Frozen E05 packet differs; inspect source/adapter drift before updating')
        else:
            OUTPUT.write_bytes(raw)
        print(f"E05 {'verified' if args.check else 'generated'}: 27 records; 22 picket pieces + four garden gates + one hedge trial. No human approval.")
        return 0
    except (OSError,KeyError,ValueError) as error:
        print('E05 failed: '+str(error),file=sys.stderr);return 1


if __name__=='__main__':
    sys.exit(main())
