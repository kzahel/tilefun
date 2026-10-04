#!/usr/bin/env python3
"""Build proposed family contact sheets using committed art only.

Run normally to write public/data/family-sheets.json; --check verifies all pins,
rectangles, available proposal pixel hashes, coverage, and byte-for-byte output
without writing. Needs Python 3 and Pillow; no downloaded source packs.

Revision algorithm: SHA-256 of UTF-8 JSON, sorted keys, compact separators,
ensure_ascii=True, with the object's own top-level revision omitted. Family
revisions hash their family object, including sourcePins for its used sheets;
catalog revision hashes the catalog including family revisions and the two source
ArtSheet records. Array order is significant. sourcePins are sorted by source ID.
Proposal/review pins remain here, outside the plain-language browsing artifact.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / 'docs/tactical/053-semantic-tileset-map/packets'
OUTPUT = ROOT / 'public/data/family-sheets.json'
PINS = {
    'P01-trees.json': '3df0e42f9012644afe5cd1233f604b5dd74ec05c4c4f26253834dc2a05281ff6',
    'P02-scrapyard.json': '429d796ec87adb007a4febc267fabff14c1032cd197dc47ed50d729f65073957',
    'P03-cabinets.json': 'c22f7b16e24816a231883bad04cd29e43eac2ce81f09f444d4bc5ffad7875254',
    'P03-cabinets-topology.json': '409461fce1bb0eccb866569140ab2c17bdc7040940fb9ea359668d4fe93dcfc3',
    'P01-trees-review.md': '91e950cc52b1192608c8811141ab0b42f69f916c24f94694e4022871131d8b36',
    'P02-scrapyard-review.md': 'a05de021a8524e4f9fd6510dc517241567845bdf36ad936d7c24ba80bbcfcee3',
    'P03-cabinets-review.md': 'd785fad5cd8629d31ee1781287f5b1fbc9f50ea8d2af8a2d02adf221f18f7465',
}
SHADOWS = [('normal', 'Normal'), ('black-shadow', 'Dark shadow'), ('shadowless', 'No shadow')]
PALETTES = [('green', 'Green'), ('orange-red', 'Orange / red'),
            ('blue-green', 'Blue-green'), ('ochre-yellow', 'Ochre / yellow')]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def revision(value):
    return sha(json.dumps({k: v for k, v in value.items() if k != 'revision'},
                          sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('utf-8'))


def normalized_bytes(image):
    raw = bytearray(image.convert('RGBA').tobytes())
    for i in range(0, len(raw), 4):
        if raw[i + 3] == 0:
            raw[i:i + 4] = bytes(4)
    return bytes(raw)


def fact(label, value):
    return {'label': label, 'value': value}


def options(values):
    return [{'id': key, 'label': label} for key, label in values]


def sprite(sheet_id, rect):
    return {'size': rect[2:], 'layers': [{'sheetId': sheet_id, 'rect': rect, 'at': [0, 0]}]}


def variant(key, label, records, image):
    return {'id': key, 'label': label, 'recordIds': records, 'sprite': image}


def member(key, number, label, kind, facts, variants, question=None):
    result = {'id': key, 'number': number, 'label': label, 'kind': kind,
              'facts': facts, 'variants': variants}
    if question:
        result['question'] = question
    return result


def group(key, title, members, description=None):
    result = {'id': key, 'title': title, 'members': members}
    if description:
        result['description'] = description
    return result


def family(key, name, description, variant_label, values, facts, groups, examples, source_sheets):
    entries = [m for g in groups for m in g['members']] + examples
    used_sources = {layer['sheetId'] for entry in entries for value in entry['variants']
                    for layer in value['sprite']['layers']}
    source_pins = [{field: source_sheets[source_id][field]
                    for field in ('id', 'fingerprint', 'width', 'height')}
                   for source_id in sorted(used_sources)]
    result = {'id': key, 'name': name, 'description': description, 'status': 'proposed',
              'variantLabel': variant_label, 'variants': options(values), 'facts': facts,
              'groups': groups, 'examples': examples, 'sourcePins': source_pins}
    result['revision'] = revision(result)
    return result


def combine(variants):
    """Keep untrimmed frames and copy each source layer at cumulative widths."""
    width = 0
    height = 0
    layers = []
    for value in variants:
        image = value['sprite']
        for layer in image['layers']:
            layers.append({**layer, 'at': [width + layer['at'][0], layer['at'][1]]})
        width += image['size'][0]
        height = max(height, image['size'][1])
    return {'size': [width, height], 'layers': layers}


def render(image, sources):
    size = image['size']
    require(len(size) == 2 and all(type(v) is int and v > 0 for v in size), 'Invalid sprite size')
    require(image['layers'], 'Sprite has no layers')
    result = Image.new('RGBA', tuple(size))
    for layer in image['layers']:
        source = sources[layer['sheetId']]
        x, y, w, h = layer['rect']
        ax, ay = layer['at']
        require(all(type(v) is int for v in [x, y, w, h, ax, ay]), 'Noninteger rectangle')
        require(x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= source.width
                and y + h <= source.height, 'Source rectangle outside pinned sheet')
        require(ax >= 0 and ay >= 0 and ax + w <= size[0] and ay + h <= size[1],
                'Destination rectangle outside sprite')
        # No mask: Pillow paste replaces RGBA, including transparent pixels.
        result.paste(source.crop((x, y, x + w, y + h)), (ax, ay))
    return result


def check_pixels(image, expected, sources, context):
    require(sha(normalized_bytes(render(image, sources))) == expected, f'Pixel hash mismatch: {context}')


def build_cabinets(packet, topology, sources, source_sheets):
    records = {row['id']: row for row in packet['measurements']['records']}
    index_pin = packet['measurements']['sources']['packedCatalog']
    index_path = ROOT / index_pin['path']
    require(sha(index_path.read_bytes()) == index_pin['sha256'], 'Packed catalog pin changed')
    index = {row['key']: row for row in load(index_path)['entries']}
    variants_by_record = {}
    for key, record in records.items():
        alias = index[record['packedAliasKey']]
        require(alias['rect'] == record['packedRect'] and alias['sourcePath'] == record['single']['path'],
                f'Packed alias lineage changed: {key}')
        image = sprite('modern-interiors', record['packedRect'])
        require(image['size'] == record['single']['dimensions'], f'Cabinet frame changed: {key}')
        check_pixels(image, record['visibleRGBAHash'], sources, key)
        variants_by_record[key] = variant(record['variant'], dict(SHADOWS)[record['variant']], [key], image)

    restrictions = {row['conceptId']: row for row in topology['components']}
    labels = {37: 'Tall solid-front cabinet', 38: 'Tall reflective cabinet',
              39: 'Short solid-front cabinet', 40: 'Short reflective cabinet',
              41: 'Left end', 42: 'Reflective middle', 43: 'Solid middle',
              44: 'Right end', 45: 'Small open-front unit'}
    whole, components = [], []
    for concept in packet['semanticProposals']:
        number = int(concept['id'].split('C')[-1])
        part = restrictions.get(concept['id'])
        facts = []
        if part:
            require(not part['standaloneAllowed'] and part['requiresAssembly'], 'Cabinet topology changed')
            require(part['memberRecords'] == concept['memberRecords'], 'Topology membership differs')
            facts.append(fact('Use', 'Cannot stand alone in any shadow style.'))
            facts.append(fact('Join', {41: 'Add a middle or right end on the right.',
                                       42: 'Connect another piece on both sides.',
                                       43: 'Connect another piece on both sides.',
                                       44: 'Add a middle or left end on the left.'}[number]))
        else:
            facts.append(fact('Form', 'Complete object'))
        question = ('Mirror or glass?' if number in (38, 40, 42) else
                    'Shelf, side table, or another small unit?' if number == 45 else None)
        value = member(concept['id'], number, labels[number], 'component' if part else 'whole', facts,
                       [variants_by_record[key] for key in concept['memberRecords']], question)
        (components if part else whole).append(value)

    example_variants = []
    sequence = [41, 42, 43, 44]
    require(['P03-C' + str(n) for n in sequence] in topology['verifiedRenderSequences']['proposal'],
            'Cabinet example lacks tested sequence')
    for key, label in SHADOWS:
        values = [variants_by_record[f'P03-{n}-{key}'] for n in sequence]
        image = combine(values)
        experiment = next(row for row in packet['measurements']['assemblyExperiments']
                          if row['members'] == sequence and row['variant'] == key)
        check_pixels(image, experiment['visibleRGBAHash'], sources, f'cabinet example {key}')
        example_variants.append(variant(key, label, [r for v in values for r in v['recordIds']], image))
    return family('cabinets', 'Wooden cabinets', 'Complete cabinets and pieces for a wider cabinet.',
                  'Shadow', SHADOWS,
                  [fact('Appearance', 'Wooden frames, shown from the front.'),
                   fact('Assembly', 'Left end → optional middles → right end. Keep one shadow style.'),
                   fact('Variants', 'Reflection highlights also change slightly in three pieces.'),
                   fact('Gameplay', 'Collision and height are unknown.')],
                  [group('whole', 'Complete cabinets', whole),
                   group('components', 'Pieces to combine', components,
                         'These four pieces cannot stand alone in any shadow style.')],
                  [{'id': 'cabinet-assembly', 'label': 'A wider cabinet',
                    'description': 'Left end, reflective middle, solid middle, right end. Proposed assembly; not human-approved.',
                    'variants': example_variants}], source_sheets)


def build_trees(packet, source_sheets):
    records = {row['id']: row for row in packet['candidates']}
    occurrences = {row['id']: row['all_pixel_exact_master_occurrences']
                   for row in packet['experiments']['occurrences']}
    reconstructions = {(row['base'], row['patch'], row['result'])
                       for row in packet['experiments']['exact_reconstructions']
                       if row['exact_normalized_rgba']}
    images = {}
    for key, row in records.items():
        rect = row.get('master_anchor') or (row['source_rect'] if key.startswith('B') else None)
        if rect:
            require(rect in occurrences[key], f'Tree source occurrence differs: {key}')
            images[key] = sprite('me-complete', rect)
    for relation in packet['relations']:
        if relation['type'] == 'lower-strip-replacement':
            require((relation['base'], relation['patch'], relation['result']) in reconstructions,
                    'Tree replacement has no exact reconstruction evidence')
            require(relation['replace_local_rect'] == [0, 48, 64, 16], 'Tree replacement rectangle changed')
            base = images[relation['base']]
            patch = images[relation['patch']]['layers'][0]
            images[relation['result']] = {'size': base['size'], 'layers': [*base['layers'],
                                          {**patch, 'at': relation['replace_local_rect'][:2]}]}
    whole = []
    for treatment, label in enumerate(['Brown lower section', 'Pale lower section', 'Green-tinted lower section']):
        values = []
        for i, (key, palette) in enumerate(PALETTES):
            record_id = f'T{1 + i * 3 + treatment:02}'
            fields = records[record_id]['proposed_fields']
            require(fields['palette']['value'] == key and fields['trunk_treatment']['value'] ==
                    ['brown', 'pale', 'green-tinted'][treatment], f'Tree grouping differs: {record_id}')
            values.append(variant(key, palette, [record_id], images[record_id]))
        whole.append(member(f'tree-{treatment + 1}', treatment + 1, 'Tree · ' + label.lower(), 'whole',
                            [fact('Form', 'Rounded canopy')], values))
    patches = []
    for treatment, label in enumerate(['Pale replacement strip', 'Green-tinted replacement strip']):
        values = []
        for i, (key, palette) in enumerate(PALETTES):
            record_id = f'B{1 + i * 2 + treatment:02}'
            require(records[record_id]['proposed_fields']['palette']['value'] == key,
                    f'Tree patch grouping differs: {record_id}')
            values.append(variant(key, palette, [record_id], images[record_id]))
        patches.append(member(f'tree-patch-{treatment + 1}', treatment + 4, label, 'component',
                              [fact('Use', 'Cannot stand alone. Replaces the bottom 16 pixels of the matching tree.')], values))
    forest = []
    for i in range(9):
        record_id = f'F{i + 1:02}'
        row, position = divmod(i, 3)
        label = ['Left fragment', 'Center with stump' if row == 1 else 'Center', 'Right fragment'][position]
        forest.append(member(record_id, i + 6, f'Forest {row + 1} · {label.lower()}', 'component',
                             [fact('Use', f'Proposed combination with the other forest {row + 1} pieces.')],
                             [variant('fixed', 'Original colors', [record_id], images[record_id])]))
    examples = []
    for i, relation in enumerate(r for r in packet['relations'] if r['type'] == 'forest-assembly-proposal'):
        keys = relation['members']
        values = [variant('fixed', 'Original colors', [key], images[key]) for key in keys]
        examples.append({'id': f'forest-row-{i + 1}', 'label': f'Forest {i + 1}',
                         'description': 'Ordered fragments. Ground colors belong to this row; repeated centers and corners remain untested.',
                         'variants': [variant('fixed', 'Original colors', keys, combine(values))]})
    return family('trees', 'Trees and forest', 'One rounded-canopy form, four palettes, three lower sections, and forest pieces.',
                  'Palette', PALETTES,
                  [fact('Identity', 'Species and seasons are unknown.'),
                   fact('Palettes', 'Four colors for the rounded trees and strips. Forest pieces keep their original colors.'),
                   fact('Ground', 'Forest ground colors differ by row. Other terrain compatibility is unknown.'),
                   fact('Assembly', 'Match forest rows. Seamless repeats and corners are unproven.'),
                   fact('Gameplay', 'Collision and height are unknown.')],
                  [group('whole', 'Complete trees', whole), group('patches', 'Replacement strips', patches),
                   *[group(f'forest-{i + 1}', f'Forest {i + 1} pieces', forest[i * 3:i * 3 + 3])
                     for i in range(3)]], examples, source_sheets)


def build_scrapyard(packet, sources, source_sheets):
    values = {}
    groups = {'wrecks': [], 'scrap': [], 'piles': [], 'components': [], 'loose': [], 'utilities': []}
    questions = {5: 'A different underside view or a different wreck?', 6: 'A different underside view or a different wreck?',
                 7: 'Tire, pipe coupling, or loop?', 8: 'Car bumpers or bent metal panels?',
                 9: 'Pallet, grating, or ladder-like frame?',
                 **{i: 'Compressed scrap or bundled mixed trash?' for i in range(10, 16)},
                 22: 'Repeatable fill or a fixed-width strip?',
                 25: 'Does this triangle belong to the mound? The visible match is incomplete.',
                 26: 'Discarded appliance, cabinet, or bin?', 27: 'Water storage or another industrial tank?'}
    labels = {5: 'Overturned teal car · lower row', 6: 'Overturned teal car · upper row',
              9: 'Brown slatted frame', 22: 'Refuse strip middle', 27: 'Cylindrical tank'}
    for row in packet['candidates']:
        key = row['id']
        number = int(key.split('-')[-1])
        image = sprite('me-complete', row['masterOccurrences'][0]['rect'])
        require(image['size'] == row['sourceSize'], f'Source frame changed: {key}')
        check_pixels(image, row['normalizedRgbaSHA256'], sources, key)
        for occurrence in row['masterOccurrences'][1:]:
            check_pixels(sprite('me-complete', occurrence['rect']), row['normalizedRgbaSHA256'], sources, key)
        value = variant('original', 'Original', [key], image)
        values[row['sourceKey']] = value
        component = 21 <= number <= 26
        facts = []
        if 21 <= number <= 23:
            facts.append(fact('Use', {21: 'Left taper; join a middle on the right.',
                                     22: 'Middle; place between the left and right tapers.',
                                     23: 'Right taper; join a middle on the left.'}[number]))
        elif component:
            facts.append(fact('Use', 'Loose piece; possible mound addition.'))
            facts.append(fact('Placement', 'Whether it can stand alone is unknown.'))
        elif number in (3, 4, 15, 16, 17, 18, 19, 20):
            facts.append(fact('Form', 'One image containing a stack or mixed pile.'))
        else:
            facts.append(fact('Form', 'Complete source image'))
        card = member(key, number, labels.get(number, row['label']), 'component' if component else 'whole',
                      facts, [value], questions.get(number))
        category = ('wrecks' if number <= 6 else 'scrap' if number <= 15 else
                    'piles' if number <= 20 else 'components' if number <= 23 else
                    'loose' if number <= 26 else 'utilities')
        groups[category].append(card)
    experiments = packet['experiments']['modularStrip']
    example_variants = []
    for experiment in experiments:
        pieces = [values[key] for key in experiment['sequence']]
        image = combine(pieces)
        require(image['size'] == experiment['size'], 'Refuse-strip size differs')
        check_pixels(image, experiment['normalizedRgbaSHA256'], sources, 'refuse strip')
        if experiment['bodyRepeats'] == 2:
            example_variants.append(variant('original', 'Original',
                                           [r for v in pieces for r in v['recordIds']], image))
    require(len(example_variants) == 1, 'Refuse example needs exactly one tested two-middle assembly')
    return family('scrapyard', 'Scrapyard and debris', 'Wrecked cars, scrap, refuse pieces, and nearby utility structures.',
                  'Appearance', [('original', 'Original')],
                  [fact('Identity', 'Labels describe visible forms; uncertain purposes have a question.'),
                   fact('Joins', 'Refuse tapers and middle connect in the examples; seamless texture is unproven.'),
                   fact('Gameplay', 'Collision, anchors, and walkability are unknown.')],
                  [group('wrecks', 'Wrecked cars', groups['wrecks']), group('scrap', 'Loose scrap and stacks', groups['scrap']),
                   group('piles', 'Mixed refuse mounds', groups['piles']),
                   group('components', 'Refuse pieces to combine', groups['components']),
                   group('loose', 'Signs and loose pieces', groups['loose'],
                         'Possible mound additions; standalone suitability is unknown.'),
                   group('utilities', 'Nearby utility structures', groups['utilities'])],
                  [{'id': 'refuse-strip', 'label': 'A longer refuse strip',
                    'description': 'Left taper, two middles, right taper. Longer repeats remain unproven.',
                    'variants': example_variants}], source_sheets)


def build():
    for name, expected in PINS.items():
        require(sha((PACKETS / name).read_bytes()) == expected, f'Pinned proposal/review changed: {name}')
    trees = load(PACKETS / 'P01-trees.json')
    scrapyard = load(PACKETS / 'P02-scrapyard.json')
    cabinets = load(PACKETS / 'P03-cabinets.json')
    topology = load(PACKETS / 'P03-cabinets-topology.json')
    require(topology['baseProposal']['sha256'] == PINS['P03-cabinets.json'], 'Topology base proposal mismatch')
    require(topology['evidence']['agentEvidence']['reviewSha256'] == PINS['P03-cabinets-review.md'],
            'Topology review mismatch')
    sheets = {row['id']: row for row in load(ROOT / 'public/data/art-catalog.json')['sheets']}
    sources = [sheets[key] for key in ('me-complete', 'modern-interiors')]
    pins = {'me-complete': trees['source']['sha256'],
            'modern-interiors': cabinets['measurements']['sources']['packedAtlas']['sha256']}
    require(scrapyard['source']['sha256'] == pins['me-complete'], 'Exteriors proposal source mismatch')
    images = {}
    for sheet in sources:
        path = ROOT / 'public' / sheet['image']
        require(path.resolve().is_relative_to((ROOT / 'public').resolve()), 'Source is outside public assets')
        require(sheet['fingerprint'] == pins[sheet['id']] == sha(path.read_bytes()),
                f"Pinned public source changed: {sheet['id']}")
        image = Image.open(path).convert('RGBA')
        require(list(image.size) == [sheet['width'], sheet['height']], 'Source dimensions differ')
        images[sheet['id']] = image
    families = [build_cabinets(cabinets, topology, images, sheets), build_trees(trees, sheets),
                build_scrapyard(scrapyard, images, sheets)]
    expected = {'cabinets': [row['id'] for row in cabinets['measurements']['records']],
                'trees': [row['id'] for row in trees['candidates']],
                'scrapyard': [row['id'] for row in scrapyard['candidates']]}
    for item in families:
        records = [r for g in item['groups'] for m in g['members'] for v in m['variants'] for r in v['recordIds']]
        require(Counter(records) == Counter(expected[item['id']]), f"Incomplete or duplicated coverage: {item['id']}")
        for entry in [m for g in item['groups'] for m in g['members']] + item['examples']:
            for value in entry['variants']:
                render(value['sprite'], images)
    require(sum(map(len, expected.values())) == 85, 'Unexpected pilot record count')
    result = {'version': 1, 'sources': sources, 'families': families}
    result['revision'] = revision(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify committed output without writing')
    args = parser.parse_args()
    try:
        result = build()
        encoded = (json.dumps(result, indent=2, ensure_ascii=True) + '\n').encode('utf-8')
        if args.check:
            require(OUTPUT.is_file() and OUTPUT.read_bytes() == encoded,
                    'family-sheets.json is stale; run python3 scripts/build-family-sheets.py')
        else:
            OUTPUT.write_bytes(encoded)
        print(f"Family sheets {'verified' if args.check else 'generated'}: 3 families, 52 cards, 85 source records.")
    except (ValueError, KeyError, OSError, StopIteration) as error:
        print(f'Family sheets failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
