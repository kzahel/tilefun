#!/usr/bin/env python3
"""Explicit frozen E04/I02/E05 adapters and finite evidence replay.

No absence searches are repeated. Original evidence, committed rendering and
master lineage remain separate; missing originals never become verified originals.
"""
import copy
import hashlib
import json
from pathlib import Path

from PIL import Image

PLAN = 'docs/tactical/053-semantic-tileset-map'
CONTRACTS = {
    'E04': {'name': 'E04-plants-planters', 'version': 1, 'records': 19, 'units': 19,
        'proposal': '8fbca92889dd7bc587093eaa38d276b36d6ccbe22a8f748c79d4b4f6c4554f36',
        'review': '7815d8d76dfa2543f5ee43f10d9da5ff375a02043574a8bcd2474e7a508ea961',
        'helper': ('scripts/semantic-map-plants-planters.py', '8fc4a26872684f7719dbc8586c7356598b398f4110d7056543791eea983080c5'),
        'lineage': {'direct': 16, 'alpha-visible-reconstruction': 3}},
    'I02': {'name': 'I02-bedroom', 'version': 1, 'records': 18, 'units': 6,
        'proposal': '9b951c075c0707f86391b14741f533c499a8b1938342db936e0b9dea29f7e0a5',
        'review': 'fb62ea277d4c053acf5ba752dd2da54963c55e30a8920425c1cb050e5f0efc88',
        'helper': ('scripts/semantic-map-bedroom.py', '4242f041621ccb19fa4f5134832b6437d3628faaaf5ca7e3c938a46c7dab7f31'),
        'lineage': {'direct': 6, 'subfile-only': 12}},
    'E05': {'name': 'E05-fences-gates', 'version': 1, 'records': 27, 'units': 27,
        'proposal': '238778d9b00baadfa7de2799b3d55a0f834be22237b0994c77e731efba1e2870',
        'review': '3395feed2cfe2f9e505c9ca375b2792b22519c95f078d0ab58d92bb0663191e8',
        'helper': ('scripts/semantic-map-fences-gates.py', '1284587d22eb12fe975fbd84c7e56af4c802b8e5df0d0378a981cf808328c066'),
        'lineage': {'direct': 27}},
}


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def receipt(value):
    return sha(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode())


def dispositions(text, ids):
    """Read the explicit disposition column rather than guessing a table layout."""
    result = {}
    column = None
    for line in text.splitlines():
        if not line.startswith('|'):
            continue
        cells = [s.strip().replace('`', '') for s in line.strip('|').split('|')]
        headers = [i for i, cell in enumerate(cells) if 'disposition' in cell.lower()]
        if headers and cells[0].lower() in ('member', 'record', 'experiment', 'candidate', 'probe'):
            column = headers[0]
        if cells[0] in ids:
            require(column is not None and column < len(cells), 'Review lacks explicit disposition column')
            require(cells[0] not in result, 'Duplicate next-family review disposition')
            result[cells[0]] = {'memberId': cells[0], 'disposition': cells[column],
                'qualifications': [cell for i, cell in enumerate(cells) if i not in (0, column)]}
    require(set(result) == set(ids), 'Missing next-family review dispositions: ' + str(set(ids) - set(result)))
    return [result[uid] for uid in ids]


def build(root, source, files, pins, records, proposals, relations, reviews, packets, api):
    rect, fields_from, geometry = api['rect'], api['fields_from'], api['geometry']
    for pid, contract in CONTRACTS.items():
        path = f'{PLAN}/packets/{contract["name"]}.json'
        review_path = path.replace('.json', '-review.md')
        raw, review_raw = (root / path).read_bytes(), (root / review_path).read_bytes()
        require(sha(raw) == contract['proposal'] and sha(review_raw) == contract['review'], pid + ' frozen next-family pin drift')
        packet, text = json.loads(raw), review_raw.decode()
        require((packet['schemaVersion'], packet['packetId'], packet['proposalRevision']) == (contract['version'], pid, 1), pid + ' unsupported next-family schema')
        require(contract['proposal'] in text and contract['helper'][1] in text, pid + ' review applicability mismatch')
        pins[path], pins[review_path] = contract['proposal'], contract['review']
        helper_path, helper_pin = contract['helper']
        require(sha((root / helper_path).read_bytes()) == helper_pin, pid + ' helper drift')
        pins[helper_path] = helper_pin
        sources = {}
        for item in packet['sources']:
            sf = source(item['path'], item['sha256'], item['dimensions'])
            files[sf]['normalizedPixelSha256'] = item['normalizedRgbaSHA256']
            sources[item['id']] = sf
        for pin in packet['pins'].values():
            require(sha((root / pin['path']).read_bytes()) == pin['sha256'], pid + ' next-family input pin drift')
            pins[pin['path']] = pin['sha256']
        ids = [c['id'] for c in packet['candidates']]
        require(len(ids) == contract['records'], pid + ' next-family source count drift')
        reviewed = dispositions(text, ids)
        master_id = packet['matching']['sheetDomains'][0]
        for candidate, disposition in zip(packet['candidates'], reviewed):
            uid, bounds = candidate['id'], candidate['sourceRect']
            render = candidate['committedRendering']
            refs, occurrences, visible = [], [], []
            if pid == 'I02':
                for alias in candidate['namedExportAliases']:
                    refs.append({'sourceFile': sources[alias['sourceId']], 'bounds': rect(bounds, 'source-file-pixels')})
                    refs.append({'sourceFile': sources[render['sourceId']],
                        'bounds': rect(alias['packedRect'], 'packed-atlas-pixels', 'packed-alias'),
                        'catalogFile': packet['pins']['packedIndex']['path'], 'aliasKey': alias['packedKey'],
                        'aliasSourceFile': sources[alias['sourceId']], 'aliasSourceBounds': rect(bounds, 'source-file-pixels')})
                occurrences = [{'sourceFile': sources[o['sourceId']], 'bounds': rect(o['rect'], 'source-file-pixels'),
                    'lineage': o['lineage']} for o in candidate['occurrences']]
                lineage = 'direct' if any(o['sourceId'] == master_id for o in candidate['occurrences']) else 'subfile-only'
            else:
                refs = [{'sourceFile': sources[sid], 'bounds': rect(bounds, 'source-file-pixels')}
                        for sid in candidate['namedExportAliases']]
                refs.append({'sourceFile': sources[render['sourceId']], 'bounds': rect(render['rect'], 'source-file-pixels', 'committed-render-crop'),
                    'transparentFrame': {k: copy.deepcopy(render[k]) for k in ('operation', 'frameSize', 'offsetXY', 'normalizedRgbaSHA256')}})
                if pid == 'E04':
                    for o in candidate['occurrences']:
                        occurrences.extend({'sourceFile': sources[o['sourceId']], 'bounds': rect(r, 'source-file-pixels'),
                            'lineage': 'exact-whole-native-export-frame'} for r in o['fullFrameRects'])
                        visible.extend({'sourceFile': sources[o['sourceId']], 'bounds': rect(r, 'source-file-pixels', 'alpha-visible-correspondence'),
                            'recordLocalBounds': rect(o['alphaVisibleCropLocalRect'], 'record-local-pixels', 'alpha-visible'),
                            'lineage': 'exact-alpha-visible-crop-only; not a whole-master-frame occurrence'} for r in o['alphaVisibleCropRects'])
                    lineage = 'direct' if candidate['occurrences'][0]['fullFrameRects'] else 'alpha-visible-reconstruction'
                else:
                    occurrences = [{'sourceFile': sources[o['sourceId']], 'bounds': rect(o['rect'], 'source-file-pixels'),
                        'lineage': o['lineage']} for o in candidate['occurrences']]
                    lineage = 'direct'
            record = {'id': uid, 'packetId': pid, 'sourceId': uid, 'sourceKind': 'named-single',
                'primaryLineage': lineage, 'lineageDomain': 'pinned-original-master',
                'sourceIdentity': 'exact-pinned-whole-export', 'frameDimensions': bounds[2:],
                'normalizedPixelSha256': candidate['normalizedRgbaSHA256'], 'references': refs,
                'occurrences': occurrences, 'integrationAliases': [],
                'bounds': [rect([0, 0, *bounds[2:]], 'record-local-pixels'),
                    rect(candidate['alphaVisibleRect'], 'record-local-pixels', 'alpha-visible')],
                'topology': candidate['topology'], 'independentDisposition': disposition,
                'originalEvidence': candidate, 'searchEvidence': packet['matching']}
            if visible:
                record['alphaVisibleCorrespondences'] = visible
            if pid == 'I02':
                record.update(variant=candidate['renderVariant'], vendorIndex=candidate['actualVendorIndex'],
                    logicalNormalVendorIndex=candidate['logicalNormalVendorIndex'])
            records.append(record)
        if pid == 'I02':
            for group in packet['variantGroups']:
                members = group['members']
                member_fields = {c['id']: fields_from(c['fields']) for c in packet['candidates'] if c['id'] in members}
                fields = member_fields[group['representativeMemberId']]
                proposals.append({'id': group['id'], 'packetId': pid, 'members': members,
                    'unitType': 'bed-or-overlay-variant-unit', 'fields': fields, 'memberFields': member_fields,
                    'identity': fields['identity'], 'family': fields['family'], 'componentRole': fields['role'],
                    'variant': fields['variant'], 'facing': fields['facing'],
                    'topologyByMember': {c['id']: c['topology'] for c in packet['candidates'] if c['id'] in members},
                    'gameplayGeometry': geometry.copy(), 'alternatives': fields['identity']['alternatives'],
                    'state': 'proposed', 'humanApproval': 'unregistered'})
        else:
            for candidate in packet['candidates']:
                fields = fields_from(candidate['fields'])
                proposals.append({'id': candidate['id'], 'packetId': pid, 'members': [candidate['id']],
                    'unitType': 'whole-visual-object' if pid == 'E04' or candidate['id'] == 'E05-27' else 'unresolved-gate-proposal' if candidate['id'] in ('E05-23', 'E05-24', 'E05-25', 'E05-26') else 'source-component-proposal',
                    'fields': fields, 'identity': fields['identity'], 'family': fields['family'],
                    'componentRole': fields['role'], 'variant': fields['variant'], 'facing': fields['facing'],
                    'topology': candidate['topology'], 'gameplayGeometry': geometry.copy(),
                    'alternatives': fields['identity']['alternatives'], 'state': 'proposed', 'humanApproval': 'unregistered'})
        relations.append({'id': pid + ':next-family-evidence', 'packetId': pid, 'kind': 'frozen-next-family-evidence',
            'members': ids, 'sourceFilesById': sources, 'originalEvidence': {k: v for k, v in packet.items() if k not in ('sources', 'candidates')},
            'limit': 'Replay listed exact correspondences and bounded experiments only; do not repeat absence scans or grant approval.'})
        experiments = packet['assemblyExperiments'] if pid == 'I02' else packet['experiments'].get('assemblies', [])
        probe_dispositions = dispositions(text, [e['id'] for e in experiments]) if experiments else []
        for experiment, disposition in zip(experiments, probe_dispositions):
            recipe = copy.deepcopy(experiment['renderRecipe']) if pid == 'E05' else {k: copy.deepcopy(experiment[k]) for k in ('size', 'placements', 'operation')}
            relations.append({'id': pid + ':probe:' + experiment['id'], 'packetId': pid,
                'kind': 'bounded-next-family-probe', 'members': [p['memberId'] for p in recipe['placements']],
                'renderRecipe': recipe, 'renderRecipeSha256': receipt(recipe),
                'operation': 'source-over', 'originalEvidence': experiment, 'independentDisposition': disposition,
                'humanApproval': 'unregistered', 'limit': 'Frozen finite rendering/metadata proposal only; no arbitrary assembly or gameplay rule.'})
        review_sources = sorted(set(sources.values()))
        pr = [p for p in proposals if p['packetId'] == pid]
        require(len(pr) == contract['units'], pid + ' proposal-unit count drift')
        reviews.append({'id': pid + ':independent-review', 'packetId': pid, 'kind': 'agent-review',
            'proposalPath': path, 'proposalSha256': contract['proposal'], 'proposalRevision': 1,
            'sourcePins': [files[sf] for sf in review_sources], 'sourceScope': 'Every frozen materialized source and selected full/visible reference; conditional corpora are not whole-pack semantics.',
            'memberRecords': ids, 'proposalUnits': [p['id'] for p in pr],
            'recordDispositions': reviewed, 'probeDispositions': probe_dispositions,
            'applicability': 'exact-proposal-hash-only', 'reviewPath': review_path, 'reviewSha256': contract['review'],
            'observationOrder': 'Reviewer recorded actual source interpretation before mapper semantic claims; brief/capture labels may be known, not formally blinded.',
            'originalText': text, 'humanApproval': 'unregistered', 'runtimePromotion': False})
        packets.append({'id': pid, 'proposalPath': path, 'proposalSha256': contract['proposal'], 'revision': 1,
            'sourceRecordCount': len(ids), 'proposalUnitCount': len(pr), 'state': 'proposed',
            'coverageLimit': packet['coverage'], 'originalContext': {k: v for k, v in packet.items() if k not in ('sources', 'candidates')}})


def bed_delta(a, b):
    require(a.size == b.size, 'Next-family comparison dimensions differ')
    A, B = a.tobytes(), b.tobytes()
    mask = bytes(255 if A[i:i + 4] != B[i:i + 4] else 0 for i in range(0, len(A), 4))
    changes = [i for i, value in enumerate(mask) if value]
    pairs = sorted({(tuple(A[i * 4:i * 4 + 4]), tuple(B[i * 4:i * 4 + 4])) for i in changes})
    inside = sum(bool(B[i * 4 + 3]) for i in changes)
    box = Image.frombytes('L', a.size, mask).getbbox()
    return {'size': list(a.size), 'inputNormalizedRgbaSHA256': sha(A), 'referenceNormalizedRgbaSHA256': sha(B),
        'changedPixels': len(changes), 'onReferenceBodyPixels': inside, 'outsideReferenceBodyPixels': len(changes) - inside,
        'changedBoundsXYXY': list(box) if box else None, 'changedMaskSHA256': sha(mask),
        'changedColorPairs': [[list(p), list(q)] for p, q in pairs]}


def bed_signature(im, token):
    data = bytearray(im.tobytes())
    if token:
        for i in range(0, len(data), 4):
            if data[i:i + 4] == bytes(token):
                data[i:i + 4] = bytes(4)
    return sha(data)


def fence_ports(recipe, records):
    ports = []
    opposite = {'left': 'right', 'right': 'left', 'top': 'bottom', 'bottom': 'top'}
    for index, placement in enumerate(recipe['placements']):
        x, y = placement['at']
        for port in records[placement['memberId']]['topology']['openJoinEdges']:
            px, py = port['originXY']
            ports.append({'placementIndex': index, 'memberId': placement['memberId'],
                'edge': port['edge'], 'profile': port['profile'], 'globalOriginXY': [x + px, y + py]})
    pairs, unmatched = [], []
    for index, port in enumerate(ports):
        peers = [j for j, peer in enumerate(ports) if peer['placementIndex'] != port['placementIndex'] and
            peer['edge'] == opposite[port['edge']] and peer['profile'] == port['profile'] and peer['globalOriginXY'] == port['globalOriginXY']]
        if len(peers) != 1:
            unmatched.append(port)
        elif index < peers[0]:
            pairs.append([port, ports[peers[0]]])
    return {'matchedPairs': pairs, 'unmatchedPorts': unmatched}


def bed_overlay(recipe, records):
    """Validate only the selected finite underlay recipe, never arbitrary cloth fitting."""
    placements = recipe['placements']
    if len(placements) != 2:
        return False
    bed, cover = placements
    a, b = records[bed['memberId']], records[cover['memberId']]
    underlays = b['topology']['requiredNeighbors']
    return (a['topology']['standaloneEligibility'] == 'allowed as visual proposal only' and
        b['topology']['standaloneEligibility'] == 'forbidden; bedding component' and
        bed['targetOffset'] == [0, 0] and len(underlays) == 1 and underlays[0]['relation'] == 'underlay' and
        bed['memberId'] in underlays[0]['members'] and cover['targetOffset'] == underlays[0]['overlayTargetOffset'] and
        a['variant'] == b['variant'] and
        bed['sourceRect'] == [0, 0, *a['frameDimensions']] and cover['sourceRect'] == [0, 0, *b['frameDimensions']])


def validate(model, records, rendered, image, api):
    rect, crop, pixel_hash, delta = api['rect'], api['crop'], api['pixel_hash'], api['delta']
    files = {f['path']: f for f in model['sourceFiles']}
    result = {'recordPixelsVerified': {}, 'visibleCorrespondencesVerified': 0,
        'visibleCorrespondencesUnavailable': [], 'finiteProbeRastersVerified': {},
        'originalCorrespondencesUnavailable': [], 'pixelComparisonsVerified': 0,
        'I02CounterpartCorpusRechecked': False, 'I02FilenameRefutationsVerified': 0,
        'I02FilenameRefutationsUnavailable': [], 'I02MasterDifferencesVerified': 0,
        'I02MasterDifferencesUnavailable': [], 'originalNativeFramesVerified': {},
        'originalNativeFramesUnavailable': [], 'E05PortProbesVerified': 0, 'E05SeamDiagnosticsVerified': 0,
        'I02OverlayTopologyProbesVerified': 0}
    for record in records.values():
        pid, uid = record['packetId'], record['id']
        if pid not in CONTRACTS:
            continue
        require(uid in rendered, 'Committed next-family pixels unavailable: ' + uid)
        result['recordPixelsVerified'][pid] = result['recordPixelsVerified'].get(pid, 0) + 1
        original_refs = [ref for ref in record['references'] if ref['sourceFile'].startswith('assets/') and ref['bounds']['coordinateSpace'] == 'source-file-pixels']
        if any(image(ref['sourceFile']) is not None for ref in original_refs):
            result['originalNativeFramesVerified'][pid] = result['originalNativeFramesVerified'].get(pid, 0) + 1
        else:
            result['originalNativeFramesUnavailable'].append(uid)
        for ref in record.get('alphaVisibleCorrespondences', []):
            expected = crop(rendered[uid], ref['recordLocalBounds'])
            require(ref['bounds']['coordinateSpace'] == 'source-file-pixels' and ref['recordLocalBounds']['coordinateSpace'] == 'record-local-pixels', 'Visible crop coordinate-space drift')
            api['check_bounds'](ref['bounds'], files[ref['sourceFile']]['dimensions'])
            original = image(ref['sourceFile'])
            if original is None:
                result['visibleCorrespondencesUnavailable'].append({'memberId': uid, 'sourceFile': ref['sourceFile']})
            else:
                require(crop(original, ref['bounds']).tobytes() == expected.tobytes(), 'Alpha-visible correspondence differs: ' + uid)
                result['visibleCorrespondencesVerified'] += 1
        for occurrence in record['occurrences']:
            if image(occurrence['sourceFile']) is None:
                result['originalCorrespondencesUnavailable'].append({'memberId': uid, 'sourceFile': occurrence['sourceFile']})
    for relation in model['relationships']:
        pid = relation['packetId']
        if pid not in CONTRACTS:
            continue
        if relation['kind'] == 'bounded-next-family-probe':
            recipe, evidence = relation['renderRecipe'], relation['originalEvidence']
            require(receipt(recipe) == relation['renderRecipeSha256'], 'Next-family recipe receipt drift')
            require(relation['operation'] == 'source-over' and recipe['operation'].startswith('ordered native RGBA source-over' if pid == 'E05' else 'RGBA source-over'), 'Next-family probe operation drift')
            if pid == 'I02':
                require(bed_overlay(recipe, records) == (evidence['topologyDisposition'] == 'proposed-valid'), 'I02 finite underlay topology drift')
                result['I02OverlayTopologyProbesVerified'] += 1
            if pid == 'E05':
                require(receipt(recipe) == evidence['renderRecipeSHA256'], 'E05 frozen recipe receipt drift')
                if 'portEvaluation' in evidence:
                    ports = fence_ports(recipe, records)
                    require(ports == evidence['portEvaluation'], 'E05 finite port evidence drift')
                    require(bool(ports['unmatchedPorts']) == (evidence['topologyDisposition'] != 'supported-bounded-closed'), 'E05 closed/open disposition drift')
                    result['E05PortProbesVerified'] += 1
                    for diagnostic in evidence['seamDiagnostics']:
                        a, b = [rendered[uid] for uid in diagnostic['members']]
                        if diagnostic['axis'] == 'horizontal':
                            edge_a = [a.getpixel((a.width - 1, y)) for y in range(a.height)]
                            edge_b = [b.getpixel((0, y)) for y in range(b.height)]
                        else:
                            require(diagnostic['axis'] == 'vertical', 'E05 seam axis drift')
                            edge_a = [a.getpixel((x, a.height - 1)) for x in range(a.width)]
                            edge_b = [b.getpixel((x, 0)) for x in range(b.width)]
                        measured = {'bothOpaquePositions': [i for i, (p, q) in enumerate(zip(edge_a, edge_b)) if p[3] and q[3]],
                            'differentAdjacentRGBAPositions': [i for i, (p, q) in enumerate(zip(edge_a, edge_b)) if p != q],
                            'alphaChangedPositions': [i for i, (p, q) in enumerate(zip(edge_a, edge_b)) if p[3] != q[3]]}
                        require(all(diagnostic[k] == v for k, v in measured.items()), 'E05 seam diagnostic drift')
                        result['E05SeamDiagnosticsVerified'] += 1
            out = Image.new('RGBA', tuple(recipe['size']))
            for placement in recipe['placements']:
                part = rendered[placement['memberId']]
                if 'sourceRect' in placement:
                    part = crop(part, rect(placement['sourceRect'], 'record-local-pixels'))
                at = placement['at'] if pid == 'E05' else placement['targetOffset']
                if pid == 'E05':
                    require(placement['blend'] == 'over', 'E05 blend drift')
                api['check_bounds'](rect([*at, *part.size], 'probe-canvas-pixels'), out.size)
                out.alpha_composite(part, tuple(at))
            require(pixel_hash(out) == evidence['normalizedRgbaSHA256'] if pid == 'E05' else pixel_hash(out) == evidence['outputNormalizedRgbaSHA256'], 'Next-family probe raster differs: ' + relation['id'])
            result['finiteProbeRastersVerified'][pid] = result['finiteProbeRastersVerified'].get(pid, 0) + 1
            continue
        if relation['kind'] != 'frozen-next-family-evidence':
            continue
        packet, sources = relation['originalEvidence'], relation['sourceFilesById']
        if pid == 'E04':
            for experiment in packet['experiments']['comparisons']:
                a, b = [rendered[uid] for uid in experiment['members']]
                if experiment['operation'] == 'explicit aligned native crops':
                    a, b = crop(a, rect(experiment['localRects'][0], 'record-local-pixels')), crop(b, rect(experiment['localRects'][1], 'record-local-pixels'))
                else:
                    require(experiment['operation'] == 'identity full native frames', 'E04 comparison operation drift')
                measured = delta(a, b)
                require(all(measured[k] == experiment[k] for k in measured if k in experiment), 'E04 pixel comparison drift')
                result['pixelComparisonsVerified'] += 1
            master_path = sources[packet['matching']['sheetDomains'][0]]
            master = image(master_path)
            for annotation in packet['humanAnnotations']:
                expected = crop(master, rect(annotation['rect'], 'source-file-pixels'))
                out = Image.new('RGBA', expected.size)
                out.paste(rendered[annotation['memberId']], tuple(annotation['nativeExportOffsetInSelectionXY']))
                require(out.tobytes() == expected.tobytes() and pixel_hash(out) == annotation['selectionNormalizedRgbaSHA256'], 'E04 owner annotation correspondence drift')
            for experiment in packet['experiments']['paddingOnlyMasterDifferences']:
                a = rendered[experiment['memberId']]
                b = crop(master, rect(experiment['inferredFullFrameMasterRect'], 'source-file-pixels'))
                measured = delta(a, b)
                require(all(measured[k] == experiment[k] for k in measured if k in experiment), 'E04 padding adversary drift')
                require(all(p == q or p[3] == 0 for p, q in zip(api['pixels'](a), api['pixels'](b))), 'E04 padding-only claim drift')
                result['pixelComparisonsVerified'] += 1
        elif pid == 'I02':
            pool = packet['counterpartCorpus']
            available = all(image(sources[e['sourceId']]) is not None for e in pool)
            result['I02CounterpartCorpusRechecked'] = available
            for experiment in packet['counterpartExperiments']:
                a, b = rendered[experiment['memberId']], rendered[experiment['shadowlessReferenceId']]
                require(bed_delta(a, b) == experiment['deltaFromShadowless'] and bed_signature(a, experiment['shadowToken']) == experiment['canonicalBodySHA256'], 'I02 counterpart delta/body drift')
                if available:
                    hits = [e['actualVendorIndex'] for e in pool if image(sources[e['sourceId']]).size == b.size and bed_signature(image(sources[e['sourceId']]), [58, 58, 80, 100]) == pixel_hash(b)]
                    require(hits == experiment['blackShadowPoolMatches'], 'I02 counterpart uniqueness drift')
                result['pixelComparisonsVerified'] += 1
            for experiment in packet['filenameNumberRefutations']:
                wrong = image(sources[experiment['sameNumberBlackSourceId']])
                if wrong is None:
                    result['I02FilenameRefutationsUnavailable'].append(experiment['normalLogicalIndex'])
                    continue
                reference = next(rendered[r['id']] for r in records.values() if r['packetId'] == 'I02' and r['variant'] == 'shadowless' and r['logicalNormalVendorIndex'] == experiment['normalLogicalIndex'])
                require(list(wrong.size) == experiment['dimensions'] and pixel_hash(wrong) == experiment['normalizedRgbaSHA256'] and
                    (wrong.size == reference.size) == experiment['sameFrameDimensions'] and
                    (wrong.size == reference.size and bed_signature(wrong, [58, 58, 80, 100]) == pixel_hash(reference)) == experiment['sameCanonicalBody'], 'I02 filename refutation drift')
                result['I02FilenameRefutationsVerified'] += 1
            master = image(sources[packet['matching']['sheetDomains'][0]])
            for experiment in packet['masterRelatedComparisons']:
                if master is None:
                    result['I02MasterDifferencesUnavailable'].append(experiment['memberId'])
                    continue
                a = rendered[experiment['memberId']]
                b = crop(master, rect(experiment['masterRect'], 'source-file-pixels'))
                require(bed_delta(a, b) == experiment['fullFrameDelta'], 'I02 contextual master delta drift')
                bounds = rect(experiment['sourceComparisonRect'], 'record-local-pixels')
                require(bed_delta(crop(a, bounds), crop(b, bounds)) == experiment['alphaBoundingFrameDelta'], 'I02 contextual body delta drift')
                result['I02MasterDifferencesVerified'] += 1
        elif pid == 'E05':
            comparisons = packet['experiments']['comparisons'] + packet['experiments']['gateHedgeComparisons']
            for experiment in comparisons:
                a, b = [rendered[uid] for uid in experiment['members']]
                if 'leftSourceRect' in experiment:
                    a, b = crop(a, rect(experiment['leftSourceRect'], 'record-local-pixels')), crop(b, rect(experiment['rightSourceRect'], 'record-local-pixels'))
                else:
                    require(experiment['operation'] == 'identity', 'E05 comparison operation drift')
                measured = delta(a, b)
                expected = {'changedPixels': measured['rgbaChangedPixels'], 'alphaChangedPixels': measured['alphaChangedPixels'],
                    'changedBoundsXYXY': measured['changedBoundsXYXY'], 'exactNormalizedRGBAEqual': measured['exactEqual'], 'changedMaskSHA256': measured['changedMaskSHA256']}
                require(all(experiment[k] == v for k, v in expected.items()), 'E05 pixel comparison drift')
                result['pixelComparisonsVerified'] += 1
            for group in packet['duplicatePixelGroups']:
                require(all(pixel_hash(rendered[uid]) == group['normalizedRgbaSHA256'] for uid in group['members']), 'E05 duplicate export identity drift')
    return result
