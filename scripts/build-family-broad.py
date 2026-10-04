#!/usr/bin/env python3
"""Reusable committed-source adapter for broad first-pass semantic proposals.

Source pixels, native frames, index aliases and record coverage remain strict.
Labels and topology are hypotheses; targeted reviews do not imply exhaustive proof.
"""
from collections import Counter

PACKETS = [('kitchens', 'B01-kitchens.json'),
           ('music-recreation', 'B02-music-recreation.json'),
           ('street-hardware', 'B03-street-hardware.json')]
PINS = {'B01-kitchens.json': '924cb3870f0e1d20138e96d61488d82915200da72f48cb7e26a18fe3f84c0ca7', 'B02-music-recreation.json': '06f9479b31402f287dacce314b94dd02bf145e1567a5be80c4286594ff322368', 'B03-street-hardware.json': '57118aa460faca9f120dc42398eb8e15bbdf2ef56deb3f9c5a0f527ea7f0c063'}


def read_packets(a):
    result = []
    for family_id, filename in PACKETS:
        path = a.PACKETS / filename
        a.require(filename in PINS and a.sha(path.read_bytes()) == PINS[filename],
                  f'Broad proposal pin changed: {filename}')
        packet = a.load(path)
        a.require(packet['schemaVersion'] == 1 and packet['familyId'] == family_id, 'Unsupported broad packet')
        result.append(packet)
    corrections = a.load(a.PACKETS / 'broad-owner-corrections.json')
    a.require(corrections['schemaVersion'] == 1, 'Unsupported broad correction schema')
    for correction in corrections['corrections']:
        a.require(PINS.get(correction['packet']) == correction['proposalSha256'],
                  'Broad correction targets a different proposal')
        family_id = dict((filename, key) for key, filename in PACKETS)[correction['packet']]
        packet = next(p for p in result if p['familyId'] == family_id)
        apply_correction(a, packet, correction)
    return result


def apply_correction(a, packet, correction):
    # Frozen proposals remain historical evidence; owner corrections change only semantics.
    record = next(r for r in packet['records'] if r['id'] == correction['recordId'])
    card = next(c for c in packet['cards'] if c['id'] == correction['cardId'])
    a.require([v['recordId'] for v in card['variants']] == [record['id']],
              'Broad correction must target its exact single-record card')
    a.require(set(correction['recordChanges']) <= {'label', 'kind', 'topology', 'uncertainty'} and
              set(correction['cardChanges']) <= {'label', 'kind', 'facts', 'groupId'},
              'Broad corrections cannot replace artwork or membership')
    record.update(correction['recordChanges'])
    card.update(correction['cardChanges'])


def build_packet(a, packet, images, sheets):
    allowed = set()
    for pin in packet['sourcePins']:
        sheet = sheets[pin['sheetId']]
        path = a.ROOT / pin['path']
        a.require(path.resolve().is_relative_to((a.ROOT / 'public').resolve()), 'Broad source outside public assets')
        a.require(pin['path'] == 'public/' + sheet['image'] and
                  a.sha(path.read_bytes()) == pin['sha256'] == sheet['fingerprint'], 'Broad source pin changed')
        allowed.add(pin['sheetId'])
    indexes = {}
    for pin in packet['sourceIndexPins']:
        path = a.ROOT / pin['path']
        a.require(path.resolve().is_relative_to((a.ROOT / 'public/data').resolve()), 'Broad index outside public data')
        a.require(a.sha(path.read_bytes()) == pin['sha256'], 'Broad source index pin changed')
        indexes[pin['path']] = a.load(path)
    packed = {r['key']: r for r in indexes.get('public/data/modern-interiors-atlas.json', {}).get('entries', [])}
    records, sprites = {}, {}
    for row in packet['records']:
        uid, source = row['id'], row['source']
        a.require(uid not in records and uid.startswith(packet['packetId'] + '-'), 'Duplicate or foreign broad record')
        a.require(source['sheetId'] in allowed, 'Unpinned broad source')
        sprite = {'size': source['frameSize'], 'layers': [
            {'sheetId': source['sheetId'], 'rect': source['rect'], 'at': source['offsetXY']}]}
        a.check_pixels(sprite, source['pixelSha256'], images, uid)
        if source['sheetId'] == 'modern-interiors':
            entry = packed[source['packedKey']]
            a.require(entry['rect'] == source['rect'] and entry['sourcePath'] == source['originalPath'] and
                      source['offsetXY'] == [0, 0] and source['frameSize'] == entry['sourceRect'][2:],
                      'Broad packed source identity changed')
        topology = row['topology']
        a.require(row['kind'] in ('whole', 'component', 'unknown') and
                  topology['standalone'] == {'whole': 'allowed', 'component': 'forbidden', 'unknown': 'unknown'}[row['kind']],
                  'Broad standalone role mismatch')
        a.require(isinstance(topology['requiredNeighbors'], list) and isinstance(topology['limits'], str),
                  'Broad topology description missing')
        a.require(row.get('uncertainty') is None or isinstance(row['uncertainty'], str), 'Invalid uncertainty')
        records[uid], sprites[uid] = row, sprite
    groups = {row['id']: [] for row in packet['groups']}
    a.require(len(groups) == len(packet['groups']), 'Duplicate broad group')
    used, card_ids = [], set()
    for number, card in enumerate(packet['cards'], 1):
        a.require(card['id'] not in card_ids and card['groupId'] in groups, 'Duplicate card or absent group')
        card_ids.add(card['id'])
        variants, notes, joins = [], [], []
        ids = [v['id'] for v in card['variants']]
        a.require(ids and len(ids) == len(set(ids)), 'Empty/duplicate card variants')
        for value in card['variants']:
            row = records[value['recordId']]
            a.require(card['kind'] == row['kind'], 'Card combines incompatible standalone roles')
            used.append(row['id'])
            variants.append(a.variant(value['id'], value['label'], [row['id']], sprites[row['id']]))
            if row.get('uncertainty') and row['uncertainty'] not in notes:
                notes.append(row['uncertainty'])
            for join in row['topology']['requiredNeighbors']:
                if join not in joins:
                    joins.append(join)
        facts = list(card.get('facts', []))
        if card['kind'] == 'component':
            facts.insert(0, a.fact('Use', 'Cannot stand alone; combine with matching pieces.'))
        elif card['kind'] == 'unknown':
            facts.insert(0, a.fact('Use', 'Standalone use is uncertain.'))
        if joins:
            facts.append(a.fact('Joins', ' '.join(joins)))
        if notes:
            facts.append(a.fact('Uncertain', ' '.join(notes)))
        # Keep the selected-piece description compact when packet and generic facts overlap.
        unique_facts = []
        seen = set()
        for item in facts:
            if item['value'] not in seen:
                unique_facts.append(item)
                seen.add(item['value'])
        facts = unique_facts
        member = a.member(card['id'], number, card['label'], card['kind'], facts, variants, card.get('question'))
        if len(variants) > 1:
            member['variantLabel'] = card.get('variantLabel', 'Appearance')
        groups[card['groupId']].append(member)
    a.require(Counter(used) == Counter(records.keys()), 'Broad records missing or duplicated across cards')
    a.require(all(groups.values()), 'Empty broad display group')
    examples = []
    for example in packet.get('examples', []):
        layers, ids = [], []
        for placement in example['placements']:
            uid = placement['recordId']
            sprite = sprites[uid]
            dx, dy = placement['at']
            for layer in sprite['layers']:
                layers.append({**layer, 'at': [dx + layer['at'][0], dy + layer['at'][1]], 'blend': 'over'})
            ids.append(uid)
        sprite = {'size': example['size'], 'layers': layers}
        a.check_pixels(sprite, example['pixelSha256'], images, example['id'])
        examples.append({'id': example['id'], 'label': example['label'], 'description': example['description'],
                         'variants': [a.variant('original', 'Original', ids, sprite)]})
    return a.family(packet['familyId'], packet['title'], packet['description'], 'Appearance', [('original', 'Original')],
                    packet['facts'], [a.group(g['id'], g['title'], groups[g['id']], g.get('description')) for g in packet['groups']],
                    examples, sheets)


def build_broad(a, images, sheets, packets):
    return [build_packet(a, packet, images, sheets) for packet in packets]
