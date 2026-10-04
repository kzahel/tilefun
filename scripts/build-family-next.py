#!/usr/bin/env python3
"""Committed-only E04/I02/E05 family adapters with exact reviewed provenance.

Public API: build_next(a, images, sheets), where a is build-family-sheets helpers.
This module returns only the three new families; the caller appends them serially.
No source packs are opened and no art is copied or modified.
"""
from collections import Counter
import json

PINS = {
    'E04-plants-planters.json': '8fbca92889dd7bc587093eaa38d276b36d6ccbe22a8f748c79d4b4f6c4554f36',
    'E04-plants-planters-review.md': '7815d8d76dfa2543f5ee43f10d9da5ff375a02043574a8bcd2474e7a508ea961',
    'I02-bedroom.json': '9b951c075c0707f86391b14741f533c499a8b1938342db936e0b9dea29f7e0a5',
    'I02-bedroom-review.md': 'fb62ea277d4c053acf5ba752dd2da54963c55e30a8920425c1cb050e5f0efc88',
    'E05-fences-gates.json': '238778d9b00baadfa7de2799b3d55a0f834be22237b0994c77e731efba1e2870',
    'E05-fences-gates-review.md': '3395feed2cfe2f9e505c9ca375b2792b22519c95f078d0ab58d92bb0663191e8',
}
HELPER_PINS = {
    'scripts/semantic-map-plants-planters.py': '8fc4a26872684f7719dbc8586c7356598b398f4110d7056543791eea983080c5',
    'scripts/semantic-map-bedroom.py': '4242f041621ccb19fa4f5134832b6437d3628faaaf5ca7e3c938a46c7dab7f31',
    'scripts/semantic-map-fences-gates.py': '1284587d22eb12fe975fbd84c7e56af4c802b8e5df0d0378a981cf808328c066',
}
PACKET_NAMES = ('E04-plants-planters.json', 'I02-bedroom.json', 'E05-fences-gates.json')
ORIGINAL = [('original', 'Original')]
SHADOWS = [('normal', 'Normal'), ('black-shadow', 'Dark shadow'), ('shadowless', 'No shadow')]
BED_INDICES = [1, 2, 63, 64, 57, 119]
BLACK_INDICES = [424, 425, 486, 487, 480, 542]
FENCE_EXAMPLES = [
    ('closed-picket-48', 'Small picket enclosure'),
    ('closed-picket-48-duplicate-exports', 'Small enclosure · alternate exports'),
    ('closed-picket-64', 'Larger picket enclosure'),
    ('rising-diagonal-a', 'Rising diagonal pair'),
    ('falling-diagonal-a', 'Falling diagonal pair'),
    ('rising-diagonal-b', 'Rising diagonal pair · alternate shading'),
    ('falling-diagonal-b', 'Falling diagonal pair · alternate shading'),
    ('open-upper-run', 'Upper fence section'),
]


def normalized_data(image):
    """Same alpha-zero convention as the caller, using Pillow for large sheets."""
    image = image.convert('RGBA')
    image.paste((0, 0, 0, 0), mask=image.getchannel('A').point(lambda alpha: 255 if alpha == 0 else 0))
    return image.tobytes()


def verify_public_source(a, source, sheet_id, images, sheets):
    sheet = sheets[sheet_id]
    path = a.ROOT / 'public' / sheet['image']
    a.require(path.resolve().is_relative_to((a.ROOT / 'public').resolve()), 'Next-family source outside public assets')
    a.require(source['path'] == path.relative_to(a.ROOT).as_posix(), 'Next-family committed source path changed')
    a.require(a.sha(path.read_bytes()) == source['sha256'] == sheet['fingerprint'],
              f'Next-family public source changed: {sheet_id}')
    a.require(list(images[sheet_id].size) == source['dimensions'] == [sheet['width'], sheet['height']],
              f'Next-family source dimensions changed: {sheet_id}')
    a.require(a.sha(normalized_data(images[sheet_id])) == source['normalizedRgbaSHA256'],
              f'Next-family source pixels changed: {sheet_id}')


def verify_record(a, row, image, images, sources):
    a.require(row['sourceRect'] == [0, 0, *sources[row['sourceId']]['dimensions']] and
              image['size'] == row['sourceRect'][2:], f"Next-family native frame changed: {row['id']}")
    a.check_pixels(image, row['normalizedRgbaSHA256'], images, row['id'])
    bounds = a.render(image, images).getchannel('A').getbbox()
    visible = [bounds[0], bounds[1], bounds[2]-bounds[0], bounds[3]-bounds[1]] if bounds else None
    a.require(visible == row['alphaVisibleRect'], f"Next-family alpha bounds changed: {row['id']}")


def assert_unknown_geometry(a, row):
    geometry = row.get('geometry', row.get('gameplayGeometry'))
    a.require(geometry is not None and all(value is None for key, value in geometry.items() if key != 'status') and
              geometry.get('status', 'unknown') == 'unknown', f"Next-family unknown gameplay geometry changed: {row['id']}")


def build_plants(a, packet, images, sheets):
    sources = {row['id']: row for row in packet['sources']}
    master = next(row for row in sources.values() if row['path'] == 'public/assets/tilesets/me-complete.png')
    verify_public_source(a, master, 'me-complete', images, sheets)
    legacy = a.load(a.ROOT / packet['pins']['legacyIndex']['path'])['themes']
    values = {}
    for row in packet['candidates']:
        key, rr = row['id'], row['committedRendering']
        a.require(rr['sheetId'] == 'me-complete' and rr['sourceId'] == master['id'], 'Plant committed lineage changed')
        occurrence = next(item for item in row['occurrences'] if item['sourceId'] == master['id'])
        a.require(rr['frameSize'] == row['sourceRect'][2:], f'Plant native frame changed: {key}')
        if rr['operation'] == 'direct-crop':
            a.require(rr['offsetXY'] == [0, 0] and rr['rect'] in occurrence['fullFrameRects'] and
                      rr['rect'][2:] == rr['frameSize'], f'Plant full-frame lineage changed: {key}')
        else:
            a.require(rr['operation'] == 'crop-into-transparent-frame' and not occurrence['fullFrameRects'] and
                      rr['rect'] in occurrence['alphaVisibleCropRects'] and rr['offsetXY'] == row['alphaVisibleRect'][:2] and
                      rr['rect'][2:] == row['alphaVisibleRect'][2:], f'Plant transparent-frame restoration changed: {key}')
        image = {'size': rr['frameSize'], 'layers': [{'sheetId': 'me-complete', 'rect': rr['rect'], 'at': rr['offsetXY']}]}
        verify_record(a, row, image, images, sources)
        a.check_pixels(image, rr['normalizedRgbaSHA256'], images, key)
        for rect in occurrence['fullFrameRects']:
            a.check_pixels(a.sprite('me-complete', rect), row['normalizedRgbaSHA256'], images, key)
        alias = row['legacyIndexAlias']
        a.require(legacy[alias['theme']].get(alias['key']) == alias['rect'], f'Plant legacy navigation alias changed: {key}')
        a.require(row['kind'] == 'whole' and row['topology']['standaloneEligibility'] == 'allowed' and
                  not row['topology']['requiredNeighbors'] and not row['topology']['compatibleMembers'] and
                  not row['topology']['openJoinEdges'], f'Plant whole-object role changed: {key}')
        assert_unknown_geometry(a, row)
        values[key] = image
    cards = []
    for number, group in enumerate(packet['variantGroups'], 1):
        ids = group['memberIds']
        a.require(len(ids) == len(group['variantLabels']) and group['defaultMemberId'] in ids, 'Plant selector membership changed')
        labels = dict(zip(ids, group['variantLabels']))
        ordered = [group['defaultMemberId']] + [key for key in ids if key != group['defaultMemberId']]
        variants = [a.variant(key, labels[key], [key], values[key]) for key in ordered]
        facts = [a.fact('Form', 'Complete visual object; no other piece required.')]
        if group['id'].endswith('broadleaf-tree'):
            facts.extend([a.fact('Base', 'Bare trunk, grass, square base or rounded base are original whole-tree variants.'),
                          a.fact('Unknown', 'Raised planter versus bordered ground, species and material are unknown.')])
        elif group['id'] == 'upright-potted-plant':
            facts.append(a.fact('Variants', 'The tan-pot plant also has shorter, slightly different leaves.'))
        elif group['id'] == 'arching-potted-plant':
            facts.append(a.fact('Variants', 'The foliage stays the same; the original pot colors differ.'))
        elif group['id'] == 'loose-flowering-bush':
            facts.append(a.fact('Unknown', 'Low shrub or compact flower clump; no box or pot is shown.'))
        else:
            facts.append(a.fact('Form', 'Flowers and the closed bordered bed are drawn together.'))
        member = a.member(group['id'], number, group['label'], 'whole', facts, variants)
        member['variantLabel'] = ('Tree base' if group['id'].endswith('broadleaf-tree') else
                                  'Flower colors' if group['id'].endswith('flowerbed') else 'Plant appearance')
        cards.append(member)
    a.require(len(cards) == 7, 'Plant card count changed')
    return a.family('plants-planters', packet['presentation']['familyTitle'], packet['presentation']['description'],
                    'Appearance', ORIGINAL,
                    [a.fact('Form', 'Complete trees, flowerbeds, shrubs and potted plants.'),
                     a.fact('Variants', 'Original tree bases, flower colors and potted plant forms are selectable.'),
                     a.fact('Unknown', 'Plant species, container materials and raised planter versus ground edging are unknown.'),
                     a.fact('Gameplay', 'Size, collision, height and walkability are unknown.')],
                    [a.group('plants', 'Trees, flowers and small pots', cards)], [], sheets)


def build_bedroom(a, packet, images, sheets):
    sources = {row['id']: row for row in packet['sources']}
    atlas = next(row for row in sources.values() if row['path'] == 'public/assets/tilesets/modern-interiors-atlas.png')
    verify_public_source(a, atlas, 'modern-interiors', images, sheets)
    index = {row['key']: row for row in a.load(a.ROOT / packet['pins']['packedIndex']['path'])['entries']}
    rows = {row['id']: row for row in packet['candidates']}
    a.require(set(rows) == {f'I02-{n:02}' for n in range(1, 19)}, 'Bedroom record membership changed')
    values = {}
    for n, row in enumerate(packet['candidates']):
        key, rr = row['id'], row['committedRendering']
        variant, logical = SHADOWS[n // 6][0], BED_INDICES[n % 6]
        actual = BLACK_INDICES[n % 6] if variant == 'black-shadow' else logical
        a.require(row['renderVariant'] == variant and row['logicalNormalVendorIndex'] == logical and
                  row['actualVendorIndex'] == actual, f'Bedroom actual counterpart identity changed: {key}')
        a.require(rr['sheetId'] == 'modern-interiors' and rr['sourceId'] == atlas['id'] and rr['exactVerified'],
                  'Bedroom packed source lineage changed')
        entry = index[rr['packedKey']]
        a.require(entry['sourcePath'] == sources[row['sourceId']]['path'] and entry['rect'] == rr['rect'] and
                  entry['sourceRect'] == row['sourceRect'] and entry['variant'] == variant,
                  f'Bedroom packed alias lineage changed: {key}')
        image = a.sprite('modern-interiors', rr['rect'])
        verify_record(a, row, image, images, sources)
        for alias in row['namedExportAliases']:
            entry = index[alias['packedKey']]
            a.require(entry['sourcePath'] == sources[alias['sourceId']]['path'] and entry['rect'] == alias['packedRect'] and
                      entry['sourceRect'][2:] == image['size'], f'Bedroom named alias lineage changed: {key}')
            a.check_pixels(a.sprite('modern-interiors', alias['packedRect']), row['normalizedRgbaSHA256'], images, key)
        assert_unknown_geometry(a, row)
        cover = logical in (57, 119)
        a.require(row['topology']['standaloneEligibility'] == ('forbidden; bedding component' if cover else 'allowed as visual proposal only') and
                  not row['topology']['openJoinEdges'] and not row['topology']['repeatable'], f'Bedroom component rule changed: {key}')
        if cover:
            expected_beds = [f'I02-{n//6*6+i:02}' for i in ([1,2] if logical==57 else [3,4])]
            a.require(row['topology']['compatibleMembers'] == expected_beds and row['topology']['requiredNeighbors'] ==
                      [{'relation': 'underlay', 'members': expected_beds, 'overlayTargetOffset': [0,16]}],
                      f'Bedroom required underlay changed: {key}')
        else:
            a.require(not row['topology']['requiredNeighbors'], f'Complete bed requires an optional blanket: {key}')
        values[key] = a.variant(variant, dict(SHADOWS)[variant], [key], image)
    beds, covers = [], []
    for number, card in enumerate(packet['presentation']['cards'], 1):
        members = card['membersByVariant']
        a.require(set(members) == {key for key,_ in SHADOWS} and all(rows[members[v]]['renderVariant']==v for v,_ in SHADOWS),
                  'Bedroom selector membership changed')
        is_cover = card['section'] == 'Pieces to combine'
        logicals = {rows[key]['logicalNormalVendorIndex'] for key in members.values()}
        a.require(len(logicals)==1 and is_cover==(next(iter(logicals)) in (57,119)), 'Bedroom card whole/component role changed')
        facts = [a.fact('Form', text) for text in card['facts']]
        if is_cover:
            facts.extend([a.fact('Use', 'Cannot stand alone in this bed kit; lay over a matching complete bed.'),
                          a.fact('Unknown', 'A separate decorative cloth or rug remains an alternative interpretation.')])
        member = a.member(card['id'], number, card['label'], 'component' if is_cover else 'whole', facts,
                          [values[members[v]] for v,_ in SHADOWS])
        (covers if is_cover else beds).append(member)
    a.require([len(beds),len(covers)] == [4,2], 'Bedroom card role counts changed')
    experiments = {row['id']: row for row in packet['assemblyExperiments']}
    examples = []
    for bed, label in zip(BED_INDICES[:4], ['Blue pillow at right', 'Pale lilac pillow at right', 'Blue pillow at left', 'Pale lilac pillow at left']):
        variants = []
        for variant, variant_label in SHADOWS:
            experiment = experiments[f'{variant}-bed-{bed}-matching-cover']
            a.require(experiment['topologyDisposition'] == 'proposed-valid' and experiment['size']==[48,48] and
                      experiment['operation']=='RGBA source-over onto transparent native canvas; no resizing/mirroring/recoloring',
                      'Bedroom positive example disposition changed')
            placements = experiment['placements']
            a.require(len(placements)==2 and placements[0]['targetOffset']==[0,0] and placements[1]['targetOffset']==[0,16],
                      'Bedroom overlay offset/order changed')
            bed_row, cover_row = [rows[p['memberId']] for p in placements]
            a.require(bed_row['logicalNormalVendorIndex']==bed and bed_row['renderVariant']==variant and
                      cover_row['renderVariant']==variant and bed_row['id'] in cover_row['topology']['compatibleMembers'] and
                      bed_row['fields']['role']['value']=='complete-side-bed' and cover_row['fields']['role']['value']=='bedding-overlay-component',
                      'Bedroom overlay compatible underlay changed')
            layers, record_ids = [], []
            for placement in placements:
                value = values[placement['memberId']]
                a.require(placement['sourceRect']==[0,0,*value['sprite']['size']], 'Bedroom full native placement frame changed')
                layer = value['sprite']['layers'][0]
                layers.append({**layer, 'at': placement['targetOffset'], 'blend': 'over'})
                record_ids.extend(value['recordIds'])
            image = {'size':experiment['size'], 'layers':layers}
            a.check_pixels(image, experiment['outputNormalizedRgbaSHA256'], images, experiment['id'])
            variants.append(a.variant(variant, variant_label, record_ids, image))
        examples.append({'id':f'bed-{bed}-blue-blanket', 'label':label+' · blue blanket',
                         'description':'Matching blanket layered over a complete bed; the pillow and headboard stay visible. Other bed fits are unknown.', 'variants':variants})
    return a.family('bedroom', packet['presentation']['familyTitle'], 'Side-view beds with optional blue patterned blanket pieces.',
                    'Shadow', SHADOWS,
                    [a.fact('Beds', 'Headboard on the left or right, with blue or pale lilac pillows.'),
                     a.fact('Blankets', 'Pieces need a matching complete bed; the bed can appear without a blanket.'),
                     a.fact('Variants', 'Shadow choices keep the same bed body. Blankets have identical pixels in each choice.'),
                     a.fact('Gameplay', 'Collision, size, height and occlusion are unknown.')],
                    [a.group('beds','Complete beds',beds), a.group('blankets','Pieces to combine',covers)], examples, sheets)


def build_fences(a, packet, images, sheets):
    sources = {row['id']:row for row in packet['sources']}
    master = sources[packet['masterLineage']['committedSourceId']]
    verify_public_source(a, master, 'me-complete', images, sheets)
    legacy = a.load(a.ROOT / packet['pins']['public/data/me-atlas-index.json']['path'])['themes']
    rows = {row['id']:row for row in packet['candidates']}
    values = {}
    for n, row in enumerate(packet['candidates'],1):
        key, rr = row['id'], row['committedRendering']
        a.require(rr['sheetId']=='me-complete' and rr['sourceId']==master['id'] and rr['operation']=='direct-crop' and
                  rr['offsetXY']==[0,0] and rr['frameSize']==row['sourceRect'][2:]==rr['rect'][2:], 'Fence full-frame lineage changed')
        a.require(any(o['sourceId']==master['id'] and o['rect']==rr['rect'] for o in row['occurrences']), 'Fence exact master occurrence missing')
        alias = row['legacyIndexAlias']
        a.require(legacy[alias['theme']][alias['key']]==alias['rect']==rr['rect'], f'Fence navigation alias changed: {key}')
        image = a.sprite('me-complete',rr['rect'])
        verify_record(a,row,image,images,sources)
        a.check_pixels(image,rr['normalizedRgbaSHA256'],images,key)
        for o in row['occurrences']:
            if o['sourceId']==master['id']:
                a.check_pixels(a.sprite('me-complete',o['rect']),row['normalizedRgbaSHA256'],images,key)
        assert_unknown_geometry(a,row)
        expected = 'forbidden' if n<=22 else 'unknown' if n<=26 else 'visual-proposal-only'
        a.require(row['topology']['standaloneEligibility']==expected, f'Fence standalone rule changed: {key}')
        values[key] = image
    proposal = packet['presentationProposal']
    variants_by_card = {group['id']:group for group in packet['variantGroups']}
    cards = {}
    for number, card in enumerate(proposal['cards'],1):
        ids = card['memberRecords']
        if card['id'] in variants_by_card:
            vg = variants_by_card[card['id']]
            a.require(ids==vg['members'] and vg['variants']==['cool','warm'], 'Garden gate selector membership changed')
            variants = [a.variant(v, {'cool':'Cool frame','warm':'Warm frame'}[v],[key],values[key]) for v,key in zip(vg['variants'],ids)]
            kind = 'unknown'
        else:
            a.require(len(ids)==1, 'Fence original member count changed')
            variants = [a.variant('original','Original',ids,values[ids[0]])]
            kind = card['kind']
            a.require(kind==('whole' if ids==['E05-27'] else 'component'), 'Fence card whole/component role changed')
        member = a.member(card['id'],number,card['label'],kind,card['facts'],variants)
        if kind=='unknown':
            member['variantLabel']='Frame appearance'
            member['facts']=[*member['facts'],a.fact('Use','Whether this can stand alone is unknown.')]
        if card['id'].startswith('E05-') and int(card['id'].split('-')[-1])<=22:
            a.require(kind=='component' and rows[ids[0]]['topology']['requiredNeighbors'], 'Fence component lost required neighbors')
            member['facts']=[a.fact('Use','Cannot stand alone.'),*member['facts']]
        cards[card['id']]=member
    groups=[a.group(group['id'],group['title'],[cards[key] for key in group['memberIds']]) for group in proposal['groups']]
    experiments={row['id']:row for row in packet['experiments']['assemblies']}
    a.require(proposal['positiveExampleIds']==[key for key,_ in FENCE_EXAMPLES], 'Fence bounded example list changed')
    examples=[]
    for key,label in FENCE_EXAMPLES:
        e=experiments[key];recipe=e['renderRecipe'];is_open=key=='open-upper-run'
        a.require(e['topologyDisposition']==('supported-explicit-open-section' if is_open else 'supported-bounded-closed') and
                  len(e['portEvaluation']['unmatchedPorts'])==(2 if is_open else 0), 'Fence example has unaccounted open cuts')
        a.require(a.sha(json.dumps(recipe,sort_keys=True,separators=(',',':')).encode())==e['renderRecipeSHA256'], 'Fence recipe hash changed')
        a.require(recipe['operation']=='ordered native RGBA source-over; no edits, scaling, reflection or trimming', 'Fence recipe operation changed')
        layers=[];records=[]
        for p in recipe['placements']:
            a.require(p['blend']=='over' and p['memberId'] in rows and rows[p['memberId']]['topology']['standaloneEligibility']=='forbidden', 'Fence example crosses kits or changes blend')
            layer=values[p['memberId']]['layers'][0]
            layers.append({**layer,'at':p['at'],'blend':'over'});records.append(p['memberId'])
        image={'size':recipe['size'],'layers':layers}
        a.check_pixels(image,e['normalizedRgbaSHA256'],images,key)
        example={'id':key,'label':label,
                 'description':'Both downward cuts need continuing side posts; this is an open section.' if is_open else 'Only this finite source pairing is checked; other lengths and joins are unknown.',
                 'variants':[a.variant('original','Original',records,image)]}
        if is_open:example['groupLabel']='Open fence sections'
        examples.append(example)
    return a.family('fences-gates',proposal['familyLabel'],'Low picket pieces and a separate hedge-framed garden gate set.',
                    'Appearance',ORIGINAL,proposal['facts'],groups,examples,sheets)


def build_next(a, images, sheets):
    a.require('E05-fences-gates.json' in PINS and 'E05-fences-gates-review.md' in PINS, 'Fence independent review pins are not finalized')
    for name, expected in PINS.items():
        a.require(a.sha((a.PACKETS/name).read_bytes())==expected, f'Pinned next-family proposal/review changed: {name}')
    for path, expected in HELPER_PINS.items():
        a.require(a.sha((a.ROOT/path).read_bytes())==expected, f'Next-family input pin changed: {path}')
    packets=[a.load(a.PACKETS/name) for name in PACKET_NAMES]
    for packet in packets:
        for pin in packet['pins'].values():
            a.require(a.sha((a.ROOT/pin['path']).read_bytes())==pin['sha256'], f"Next-family input pin changed: {pin['path']}")
    families=[builder(a,packet,images,sheets) for builder,packet in zip((build_plants,build_bedroom,build_fences),packets)]
    for family,packet,count in zip(families,packets,(7,6,25)):
        cards=[member for group in family['groups'] for member in group['members']]
        records=[key for card in cards for value in card['variants'] for key in value['recordIds']]
        a.require(len(cards)==count and Counter(records)==Counter(row['id'] for row in packet['candidates']),
                  f"Incomplete or duplicated next-family coverage: {family['id']}")
    return families
