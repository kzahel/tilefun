#!/usr/bin/env python3
"""Build/check a broad music/recreation proposal using exact indexed atlas frames."""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PACKET = 'docs/tactical/053-semantic-tileset-map/packets/B02-music-recreation.json'
INDEX = 'public/data/modern-interiors-atlas.json'
ATLAS = 'public/assets/tilesets/modern-interiors-atlas.png'
INDEX_SHA = 'c2beaba7bbd767b14df8cb7faa042908adbda89e0a43a7fd5c37cb5101a9a02e'
ATLAS_SHA = 'b2ff29303e6c7e61d49b650171ec6dac2dfce8baa681a708897b66a1461245bd'
GROUPS = [
    {'id': 'pianos', 'title': 'Pianos and benches'},
    {'id': 'keyboards', 'title': 'Keyboards and organs'},
    {'id': 'strings', 'title': 'Guitars and harps'},
    {'id': 'percussion', 'title': 'Drums and percussion'},
    {'id': 'sound', 'title': 'Microphones, speakers and sound'},
    {'id': 'screens', 'title': 'Screens and game hardware'},
    {'id': 'arcade', 'title': 'Arcade cabinets'},
    {'id': 'table-games', 'title': 'Billiards and table tennis'},
]
# theme, group, card id, label, [(vendor index, variant label)], kind,
# concise identity uncertainty, optional plain facts and required neighbors.
SPECS = []


def add(theme, group, card_id, label, variants, kind='whole', uncertainty=None,
        facts=None, neighbors=None):
    SPECS.append((theme, group, card_id, label, variants, kind, uncertainty, facts or [], neighbors or []))


def music(group, card_id, label, variants, **kwargs):
    add('music-and-sport', group, card_id, label, variants, **kwargs)


def basement(group, card_id, label, variants, **kwargs):
    add('basement', group, card_id, label, variants, **kwargs)


# Keep differently finished upright instruments visible, with sheet music a local variant.
for index, finish in [(1, 'Honey wood'), (3, 'Honey wood with red trim'),
                      (5, 'Honey wood with purple trim'), (7, 'Honey wood with plum trim'),
                      (9, 'Warm wood'), (11, 'Warm wood with plum trim'),
                      (13, 'Warm wood with red trim'), (15, 'Warm wood with purple trim'),
                      (17, 'Pale wood'), (19, 'Pale wood with plum trim'),
                      (21, 'Pale wood with red trim'), (23, 'Pale wood with purple trim')]:
    music('pianos', f'upright-{index}', finish + ' upright piano',
          [(index, 'Without sheet music'), (index + 1, 'With sheet music')])
music('pianos', 'piano-bench-tall', 'Piano bench', [(25, 'Wood and gray'), (26, 'Dark gray'), (27, 'Red cushion')])
music('pianos', 'piano-bench-low', 'Low piano bench', [(34, 'Wood and gray'), (35, 'Dark gray'), (36, 'Red cushion')])
for index, finish in [(28, 'Honey wood'), (30, 'Warm wood'), (32, 'Pale wood')]:
    music('pianos', f'grand-{index}', finish + ' grand piano',
          [(index, 'Without sheet music'), (index + 1, 'With sheet music')])
for index, finish in [(37, 'Brown'), (39, 'Blue'), (41, 'Red')]:
    music('percussion', f'drum-kit-{index}', finish + ' drum kit',
          [(index, 'Front view'), (index + 1, 'Side view')],
          facts=[{'label': 'View', 'value': 'The narrow side view is a whole kit seen from the side.'}])
music('sound', 'speaker-tower', 'Tall speaker cabinet', [(43, 'Original')])
music('sound', 'speaker-wide', 'Wide speaker cabinet', [(44, 'Original')])
music('strings', 'acoustic-on-stand', 'Acoustic guitar on a stand', [(45, 'Honey wood'), (46, 'Warm wood'), (47, 'Pale wood')])
music('strings', 'acoustic-loose', 'Acoustic guitar', [(48, 'Honey wood'), (49, 'Warm wood'), (50, 'Pale wood')])
music('strings', 'electric-on-stand', 'Electric guitar on a stand', [(51, 'Blue'), (52, 'Red'), (53, 'Yellow')])
music('strings', 'electric-loose', 'Electric guitar', [(54, 'Blue'), (55, 'Red'), (56, 'Yellow')])
music('strings', 'harp-simple', 'Harp', [(57, 'Warm wood'), (58, 'Honey wood'), (59, 'Pale wood'), (60, 'Gold')])
for index, label in [(61, 'Short angled microphone'), (62, 'Microphone on a tripod'),
                     (63, 'Microphone on a round stand'), (64, 'Angled microphone on a round stand'),
                     (65, 'Angled microphone on a tripod')]:
    music('sound', f'microphone-{index}', label, [(index, 'Original')])
music('keyboards', 'keyboard-simple', 'Compact keyboard', [(66, 'Gray'), (67, 'Red'), (68, 'Blue')])
music('percussion', 'drum-blue', 'Blue small drum', [(69, 'Without sticks'), (70, 'With sticks')])
music('percussion', 'drum-red', 'Red small drum', [(71, 'Without sticks'), (72, 'With sticks')])
music('sound', 'saxophone', 'Saxophone (likely)', [(73, 'Brass'), (74, 'Red'), (75, 'Pale metal')],
      uncertainty='The stylized curved wind instrument looks like a saxophone; exact instrument type is uncertain.')

# The pack also includes a visibly more detailed set of instruments.
music('keyboards', 'double-keyboard-flat', 'Double keyboard panel', [(165, 'Purple'), (166, 'Red'), (167, 'Gray')],
      uncertainty='Likely an organ or synthesizer panel. It has two keyboard rows; exact instrument type is uncertain.')
music('keyboards', 'keyboard-control-panel', 'Keyboard with control panel', [(168, 'Purple'), (169, 'Red'), (170, 'Gray')],
      uncertainty='Likely an organ or synthesizer panel; the specific instrument type is uncertain.')
music('pianos', 'square-stool', 'Square musician stool', [(171, 'Dark legs'), (172, 'Wood legs')])
music('keyboards', 'organ-console-front', 'Organ-style keyboard console',
      [(173, 'Purple'), (174, 'Purple with stool'), (175, 'Red'), (176, 'Red with stool'),
       (177, 'Gray'), (178, 'Gray with stool')],
      uncertainty='Organ-style console is a plausible reading; the source does not identify its exact instrument model.',
      facts=[{'label': 'Stool', 'value': 'Some versions already include a stool in front.'}])
music('keyboards', 'organ-console-reverse', 'Keyboard console, opposite view',
      [(179, 'Red'), (180, 'Red with stool'), (181, 'Gray'), (182, 'Gray with stool')],
      uncertainty='The changed keyboard/control layout may be an opposite view or a different organ design.',
      facts=[{'label': 'Stool', 'value': 'Some versions already include a stool behind the console.'}])
music('sound', 'speaker-detailed-wide', 'Large speaker cabinet', [(183, 'Original')])
music('sound', 'speaker-detailed-tall', 'Twin speaker tower', [(184, 'Original')])
music('keyboards', 'keyboard-colorful', 'Colorful compact keyboard', [(185, 'Blue'), (186, 'Red')])
music('keyboards', 'keyboard-colorful-stand', 'Colorful keyboard on a stand', [(187, 'Blue'), (188, 'Red')])
music('pianos', 'upright-detailed', 'Detailed upright piano', [(189, 'Pale wood'), (190, 'Warm wood'), (191, 'Honey wood'), (192, 'Olive wood')])
music('pianos', 'grand-detailed', 'Detailed grand piano',
      [(193, 'Pale wood'), (194, 'Pale wood with sheet music'), (195, 'Honey wood'),
       (196, 'Honey wood with sheet music'), (197, 'Warm wood'), (198, 'Warm wood with sheet music')])
music('pianos', 'round-stool', 'Round musician stool', [(199, 'Blue'), (200, 'Brown'), (201, 'Honey'), (202, 'Gray')])
music('strings', 'electric-detailed', 'Detailed electric guitar', [(203, 'Red'), (204, 'Blue'), (205, 'Gray')])
music('strings', 'electric-detailed-alternate', 'Electric guitar, alternate view', [(206, 'Red'), (207, 'Blue'), (208, 'Gray')],
      uncertainty='The plain body may show the back of the guitar; the exact view is tentative.')
music('strings', 'acoustic-detailed', 'Detailed acoustic guitar on a stand', [(209, 'Honey wood'), (210, 'Warm wood'), (211, 'Pale wood')])
music('strings', 'harp-detailed', 'Detailed harp', [(212, 'Honey wood'), (213, 'Pale wood'), (214, 'Warm wood'), (215, 'Gold')])
music('percussion', 'drum-detailed-red', 'Detailed red drum', [(216, 'Without sticks'), (217, 'With sticks')])
for start, color in [(218, 'Green'), (224, 'Blue')]:
    music('percussion', f'band-drum-{color.lower()}', color + ' band drum',
          [(start, 'Plain'), (start + 1, 'White trim'), (start + 2, 'Yellow trim'),
           (start + 3, 'Plain with sticks'), (start + 4, 'White trim with sticks'), (start + 5, 'Yellow trim with sticks')],
          uncertainty='The lower colored marks may be trim or source pose details. No animation behavior is inferred.')
music('percussion', 'wooden-hand-drum', 'Wooden hand drum', [(230, 'View 1'), (231, 'View 2'), (232, 'View 3')],
      uncertainty='Likely a conga or similar hand drum; exact instrument name is uncertain.')
music('percussion', 'shallow-drums', 'Shallow drum', [(233, 'Green'), (234, 'Red'), (235, 'Blue')])
music('percussion', 'drum-cluster', 'Cluster of small drums', [(236, 'Original')])
for index, color in [(237, 'Blue'), (239, 'Wood'), (241, 'Red')]:
    music('percussion', f'detailed-kit-{index}', color + ' detailed drum kit',
          [(index, 'Front view'), (index + 1, 'Side view')],
          facts=[{'label': 'View', 'value': 'The narrow side view is a whole kit seen from the side.'}])

basement('screens', 'tv-light-frame', 'Light-framed television', [(163, 'Pale screen'), (164, 'Reflective screen')])
basement('screens', 'tv-dark-frame', 'Dark-framed television', [(165, 'Reflective screen'), (166, 'Gray screen')])
basement('screens', 'small-panel-stand', 'Small panel on a stand', [(168, 'Original')], kind='unknown',
         uncertainty='May be the back of a small display or a music stand. Its use and standalone placement are uncertain.')
basement('screens', 'brown-game-box', 'Brown game console (likely)', [(169, 'Original')],
         uncertainty='Likely game hardware; exact device type is uncertain.')
basement('screens', 'dark-media-box', 'Dark media box', [(170, 'Original')],
         uncertainty='Could be a game console, player or other media unit.')
basement('screens', 'game-cases', 'Game cases (likely)', [(171, 'Original')],
         uncertainty='The colored upright stack looks like game cases or cartridges; exact contents are uncertain.')
basement('screens', 'console-corded', 'Slim console with corded controller', [(172, 'Original')],
         uncertainty='Likely game hardware; no particular brand or model is claimed.')
basement('screens', 'white-console-low', 'Low white console', [(173, 'Original')],
         uncertainty='Likely game hardware; exact device type is uncertain.')
basement('screens', 'white-console-upright', 'Upright white game console', [(174, 'With controller'), (175, 'Without controller')])
basement('screens', 'white-player', 'White horizontal media unit', [(176, 'Original')],
         uncertainty='Could be a console or disc player.')
basement('screens', 'black-console-upright', 'Upright dark game console', [(177, 'With controller'), (179, 'Without controller')])
basement('screens', 'black-console-low', 'Dark horizontal console', [(178, 'Original')])
basement('screens', 'retro-console', 'Retro game console', [(180, 'With controller'), (181, 'Without controller')],
         uncertainty='Likely retro game hardware; exact device type is uncertain.')
basement('screens', 'retro-console-opposite', 'Retro console, opposite view', [(182, 'Original')],
         uncertainty='Likely another view of the retro media/game unit; identity is tentative.')
basement('screens', 'tall-panel', 'Tall screen or panel', [(183, 'Dark'), (184, 'Blue-white'), (185, 'Pale')], kind='unknown',
         uncertainty='Could be a tall screen, mirror or another wall panel; its role and standalone placement remain uncertain.')
basement('screens', 'screen-side-left', 'Screen, left side view', [(186, 'Dark'), (187, 'Green glow'), (188, 'White glow'), (189, 'Yellow glow')],
         uncertainty='Likely a screen seen from the side. Glows are source-art variants, not a proposed animation.')
basement('screens', 'screen-side-right', 'Screen, right side view', [(190, 'Dark'), (191, 'Green glow'), (192, 'White glow'), (193, 'Yellow glow')],
         uncertainty='Likely a screen seen from the side. Glows are source-art variants, not a proposed animation.')
for index, side, peer in [(194, 'left', 'right'), (195, 'right', 'left')]:
    basement('screens', f'tv-cabinet-{side}', 'Television cabinet, ' + side + ' half', [(index, 'Original')], kind='component',
             facts=[{'label': 'Join', 'value': 'Needs the matching ' + peer + ' half to complete the cabinet.'}],
             neighbors=['Matching television cabinet ' + peer + ' half, directly beside this piece.'])

basement('arcade', 'arcade-front', 'Arcade cabinet, front', [(218, 'Orange'), (219, 'Green')])
basement('arcade', 'arcade-back', 'Arcade cabinet, rear', [(220, 'Original')])
basement('arcade', 'arcade-left', 'Arcade cabinet, left view', [(221, 'Orange'), (222, 'Green')])
basement('arcade', 'arcade-right', 'Arcade cabinet, right view', [(224, 'Orange'), (223, 'Green')])
basement('table-games', 'ping-pong-paddle', 'Table tennis paddle and ball', [(67, 'Horizontal view'), (68, 'Upright view')])
basement('table-games', 'crossed-cues', 'Crossed billiard cues', [(69, 'Upright view'), (73, 'Horizontal view')])
basement('table-games', 'racked-balls', 'Racked billiard balls', [(70, 'Front view'), (74, 'Side view')])
basement('table-games', 'loose-balls', 'Cluster of billiard balls', [(71, 'Front view'), (75, 'Side view')])
basement('table-games', 'cue-stand', 'Billiard cue stand', [(72, 'Original')])
for side, indices, peer in [('left', [76, 78, 80], 'right'), ('right', [77, 79, 81], 'left')]:
    basement('table-games', 'billiards-half-' + side, 'Billiard table, ' + side + ' half',
             list(zip(indices, ['Green', 'Teal', 'Blue'])), kind='component',
             facts=[{'label': 'Join', 'value': 'Needs the matching ' + peer + ' half in the same color.'}],
             neighbors=['Matching ' + peer + ' billiard table half of the same color, directly beside this piece.'])
basement('table-games', 'table-tennis-table', 'Table tennis table', [(241, 'Blue'), (242, 'Green'), (243, 'Teal')])
basement('table-games', 'billiard-whole', 'Whole billiard table', [(244, 'Teal'), (245, 'Blue'), (246, 'Green')],
         facts=[{'label': 'Shape', 'value': 'This view is already a complete table.'}])


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalized(image):
    image = image.convert('RGBA').copy()
    transparent = image.getchannel('A').point(lambda alpha: 255 if alpha == 0 else 0)
    image.paste((0, 0, 0, 0), (0, 0), transparent)
    return image


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def build():
    for path, pin in [(INDEX, INDEX_SHA), (ATLAS, ATLAS_SHA)]:
        if sha((ROOT / path).read_bytes()) != pin:
            raise ValueError('Source pin drift: ' + path)
    index = json.loads((ROOT / INDEX).read_bytes())
    atlas = normalized(Image.open(ROOT / ATLAS))
    entries = {(e['theme'], int(e['key'].split('-')[-1])): e for e in index['entries']
               if e.get('sourceKind') == 'single' and e.get('variant') == 'normal'}
    records, cards, images, lookup, used = [], [], {}, {}, set()
    original_count = 0
    for theme, group, cid, label, variants, kind, uncertainty, facts, neighbors in SPECS:
        card_variants = []
        for vendor, variant_label in variants:
            if (theme, vendor) in used:
                raise ValueError('Duplicate selected export')
            used.add((theme, vendor))
            e = entries[theme, vendor]
            x, y, w, h = e['rect']
            if min(x, y) < 0 or min(w, h) <= 0 or x + w > atlas.width or y + h > atlas.height:
                raise ValueError('Invalid packed bounds')
            if e['sourceRect'] != [0, 0, w, h]:
                raise ValueError('Unexpected trimmed export: ' + e['key'])
            sprite = atlas.crop((x, y, x + w, y + h))
            original = ROOT / e['sourcePath']
            if original.exists():
                native = normalized(Image.open(original))
                if native.size != sprite.size or native.tobytes() != sprite.tobytes():
                    raise ValueError('Original / committed frame mismatch: ' + e['sourcePath'])
                original_count += 1
            rid = f'B02-{len(records) + 1:03d}'
            standalone = {'whole': 'allowed', 'component': 'forbidden', 'unknown': 'unknown'}[kind]
            records.append({'id': rid, 'label': label + ' — ' + variant_label, 'kind': kind,
                'source': {'sheetId': 'modern-interiors', 'rect': e['rect'], 'frameSize': [w, h],
                    'offsetXY': [0, 0], 'pixelSha256': sha(sprite.tobytes()), 'packedKey': e['key'],
                    'originalPath': e['sourcePath']},
                'topology': {'standalone': standalone, 'requiredNeighbors': neighbors,
                    'limits': 'Visual object proposal; game geometry unknown.' if kind == 'whole' else
                        'Requires matching neighboring half; no arbitrary joins or game geometry inferred.' if kind == 'component' else
                        'Identity and standalone use unresolved; game geometry unknown.'},
                'uncertainty': uncertainty})
            card_variants.append({'id': f'v-{vendor}', 'label': variant_label, 'recordId': rid})
            images[rid], lookup[theme, vendor] = sprite, rid
        cards.append({'id': cid, 'groupId': group, 'label': label, 'kind': kind, 'facts': facts,
            'variants': card_variants, **({'question': uncertainty} if uncertainty else {})})
    examples = []
    for eid, label, pair, description in [
            ('green-billiard-table', 'Green billiard table', [76, 77],
             'Proposed assembly of matching green left and right table halves.'),
            ('television-cabinet', 'Television and game cabinet', [194, 195],
             'Proposed assembly of the two cabinet halves; matching horizontal cuts support this join.')]:
        placements = [{'recordId': lookup['basement', n], 'at': [32 * i, 0]} for i, n in enumerate(pair)]
        canvas = Image.new('RGBA', (64, 48))
        for p in placements:
            canvas.alpha_composite(images[p['recordId']], tuple(p['at']))
        examples.append({'id': eid, 'label': label, 'description': description, 'size': [64, 48],
            'placements': placements, 'pixelSha256': sha(normalized(canvas).tobytes())})
        images['example:' + eid] = canvas
    packet = {'schemaVersion': 1, 'packetId': 'B02', 'familyId': 'music-recreation',
        'title': 'Music and recreation',
        'description': 'Pianos and benches, keyboards, guitars, harps, drums, sound equipment, games and recreation-room screens.',
        'sourcePins': [{'sheetId': 'modern-interiors', 'path': ATLAS, 'sha256': ATLAS_SHA}],
        'sourceIndexPins': [{'path': INDEX, 'sha256': INDEX_SHA}],
        'scope': {'included': ['Both visible music-instrument generations from the complete Music and Sport theme overview.',
            'Relevant Basement televisions, game consoles, arcade cabinets and billiard/table-tennis equipment.',
            'Native finish, sheet-music, stool, controller, drum-stick and view variants where visually useful.'],
            'excluded': ['Sports balls, trophies, plaques and posters in Music and Sport.',
                'General Basement sofas, shelves, tables, walls, doors, mirrors outside the selected screen cluster and picnic baskets.',
                'General Living Room furniture, gym equipment and television/film studio cameras, stages and lighting.',
                'Black-shadow and shadowless exports; this first pass uses exact normal atlas exports only.'],
            'method': 'Visual first pass; selected exact committed crops; no exhaustive absence search.'},
        'facts': [{'label': 'Status', 'value': 'Proposed labels; uncertain identities are marked.'},
            {'label': 'Use', 'value': 'Complete objects and pieces to combine are distinguished.'},
            {'label': 'Variants', 'value': 'Finish, sheet music, stools, controllers and source views stay with their item.'},
            {'label': 'Placement', 'value': 'Game geometry and interactions are unknown.'}],
        'groups': GROUPS, 'records': records, 'cards': cards, 'examples': examples}
    return packet, images, original_count


def capture(directory, packet, images):
    directory.mkdir(parents=True, exist_ok=True)
    for group in GROUPS:
        cards = [card for card in packet['cards'] if card['groupId'] == group['id']]
        width, height = 210, 225
        canvas = Image.new('RGBA', (width * 5, height * math.ceil(len(cards) / 5)), (224, 228, 232, 255))
        draw = ImageDraw.Draw(canvas)
        for i, card in enumerate(cards):
            x, y = i % 5 * width, i // 5 * height
            draw.text((x + 5, y + 4), card['label'][:33], fill='black')
            draw.text((x + 5, y + 19), f"{card['kind']} / {len(card['variants'])} versions", fill='black')
            sprite = images[card['variants'][0]['recordId']]
            scale = min(4, (width - 15) // sprite.width, (height - 45) // sprite.height)
            sprite = sprite.resize((sprite.width * scale, sprite.height * scale), Image.Resampling.NEAREST)
            canvas.alpha_composite(sprite, (x + (width - sprite.width) // 2, y + 39))
        canvas.convert('RGB').save(directory / (group['id'] + '.png'))
    for example in packet['examples']:
        sprite = images['example:' + example['id']]
        canvas = Image.new('RGBA', sprite.size, (223, 229, 233, 255))
        canvas.alpha_composite(sprite)
        canvas.resize((sprite.width * 5, sprite.height * 5), Image.Resampling.NEAREST).convert('RGB').save(directory / (example['id'] + '.png'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--capture-dir', type=Path)
    args = parser.parse_args()
    packet, images, original_count = build()
    expected = encoded(packet)
    if args.check:
        if (ROOT / PACKET).read_bytes() != expected:
            raise SystemExit('Broad music packet is stale; no file was written.')
    else:
        (ROOT / PACKET).write_bytes(expected)
    if args.capture_dir:
        capture(args.capture_dir, packet, images)
    print(json.dumps({'ok': True, 'cards': len(packet['cards']), 'records': len(packet['records']),
        'groups': len(packet['groups']), 'examples': len(packet['examples']),
        'originalFramesCompared': original_count, 'committedFramesVerified': len(packet['records'])}, sort_keys=True))


if __name__ == '__main__':
    main()
