#!/usr/bin/env python3
"""Reproduce E04 civic broadleaf trees, flowerbeds and pots from pinned pixels."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / 'docs/tactical/053-semantic-tileset-map'
OUTPUT = PLAN / 'packets/E04-plants-planters.json'
LEDGER_HASH = 'c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda'
MASTER = 'public/assets/tilesets/me-complete.png'
MASTER_HASH = '1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737'
BASE = 'assets/exteriors/Modern_Exteriors_16x16'
SINGLES = BASE + '/Modern_Exteriors_Complete_Singles_16x16'
SPECS = [('Tree', n) for n in (1, 2, 9, 10, 11, 12, 13, 14)] + [
    (stem, n) for stem, count in [('Flower_Bush', 7), ('Pot', 4)]
    for n in range(1, count + 1)]
EXCLUDED_TREES = [3, 4, 5, 6, 7, 8, 15]
CONTEXTS = [[128, 0, 448, 224], [224, 16, 304, 176],
            [2736, 5328, 80, 112], [2256, 5584, 128, 112]]
TREE_LABELS = {1: 'Small broadleaf tree - bare trunk', 2: 'Small broadleaf tree - grass tuft',
    9: 'Small broadleaf tree - square grass base', 10: 'Small broadleaf tree - rounded planter base',
    11: 'Large broadleaf tree - bare trunk', 12: 'Large broadleaf tree - grass tuft',
    13: 'Large broadleaf tree - rounded planter base', 14: 'Large broadleaf tree - square grass base'}
FLOWER_LABELS = {1: 'Narrow flowerbed - pink', 2: 'Narrow flowerbed - red and yellow',
    3: 'Narrow flowerbed - white and yellow', 4: 'Wide flowerbed - red and white mix',
    5: 'Wide flowerbed - pink and white mix', 6: 'Wide flowerbed - white and yellow',
    7: 'Small loose flowering bush'}
POT_LABELS = {1: 'Upright leaves in red-brown pot', 2: 'Upright leaves in tan pot',
    3: 'Arching plant in red-brown pot', 4: 'Arching plant in tan pot'}
ANNOTATIONS = [
    {'id': '325cfc61-57ac-4e20-a96c-c7491f0d0f62', 'createdAt': '2026-10-02T20:32:30.521Z',
     'sheetId': 'me-complete', 'fingerprint': MASTER_HASH, 'rect': [352, 112, 48, 80],
     'note': 'tree in like a planter thing', 'statusAtRead': 'pending', 'treeNumber': 13},
    {'id': '20a19458-4424-40ed-8995-ff7945f122e8', 'createdAt': '2026-10-02T20:32:38.655Z',
     'sheetId': 'me-complete', 'fingerprint': MASTER_HASH, 'rect': [400, 112, 48, 80],
     'note': 'tree in a square planter thing', 'statusAtRead': 'pending', 'treeNumber': 14}]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sid(path):
    return 'src-' + sha(path.encode())[:16]


def crop(im, rect):
    x, y, w, h = rect
    if min(x, y, w, h) < 0 or w == 0 or h == 0 or x + w > im.width or y + h > im.height:
        raise ValueError('Out-of-frame source rectangle: ' + str(rect))
    return im.crop((x, y, x + w, y + h))


def xywh(bounds):
    x, y, right, bottom = bounds
    return [x, y, right - x, bottom - y]


def field(value, confidence, evidence, alternatives=None):
    return {'value': value, 'confidence': confidence, 'evidence': evidence,
            'alternatives': alternatives or [], 'disposition': 'proposed'}


def delta(a, b):
    if a.size != b.size:
        raise ValueError('Comparisons require explicitly aligned equal dimensions')
    adata, bdata = a.tobytes(), b.tobytes()
    aa = [adata[i:i + 4] for i in range(0, len(adata), 4)]
    bb = [bdata[i:i + 4] for i in range(0, len(bdata), 4)]
    mask = Image.new('L', a.size)
    mask.putdata([255 if x != y else 0 for x, y in zip(aa, bb)])
    return {'size': list(a.size), 'leftNormalizedRgbaSHA256': sha(a.tobytes()),
        'rightNormalizedRgbaSHA256': sha(b.tobytes()),
        'rgbaChangedPixels': sum(x != y for x, y in zip(aa, bb)),
        'alphaChangedPixels': sum(x[3] != y[3] for x, y in zip(aa, bb)),
        'changedBoundsXYXY': list(mask.getbbox()) if mask.getbbox() else None,
        'changedMaskSHA256': sha(mask.tobytes()), 'exactEqual': a.tobytes() == b.tobytes()}


def export_path(stem, n):
    return f'{SINGLES}/ME_Singles_City_Props_16x16_{stem}_{n}.png'


def build(capture_dir):
    ledger_raw = (PLAN / 'source-files.json').read_bytes()
    if sha(ledger_raw) != LEDGER_HASH:
        raise ValueError('Source ledger drift')
    rows = json.loads(ledger_raw)['files']
    by_path = {r[0]: r for r in rows}
    spec = importlib.util.spec_from_file_location('e04_match', REPO / 'scripts/semantic-map-match.py')
    match = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(match)
    sources = {}

    def read(path):
        row = by_path[path]
        raw = (REPO / path).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError('Pinned source drift: ' + path)
        im = match.normalized(Image.open(REPO / path))
        if list(im.size) != row[2:4]:
            raise ValueError('Source dimension drift: ' + path)
        sources[sid(path)] = {'id': sid(path), 'path': path, 'sha256': row[1],
            'dimensions': list(im.size), 'normalizedRgbaSHA256': sha(im.tobytes())}
        return im

    master = read(MASTER)
    if sources[sid(MASTER)]['sha256'] != MASTER_HASH:
        raise ValueError('Master pin changed')
    original_master = BASE + '/Modern_Exteriors_Complete_Tileset.png'
    if read(original_master).tobytes() != master.tobytes():
        raise ValueError('Original/committed master alias differs')
    theme_paths = [r[0] for r in rows if r[5] == 'exteriors-theme-sheets']
    if len(theme_paths) != 24:
        raise ValueError('Exteriors theme search domain changed')
    sheets = {MASTER: master, **{p: read(p) for p in theme_paths}}
    searchers = {p: match.Matcher(im, grid=1) for p, im in sheets.items()}
    images = {key: read(export_path(*key)) for key in SPECS}
    # All seven excluded Tree exports are pinned context, not mapped candidates.
    excluded_images = {n: read(export_path('Tree', n)) for n in EXCLUDED_TREES}
    identities = {(im.size, sha(im.tobytes())) for im in images.values()}
    aliases = {identity: [] for identity in identities}
    sizes = {identity[0] for identity in identities}
    corpus = [r for r in rows if r[5] in ('exteriors-complete-singles', 'exteriors-theme-singles')]
    checked = 0
    for row in corpus:
        if tuple(row[2:4]) not in sizes:
            continue
        raw = (REPO / row[0]).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError('Alias domain source drift: ' + row[0])
        im = match.normalized(Image.open(REPO / row[0]))
        if list(im.size) != row[2:4]:
            raise ValueError('Alias domain dimension drift: ' + row[0])
        checked += 1
        identity = (im.size, sha(im.tobytes()))
        if identity in aliases:
            read(row[0])
            aliases[identity].append(sid(row[0]))

    ids = {key: f'E04-{i:02d}' for i, key in enumerate(SPECS, 1)}
    candidates = []
    for key in SPECS:
        stem, n = key
        im = images[key]
        visible = xywh(im.getchannel('A').getbbox())
        occurrences = []
        for path, searcher in searchers.items():
            full_rects = searcher.find(im)
            visible_rects = searcher.find(crop(im, visible))
            occurrences.append({'sourceId': sid(path), 'fullFrameRects': full_rects,
                'alphaVisibleCropRects': visible_rects,
                'alphaVisibleCropLocalRect': visible,
                'comparison': 'Exact normalized RGBA, including transparency inside each tested rectangle'})
        master_occ = occurrences[0]
        if master_occ['fullFrameRects']:
            render_rect = master_occ['fullFrameRects'][0]
            offset = [0, 0]
            operation = 'direct-crop'
        elif master_occ['alphaVisibleCropRects']:
            render_rect = master_occ['alphaVisibleCropRects'][0]
            offset = visible[:2]
            operation = 'crop-into-transparent-frame'
        else:
            raise ValueError('Candidate lacks committed master correspondence: ' + str(key))
        rendered = Image.new('RGBA', im.size)
        # Paste source RGBA without a mask: do not multiply translucent alpha twice.
        rendered.paste(crop(master, render_rect), tuple(offset))
        if rendered.tobytes() != im.tobytes():
            raise ValueError('Committed rendering is not exact: ' + str(key))
        if stem == 'Tree':
            label = TREE_LABELS[n]
            identity = 'whole broadleaf tree' if n in (1, 2, 11, 12) else 'whole broadleaf tree with planted base'
            family = 'civic-broadleaf-trees'
            evidence = 'Closed leafy crown, continuous branched trunk, complete lower silhouette; exact aligned crown experiments establish small/large variant sets.'
            role = 'standalone tree' if n in (1, 2, 11, 12) else 'baked tree-and-base composition'
            variant = label.split(' - ')[1]
            alternatives = ['Exact botanical species unknown; green foliage alone does not prove a season.']
            if n in (9, 10, 13, 14):
                alternatives += ['Planter versus bordered ground planting is unresolved; rim pixels do not establish a raised pot, material or gameplay height.']
        elif stem == 'Flower_Bush':
            label = FLOWER_LABELS[n]
            identity = 'whole flowers in rectangular bordered bed' if n <= 6 else 'whole loose flowering bush'
            family = 'civic-flowerbeds' if n <= 6 else 'civic-loose-flowering-bush'
            evidence = 'Colored flower heads over green fill; six exports have closed shaded container/rim outlines, seventh has an unboxed leafy silhouette.'
            role = 'baked flowers-and-bed composition' if n <= 6 else 'standalone flowering bush'
            variant = label.split(' - ')[1] if n <= 6 else 'unboxed green bush with colored flowers'
            alternatives = ['Botanical species unknown; bordered bed versus portable planter and construction material unresolved.'] if n <= 6 else ['Low shrub versus compact flower clump unresolved; no pot or modular cut established.']
        else:
            label = POT_LABELS[n]
            identity = 'whole small potted plant'
            family = 'civic-small-potted-plants'
            evidence = 'Green leaves/stems rise from a shaded red-brown or tan pot silhouette; source names corroborate the pixel interpretation.'
            role = 'baked plant-and-pot composition'
            variant = label
            alternatives = ['Exact plant species, pot material and growing state unknown.']
        selected_facts = ['Complete tree; no other piece required.'] if stem == 'Tree' else ['Complete flowers and bed drawn together.'] if stem == 'Flower_Bush' and n <= 6 else ['Loose flowering bush; no box or pot shown.'] if stem == 'Flower_Bush' else ['Plant and pot drawn together.']
        if stem == 'Tree' and n in (9, 10, 13, 14):
            selected_facts = ['Tree and planted base drawn together.', 'Raised planter versus bordered ground remains uncertain.']
        if stem == 'Pot' and n in (1, 2):
            selected_facts.append('These two original variants differ slightly in their leaves as well as pot color.')
        candidates.append({'id': ids[key], 'label': label, 'kind': 'whole',
            'selectedFacts': selected_facts, 'sourceId': sid(export_path(*key)),
            'sourceRect': [0, 0, im.width, im.height],
            'normalizedRgbaSHA256': sha(im.tobytes()), 'alphaVisibleRect': visible,
            'exportName': f'City_Props_{stem}_{n}',
            'namedExportAliases': aliases[(im.size, sha(im.tobytes()))],
            'committedRendering': {'sheetId': 'me-complete', 'sourceId': sid(MASTER),
                'rect': render_rect, 'operation': operation, 'frameSize': list(im.size),
                'offsetXY': offset, 'normalizedRgbaSHA256': sha(rendered.tobytes()),
                'contract': 'Create transparent RGBA frameSize, copy rect unscaled at offsetXY; exact normalized native export pixels. No alpha mask, recoloring or trimming.'},
            'fields': {
                'identity': field(identity, 'high', evidence, alternatives),
                'family': field(family, 'high', evidence, ['Cross-theme similarity does not imply exhaustive vegetation membership.']),
                'role': field(role, 'high', 'Complete source silhouette has no exposed required continuation cut; base/container and plant are baked in the same export.', ['No detached plant/container attachment recipe inferred.']),
                'facing': field('source image-plane view; world direction unknown', 'medium', 'Front/top rim shading is visible on boxed forms; tree silhouette supplies no world compass convention.', ['No north/east/south/west assignment.']),
                'variant': field(variant, 'high', 'Exact export pixels and aligned crown/full-frame delta experiments; original variants retained.', alternatives)},
            'topology': {'standaloneEligibility': 'allowed', 'requiredNeighbors': [],
                'compatibleMembers': [], 'openJoinEdges': [],
                'completeness': 'A complete visual object or baked plant/container composition; no missing neighbor required.',
                'limits': 'Standalone visual proposal only. No modular joins, arbitrary repetitions, detachable base recipe, gameplay placement or collision are established.',
                'enforcement': 'metadata only'},
            'geometry': {'anchor': None, 'footprint': None, 'collision': None, 'height': None,
                'walkableSurfaces': None, 'status': 'unknown'},
            'occurrences': occurrences, 'independentReview': 'pending',
            'humanApproval': 'none; annotations are identity clues, not approval'})

    crown_specs = [((1, [0, 4, 32, 27]), (2, [0, 3, 32, 27])),
        ((1, [0, 4, 32, 27]), (9, [0, 11, 32, 27])),
        ((1, [0, 4, 32, 27]), (10, [0, 11, 32, 27])),
        ((11, [0, 9, 48, 38]), (12, [0, 7, 48, 38])),
        ((11, [0, 9, 48, 38]), (13, [0, 0, 48, 38])),
        ((11, [0, 9, 48, 38]), (14, [0, 0, 48, 38]))]
    comparisons = []
    for (a, ra), (b, rb) in crown_specs:
        measurement = delta(crop(images[('Tree', a)], ra), crop(images[('Tree', b)], rb))
        if not measurement['exactEqual']:
            raise ValueError('Shared crown claim refuted')
        comparisons.append({'id': f'crown-{a}-{b}', 'members': [ids[('Tree', a)], ids[('Tree', b)]],
            'operation': 'explicit aligned native crops', 'localRects': [ra, rb],
            'hypothesis': 'Same-size tree variants share an exact crown.',
            'result': 'supported', 'observation': 'Selected upper crown pixels are identical; this does not establish a complete base/attachment recipe.', **measurement})
    pairs = [('Tree', 9, 10), ('Tree', 13, 14), ('Flower_Bush', 1, 2),
        ('Flower_Bush', 1, 3), ('Flower_Bush', 4, 5), ('Flower_Bush', 4, 6),
        ('Pot', 1, 2), ('Pot', 3, 4)]
    for stem, a, b in pairs:
        measurement = delta(images[(stem, a)], images[(stem, b)])
        comparisons.append({'id': f'frame-{stem}-{a}-{b}',
            'members': [ids[(stem, a)], ids[(stem, b)]], 'operation': 'identity full native frames',
            'localRects': [[0, 0, *images[(stem, a)].size], [0, 0, *images[(stem, b)].size]],
            'hypothesis': 'These variants differ only in color, retaining the same alpha silhouette.',
            'result': 'refuted' if measurement['alphaChangedPixels'] else 'supported-for-alpha-only',
            'observation': 'Alpha differences refute a pure color-only shortcut.' if measurement['alphaChangedPixels'] else 'Equal alpha supports silhouette correspondence; equal alpha does not prove a universal palette transform.',
            **measurement})

    padding_comparisons = []
    for key, candidate in zip(SPECS, candidates):
        rendering = candidate['committedRendering']
        if rendering['operation'] == 'direct-crop':
            continue
        x, y, _, _ = rendering['rect']
        dx, dy = rendering['offsetXY']
        w, h = rendering['frameSize']
        inferred_rect = [x - dx, y - dy, w, h]
        inferred_image = crop(master, inferred_rect)
        measurement = delta(images[key], inferred_image)
        expected_bytes, actual_bytes = images[key].tobytes(), inferred_image.tobytes()
        padding_only = all(a == b or a[3] == 0 for a, b in zip(
            [expected_bytes[i:i + 4] for i in range(0, w * h * 4, 4)],
            [actual_bytes[i:i + 4] for i in range(0, w * h * 4, 4)]))
        if not padding_only or measurement['exactEqual']:
            raise ValueError('Padding-only master failure claim changed')
        padding_comparisons.append({'memberId': candidate['id'],
            'hypothesis': 'No full-frame master occurrence means the original visible object is missing or changed.',
            'result': 'refuted', 'inferredFullFrameMasterRect': inferred_rect,
            'differenceOnlyWhereOriginalAlphaIsZero': padding_only,
            'observation': 'Neighboring master artwork occupies original transparent padding. Exact alpha-visible crop plus transparent frame restoration reproduces all native RGBA.',
            **measurement})

    annotation_evidence = []
    for annotation in ANNOTATIONS:
        key = ('Tree', annotation['treeNumber'])
        source_selection = crop(master, annotation['rect'])
        recreated = Image.new('RGBA', source_selection.size)
        recreated.paste(images[key], (0, 9))
        if recreated.tobytes() != source_selection.tobytes():
            raise ValueError('Human annotation correspondence changed')
        annotation_evidence.append({**annotation, 'memberId': ids[key],
            'nativeExportOffsetInSelectionXY': [0, 9],
            'selectionNormalizedRgbaSHA256': sha(source_selection.tobytes()),
            'reconstructionExact': True, 'interpretation': 'Identity clue only; no approval, source cropping, geometry or material decision.'})

    def vg(name, label, members, labels, default):
        return {'id': name, 'label': label, 'memberIds': [ids[key] for key in members],
            'variantLabels': labels, 'defaultMemberId': ids[default],
            'presentation': 'One complete-object card with an explicit member variant selector.'}

    variant_groups = [
        vg('small-broadleaf-tree', 'Small broadleaf tree', [('Tree', n) for n in (1, 2, 9, 10)],
           ['Bare trunk', 'With grass', 'Square grass base', 'Rounded planter base'], ('Tree', 10)),
        vg('large-broadleaf-tree', 'Large broadleaf tree', [('Tree', n) for n in (11, 12, 13, 14)],
           ['Bare trunk', 'With grass', 'Rounded planter base', 'Square grass base'], ('Tree', 13)),
        vg('narrow-flowerbed', 'Narrow flowerbed', [('Flower_Bush', n) for n in (1, 2, 3)],
           ['Pink', 'Red and yellow', 'White and yellow'], ('Flower_Bush', 1)),
        vg('wide-flowerbed', 'Wide flowerbed', [('Flower_Bush', n) for n in (4, 5, 6)],
           ['Red and white mix', 'Pink and white mix', 'White and yellow'], ('Flower_Bush', 4)),
        vg('loose-flowering-bush', 'Small flowering bush', [('Flower_Bush', 7)],
           ['Loose bush'], ('Flower_Bush', 7)),
        vg('upright-potted-plant', 'Upright potted plant', [('Pot', n) for n in (1, 2)],
           ['Red-brown pot', 'Tan pot with shorter leaves'], ('Pot', 1)),
        vg('arching-potted-plant', 'Arching potted plant', [('Pot', n) for n in (3, 4)],
           ['Red-brown pot', 'Tan pot'], ('Pot', 3))]
    if sorted(member for group in variant_groups for member in group['memberIds']) != sorted(ids.values()):
        raise ValueError('Presentation cards do not partition the source records')
    index_path = 'public/data/me-atlas-index.json'
    index_raw = (REPO / index_path).read_bytes()
    index = json.loads(index_raw)['themes']['ME_Singles_City_Props']
    for key, candidate in zip(SPECS, candidates):
        candidate['legacyIndexAlias'] = {'path': index_path, 'theme': 'ME_Singles_City_Props',
            'key': f'{key[0]}_{key[1]}', 'rect': index.get(f'{key[0]}_{key[1]}'),
            'status': 'Legacy rectangle alias only; candidate export and measured occurrences remain authoritative.',
            'coordinateSpace': 'original master pixels; not packed'}
    coverage = {'sourceRecordCount': len(candidates), 'proposalUnitCount': len(candidates),
        'presentationCardCount': len(variant_groups),
        'exactMasterFullFrameOccurrenceCount': sum(len(c['occurrences'][0]['fullFrameRects']) for c in candidates),
        'exactMasterAlphaVisibleOccurrenceCount': sum(len(c['occurrences'][0]['alphaVisibleCropRects']) for c in candidates),
        'transparentFrameRestorationMembers': [c['id'] for c in candidates if c['committedRendering']['operation'] != 'direct-crop'],
        'namedExportAliasCount': sum(len(c['namedExportAliases']) for c in candidates),
        'semanticExhaustiveness': 'All broadleaf Tree variants 1,2,9-14, all Flower_Bush 1-7 and Pot 1-4 exports; no entire City Props, vegetation pack or source-window completion.'}
    result = {'schemaVersion': 1, 'packetId': 'E04', 'proposalRevision': 1, 'state': 'agent-proposal',
        'coordinates': {'unit': 'native pixels', 'origin': 'top-left',
            'rect': '[x,y,width,height]; half-open', 'alphaVisibleRect': 'Local to native export frame; same xywh convention.',
            'changedBoundsXYXY': '[left,top,right,bottom]; half-open; comparison-frame coordinates.'},
        'pins': {'sourceLedger': {'path': str((PLAN / 'source-files.json').relative_to(REPO)), 'sha256': LEDGER_HASH},
            'sourceManifest': {'path': str((PLAN / 'source-manifest.json').relative_to(REPO)), 'sha256': sha((PLAN / 'source-manifest.json').read_bytes())},
            'matcher': {'path': 'scripts/semantic-map-match.py', 'sha256': sha((REPO / 'scripts/semantic-map-match.py').read_bytes())},
            'legacyIndex': {'path': index_path, 'sha256': sha(index_raw)}},
        'scope': {'selectedExportGroups': ['City_Props_Tree_1,2,9-14 (all broadleaf variants)', 'City_Props_Flower_Bush_1-7', 'City_Props_Pot_1-4'],
            'excludedTrees': [{'exportName': f'City_Props_Tree_{n}', 'sourceId': sid(export_path('Tree', n)),
                'status': 'unmapped; queued separate topiary/conical-strip investigation'} for n in EXCLUDED_TREES],
            'excluded': ['Topiary Tree3-8 and clipped conical Tree15 family', 'Loose Flowers_1-5 exports',
                'Garden, Villas, Additional Houses and other theme vegetation', 'Bare planter/base segmentation',
                'Larger baked scenes, animation, alternate resolutions, near/partial/occluded appearances'],
            'countMeaning': '19 exported source records / seven presentation cards, not unique concepts or pack completion.'},
        'sources': sorted(sources.values(), key=lambda s: s['path']), 'candidates': candidates,
        'presentation': {'familyTitle': 'Plants and planters',
            'description': 'Broadleaf trees, flowerbeds and small potted plants from the civic set.',
            'facts': ['Complete objects', 'Tree bases and flower colors have original variants',
                'Plants and containers are drawn together'],
            'proposalState': 'Proposed', 'geometryFact': 'Gameplay size and collision are unknown.',
            'groupingLimit': 'Tree cards share exact crowns; flowerbeds share closed outlines. Upright pot variants also differ in their leaves. No independent container or plant pieces offered.'},
        'groups': [{'id': 'complete-civic-plants', 'label': 'Trees, flowers and small pots',
            'standaloneEligibility': 'allowed', 'cardIds': [group['id'] for group in variant_groups],
            'memberIds': list(ids.values()), 'facts': ['Complete objects', 'Plants and containers are drawn together',
                'Bases and flower/pot colors are available as original variants'],
            'limits': 'Species, planter materials and gameplay geometry remain unknown.'}],
        'variantGroups': variant_groups,
        'matching': {'implementation': 'scripts/semantic-map-match.py Matcher(grid=1)',
            'comparison': 'Exact normalized RGBA; RGB zeroed only at alpha=0.',
            'sheetDomains': [sid(path) for path in sheets],
            'origins': 'Every fitting integer pixel origin in full committed master and all 24 native16 Exteriors theme sheets, for both native export frame and measured alpha-visible crop.',
            'namedAliasDomain': {'groups': ['exteriors-complete-singles', 'exteriors-theme-singles'],
                'files': len(corpus), 'sameSizeFilesRead': checked,
                'method': 'Ledger dimension prefilter, raw PNG hash and normalized whole-frame RGBA hash equality.'},
            'limitation': 'No partial occlusion, approximate similarity, alternate resolutions or animation matching. Alpha-visible equality does not establish a full-frame occurrence.'},
        'experiments': {'comparisons': comparisons, 'paddingOnlyMasterDifferences': padding_comparisons,
            'annotationCorrespondence': annotation_evidence,
            'positiveExamples': [{'memberId': c['id'], 'kind': 'exact standalone source rendering',
                'normalizedRgbaSHA256': c['normalizedRgbaSHA256'], 'committedRendering': c['committedRendering'],
                'topologyValidity': 'valid complete visual object', 'humanApproval': 'none'} for c in candidates],
            'assemblies': [], 'assemblyLimit': 'No modular kit proposed; exact baked source compositions are the positive examples. No invented detach-and-recombine recipe.'},
        'contexts': [{'sourceId': sid(MASTER), 'rect': rect} for rect in CONTEXTS],
        'humanAnnotations': annotation_evidence,
        'coverage': coverage, 'review': {'independent': 'pending exact-hash per-member review',
            'human': 'unregistered; pending annotations do not approve metadata or geometry'},
        'reproduce': {'check': 'python3 scripts/semantic-map-plants-planters.py --check',
            'capture': 'python3 scripts/semantic-map-plants-planters.py --check --capture-dir /tmp/tilefun-semantic-E04'}}

    if capture_dir:
        capture_dir.mkdir(parents=True, exist_ok=True)
        sheet = Image.new('RGBA', (5 * 250, 4 * 250), '#30333a')
        draw = ImageDraw.Draw(sheet)
        for i, (key, candidate) in enumerate(zip(SPECS, candidates)):
            x, y = i % 5 * 250, i // 5 * 250
            im = images[key]
            draw.text((x + 8, y + 8), candidate['id'] + ' ' + candidate['exportName'], fill='white')
            sheet.alpha_composite(im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST), (x + 35, y + 30))
            draw.text((x + 8, y + 225), str(im.size) + ' complete object', fill='white')
            im.save(capture_dir / (candidate['id'] + '-native.png'))
            rendering = candidate['committedRendering']
            rendered = Image.new('RGBA', tuple(rendering['frameSize']))
            rendered.paste(crop(master, rendering['rect']), tuple(rendering['offsetXY']))
            rendered.save(capture_dir / (candidate['id'] + '-committed-native.png'))
        sheet.save(capture_dir / 'contact-sheet.png')
        for i, rect in enumerate(CONTEXTS, 1):
            im = crop(master, rect)
            im.save(capture_dir / f'context-{i}-native.png')
            backing = Image.new('RGBA', im.size, '#30333a')
            backing.alpha_composite(im)
            backing.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST).save(capture_dir / f'context-{i}.png')
        scope_sheet = Image.new('RGBA', (5 * 200, 3 * 240), '#30333a')
        draw = ImageDraw.Draw(scope_sheet)
        for n in range(1, 16):
            i = n - 1
            x, y = i % 5 * 200, i // 5 * 240
            im = images.get(('Tree', n), excluded_images.get(n))
            draw.text((x + 5, y + 5), f'Tree {n}: ' + ('IN SCOPE' if ('Tree', n) in images else 'UNMAPPED'), fill='white')
            scope_sheet.alpha_composite(im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST), (x + 20, y + 30))
        scope_sheet.save(capture_dir / 'tree-scope.png')
        for annotation in annotation_evidence:
            im = crop(master, annotation['rect'])
            backing = Image.new('RGBA', im.size, '#30333a')
            backing.alpha_composite(im)
            backing.resize((im.width * 6, im.height * 6), Image.Resampling.NEAREST).save(capture_dir / (annotation['memberId'] + '-annotation.png'))
        (capture_dir / 'proof-summary.json').write_text(json.dumps(coverage, indent=2) + '\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--capture-dir', type=Path)
    args = parser.parse_args()
    result = build(args.capture_dir)
    output = json.dumps(result, indent=2) + '\n'
    if args.check:
        if OUTPUT.read_text() != output:
            raise SystemExit('E04 differs from reproduced evidence')
        print('E04 verified: ' + json.dumps(result['coverage'], sort_keys=True))
    else:
        OUTPUT.write_text(output)
        print('Wrote ' + str(OUTPUT.relative_to(REPO)))


if __name__ == '__main__':
    main()
