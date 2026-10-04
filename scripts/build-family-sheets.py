#!/usr/bin/env python3
"""Build proposed family contact sheets using committed art only.

Run normally to write public/data/family-sheets.json; --check verifies all pins,
rectangles, available proposal pixel hashes, coverage, and byte-for-byte output
without writing. Needs Python 3 and Pillow; no downloaded source packs.

Revision algorithm: SHA-256 of UTF-8 JSON, sorted keys, compact separators,
ensure_ascii=True, with the object's own top-level revision omitted. Family
revisions hash their family object, including sourcePins for its used sheets;
catalog revision hashes the catalog including family revisions and all source
ArtSheet records. Array order is significant. sourcePins are sorted by source ID.
Proposal/review pins remain here, outside the plain-language browsing artifact.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / 'docs/tactical/053-semantic-tileset-map/packets'
OUTPUT = ROOT / 'public/data/family-sheets.json'
PINS = {
    'I01-interior-sofas.json': '75b0910c5565e9bff3db9b819f76fe2cca0e5e268b6438a2ff7023a061a260df',
    'I01-interior-sofas-review.md': '1b93f7b2b438eb4f74f3e01f898b746bd5f0f7a5a36eb48e4b23f7651cc256fb',
    'P01-trees.json': '3df0e42f9012644afe5cd1233f604b5dd74ec05c4c4f26253834dc2a05281ff6',
    'P02-scrapyard.json': '429d796ec87adb007a4febc267fabff14c1032cd197dc47ed50d729f65073957',
    'P03-cabinets.json': 'c22f7b16e24816a231883bad04cd29e43eac2ce81f09f444d4bc5ffad7875254',
    'P03-cabinets-topology.json': '409461fce1bb0eccb866569140ab2c17bdc7040940fb9ea359668d4fe93dcfc3',
    'P01-trees-review.md': '91e950cc52b1192608c8811141ab0b42f69f916c24f94694e4022871131d8b36',
    'P02-scrapyard-review.md': 'a05de021a8524e4f9fd6510dc517241567845bdf36ad936d7c24ba80bbcfcee3',
    'P03-cabinets-review.md': 'd785fad5cd8629d31ee1781287f5b1fbc9f50ea8d2af8a2d02adf221f18f7465',
    'E01-outdoor-seating.json': '9562c3956611af40245966284ad5614bbff9a7c11a07fac78c9b9a6a5c5bd62b',
    'E01-outdoor-seating-review.md': '5b85986b906910e857549c7528b33ef70b995fb7c5ec7276d1e65a01d6ee1ef0',
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
    background = image.get('background')
    require(background is None or (len(background) == 7 and background[0] == '#'
            and all(c in '0123456789abcdef' for c in background[1:])), 'Invalid background')
    result = Image.new('RGBA', tuple(size), background or (0, 0, 0, 0))
    for layer in image['layers']:
        source = sources[layer['sheetId']]
        x, y, w, h = layer['rect']
        ax, ay = layer['at']
        require(all(type(v) is int for v in [x, y, w, h, ax, ay]), 'Noninteger rectangle')
        require(x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= source.width
                and y + h <= source.height, 'Source rectangle outside pinned sheet')
        require(ax >= 0 and ay >= 0 and ax + w <= size[0] and ay + h <= size[1],
                'Destination rectangle outside sprite')
        require(layer.get('blend') in (None, 'over'), 'Unsupported artwork blend')
        crop = source.crop((x, y, x + w, y + h))
        if layer.get('blend') == 'over':
            result.alpha_composite(crop, (ax, ay))
        else:
            # No mask: replace RGBA, including transparent pixels.
            result.paste(crop, (ax, ay))
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
    for treatment, label in enumerate(['Pale tree base', 'Green-tinted tree base']):
        values = []
        for i, (key, palette) in enumerate(PALETTES):
            record_id = f'B{1 + i * 2 + treatment:02}'
            require(records[record_id]['proposed_fields']['palette']['value'] == key,
                    f'Tree patch grouping differs: {record_id}')
            values.append(variant(key, palette, [record_id], images[record_id]))
        patches.append(member(f'tree-patch-{treatment + 1}', treatment + 4, label, 'component',
                              [fact('Use', 'Cannot stand alone. Fits under the matching rounded canopy.'),
                               fact('Matches', f'The base shown on tree {treatment + 2}, in the selected palette.')], values))
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
                         'description': 'Matching left, center and right pieces. Corners and mixed-row joins remain untested.',
                         'variants': [variant('fixed', 'Original colors', keys, combine(values))]})
    # Exact source recipe accepted in chat, 2026-10-04 (probe commit 2cb786c).
    # Clip copies at the 256px interior frame, preserving phase and painter order.
    for i, record_id in enumerate(['F02', 'F05', 'F08']):
        sx, sy, width, height = images[record_id]['layers'][0]['rect']
        layers = []
        for row, phase in enumerate([0, 48, 16, 96, 32]):
            for x in range(-width + phase, 256, width):
                left, right = max(0, x), min(256, x + width)
                if left < right:
                    layers.append({'sheetId': 'me-complete',
                                   'rect': [sx + left - x, sy, right - left, height],
                                   'at': [left, row * 48], 'blend': 'over'})
        examples.append({'id': f'forest-fill-{i + 1}', 'label': f'Dense forest {i + 1}',
                         'description': 'Approved example. Overlapping rows use varied sideways offsets. Interior section; outer edges still need their own arrangement.',
                         'variants': [variant('fixed', 'Original colors', [record_id],
                                      {'size': [256, 4 * 48 + height], 'background': '#479757', 'layers': layers})]})
    return family('trees', 'Trees and forest', 'One rounded-canopy form, four palettes, three lower sections, and forest pieces.',
                  'Palette', PALETTES,
                  [fact('Identity', 'Species and seasons are unknown.'),
                   fact('Palettes', 'Four colors for the rounded trees and bases. Forest pieces keep their original colors.'),
                   fact('Ground', 'These forest examples share one grass green. Other terrain compatibility is unknown.'),
                   fact('Assembly', 'Centers repeat sideways. Dense rows overlap with varied offsets; outer edges and corners need review.'),
                   fact('Gameplay', 'Collision and height are unknown.')],
                  [group('whole', 'Complete trees', whole), group('patches', 'Tree bases', patches),
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


def build_seating(packet, images, sheets):
    rows = {row['id']: row for row in packet['candidates']}
    values = {}
    for key, row in rows.items():
        if row['masterOccurrences']:
            image = sprite('me-complete', row['masterOccurrences'][0]['rect'])
        else:
            require(key in ('E01-05', 'E01-06'), 'Unregistered original-only seating source')
            image = sprite(f'exteriors-bench-{int(key[-2:])}', row['exportRect'])
        require(image['size'] == row['exportRect'][2:], 'Seating source frame changed')
        check_pixels(image, row['normalizedRgbaSHA256'], images, key)
        for occurrence in row['masterOccurrences']:
            check_pixels(sprite('me-complete', occurrence['rect']), row['normalizedRgbaSHA256'], images, key)
        values[key] = variant('original', 'Original', [key], image)

    benches = [member(f'bench-{i}', i, rows[f'E01-{i:02}']['label'], 'whole',
                      [fact('Use', 'Complete bench; no connecting piece required.'),
                       fact('View', rows[f'E01-{i:02}']['fields']['facing']['value'])],
                      [values[f'E01-{i:02}']]) for i in range(1, 8)]
    colors = [('green', 'Green'), ('blue', 'Blue'), ('ochre', 'Ochre'), ('gray', 'Gray')]
    chairs = []
    for i, (label, records) in enumerate([
        ('Chair · brown frame', [8, 9, 10, 11]),
        ('Chair · gray frame', [12, 13, 14, 15]),
        ('Side chair · back on left', [18, 16, 19, 17]),
        ('Side chair · back on right', [22, 20, 23, 21]),
    ]):
        variants = [{**values[f'E01-{record:02}'], 'id': color, 'label': name}
                    for record, (color, name) in zip(records, colors)]
        chairs.append(member(f'chair-{i + 1}', i + 8, label, 'whole',
                             [fact('Use', 'Complete chair; no connecting piece required.'),
                              fact('Material', 'Patterned seat and back. Exact material and folding are unknown.')], variants))
    tables = [member(f'table-{i + 1}', i + 12,
                     ['Picnic table', 'Picnic table · set for a meal', 'Wide picnic table',
                      'Wide picnic table · food and serving items'][i], 'whole',
                     [fact('Form', 'Table and seating are one source image.'),
                      fact('Attachments', 'Separate tabletop items have not been established.')],
                     [values[f'E01-{i + 24:02}']]) for i in range(4)]
    return family('outdoor-seating', 'Outdoor seating',
                  'Slatted benches, camping chairs, and picnic tables.', 'Chair color', colors,
                  [fact('Use', 'These are proposed complete objects; none needs an adjoining piece.'),
                   fact('Variants', 'Chairs have four panel colors. Benches and tables keep their original colors.'),
                   fact('Views', 'Left and right describe the image, not a world direction.'),
                   fact('Gameplay', 'Collision, anchors and sitting positions are unknown.')],
                  [group('benches', 'Benches', benches), group('chairs', 'Camping chairs', chairs),
                   group('tables', 'Picnic tables', tables)], [], sheets)


def build_sofas(packet, images, sheets):
    records = {row['id']: row for row in packet['candidates']}
    sources = {row['id']: row for row in packet['sources']}
    pin = packet['pins']['packedIndex']
    require(sha((ROOT / pin['path']).read_bytes()) == pin['sha256'], 'Sofa packed index changed')
    index = {row['key']: row for row in load(ROOT / pin['path'])['entries']}
    variants = {}
    for key, row in records.items():
        alias = row['packedAlias']
        packed = index[alias['key']]
        require(packed['rect'] == alias['rect']
                and packed['sourcePath'] == sources[row['primarySourceId']]['path']
                and packed['sourceRect'] == row['exportRect'], f'Sofa packed lineage changed: {key}')
        image = sprite('modern-interiors', alias['rect'])
        check_pixels(image, row['normalizedRgbaSHA256'], images, key)
        variants[key] = variant(row['variant'], dict(SHADOWS)[row['variant']], [key], image)
    groups = {key: [] for key in ('whole', 'front', 'side', 'unknown')}
    joins = {'front-left-cap': 'Add a matching middle or right end on the right.',
             'front-repeat-middle': 'Connect matching pieces on both sides.',
             'front-right-cap': 'Add a matching middle or left end on the left.',
             'side-top-cap': 'Add a matching middle or bottom end below.',
             'side-repeat-middle': 'Connect matching pieces above and below.',
             'side-bottom-cap': 'Add a matching middle or top end above.'}
    names = {'front-left-cap': 'left end', 'front-repeat-middle': 'middle',
             'front-right-cap': 'right end', 'side-top-cap': 'top end',
             'side-repeat-middle': 'middle', 'side-bottom-cap': 'bottom end'}
    for row in packet['candidates'][:18]:
        key = row['id']
        number = int(key.split('-')[1])
        role = row['fields']['role']['value']
        color = 'Blue-gray' if row['vendorIndex'] < 10 else 'Pale gray'
        values = [variants[key]]
        facts, question = [], None
        if role in joins:
            kind = 'component'
            group_id = 'front' if role.startswith('front') else 'side'
            label = f'{color} {names[role]}'
            facts = [fact('Use', 'Cannot stand alone.'), fact('Join', joins[role])]
            if group_id == 'side':
                side = 'right' if row['vendorIndex'] < 30 else 'left'
                label = f'{names[role].capitalize()} · rail on {side}'
                facts.append(fact('View', f'The raised rail is on the {side} of the image.'))
            if key == 'I01-01':
                values += [variants['I01-19'], variants['I01-20']]
                facts.append(fact('Shadows', 'This end also has dark and shadowless versions. Matching neighbors for those versions are not included here.'))
        elif row['topology']['standaloneEligibility'].startswith('allowed'):
            kind, group_id, label = 'whole', 'whole', f'{color} small seat'
            facts = [fact('Form', 'Appears complete; its exact use is uncertain.')]
            question = 'An ottoman or a low seat?'
        else:
            kind, group_id, label = 'unknown', 'unknown', f'{color} long seat'
            facts = [fact('Use', 'Whether this can stand alone is unknown.'),
                     fact('Join', 'No joining rule established yet.')]
            question = 'A separate backless seat, or an extension for a sofa?'
        groups[group_id].append(member(key, number, label, kind, facts, values, question))
    example_names = {
        'blue-front-closed': 'Blue-gray sofa', 'gray-front-closed': 'Pale gray sofa',
        'blue-front-short': 'Short blue-gray sofa', 'blue-front-repeated-middle': 'Wider blue-gray sofa',
        'gray-side-right-short': 'Short side sofa · right rail',
        'gray-side-right-extended': 'Long side sofa · right rail',
        'gray-side-right-repeated': 'Longer side sofa · right rail',
        'gray-side-left-short': 'Short side sofa · left rail',
        'gray-side-left-extended': 'Long side sofa · left rail'}
    examples = []
    for probe in packet['assemblyExperiments']:
        if probe['topologyDisposition'] != 'proposed-valid':
            continue
        layers = []
        for placement in probe['placements']:
            rect = records[placement['memberId']]['packedAlias']['rect']
            x, y, w, h = placement['sourceRect']
            require(x >= 0 and y >= 0 and x + w <= rect[2] and y + h <= rect[3], 'Sofa probe crop exceeds member')
            layers.append({'sheetId': 'modern-interiors', 'rect': [rect[0] + x, rect[1] + y, w, h],
                           'at': placement['targetOffset']})
        image = {'size': probe['size'], 'layers': layers}
        check_pixels(image, probe['outputNormalizedRgbaSHA256'], images, probe['id'])
        examples.append({'id': probe['id'], 'label': example_names[probe['id']],
                         'description': 'Matching ends close the shape. Original texture bands remain visible.',
                         'variants': [variant('normal', 'Normal',
                            [p['memberId'] for p in probe['placements']], image)]})
    require(len(examples) == 9, 'Sofa positive probe coverage changed')
    return family('sofas', 'Sofas and seats', 'Small seats, sofa pieces, and examples of how they fit together.',
                  'Shadow', [('normal', 'Normal')],
                  [fact('Assembly', 'Keep the same color, view and shadow style. Middles need an end at each side.'),
                   fact('Examples', 'Nine tested arrangements with normal shadows; longer combinations still need visual review.'),
                   fact('Gameplay', 'Collision, anchors and sitting positions are unknown.')],
                  [group('whole', 'Complete small seats', groups['whole']),
                   group('front', 'Front sofa pieces', groups['front'], 'These pieces need matching neighbors.'),
                   group('side', 'Side sofa pieces', groups['side'], 'Top ends are taller than middles and bottom ends.'),
                   group('unknown', 'Seats or extensions?', groups['unknown'], 'These four roles are still uncertain.')],
                  examples, sheets)


def build():
    for name, expected in PINS.items():
        require(sha((PACKETS / name).read_bytes()) == expected, f'Pinned proposal/review changed: {name}')
    trees = load(PACKETS / 'P01-trees.json')
    scrapyard = load(PACKETS / 'P02-scrapyard.json')
    cabinets = load(PACKETS / 'P03-cabinets.json')
    seating = load(PACKETS / 'E01-outdoor-seating.json')
    sofas = load(PACKETS / 'I01-interior-sofas.json')
    topology = load(PACKETS / 'P03-cabinets-topology.json')
    require(topology['baseProposal']['sha256'] == PINS['P03-cabinets.json'], 'Topology base proposal mismatch')
    require(topology['evidence']['agentEvidence']['reviewSha256'] == PINS['P03-cabinets-review.md'],
            'Topology review mismatch')
    sheets = {row['id']: row for row in load(ROOT / 'public/data/art-catalog.json')['sheets']}
    sources = [sheets[key] for key in ('me-complete', 'modern-interiors', 'exteriors-bench-5', 'exteriors-bench-6',
                                      'interiors-door-1', 'interiors-door-1-locked')]
    pins = {'me-complete': trees['source']['sha256'],
            'modern-interiors': cabinets['measurements']['sources']['packedAtlas']['sha256'],
            'exteriors-bench-5': 'a20540ddc069f247d4ea6550deba55d4e69a44d3e57a0636d04b155ad08c33fa',
            'exteriors-bench-6': 'a009c6d2666cf55b4f05a1b8307f84d147f3434aba2ccfc956ce7a46ee63f74f',
            'interiors-door-1': 'dd13493877176653200007256b6a2c48feb7f3433ef5ce39a6050e9276769165',
            'interiors-door-1-locked': 'dcb3a071c0a5489056f9d83bbdf212eda8902f6067bba1ab5e2011481c9b50a9'}
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
                build_scrapyard(scrapyard, images, sheets), build_seating(seating, images, sheets),
                build_sofas(sofas, images, sheets)]
    spec = importlib.util.spec_from_file_location('family_expansion', ROOT / 'scripts/build-family-expansion.py')
    expansion = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(expansion)
    families.extend(expansion.build_expansion(SimpleNamespace(**globals()), images, sheets))
    spec = importlib.util.spec_from_file_location('family_next', ROOT / 'scripts/build-family-next.py')
    next_adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(next_adapter)
    families.extend(next_adapter.build_next(SimpleNamespace(**globals()), images, sheets))
    expected = {'cabinets': [row['id'] for row in cabinets['measurements']['records']],
                'trees': [row['id'] for row in trees['candidates']],
                'scrapyard': [row['id'] for row in scrapyard['candidates']],
                'outdoor-seating': [row['id'] for row in seating['candidates']],
                'sofas': [row['id'] for row in sofas['candidates']]}
    for family_id, packet_file in [('room-builder', 'RB01-room-builder-path-arch.json'),
                                   ('playground-tubes', 'E03-playground-tubes.json'),
                                   ('animated-doors', 'A01-animation.json'),
                                   ('plants-planters', 'E04-plants-planters.json'),
                                   ('bedroom', 'I02-bedroom.json'),
                                   ('fences-gates', 'E05-fences-gates.json')]:
        expected[family_id] = [row['id'] for row in load(PACKETS / packet_file)['candidates']]
    for item in families:
        records = [r for g in item['groups'] for m in g['members'] for v in m['variants'] for r in v['recordIds']]
        require(Counter(records) == Counter(expected[item['id']]), f"Incomplete or duplicated coverage: {item['id']}")
        for entry in [m for g in item['groups'] for m in g['members']] + item['examples']:
            for value in entry['variants']:
                render(value['sprite'], images)
    require(sum(map(len, expected.values())) == 255, 'Unexpected source record count')
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
        cards = [m for f in result['families'] for g in f['groups'] for m in g['members']]
        records = [r for m in cards for v in m['variants'] for r in v['recordIds']]
        print(f"Family sheets {'verified' if args.check else 'generated'}: {len(result['families'])} families, {len(cards)} cards, {len(records)} source records.")
    except (ValueError, KeyError, OSError, StopIteration) as error:
        print(f'Family sheets failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
