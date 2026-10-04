#!/usr/bin/env python3
"""Broad B01 first pass: exact named normal kitchen exports, concise visual labels."""
import argparse
import hashlib
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/tactical/053-semantic-tileset-map/packets/B01-kitchens.json'
ATLAS = 'public/assets/tilesets/modern-interiors-atlas.png'
INDEX = 'public/data/modern-interiors-atlas.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalize(im):
    data = bytearray(im.convert('RGBA').tobytes())
    for i in range(0, len(data), 4):
        if data[i + 3] == 0:
            data[i:i + 3] = b'\0\0\0'
    return Image.frombytes('RGBA', im.size, bytes(data))


def crops(im, rect):
    x, y, w, h = rect
    assert x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= im.width and y + h <= im.height
    return normalize(im.crop((x, y, x + w, y + h)))


def build():
    index = json.loads((ROOT / INDEX).read_bytes())
    entries = {int(re.search(r'(\d+)\.png$', e['sourcePath']).group(1)): e for e in index['entries']
               if e.get('theme') == 'kitchen' and e.get('variant') == 'normal' and e['sourceKind'] == 'single'}
    assert set(entries) == set(range(1, 409))
    with Image.open(ROOT / ATLAS) as raw:
        atlas = normalize(raw)
    records, cards, selected = [], [], set()
    groups = [{'id': key, 'title': title} for key, title in [
        ('surfaces', 'Counter and table surfaces'), ('cabinets', 'Cabinets and shelves'),
        ('sinks', 'Sinks and dish racks'), ('large-appliances', 'Ranges and refrigerators'),
        ('small-appliances', 'Small appliances and electrical fittings'),
        ('preparation', 'Food preparation'), ('seating', 'Wooden chairs'),
        ('tables', 'Wooden tables and display tables'), ('cloths', 'Tablecloths'),
        ('rugs', 'Rugs and rug pieces'), ('decor', 'Pictures, drinks and lighting'),
        ('tableware', 'Tableware and meals')]]

    def add(group, label, nums, labels=None, kind='whole', uncertainty=None, neighbors=None):
        nums = list(nums)
        assert nums and not selected.intersection(nums), (label, selected.intersection(nums))
        selected.update(nums)
        labels = labels or ['Original'] * len(nums)
        assert len(labels) == len(nums)
        cid = f'kitchen-card-{len(cards) + 1:03d}'
        required = neighbors or ([] if kind != 'component' else ['Matching pieces are needed to finish the outline; exact joins are not checked.'])
        facts = []
        if required:
            facts.append({'label': 'Combine', 'value': ' '.join(required)})
        if uncertainty:
            facts.append({'label': 'Uncertain', 'value': uncertainty})
        variants = []
        for n, variant in zip(nums, labels):
            entry = entries[n]
            native = crops(atlas, entry['rect'])
            with Image.open(ROOT / entry['sourcePath']) as original:
                assert crops(original, entry['sourceRect']).tobytes() == native.tobytes(), f'Packed source differs: {n}'
            uid = f'B01-{n:03d}'
            record_label = label if len(nums) == 1 else label + ' — ' + variant.lower()
            records.append({'id': uid, 'label': record_label, 'kind': kind,
                'source': {'sheetId': 'modern-interiors', 'rect': entry['rect'], 'frameSize': list(native.size),
                    'offsetXY': [0, 0], 'pixelSha256': sha(native.tobytes()),
                    'packedKey': entry['key'], 'originalPath': entry['sourcePath']},
                'topology': {'standalone': 'forbidden' if kind == 'component' else 'unknown' if kind == 'unknown' else 'allowed',
                    'requiredNeighbors': required, 'limits': 'Visual first-pass proposal. Joins are not established unless stated; game geometry and appliance behavior are unknown.'},
                'uncertainty': uncertainty})
            variants.append({'id': f'drawing-{n}', 'label': variant if len(nums) > 1 else 'Original', 'recordId': uid})
        cards.append({'id': cid, 'groupId': group, 'label': label, 'kind': kind,
                      'facts': facts, 'variants': variants})

    finishes = ['Pale lilac', 'Gray lilac', 'Slate gray', 'Yellow', 'Blue', 'Coral',
                'Pale wood', 'Golden wood', 'Red wood', 'Dark wood']
    surfaces = ['Tall surface, left edge', 'Surface with side edges', 'Surface with lower edge',
                'Short surface, left edge', 'Short surface, middle', 'Short surface, right edge',
                'Tall surface, right edge', 'Tall surface, middle', 'Tall surface with side detail']
    for i, label in enumerate(surfaces):
        add('surfaces', label, [1 + i + 9 * color for color in range(10)], finishes, 'component',
            'Table or counter surface is plausible. The direction and full outline need checking.')
    cabinet_names = ['Plain cabinet front', 'Drawer front', 'Plain drawer strip', 'Double-door cabinet front',
                     'Open cabinet frame', 'Open cabinet with cookware', 'Open cabinet with bottles',
                     'Small drawer bank', 'Drawer strip, left detail', 'Drawer strip, right detail']
    for i, label in enumerate(cabinet_names):
        add('cabinets', label, [91 + i, 101 + i, 111 + i], ['Red wood', 'Pale wood', 'Golden wood'],
            'component', 'Cabinet fronts and frames are proposed; complete counter assemblies are not checked.',
            ['A matching counter top or cabinet body is needed. Neighboring sections may also be needed.'])
    add('cabinets', 'Low cupboard with drawer', [121])
    add('cabinets', 'Glass-front low cupboard', [122], uncertainty='A display cupboard or glazed cabinet is plausible.')
    for n, label in zip(range(123, 126), ['Glass-front cupboard, left section', 'Glass-front cupboard, middle section', 'Glass-front cupboard, right section']):
        add('cabinets', label, [n], kind='component', uncertainty='Section names follow the visible trim; joins need checking.')
    add('cabinets', 'Wall shelf', [126, 128, 130, 132], ['Golden wood', 'Pale wood', 'Red wood', 'Pale lilac'])
    add('cabinets', 'Wall shelf with jars', [127, 129, 131, 133], ['Golden wood', 'Pale wood', 'Red wood', 'Pale lilac'])
    add('small-appliances', 'Toaster', [134])
    add('small-appliances', 'Toaster with cable and plug', [135])
    add('small-appliances', 'Toaster with bread and cable', [136])
    add('small-appliances', 'Wall socket, shaded drawing', [137])
    add('small-appliances', 'Wall socket, light drawing', [138])
    add('rugs', 'Small rectangular rug', [139, 140], ['Blue pattern', 'Pink pattern'])
    add('sinks', 'Sink and tap', [141, 143, 145], ['Pale lilac', 'Slate gray', 'Yellow'], kind='component',
        neighbors=['A supporting counter or cabinet is needed; the exact matching section is not checked.'])
    add('sinks', 'Sink with sponge', [142, 144, 146], ['Pale lilac', 'Slate gray', 'Yellow'], kind='component',
        neighbors=['A supporting counter or cabinet is needed; the exact matching section is not checked.'])
    add('sinks', 'Dish rack', [147])
    add('large-appliances', 'Range with closed oven', range(148, 153),
        ['Empty hob', 'Pan', 'Fried egg', 'Blue burners', 'Fried egg over blue burner'])
    add('large-appliances', 'Range with open oven', range(153, 157),
        ['Empty hob', 'Fried egg', 'Pan', 'Blue burners'])
    add('large-appliances', 'Extractor hood', [157])
    add('large-appliances', 'Two-door refrigerator', [158, 159, 160], ['Pale', 'Slate', 'Gray'])
    add('large-appliances', 'Refrigerator, alternate front', [161], uncertainty='The lower door/panel differs from the other closed refrigerators.')
    add('large-appliances', 'Open refrigerator with food', [162, 163], ['Pale', 'Slate'])
    add('large-appliances', 'Refrigerator, narrow side view', [164, 166, 168, 170],
        ['Slate, side A', 'Pale, side A', 'Slate, side B', 'Pale, side B'])
    add('large-appliances', 'Refrigerator, door open to the right', [165, 167], ['Slate', 'Pale'])
    add('large-appliances', 'Refrigerator, door open to the left', [169, 171], ['Slate', 'Pale'])
    add('preparation', 'Pair of pitchers', [172, 173], ['Brown pitcher on left', 'Brown pitcher on right'])
    add('preparation', 'Two pitchers, staggered', [174, 175], ['Brown pitcher behind', 'Gray pitcher behind'])
    add('preparation', 'Cluster of pitchers', [176], uncertainty='Pitchers or drink jugs are plausible.')
    add('small-appliances', 'Coffee machine', [177, 178], ['Compact drawing', 'Wider side drawing'])
    add('small-appliances', 'Coffee machine with cable', [179, 180], ['Compact drawing', 'Wider side drawing'])
    add('preparation', 'Small metal kettle, side A', [181], uncertainty='A small kettle or pouring pot is plausible.')
    add('preparation', 'Small metal kettle, side B', [182], uncertainty='A small kettle or pouring pot is plausible.')
    add('small-appliances', 'Tall electric kettle', [184, 183], ['Without cable', 'With cable'],
        uncertainty='A kettle or compact drink appliance is plausible; function is not established.')
    add('small-appliances', 'Countertop coffee maker', [185, 186], ['Without cable', 'With cable'])
    add('small-appliances', 'Microwave oven', [187, 188], ['Without cable', 'With cable'])
    add('small-appliances', 'Open microwave oven', [189, 190], ['Without cable', 'With cable'])
    add('large-appliances', 'Compact refrigerator', [191], uncertainty='A compact refrigerator or similar closed appliance is plausible.')
    add('large-appliances', 'Double-front appliance cabinet', [192], uncertainty='A dishwasher or commercial appliance is plausible; exact function is unresolved.')
    add('large-appliances', 'Appliance cabinet with racks', [193], uncertainty='A dishwasher or dish-storage appliance is plausible.')
    add('large-appliances', 'Appliance cabinet with tall contents', [194], uncertainty='The tall yellow contents and exact appliance function are unclear.')
    add('small-appliances', 'Electric cooking pot', [195, 197], ['Pale', 'Slate'], uncertainty='A rice cooker or similar lidded electric pot is plausible.')
    add('small-appliances', 'Electric cooking pot with cable', [196, 198], ['Pale', 'Slate'], uncertainty='A rice cooker or similar lidded electric pot is plausible.')
    add('small-appliances', 'Blender', range(199, 203), ['Pale', 'Green', 'Blue', 'Pink'])
    add('decor', 'Standing lamp', [203, 205], ['Pale', 'Slate'], uncertainty='A standing lamp is plausible; the patterned head could be another small household fixture.')
    add('decor', 'Standing lamp with cable', [204, 206], ['Pale', 'Slate'], uncertainty='A standing lamp is plausible; the exact fixture function is unresolved.')
    for n, label in [(207, 'Small chopping board'), (208, 'Long chopping board'), (209, 'Kitchen knife'),
                     (210, 'Chopped vegetables'), (211, 'Two pieces of fruit'), (212, 'Fruit cluster'),
                     (213, 'Chopped vegetable pile'), (214, 'Bread loaf'), (215, 'Raw meat slice'),
                     (216, 'Raw meat pieces')]:
        add('preparation', label, [n], uncertainty='The specific food is a visual guess.' if n in (210, 211, 212, 213, 214, 215, 216) else None)
    rug_pieces = ['Rug upper-left corner', 'Rug left border', 'Rug lower-left corner', 'Rug lower border',
                  'Rug lower-right corner', 'Rug right border', 'Rug upper-right corner', 'Rug upper border', 'Rug center']
    for i, label in enumerate(rug_pieces):
        add('rugs', label, [217 + i, 227 + i], ['Mustard', 'Blue'], 'component',
            neighbors=['Matching rug border and center pieces are needed. Only the pictured complete rug is a whole object.'])
    add('rugs', 'Square bordered rug', [226, 236], ['Mustard', 'Blue'])
    for i, label in enumerate(rug_pieces):
        add('rugs', label + ', patterned', [237 + i, 250 + i], ['Blue pattern', 'Pink pattern'], 'component',
            neighbors=['Matching patterned rug pieces are needed to finish the border. Joins are not checked.'])
    add('rugs', 'Square patterned rug', [246, 259], ['Blue pattern', 'Pink pattern'])
    for i, label in enumerate(['Narrow patterned rug, upper section', 'Narrow patterned rug, middle section', 'Narrow patterned rug, lower section']):
        add('rugs', label, [247 + i, 260 + i], ['Blue pattern', 'Pink pattern'], 'component')
    add('decor', 'Small drink glass or bottle', [263, 264], ['Light blue', 'Alternate light blue'], uncertainty='Glass versus small bottle is unclear at this scale.')
    add('decor', 'Drinks bottle', [265, 266, 267], ['Blue', 'Green', 'Alternate green'])
    add('decor', 'Portrait kitchen picture', [268, 271], ['Warm still life', 'Green still life'])
    add('decor', 'Landscape kitchen picture', [269, 270], ['Colorful still life', 'Green still life'])
    add('seating', 'Wooden chair, compact back view', range(272, 276), ['Golden wood', 'Pale wood', 'Dark wood', 'Red wood'], uncertainty='Front/back naming is proposed from the visible back slats.')
    add('seating', 'Wooden chair, compact front view', range(276, 280), ['Golden wood', 'Pale wood', 'Dark wood', 'Red wood'], uncertainty='Front/back naming is proposed from the visible seat and legs.')
    add('seating', 'Wooden chair, high back on left', range(280, 284), ['Red wood', 'Dark wood', 'Pale wood', 'Golden wood'])
    add('seating', 'Wooden chair, low back on left', range(284, 288), ['Red wood', 'Dark wood', 'Pale wood', 'Golden wood'])
    add('tables', 'Small wooden table', range(288, 291), ['Pale wood', 'Golden wood', 'Red wood'], uncertainty='A small table or broad stool is plausible.')
    for i, label in enumerate(['Short table, left section', 'Short table, middle section', 'Short table, right section']):
        add('tables', label, [291 + i, 294 + i, 297 + i], ['Pale wood', 'Golden wood', 'Red wood'], 'component')
    for i, label in enumerate(['Long table, left section', 'Long table, middle section', 'Long table, right section']):
        add('tables', label, [300 + i, 306 + i, 303 + i], ['Pale wood', 'Golden wood', 'Red wood'], 'component')
    add('tables', 'Large square wooden table', [309, 311, 310], ['Pale wood', 'Golden wood', 'Red wood'])
    for i, label in enumerate(['Long display table, left section', 'Display table, glass middle section', 'Long display table, right section']):
        add('tables', label, [318 + i, 315 + i, 312 + i], ['Pale wood', 'Golden wood', 'Red wood'], 'component',
            'A glass-topped table or low display cabinet is plausible.')
    add('tables', 'Glass-topped square table', [323, 322, 321], ['Pale wood', 'Golden wood', 'Red wood'], uncertainty='A table or low glazed display cabinet is plausible.')
    for i, label in enumerate(['Long tablecloth, left section', 'Long tablecloth, middle section', 'Long tablecloth, right section']):
        add('cloths', label, [324 + i, 327 + i, 330 + i, 333 + i], ['Red checks', 'Pink and yellow checks', 'White', 'Rose'], 'component',
            neighbors=['Matching cloth sections and a table underlay are proposed; the exact underlay and joins are not checked.'])
    add('cloths', 'Square tablecloth cover', range(336, 340), ['Red checks', 'Pink and yellow checks', 'White', 'Rose'],
        kind='component', uncertainty='The pixels show cloth and a hanging edge; a table body is not separately established.',
        neighbors=['A matching table underlay is needed; the exact matching table is not checked.'])
    for i, label in enumerate(['Wood table, upper section', 'Wood table, middle section', 'Wood table, lower section', 'Wood table, glass section']):
        add('tables', label, [348 + i, 340 + i, 344 + i], ['Pale wood', 'Golden wood', 'Red wood'], 'component',
            'Section orientation is proposed from trim and visible legs; complete joins are not checked.')
    for i, label in enumerate(['Short cloth, left section', 'Short cloth, middle section', 'Short cloth, right section', 'Short cloth, hanging edge']):
        add('cloths', label, [352 + i, 356 + i], ['Rose', 'White'], 'component',
            neighbors=['A matching cloth outline and table underlay are needed; exact joins are unresolved.'])
    for i, label in enumerate(['Checked cloth, left section', 'Checked cloth, middle section', 'Checked cloth, right section', 'Checked cloth, hanging edge']):
        add('cloths', label, [360 + i, 364 + i], ['Red checks', 'Pink and yellow checks'], 'component',
            neighbors=['A matching cloth outline and table underlay are needed; exact joins are unresolved.'])
    add('seating', 'Wooden chair, high back on right', range(368, 371), ['Golden wood', 'Pale wood', 'Red wood'])
    add('seating', 'Wooden chair, low back on right', range(371, 374), ['Pale wood', 'Golden wood', 'Red wood'])
    add('tableware', 'Place setting with bottle on right', [374])
    add('tableware', 'Place setting with bottle on left', [375])
    add('preparation', 'Wall rail with kitchen utensils', [376])
    add('preparation', 'Hanging kitchen tools', [377])
    add('sinks', 'Upright dish rack', [378])
    add('tableware', 'Pot lid', [379, 380], ['Dark gray', 'Light gray'])
    add('tableware', 'Empty plate', [381])
    add('tableware', 'Stack of plates', [382])
    for n, label in [(383, 'Plate with small serving'), (384, 'Plate with mixed food'), (385, 'Pan or bowl with orange food'),
                     (386, 'Pan or bowl with colorful food'), (387, 'Pan or bowl with yellow food'), (388, 'Pan or bowl with greens'),
                     (389, 'Pan or bowl with mixed greens'), (390, 'Small colorful food bowl')]:
        add('tableware', label, [n], uncertainty='The specific food and pan/bowl distinction are tentative.')
    add('tableware', 'Place setting with drinks', [391, 392], ['Blue drink', 'Green drink'])
    for n, label in [(393, 'Small drinking glass'), (394, 'Coffee cup'), (395, 'Small blue cup'),
                     (396, 'Cluster of cups'), (397, 'Six drinking glasses')]:
        add('tableware', label, [n])
    for n, label in [(398, 'Bowl or plate with ring-shaped food'), (399, 'Bowl with colorful food'),
                     (400, 'Bowl with brown food'), (401, 'Bowl with pink food'), (402, 'Two small food bowls, pink and brown'),
                     (403, 'Two small food bowls, brown'), (404, 'Two small food bowls, light and brown'), (405, 'Bowl with orange food')]:
        add('tableware', label, [n], uncertainty='Food types are not identified confidently.')
    add('cabinets', 'Glass food display counter', [406, 407, 408], ['Empty', 'With round foods', 'With assorted foods'],
        uncertainty='A pastry or food display counter is plausible; exact contents are tentative.')
    assert selected == set(entries), sorted(set(entries) - selected)
    packet = {'schemaVersion': 1, 'packetId': 'B01', 'familyId': 'kitchens', 'title': 'Kitchens and appliances',
        'description': 'Kitchen counters, cabinet sections, sinks, appliances, dining furniture, cloths, rugs, cookware and food. Finishes share selectors; parts that need combining stay marked.',
        'sourcePins': [{'sheetId': 'modern-interiors', 'path': ATLAS, 'sha256': sha((ROOT / ATLAS).read_bytes())}],
        'sourceIndexPins': [{'path': INDEX, 'sha256': sha((ROOT / INDEX).read_bytes())}],
        'scope': {'included': ['All 408 normal named Kitchen exports in the existing committed atlas index.',
            'Multiple finishes and depicted views/states; complete objects, incomplete pieces and nearby kitchen/dining props.'],
            'excluded': ['Black-shadow and shadowless exports; other themes; unindexed loose theme-sheet art; original master correspondence and exhaustive origin/alias searches.'],
            'method': 'Visual first pass of all selected exports and the native theme overview; exact committed crops and their indexed original exports checked. No exhaustive absence search.'},
        'facts': [{'label': 'Scope', 'value': f'{len(cards)} cards cover 408 normal source drawings, with finishes and alternate drawings in selectors.'},
                  {'label': 'Combine', 'value': 'Counter, cabinet, table, cloth and rug sections need matching pieces. Exact joins are mostly unresolved.'},
                  {'label': 'Meaning', 'value': 'Labels are plausible first-pass proposals. Appliance functions, some facing names and small foods may need correction.'},
                  {'label': 'Use', 'value': 'Visual objects and parts are distinguished. Game collision, placement, appliance behavior and animation remain unknown.'}],
        'groups': groups, 'records': sorted(records, key=lambda r: r['id']), 'cards': cards}
    packet['examples'] = []
    for uid, label, nums, target in [
        ('mustard-rug-four-corners', 'Mustard rug from four corners', [217, 223, 219, 221], 226),
        ('blue-patterned-rug-four-corners', 'Blue patterned rug from four corners', [237, 243, 239, 241], 246)]:
        out = Image.new('RGBA', (32, 32))
        placements = []
        for n, at in zip(nums, [[0, 0], [16, 0], [0, 16], [16, 16]]):
            out.alpha_composite(crops(atlas, entries[n]['rect']), tuple(at))
            placements.append({'recordId': f'B01-{n:03d}', 'at': at})
        out = normalize(out)
        assert out.tobytes() == crops(atlas, entries[target]['rect']).tobytes()
        packet['examples'].append({'id': uid, 'label': label,
            'description': 'These four corners exactly reproduce the pictured small complete rug. Larger layouts and arbitrary repetition are not checked.',
            'size': [32, 32], 'placements': placements, 'pixelSha256': sha(out.tobytes())})
    return packet


def check(packet):
    index = json.loads((ROOT / INDEX).read_bytes())
    aliases = {e['key']: e for e in index['entries']}
    for pin in packet['sourcePins'] + packet['sourceIndexPins']:
        assert sha((ROOT / pin['path']).read_bytes()) == pin['sha256'], 'Source pin drift'
    with Image.open(ROOT / ATLAS) as raw:
        atlas = normalize(raw)
    records = {r['id']: r for r in packet['records']}
    membership = [v['recordId'] for c in packet['cards'] for v in c['variants']]
    assert len(records) == len(packet['records']) == 408
    assert len(membership) == len(set(membership)) == len(records) and set(membership) == set(records)
    for record in records.values():
        src = record['source']; entry = aliases[src['packedKey']]
        assert entry['rect'] == src['rect'] and entry['sourcePath'] == src['originalPath']
        assert entry['theme'] == 'kitchen' and entry['variant'] == 'normal'
        native = crops(atlas, src['rect'])
        assert list(native.size) == src['frameSize'] and src['offsetXY'] == [0, 0]
        assert sha(native.tobytes()) == src['pixelSha256']
        if (ROOT / src['originalPath']).is_file():
            with Image.open(ROOT / src['originalPath']) as original:
                assert crops(original, entry['sourceRect']).tobytes() == native.tobytes()
        assert record['kind'] in ('whole', 'component', 'unknown')
        if record['kind'] == 'component':
            assert record['topology']['standalone'] == 'forbidden' and record['topology']['requiredNeighbors']
    for example in packet.get('examples', []):
        out = Image.new('RGBA', tuple(example['size']))
        for placement in example['placements']:
            src = records[placement['recordId']]['source']
            part = crops(atlas, src['rect'])
            x, y = placement['at']
            assert x >= 0 and y >= 0 and x + part.width <= out.width and y + part.height <= out.height
            out.alpha_composite(part, (x, y))
        assert sha(normalize(out).tobytes()) == example['pixelSha256']
    for card in packet['cards']:
        assert card['kind'] == records[card['variants'][0]['recordId']]['kind']
        if card['kind'] == 'component': assert any(f['label'] == 'Combine' for f in card['facts'])
    return {'ok': True, 'cards': len(packet['cards']), 'records': len(records),
            'components': sum(r['kind'] == 'component' for r in records.values()),
            'finiteExamples': len(packet.get('examples', [])),
            'originalExportsAvailable': sum((ROOT / r['source']['originalPath']).is_file() for r in records.values()),
            'scope': 'Selected normal kitchen exports only; no master occurrence or exhaustive alias/absence claim.'}


def capture(packet, destination):
    destination.mkdir(parents=True, exist_ok=True)
    with Image.open(ROOT / ATLAS) as raw:
        atlas = normalize(raw)
    records = {r['id']: r for r in packet['records']}
    for start in range(0, len(packet['cards']), 48):
        page = Image.new('RGB', (1440, 1080), '#eeeeee'); d = ImageDraw.Draw(page)
        for i, card in enumerate(packet['cards'][start:start + 48]):
            record = records[card['variants'][0]['recordId']]
            part = crops(atlas, record['source']['rect'])
            scale = min(3, 140 // part.width, 125 // part.height)
            part = part.resize((part.width * scale, part.height * scale), Image.Resampling.NEAREST)
            x, y = i % 8 * 180, i // 8 * 180
            page.paste(part, (x + (180 - part.width) // 2, y + 30), part)
            d.text((x + 5, y + 5), f'{start + i + 1}. {card["kind"]}', fill='black')
            label = card['label']
            lines = [label[:27], label[27:54]] if len(label) > 27 else [label]
            for j, line in enumerate(lines): d.text((x + 5, y + 151 + j * 12), line, fill='black')
            d.text((x + 5, y + 17), f'{len(card["variants"])} drawings', fill='#555555')
        page.save(destination / f'cards-{start // 48 + 1}.png')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--capture-dir', type=Path)
    args = parser.parse_args()
    packet = json.loads(OUT.read_bytes()) if args.check else build()
    report = check(packet)
    if not args.check: OUT.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + '\n')
    if args.capture_dir: capture(packet, args.capture_dir)
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
