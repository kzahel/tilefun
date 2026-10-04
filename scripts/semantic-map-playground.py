#!/usr/bin/env python3
"""Reproduce E03 playground-tube evidence; source-only Pillow captures, no repacking."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / 'docs/tactical/053-semantic-tileset-map'
OUTPUT = PLAN / 'packets/E03-playground-tubes.json'
LEDGER_HASH = 'c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda'
MASTER = 'public/assets/tilesets/me-complete.png'
MASTER_HASH = '1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737'
BASE = 'assets/exteriors/Modern_Exteriors_16x16'
SINGLES = BASE + '/Modern_Exteriors_Complete_Singles_16x16'
SPECS = [(1, n) for n in range(1, 20)] + [(bank, n) for bank in (2, 3) for n in (15, 16, 17)]
CONTEXTS = [[1984, 1104, 256, 288], [1920, 1024, 384, 416]]
COLORS = {1: 'ochre', 2: 'blue', 3: 'red'}
# Native image-plane ports; never world compass headings or traversable geometry.
ROLES = {
 1: ('Upper-left bend', [('right', [16, 0]), ('bottom', [0, 16])], []),
 2: ('Horizontal continuation', [('left', [0, 0]), ('right', [16, 0])], []),
 3: ('Upper-right bend', [('left', [0, 0]), ('bottom', [0, 16])], []),
 4: ('Vertical continuation', [('top', [0, 0]), ('bottom', [0, 16])], []),
 5: ('Lower-right bend', [('top', [0, 0]), ('left', [0, 0])], []),
 6: ('Horizontal continuation counterpart', [('left', [0, 0]), ('right', [16, 0])], []),
 7: ('Lower-left bend', [('top', [0, 0]), ('right', [16, 0])], []),
 8: ('Vertical continuation counterpart', [('top', [0, 0]), ('bottom', [0, 16])], []),
 9: ('Down-image entrance', [('top', [0, 0])], ['down-image mouth']),
 10: ('Down-image entrance counterpart', [('top', [0, 0])], ['down-image mouth']),
 11: ('Horizontal tube with down-image entrance', [('left', [0, 0]), ('right', [16, 0])], ['down-image mouth']),
 12: ('Round-topped vertical end', [('bottom', [0, 32])], ['upper rounded end; opening state unknown']),
 13: ('Horizontal tube with upper facing entrance', [('left', [0, 16]), ('right', [16, 16])], ['upper dark mouth']),
 14: ('Horizontal tube with rounded upper branch', [('left', [0, 16]), ('right', [16, 16])], ['upper rounded branch; opening state unknown']),
 15: ('Cross-shaped tube with two entrances', [('left', [0, 16]), ('right', [16, 16])], ['upper dark mouth', 'down-image mouth']),
 16: ('Right-facing side entrance', [('left', [0, 0])], ['right-image mouth']),
 17: ('Left-facing side entrance', [('right', [16, 0])], ['left-image mouth']),
 18: ('Horizontal segment with right collar', [('left', [0, 0]), ('right', [16, 0])], []),
 19: ('Horizontal segment with left collar', [('left', [0, 0]), ('right', [16, 0])], [])}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sid(path):
    return 'src-' + sha(path.encode())[:16]


def field(value, confidence, evidence, alternatives=None):
    return {'value': value, 'confidence': confidence, 'evidence': evidence,
            'alternatives': alternatives or [], 'disposition': 'proposed'}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def delta(a, b):
    if a.size != b.size:
        raise ValueError('Explicit alignment required')
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
            'exactEqual': a.tobytes() == b.tobytes()}


def build(capture_dir):
    ledger_raw = (PLAN / 'source-files.json').read_bytes()
    if sha(ledger_raw) != LEDGER_HASH:
        raise ValueError('Source ledger drift')
    rows = json.loads(ledger_raw)['files']
    by_path = {r[0]: r for r in rows}
    match = load_module('semantic_match', REPO / 'scripts/semantic-map-match.py')
    sources = {}

    def read(path):
        row = by_path[path]
        raw = (REPO / path).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError('Pinned PNG drift: ' + path)
        im = match.normalized(Image.open(REPO / path))
        if list(im.size) != row[2:4]:
            raise ValueError('Dimension drift: ' + path)
        sources[sid(path)] = {'id': sid(path), 'path': path, 'pngSHA256': row[1],
                              'size': list(im.size), 'normalizedRgbaSHA256': sha(im.tobytes())}
        return im

    master = read(MASTER)
    if sources[sid(MASTER)]['pngSHA256'] != MASTER_HASH:
        raise ValueError('Master pin changed')
    if read(BASE + '/Modern_Exteriors_Complete_Tileset.png').tobytes() != master.tobytes():
        raise ValueError('Original master alias differs')
    theme_paths = [r[0] for r in rows if r[5] == 'exteriors-theme-sheets']
    if len(theme_paths) != 24:
        raise ValueError('Theme domain drift')
    sheets = {p: read(p) for p in theme_paths}
    searchers = {p: match.Matcher(im, grid=1) for p, im in [(MASTER, master), *sheets.items()]}
    images = {}
    paths = {}
    for bank, n in SPECS:
        path = f'{SINGLES}/ME_Singles_School_16x16_School_Yard_Tube_Modular_{bank}_{n}.png'
        paths[(bank, n)] = path
        images[(bank, n)] = read(path)
    identities = {(im.size, sha(im.tobytes())) for im in images.values()}
    aliases = {i: [] for i in identities}
    corpus = [r for r in rows if r[5] in ('exteriors-complete-singles', 'exteriors-theme-singles')]
    sizes = {i[0] for i in identities}
    checked = 0
    for row in corpus:
        if tuple(row[2:4]) not in sizes:
            continue
        raw = (REPO / row[0]).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError('Alias domain drift: ' + row[0])
        im = match.normalized(Image.open(REPO / row[0]))
        identity = (im.size, sha(im.tobytes()))
        checked += 1
        if identity in aliases:
            read(row[0])
            aliases[identity].append(sid(row[0]))
    index_path = 'public/data/me-atlas-index.json'
    index_raw = (REPO / index_path).read_bytes()
    index = json.loads(index_raw)['themes']['ME_Singles_School']
    candidates = []
    ids = {}
    for number, (bank, n) in enumerate(SPECS, 1):
        cid = f'E03-{number:02d}'
        ids[(bank, n)] = cid
        im = images[(bank, n)]
        x0, y0, x1, y1 = im.getchannel('A').getbbox()
        bounds = [x0, y0, x1 - x0, y1 - y0]
        label, ports, entrances = ROLES[n]
        occurrences = []
        for path, searcher in searchers.items():
            for rect in searcher.find(im):
                occurrences.append({'sourceId': sid(path), 'rect': rect,
                    'alphaVisibleRect': [rect[0] + x0, rect[1] + y0, x1 - x0, y1 - y0],
                    'lineage': 'direct-exact-normalized-RGBA'})
        master_rects = [o['rect'] for o in occurrences if o['sourceId'] == sid(MASTER)]
        candidates.append({'id': cid, 'label': COLORS[bank].capitalize() + ' ' + label.lower(),
            'sourceKey': {'theme': 'School', 'key': f'School_Yard_Tube_Modular_{bank}_{n}'},
            'primarySourceId': sid(paths[(bank, n)]), 'exportRect': [0, 0, im.width, im.height],
            'alphaVisibleRect': bounds, 'normalizedRgbaSHA256': sha(im.tobytes()),
            'namedExportAliases': aliases[(im.size, sha(im.tobytes()))], 'occurrences': occurrences,
            'masterOccurrences': [{'rect': r} for r in master_rects],
            'committedRendering': {'status': 'exact committed master crop available' if master_rects else 'requires exact original single',
                'sourceId': sid(MASTER) if master_rects else sid(paths[(bank, n)]),
                'rect': master_rects[0] if master_rects else [0, 0, im.width, im.height]},
            'legacyIndexAlias': {'path': index_path, 'theme': 'ME_Singles_School',
                'key': f'School_Yard_Tube_Modular_{bank}_{n}', 'rect': index.get(f'School_Yard_Tube_Modular_{bank}_{n}'),
                'coordinateSpace': 'original-master-pixels; not repacked'},
            'fields': {
                'identity': field('painted modular playground crawl tube', 'high', 'Hollow ring-shaped mouths, curved tubular shells and schoolyard play-tower context; export names corroborate pixels.', ['generic pipe kit weakened by play context; exact material unknown']),
                'bounds': field('whole original export; visible alpha bounds separate', 'high', 'Pinned export frame and separately measured alpha; no trimming or resizing.'),
                'family': field('schoolyard-playground-tubes', 'high', 'Shared ring mouths, shell ribs, shaded lower edge and three painted banks.'),
                'role': field(label, 'medium' if n in (12, 14, 18, 19) else 'high', 'Tube contours and image-plane continuation cuts; entrance mouths are distinct from continuation joins.', ['12/14 rounded end opening state unknown; 18/19 collar purpose unknown'] if n in (12, 14, 18, 19) else []),
                'facing': field('image-plane orientation only; world compass unknown', 'medium', 'Ports and mouths follow the original image; no source-to-world convention.'),
                'variant': field(COLORS[bank] + ' painted shell; shape ' + str(n), 'high', 'Selected counterpart alpha/pixel comparisons below; no universal palette transform assumed.')},
            'topology': {'standaloneEligibility': 'forbidden', 'assemblyFamily': 'schoolyard-playground-tubes',
                'openJoinEdges': [{'edge': edge, 'bandOriginXY': origin, 'profile': 'tube-horizontal-16' if edge in ('left', 'right') else 'tube-vertical-16', 'requiredNeighbor': True} for edge, origin in ports],
                'externalEntrancesOrEnds': entrances, 'requiredNeighbors': [edge for edge, _ in ports],
                'compatibility': 'Opposite matching profile, aligned band origins; exact compatible record pairs limited to named tested assembly edges below. Same palette tested; arbitrary cross-palette joins unknown.',
                'repeatable': 'only horizontal 2/6 and vertical 4/8 continuation units are proposed; tested repetition is finite, not a universal rendering proof',
                'completeness': 'Every continuation cut requires a compatible neighbor; visible mouths/rounded outer ends require no neighbor. Closed-mouth state for 12/14 and collar function for 18/19 remain unknown.',
                'enforcement': 'metadata only; no catalog/editor/generator change',
                'limit': 'Join positions use 16px bands and can lie inside padded export bounds; shadows may overlap. No collision, navigation, climbability or arbitrary graph proof.'},
            'geometry': {'anchor': None, 'footprint': None, 'collision': None, 'walkableSurfaces': None, 'status': 'unknown'},
            'independentReview': 'pending', 'humanApproval': 'unregistered; not approved'})
    comparisons = []
    for a, b in [((1, 2), (1, 6)), ((1, 4), (1, 8)), ((1, 9), (1, 10)), *[((1, n), (bank, n)) for bank in (2, 3) for n in (15, 16, 17)]]:
        comparisons.append({'members': [ids[a], ids[b]], 'operation': 'identity', **delta(images[a], images[b])})
    comparisons.append({'members': [ids[(1, 16)], ids[(1, 17)]], 'operation': 'horizontal-reflection',
                        **delta(images[(1, 16)].transpose(Image.Transpose.FLIP_LEFT_RIGHT), images[(1, 17)])})
    # Alpha-over source pixels at native size; background/scaling are capture-only.
    specs = [
      ('straight-two-mouths', [(17, 0, 0), (2, 16, 0), (2, 32, 0), (16, 48, 0)], 'valid', 'Same-palette horizontal joins; two external side mouths.', [(17, 'right', 2, 'left'), (2, 'right', 2, 'left'), (2, 'right', 16, 'left')]),
      ('cross-four-mouths-ochre', [(17, 0, 16), (15, 16, 0), (16, 32, 16)], 'valid', 'Cross has two lateral joins at local y=16 and upper/lower mouths, not four cut ports.', [(17, 'right', 15, 'left'), (15, 'right', 16, 'left')]),
      ('u-two-mouths', [(1, 0, 0), (2, 16, 0), (3, 32, 0), (8, 0, 16), (4, 32, 16), (10, 0, 32), (9, 32, 32)], 'valid', 'Bends connect horizontal and vertical continuations; both bottom arms end in mouths.', [(1, 'right', 2, 'left'), (2, 'right', 3, 'left'), (1, 'bottom', 8, 'top'), (3, 'bottom', 4, 'top'), (8, 'bottom', 10, 'top'), (4, 'bottom', 9, 'top')]),
      ('isolated-cross', [(15, 16, 0)], 'invalid', 'The two lateral continuation cuts remain exposed despite two visible entrance mouths.', []),
      ('wrong-end-facing', [(16, 0, 0), (2, 16, 0), (16, 32, 0)], 'invalid', 'Leftmost module presents a right mouth to the middle instead of a right continuation; its left cut remains exposed.', []),
      ('one-pixel-gap', [(17, 0, 0), (2, 17, 0), (16, 34, 0)], 'invalid', 'Continuation origins shifted off tested 16px alignment; vertical breaks at x=16 and x=33.', [])]
    probes = []
    specs += [(f'cross-four-mouths-{COLORS[bank]}', [(17, 0, 16), (15, 16, 0), (16, 32, 16)], 'valid', 'Same-palette counterpart lateral joins retain aligned silhouette; upper/lower mouths remain external.', [(17, 'right', 15, 'left'), (15, 'right', 16, 'left')]) for bank in (2, 3)]
    for name, parts, validity, observation, joins in specs:
        bank = 2 if name.endswith('-blue') else 3 if name.endswith('-red') else 1
        canvas = Image.new('RGBA', (64, 64))
        placements = []
        for n, x, y in parts:
            canvas.alpha_composite(images[(bank, n)], (x, y))
            placements.append({'memberId': ids[(bank, n)], 'offsetXY': [x, y]})
        ports = []
        opposite = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}
        for i, (n, x, y) in enumerate(parts):
            for edge, (px, py) in ROLES[n][1]:
                ports.append({'placementIndex': i, 'memberId': ids[(bank, n)], 'edge': edge, 'globalBandOriginXY': [x + px, y + py]})
        matched_pairs = []
        unmatched = []
        for i, port in enumerate(ports):
            peers = [j for j, other in enumerate(ports) if other['placementIndex'] != port['placementIndex'] and other['edge'] == opposite[port['edge']] and other['globalBandOriginXY'] == port['globalBandOriginXY']]
            if len(peers) != 1:
                unmatched.append(port)
            elif i < peers[0]:
                matched_pairs.append([port, ports[peers[0]]])
        observed_validity = 'invalid' if unmatched else 'valid'
        if observed_validity != validity:
            raise ValueError('Probe topology differs: ' + name)
        probes.append({'id': name, 'placements': placements, 'operation': 'Pillow RGBA alpha_composite in listed order; native pixels, no scaling',
            'size': list(canvas.size), 'normalizedRgbaSHA256': sha(canvas.tobytes()),
            'topologyValidity': validity, 'portEvaluation': {'matchedPairs': matched_pairs, 'unmatchedPorts': unmatched}, 'renderAssessment': observation,
            'testedCompatibleEdges': [{'leftMemberId': ids[(bank, a)], 'leftPort': ae, 'rightMemberId': ids[(bank, b)], 'rightPort': be} for a, ae, b, be in joins],
            'humanApproval': 'none', 'limit': 'Finite visual probes, not physics or arbitrary module compatibility.'})
        if capture_dir:
            capture_dir.mkdir(parents=True, exist_ok=True)
            canvas.save(capture_dir / (name + '-native.png'))
            backing = Image.new('RGBA', canvas.size, '#30333a')
            backing.alpha_composite(canvas)
            backing.resize((384, 384), Image.Resampling.NEAREST).save(capture_dir / (name + '.png'))
    for candidate in candidates:
        candidate['topology']['testedCompatibleNeighbors'] = []
        for probe in probes:
            if probe['topologyValidity'] != 'valid':
                continue
            for pair in probe['portEvaluation']['matchedPairs']:
                for own, other in (pair, pair[::-1]):
                    if own['memberId'] == candidate['id']:
                        relation = {'ownPort': own['edge'], 'neighborMemberId': other['memberId'], 'neighborPort': other['edge'], 'probe': probe['id']}
                        if relation not in candidate['topology']['testedCompatibleNeighbors']:
                            candidate['topology']['testedCompatibleNeighbors'].append(relation)
    result = {'schemaVersion': 2, 'packetId': 'E03', 'proposalRevision': 1, 'state': 'agent-proposal',
        'coordinates': {'unit': 'native pixels', 'origin': 'top-left', 'rect': '[x,y,width,height]; half-open', 'joinOrigins': 'local 16px band origin; not alpha bounds or physics'},
        'pins': {'sourceLedger': {'path': str((PLAN / 'source-files.json').relative_to(REPO)), 'sha256': LEDGER_HASH}, 'legacyIndex': {'path': index_path, 'sha256': sha(index_raw)}},
        'scope': {'selectedExportGroups': ['School_Yard_Tube_Modular_1_1-19', 'School_Yard_Tube_Modular_2_15-17', 'School_Yard_Tube_Modular_3_15-17'],
            'excluded': ['remaining blue/red module exports', 'baked playground compositions/towers', 'other pipe/tunnel themes', 'animations', 'occluded/partial or near matches'],
            'countMeaning': '25 exported source records, not 25 unique concepts or region completion'},
        'sources': sorted(sources.values(), key=lambda s: s['path']), 'candidates': candidates,
        'matching': {'implementation': 'scripts/semantic-map-match.py Matcher(grid=1)', 'comparison': 'exact normalized RGBA; RGB zeroed only at alpha=0',
            'sheetDomains': [sid(p) for p in searchers], 'origins': 'every fitting integer pixel origin in full master and all 24 Exteriors theme sheets',
            'namedAliasDomain': {'groups': ['exteriors-complete-singles', 'exteriors-theme-singles'], 'files': len(corpus), 'sameSizeFilesRead': checked, 'method': 'dimension prefilter; pinned PNG hash and normalized whole-frame hash equality'},
            'limitation': 'Whole-frame equality only; transparent padding matters. Unmatched is not missing art. Other resolutions/animations/partial occlusion excluded.'},
        'experiments': {'comparisons': comparisons, 'assemblies': probes},
        'contexts': [{'sourceId': sid(MASTER), 'rect': r} for r in CONTEXTS],
        'review': {'independent': 'pending exact-hash per-member review', 'human': 'unregistered; no approval or promotion'},
        'coverage': {'sourceRecordCount': len(candidates), 'proposalUnitCount': len(candidates), 'exactMasterOccurrenceCount': sum(len(c['masterOccurrences']) for c in candidates),
            'noExactMasterMembers': [c['id'] for c in candidates if not c['masterOccurrences']], 'namedExportAliasCount': sum(len(c['namedExportAliases']) for c in candidates), 'semanticExhaustiveness': 'bounded exports only; E10 not fully segmented'},
        'reproduce': {'check': 'python3 scripts/semantic-map-playground.py --check', 'capture': 'python3 scripts/semantic-map-playground.py --check --capture-dir /tmp/tilefun-semantic-E03'}}
    if capture_dir:
        sheet = Image.new('RGBA', (5 * 190, 5 * 190), '#30333a')
        draw = ImageDraw.Draw(sheet)
        for i, ((bank, n), c) in enumerate(zip(SPECS, candidates)):
            x, y = i % 5 * 190, i // 5 * 190
            im = images[(bank, n)]
            sheet.alpha_composite(im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST), (x + 30, y + 38))
            draw.text((x + 8, y + 8), c['id'] + ' ' + COLORS[bank] + ' ' + str(n), fill='white')
            draw.text((x + 8, y + 175), 'frame ' + str(im.size), fill='white')
        sheet.save(capture_dir / 'contact-sheet.png')
        for i, (x, y, w, h) in enumerate(CONTEXTS, 1):
            im = master.crop((x, y, x + w, y + h))
            im.save(capture_dir / f'context-{i}-native.png')
            backing = Image.new('RGBA', im.size, '#30333a')
            backing.alpha_composite(im)
            backing.resize((w * 3, h * 3), Image.Resampling.NEAREST).save(capture_dir / f'context-{i}.png')
        (capture_dir / 'proof-summary.json').write_text(json.dumps(result['coverage'], indent=2) + '\n')
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
            raise SystemExit('E03 differs from reproduced evidence')
        print('E03 verified: ' + json.dumps(result['coverage'], sort_keys=True))
    else:
        OUTPUT.write_text(output)
        print('Wrote ' + str(OUTPUT.relative_to(REPO)))


if __name__ == '__main__':
    main()
