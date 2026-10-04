#!/usr/bin/env python3
"""Reproduce I02 six side-bed/bedding units in all three actual render sets.

Requires Pillow and restored original files. Source art is read-only.
--check compares frozen JSON; --capture-dir emits disposable exact-pixel evidence.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
PLAN = REPO / 'docs/tactical/053-semantic-tileset-map'
OUTPUT = PLAN / 'packets/I02-bedroom.json'
LEDGER_HASH = 'c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda'
MASTER = 'assets/interiors/1_Interiors/16x16/Interiors_16x16.png'
LOGICAL = [1, 2, 63, 64, 57, 119]
VARIANTS = ['normal', 'black-shadow', 'shadowless']
BLACK = {1: 424, 2: 425, 63: 486, 64: 487, 57: 480, 119: 542}
SHADOW = {'normal': (167, 151, 150, 255), 'black-shadow': (58, 58, 80, 100)}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sid(path):
    return 'src-' + sha(path.encode())[:16]


def vendor(entry):
    return int(Path(entry['sourcePath']).stem.rsplit('_', 1)[1])


def field(value, evidence, confidence='high', alternatives=None):
    return {'value': value, 'confidence': confidence, 'evidence': evidence,
            'alternatives': alternatives or [], 'disposition': 'proposed'}


def delta(a, b):
    if a.size != b.size:
        raise ValueError('Delta alignment must be explicit')
    raw_a, raw_b = a.tobytes(), b.tobytes()
    mask = Image.new('L', a.size)
    pairs = set()
    inside = outside = 0
    for i in range(0, len(raw_a), 4):
        p, q = tuple(raw_a[i:i + 4]), tuple(raw_b[i:i + 4])
        if p != q:
            mask.putpixel(((i // 4) % a.width, (i // 4) // a.width), 255)
            pairs.add((p, q))
            if q[3]:
                inside += 1
            else:
                outside += 1
    return {'size': list(a.size), 'inputNormalizedRgbaSHA256': sha(raw_a),
            'referenceNormalizedRgbaSHA256': sha(raw_b), 'changedPixels': inside + outside,
            'onReferenceBodyPixels': inside, 'outsideReferenceBodyPixels': outside,
            'changedBoundsXYXY': list(mask.getbbox()) if inside + outside else None,
            'changedMaskSHA256': sha(mask.tobytes()),
            'changedColorPairs': [[list(p), list(q)] for p, q in sorted(pairs)]}


def canonical(im, variant):
    raw = bytearray(im.tobytes())
    token = SHADOW.get(variant)
    if token:
        for i in range(0, len(raw), 4):
            if tuple(raw[i:i + 4]) == token:
                raw[i:i + 4] = bytes(4)
    return sha(raw)


def build(capture_dir):
    ledger_path = 'docs/tactical/053-semantic-tileset-map/source-files.json'
    ledger_raw = (REPO / ledger_path).read_bytes()
    if sha(ledger_raw) != LEDGER_HASH:
        raise ValueError('Pinned source ledger changed')
    rows = json.loads(ledger_raw)['files']
    ledger = {r[0]: r for r in rows}
    spec = importlib.util.spec_from_file_location('semantic_match', REPO / 'scripts/semantic-map-match.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sources, cache = {}, {}

    def read(path):
        if path in cache:
            return cache[path]
        row = ledger[path]
        raw = (REPO / path).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError('Pinned source changed: ' + path)
        im = module.normalized(Image.open(REPO / path))
        if list(im.size) != row[2:4]:
            raise ValueError('Pinned dimensions changed: ' + path)
        sources[sid(path)] = {'id': sid(path), 'path': path, 'sha256': row[1],
                              'dimensions': list(im.size), 'normalizedRgbaSHA256': sha(im.tobytes())}
        cache[path] = im
        return im

    master = read(MASTER)
    catalog_path = 'public/data/modern-interiors-atlas.json'
    catalog_raw = (REPO / catalog_path).read_bytes()
    catalog = json.loads(catalog_raw)
    packed_path = 'public/' + catalog['atlas']
    packed = read(packed_path)
    corpus = [e for e in catalog['entries'] if e.get('sourceKind') == 'single']
    bedroom = [e for e in corpus if e.get('theme') == 'bedroom']
    by_key = {(e['variant'], vendor(e)): e for e in bedroom}
    keys = [(v, n) for v in VARIANTS for n in LOGICAL]
    selected = {key: by_key[(key[0], BLACK[key[1]] if key[0] == 'black-shadow' else key[1])] for key in keys}
    images = {key: read(e['sourcePath']) for key, e in selected.items()}
    ids = {key: f'I02-{i:02d}' for i, key in enumerate(keys, 1)}
    theme_paths = [r[0] for r in rows if r[5].startswith('interiors-theme-') and 'Bedroom' in r[0]]
    if len(theme_paths) != 3:
        raise ValueError('Bedroom sheet domain changed')
    matchers = {p: module.Matcher(read(p), grid=1) for p in [MASTER, *theme_paths]}

    # Filename-index equality is explicitly refuted for black-shadow Bedroom.
    sizes = {im.size for im in images.values()}
    counterpart_pool = [e for e in bedroom if e['variant'] == 'black-shadow' and tuple(e['sourceRect'][2:]) in sizes]
    pool_images = {e['key']: read(e['sourcePath']) for e in counterpart_pool}
    counterpart_tests = []
    for n in LOGICAL:
        ref = images[('shadowless', n)]
        matches = [e for e in counterpart_pool if pool_images[e['key']].size == ref.size
                   and canonical(pool_images[e['key']], 'black-shadow') == sha(ref.tobytes())]
        if [vendor(e) for e in matches] != [BLACK[n]]:
            raise ValueError('Counterpart ambiguity/drift: ' + str(n))
        for v in VARIANTS:
            im = images[(v, n)]
            comparison = delta(im, ref)
            if comparison['onReferenceBodyPixels'] or canonical(im, v) != sha(ref.tobytes()):
                raise ValueError('Selected counterpart changes the visible reference body')
            counterpart_tests.append({'memberId': ids[(v, n)], 'shadowlessReferenceId': ids[('shadowless', n)],
                'shadowToken': list(SHADOW[v]) if v in SHADOW else None,
                'canonicalBodySHA256': canonical(im, v), 'deltaFromShadowless': comparison,
                'blackShadowPoolMatches': [vendor(e) for e in matches],
                'limit': 'Only six selected body signatures; not a whole-pack shadow normalization rule.'})
    wrong_name_tests = []
    for n in LOGICAL:
        entry = by_key[('black-shadow', n)]
        wrong = read(entry['sourcePath'])
        wrong_name_tests.append({'normalLogicalIndex': n, 'sameNumberBlackSourceId': sid(entry['sourcePath']),
            'sameNumberBlackVendorIndex': n, 'dimensions': list(wrong.size),
            'normalizedRgbaSHA256': sha(wrong.tobytes()), 'actualBlackVendorIndex': BLACK[n],
            'sameFrameDimensions': wrong.size == images[('shadowless', n)].size,
            'sameCanonicalBody': wrong.size == images[('shadowless', n)].size and canonical(wrong, 'black-shadow') == sha(images[('shadowless', n)].tobytes()),
            'observation': 'Same vendor number is a different bed/bunk; filename-number equality refuted by pixels.'})

    # Exact whole native-frame aliases, across every indexed native16 single theme.
    identities = {(im.size, sha(im.tobytes())) for im in images.values()}
    aliases = {identity: [] for identity in identities}
    fitting_count = 0
    for entry in corpus:
        if tuple(entry['sourceRect'][2:]) not in sizes:
            continue
        fitting_count += 1
        path = entry['sourcePath']
        row = ledger[path]
        raw = (REPO / path).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError('Alias corpus source drift: ' + path)
        im = module.normalized(Image.open(REPO / path))
        identity = (im.size, sha(im.tobytes()))
        if identity not in aliases:
            continue
        read(path)
        x, y, w, h = entry['rect']
        if min(x, y) < 0 or x + w > packed.width or y + h > packed.height or (w, h) != im.size:
            raise ValueError('Packed alias bounds changed')
        if packed.crop((x, y, x + w, y + h)).tobytes() != im.tobytes():
            raise ValueError('Packed alias pixels changed')
        aliases[identity].append({'sourceId': sid(path), 'packedKey': entry['key'], 'packedRect': entry['rect'], 'variant': entry['variant']})

    candidates = []
    for v, n in keys:
        im, entry = images[(v, n)], selected[(v, n)]
        bbox = im.getchannel('A').getbbox()
        alpha_rect = [bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]]
        cover = n in (57, 119)
        head = 'right' if n in (1, 2, 57) else 'left'
        pillow = 'blue' if n in (1, 63) else 'pale lilac'
        label = ('Blue star/moon blanket, pillow at ' + head if cover else 'Pale-gray bed, ' + pillow + ' pillow at ' + head)
        compatible = [ids[(v, other)] for other in ([1, 2] if n == 57 else [63, 64] if n == 119 else [57] if n in (1, 2) else [119])]
        identity_evidence = ('Bright blue cloth panel has scattered pale star/moon-like motifs, a vertical fold beside the pillow end and a scalloped hanging lower edge; no bed frame, pillow, legs or support exists in this export.' if cover else
            'Closed side-view frame has one tall headboard, a pillow on the mattress, a closed pale-gray cover and small feet under the near rail. Native padding is not an assembly cut.')
        occurrences = [{'sourceId': sid(path), 'rect': r, 'lineage': 'exact-whole-native-frame-normalized-RGBA'}
                       for path, matcher in matchers.items() for r in matcher.find(im)]
        candidates.append({'id': ids[(v, n)], 'label': label, 'sourceId': sid(entry['sourcePath']),
            'sourceRect': entry['sourceRect'], 'logicalNormalVendorIndex': n, 'actualVendorIndex': vendor(entry), 'renderVariant': v,
            'normalizedRgbaSHA256': sha(im.tobytes()), 'alphaVisibleRect': alpha_rect,
            'committedRendering': {'sheetId': 'modern-interiors', 'sourceId': sid(packed_path), 'rect': entry['rect'],
                                   'packedKey': entry['key'], 'exactVerified': True},
            'fields': {'identity': field(label, identity_evidence, 'medium' if cover else 'high',
                                        ['small rug or freestanding hanging cloth; alignment/drape weakens this'] if cover else ['sofa/daybed; no back running along long edge, while pillow/headboard support bed interpretation']),
                'family': field('tan/brown-frame side-bed with pale-gray bedding and optional blue patterned blanket',
                                'Exact selected body signatures repeat across shadow sets; all four beds share the same rail, feet, mattress texture and one end headboard.'),
                'style': field('wood-like tan/brown frame; softly patterned bedding', 'Brown rails and tan end post resemble wood, but pixels do not establish physical material, age, vendor style name or fabric type.', 'medium', ['physical material unknown']),
                'role': field('bedding-overlay-component' if cover else 'complete-side-bed', identity_evidence,
                              'medium' if cover else 'high', ['separate decorative cloth'] if cover else []),
                'facing': field('side view; pillow/headboard at image-' + head + '; compass heading unknown',
                                'The pillow/headboard position and long near rail are visible; no world compass convention is established.', 'medium', ['world heading unknown']),
                'variant': field(('blue patterned blanket' if cover else 'pale-gray mattress/cover, ' + pillow + ' pillow, tan/brown frame') + '; ' + v,
                                 'Selected counterpart comparison proves an identical opaque body, changing only pixels outside the shadowless body; black-shadow filenames have different numbers.')},
            'topology': {'standaloneEligibility': 'forbidden; bedding component' if cover else 'allowed as visual proposal only',
                'requiredNeighbors': [{'relation': 'underlay', 'members': compatible, 'overlayTargetOffset': [0, 16]}] if cover else [],
                'compatibleMembers': compatible, 'openJoinEdges': [], 'repeatable': False,
                'limits': 'Recipes retain same-render labels and matching pillow end; all three cover render exports are byte-identical, so same-render naming is bookkeeping rather than a pixel difference. Tested at full-frame offset [0,16] on the two selected pillow colors. No arbitrary bed/cloth fitting, repetition, mirroring or runtime placement rule.',
                'enforcement': 'metadata only'},
            'geometry': {'anchor': None, 'footprint': None, 'collision': None, 'occlusion': None, 'height': None, 'walkableSurfaces': None, 'status': 'unknown'},
            'occurrences': occurrences, 'namedExportAliases': aliases[(im.size, sha(im.tobytes()))],
            'review': {'independent': 'pending', 'human': 'unregistered; not approved'}})

    experiments, renders = [], []

    def compose(name, v, bed, cover, offset, disposition, observation):
        canvas = Image.new('RGBA', (48, 48))
        placements = []
        for n, pos in ([(bed, (0, 0))] if bed else []) + ([(cover, offset)] if cover else []):
            im = images[(v, n)]
            canvas.alpha_composite(im, pos)
            placements.append({'memberId': ids[(v, n)], 'sourceRect': [0, 0, im.width, im.height], 'targetOffset': list(pos)})
        experiments.append({'id': name, 'operation': 'RGBA source-over onto transparent native canvas; no resizing/mirroring/recoloring',
            'size': [48, 48], 'placements': placements, 'outputNormalizedRgbaSHA256': sha(canvas.tobytes()),
            'exactMasterOccurrences': matchers[MASTER].find(canvas), 'topologyDisposition': disposition,
            'observation': observation, 'renderQuality': 'mapper visual proposal; independent review pending', 'humanApproval': 'none'})
        renders.append((name, canvas))

    for v in VARIANTS:
        for bed in [1, 2, 63, 64]:
            cover = 57 if bed in (1, 2) else 119
            compose(f'{v}-bed-{bed}-matching-cover', v, bed, cover, (0, 16), 'proposed-valid',
                    'Cover top aligns with the mattress top; pillow and tall headboard remain exposed, while scalloped cloth hangs over the near rail toward feet.')
    for name, bed, cover, offset, disposition, observation in [
        ('wrong-end-right-bed', 1, 119, (0, 16), 'invalid-for-selected-overlay-rule', 'Wrong-end cover crosses the blue pillow/near-headboard area and leaves part of the foot-end gray mattress uncovered.'),
        ('wrong-end-left-bed', 63, 57, (0, 16), 'invalid-for-selected-overlay-rule', 'Opposite cover crosses pillow area; outer mattress at image-right remains uncovered.'),
        ('unshifted-export', 1, 57, (0, 0), 'invalid-for-selected-overlay-rule', 'Native exports have different padding; unshifted cloth floats above the mattress and leaves gray bedding exposed.'),
        ('cover-raised-four-pixels', 1, 57, (0, 12), 'weakened-alternative', 'Cloth top rises four pixels above the gray mattress top and lower hem stops at the upper rail; this does not match the selected drape alignment.'),
        ('cover-only', None, 57, (0, 16), 'invalid-complete-bed', 'No frame, pillow, legs or support: not a standalone complete bed.')]:
        compose(name, 'normal', bed, cover, offset, disposition, observation)

    master_related = []
    related_renders = []
    for n, r in [(1, [96, 11216, 48, 48]), (63, [48, 11216, 48, 48])]:
        im = images[('normal', n)]
        x, y, w, h = r
        contextual = master.crop((x, y, x + w, y + h))
        b = im.getchannel('A').getbbox()
        master_related.append({'memberId': ids[('normal', n)], 'masterRect': r, 'sourceComparisonRect': list([b[0], b[1], b[2]-b[0], b[3]-b[1]]),
            'fullFrameDelta': delta(im, contextual), 'alphaBoundingFrameDelta': delta(im.crop(b), contextual.crop(b)),
            'lineage': 'related-context-only; not exact occurrence or alias',
            'observation': 'Master upper headboard lacks 14 pixels present in both named exports. The image-left example additionally swaps 27 opaque wood-shading pixels. Full frames also contain neighboring art above bed. These comparisons are not exact aliases; no padding/shadow rewrite manufactures one.'})
        related_renders.extend([(f'normal export {n}', im), (f'master related to {n}', contextual)])

    variant_groups = [{'id': f'I02-unit-{n}', 'label': next(c['label'] for c in candidates if c['logicalNormalVendorIndex'] == n),
                       'representativeMemberId': ids[('normal', n)], 'members': [ids[(v, n)] for v in VARIANTS],
                       'selector': 'renderVariant', 'logicalNormalVendorIndex': n} for n in LOGICAL]
    result = {'schemaVersion': 1, 'packetId': 'I02', 'proposalRevision': 1, 'state': 'agent-proposal',
        'contract': 'Candidates use native padded single-file rectangles. Alpha bounds are local crop coordinates; occurrences are exact native-frame sheet crops. Committed render rectangles are separate packed coordinates. Required-neighbor overlay offset is relative to the full bed frame. Source-over layers reconstruct finite experiment canvases.',
        'coordinates': {'unit': 'native pixels', 'origin': 'top-left', 'rect': '[x,y,width,height]; half-open', 'deltaBounds': '[left,top,right,bottom]; half-open'},
        'pins': {'sourceLedger': {'path': ledger_path, 'sha256': LEDGER_HASH},
                 'sourceManifest': {'path': 'docs/tactical/053-semantic-tileset-map/source-manifest.json', 'sha256': sha((PLAN / 'source-manifest.json').read_bytes())},
                 'packedIndex': {'path': catalog_path, 'sha256': sha(catalog_raw)},
                 'helper': {'path': 'scripts/semantic-map-bedroom.py', 'sha256': sha(Path(__file__).read_bytes())},
                 'matchHelper': {'path': 'scripts/semantic-map-match.py', 'sha256': sha((REPO / 'scripts/semantic-map-match.py').read_bytes())}},
        'scope': {'surveyRegion': 'S02-I31; related master context only for complete beds', 'logicalNormalVendorIndices': LOGICAL, 'blackShadowCounterpartIndices': [BLACK[n] for n in LOGICAL],
                  'renderVariants': VARIANTS, 'sourceRecordCount': 18, 'proposalUnits': 6,
                  'description': 'One natural-wood/pale-gray side-bed body, two pillow colors, two headboard ends, plus blue star/moon-like cloth overlays at each end; all three actual render sets.',
                  'exclusions': ['other frame/pillow/bedding colors', 'upright/front beds', 'bunks', 'other blanket motifs', 'other Bedroom furniture', 'whole-bedroom or whole-pack semantic coverage', 'gameplay geometry and runtime rules']},
        'sources': sorted(sources.values(), key=lambda s: s['path']), 'candidates': candidates,
        'groups': [{'id': 'I02-complete-beds', 'members': [ids[(v,n)] for v in VARIANTS for n in [1,2,63,64]], 'role': 'complete-object-proposals'},
                   {'id': 'I02-bedding-components', 'members': [ids[(v,n)] for v in VARIANTS for n in [57,119]], 'role': 'pieces-to-combine'}],
        'variantGroups': variant_groups,
        'counterpartCorpus': [{'sourceId': sid(e['sourcePath']), 'actualVendorIndex': vendor(e), 'packedKey': e['key']} for e in counterpart_pool],
        'counterpartExperiments': counterpart_tests, 'filenameNumberRefutations': wrong_name_tests,
        'assemblyExperiments': experiments, 'masterRelatedComparisons': master_related,
        'matching': {'implementation': 'scripts/semantic-map-match.py Matcher(grid=1)',
            'comparison': 'exact RGBA; hidden RGB zeroed only at alpha=0', 'sheetDomains': [sid(p) for p in matchers],
            'origins': 'every fitting integer pixel origin', 'sheetMatchKind': 'whole native padded frame only',
            'namedAliasCorpus': {'domain': 'all indexed native16 Interiors singles across all themes/render sets', 'indexedRecords': len(corpus), 'sameSizeRecordsRead': fitting_count},
            'counterpartSearch': {'domain': 'all indexed Bedroom black-shadow singles of either selected native size', 'matchingSizeRecords': len(counterpart_pool), 'normalization': 'zero only observed [58,58,80,100] shadow token; exact remaining body and native padding'},
            'limits': 'Exact whole-frame equality only. No clipped/occluded/near-match domain search or other theme-sheet search. No missing-art or whole-pack completeness inference.'},
        'contexts': [{'sourceId': sid(MASTER), 'rect': [0, 11216, 240, 192]}, {'sourceId': sid(theme_paths[0]), 'rect': [0, 608, 240, 192]}],
        'coverage': {'sourceRecordCount': 18, 'proposalUnits': 6, 'completeBedRecords': 12, 'beddingComponentRecords': 6,
            'exactMasterOccurrences': sum(o['sourceId']==sid(MASTER) for c in candidates for o in c['occurrences']),
            'exactThemeOccurrences': sum(o['sourceId']!=sid(MASTER) for c in candidates for o in c['occurrences']),
            'exactNamedAliasesIncludingDuplicateRenderExports': sum(len(c['namedExportAliases']) for c in candidates),
            'uniqueNamedAliasFiles': len({a['sourceId'] for c in candidates for a in c['namedExportAliases']}),
            'distinctSelectedNormalizedFrames': len(identities), 'semanticExhaustiveness': 'bounded six units; no whole-region completeness claim'},
        'presentation': {'familyTitle': 'Side beds and blue blankets',
            'familyFacts': ['Headboard on the left or right, with blue or pale lilac pillows.', 'Two blanket pieces fit over the matching bed view.', 'Shadow choices keep the same bed body; game collision and occlusion are unknown.'],
            'representativeCards': 6, 'defaultVariant': 'normal', 'variantControl': 'normal/black-shadow/shadowless per logical unit',
            'separateCompleteObjectsAndComponents': True, 'showResearchIdentifiersInNormalBrowsing': False,
            'cards': [{'id': f'I02-unit-{n}', 'label': next(c['label'] for c in candidates if c['logicalNormalVendorIndex']==n),
                'membersByVariant': {v: ids[(v,n)] for v in VARIANTS},
                'section': 'Pieces to combine' if n in (57,119) else 'Complete beds',
                'facts': (['Blue blanket with pale star and moon-like marks.', 'Place over the matching bed with the pillow at image-'+('right' if n==57 else 'left')+'.', 'The piece has no frame or pillow of its own.'] if n in (57,119) else
                          ['Pale-gray bedding and a '+('blue' if n in (1,63) else 'pale lilac')+' pillow.', 'Headboard and pillow at image-'+('right' if n in (1,2) else 'left')+'.', 'Complete visual bed; game geometry is unknown.']),
                'positiveExperimentIds': [f'{v}-bed-{bed}-matching-cover' for v in VARIANTS for bed in ([1,2] if n==57 else [63,64] if n==119 else [n])]} for n in LOGICAL]},
        'review': {'independent': 'pending separate reviewer pinned to exact proposal and helper hashes', 'human': 'unregistered; no approval or promotion'},
        'reproduce': {'check': 'python3 scripts/semantic-map-bedroom.py --check', 'capture': 'python3 scripts/semantic-map-bedroom.py --check --capture-dir /tmp/tilefun-semantic-I02'}}
    if capture_dir:
        capture_dir.mkdir(parents=True, exist_ok=True)

        def sheet(items, cols, cell, path):
            out = Image.new('RGB', (cols*cell[0], ((len(items)+cols-1)//cols)*cell[1]), '#dedede')
            draw = ImageDraw.Draw(out)
            for i, (name, im) in enumerate(items):
                x, y = i%cols*cell[0], i//cols*cell[1]
                zoom = im.resize((im.width*4, im.height*4), Image.Resampling.NEAREST)
                out.paste(zoom, (x+10, y+40), zoom)
                draw.text((x+10, y+10), name, fill='black')
            out.save(capture_dir/path)

        sheet([(ids[k]+' '+k[0]+' vendor '+str(vendor(selected[k])), images[k]) for k in keys], 6, (240, 240), 'contact-sheet.png')
        sheet(renders, 4, (280, 260), 'assemblies.png')
        sheet(related_renders, 4, (260, 240), 'master-differences.png')
        sheet([(str(n)+' WRONG black number', read(by_key[('black-shadow',n)]['sourcePath'])) for n in LOGICAL], 6, (280, 340), 'filename-refutations.png')
        for i, context in enumerate(result['contexts'], 1):
            source = cache[next(s['path'] for s in sources.values() if s['id']==context['sourceId'])]
            x,y,w,h = context['rect']; crop=source.crop((x,y,x+w,y+h)); backing=Image.new('RGBA',crop.size,'#dedede');backing.alpha_composite(crop)
            backing.resize((w*4,h*4),Image.Resampling.NEAREST).save(capture_dir/f'context-{i}.png')
        (capture_dir/'evidence.json').write_text(json.dumps({'proposalSHA256': sha((json.dumps(result, indent=2)+'\n').encode()), 'helperSHA256': result['pins']['helper']['sha256'], 'assemblyExperiments': experiments}, indent=2)+'\n')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--capture-dir', type=Path)
    args = parser.parse_args()
    result = build(args.capture_dir)
    output = json.dumps(result, indent=2)+'\n'
    if args.check:
        if OUTPUT.read_text() != output:
            raise SystemExit('I02 differs from reproduced evidence')
        print('I02 verified: '+json.dumps(result['coverage'],sort_keys=True))
    else:
        OUTPUT.write_text(output)
        print('Wrote '+str(OUTPUT.relative_to(REPO)))


if __name__ == '__main__':
    main()
