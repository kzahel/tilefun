#!/usr/bin/env python3
"""Explicit source-only RB01/E03/A01 family adapters; no original packs needed.

The caller supplies the build-family-sheets helper module, committed RGBA images,
and source-art records. Frozen proposal/review pins are outside browsing metadata.
"""
from collections import Counter
import json

PINS = {
    'RB01-room-builder-path-arch.json': '88f2ebcf7f7509e3da1337f9e1bd2dde087f6b342e245f478fb94ddc07b2b6c4',
    'RB01-room-builder-path-arch-review.md': '31461d71cb25c1fa5eb9c4287dc2df4f2ca491a6e26367a21d69153f22821601',
    'E03-playground-tubes.json': '4370a63a1308b9ccc844029bfe077bb304faac2e62826923c3ba5a685508143e',
    'E03-playground-tubes-review.md': 'ab901c1a2859661332b15187060a3c38d3ad1e7d04ed69656128e83f49f8df88',
    'A01-animation.json': 'f0e5f627c4e8fe27c5de9c83c5b2ba98d60f273fd7361be07a914563a49e9f0c',
    'A01-animation-review.md': '7ee15c2663c88f4e7aded23d9f8023b8fc0203264f77527617fbd265fbfe9dce',
}
COLORS = [('ochre', 'Ochre'), ('blue', 'Blue'), ('red', 'Red')]
ORIGINAL = [('original', 'Original')]
ROOM_LABELS = {
    'RB01-P10': 'Narrow horizontal section',
    'RB01-P11': 'Downward junction · left half',
    'RB01-P12': 'Outer right bend',
    'RB01-P13': 'Downward junction · right half',
}
TUBE_LABELS = [
    'Upper-left bend', 'Horizontal straight section', 'Upper-right bend',
    'Vertical straight section', 'Lower-right bend', 'Horizontal straight section',
    'Lower-left bend', 'Vertical straight section · alternate shading',
    'Down-facing entrance', 'Down-facing entrance · alternate shading',
    'Horizontal tube with down-facing entrance', 'Round-topped vertical end',
    'Horizontal tube with upper opening', 'Horizontal tube with rounded upper branch',
    'Cross-shaped tube with two entrances', 'Right-facing side entrance',
    'Left-facing side entrance', 'Horizontal section with right rim', 'Horizontal section with left rim',
]
RB_EXAMPLES = [
    ('inset-square-native', 'Small inset square'),
    ('shaded-vertical-0-middle-rows', 'Short capped floor strip'),
    ('shaded-vertical-1-middle-rows', 'Capped floor strip'),
    ('shaded-vertical-2-middle-rows', 'Long capped floor strip'),
    ('stone-arch-body-three-rows', 'Stone arch'),
    ('stone-arch-with-shadow', 'Stone arch with ground shadow'),
    ('L-continuation-window', 'L-shaped path section'),
    ('T-continuation-window', 'T-shaped path section'),
]
TUBE_EXAMPLES = [
    ('straight-two-mouths', 'Straight tube with two mouths', 'ochre'),
    ('cross-four-mouths-ochre', 'Four-mouth crossing · ochre', 'ochre'),
    ('u-two-mouths', 'U-shaped tube with two mouths', 'ochre'),
    ('cross-four-mouths-blue', 'Four-mouth crossing · blue', 'blue'),
    ('cross-four-mouths-red', 'Four-mouth crossing · red', 'red'),
]


def verify_public_source(a, source, sheet_id, images, sheets):
    """Pin exact file bytes and dimensions, independently of caller setup."""
    sheet = sheets[sheet_id]
    path = a.ROOT / 'public' / sheet['image']
    a.require(path.resolve().is_relative_to((a.ROOT / 'public').resolve()), 'Source outside public assets')
    expected = source.get('pngSHA256', source.get('fileSHA256'))
    a.require(a.sha(path.read_bytes()) == sheet['fingerprint'] == expected,
              f'Expansion public source changed: {sheet_id}')
    dimensions = source.get('size', source.get('dimensions'))
    a.require(dimensions == [sheet['width'], sheet['height']] == list(images[sheet_id].size),
              f'Expansion source dimensions changed: {sheet_id}')
    a.require(a.sha(a.normalized_bytes(images[sheet_id])) == source['normalizedRgbaSHA256'],
              f'Expansion source pixels changed: {sheet_id}')


def verify_record(a, row, image, images, frame_key):
    a.require(image['size'] == row[frame_key][2:], f"Frame bounds changed: {row['id']}")
    a.check_pixels(image, row['normalizedRgbaSHA256'], images, row['id'])
    bounds = a.render(image, images).getbbox()
    visible = [bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]] if bounds else None
    a.require(visible == row['alphaVisibleRect'], f"Alpha bounds changed: {row['id']}")


def assemble(a, placements, values, size, offset_key, crop_key=None, blend=None):
    layers = []
    records = []
    for placement in placements:
        key = placement['memberId']
        source = values[key]['sprite']
        a.require(len(source['layers']) == 1, f'Assembly member has multiple sources: {key}')
        layer = source['layers'][0]
        rect = list(layer['rect'])
        if crop_key:
            x, y, w, h = placement[crop_key]
            a.require(x >= 0 and y >= 0 and w > 0 and h > 0 and
                      x + w <= source['size'][0] and y + h <= source['size'][1],
                      f'Local assembly crop outside member: {key}')
            rect = [rect[0] + x, rect[1] + y, w, h]
        output = {'sheetId': layer['sheetId'], 'rect': rect, 'at': placement[offset_key]}
        if blend:
            output['blend'] = blend
        layers.append(output)
        records.extend(values[key]['recordIds'])
    return {'size': size, 'layers': layers}, records


def build_room_builder(a, packet, images, sheets):
    sources = {row['id']: row for row in packet['sources']}
    packed_source = next(row for row in sources.values() if row['path'].endswith('modern-interiors-atlas.png'))
    verify_public_source(a, packed_source, 'modern-interiors', images, sheets)
    index = {row['key']: row for row in a.load(a.ROOT / packet['pins']['packedIndex']['path'])['entries']}
    values = {}
    for row in packet['candidates']:
        aliases = row['packedTileAliases'] + row['packedSheetOffsetAliases']
        a.require(aliases, f"Room Builder member lacks packed lineage: {row['id']}")
        for alias in aliases:
            a.require(alias['exactVerified'] and alias['sourceId'] == packed_source['id'],
                      'Room Builder alias not verified against committed packed source')
            original = sources[alias['originalSourceId']]
            entry = index[alias.get('key', alias.get('sheetKey'))]
            a.require(entry['sourcePath'] == original['path'], f"Packed source lineage changed: {row['id']}")
            if 'key' in alias:
                a.require(entry['rect'] == alias['rect'] and entry['sourceRect'] == alias['originalSourceRect'],
                          f"Packed tile coordinates changed: {row['id']}")
            else:
                x, y, w, h = alias['originalSourceRect']
                ex, ey, ew, eh = entry['rect']
                sx, sy, sw, sh = entry['sourceRect']
                a.require([ew, eh] == [sw, sh] and x >= sx and y >= sy and
                          x + w <= sx + sw and y + h <= sy + sh and
                          alias['rect'] == [ex + x - sx, ey + y - sy, w, h],
                          f"Packed sheet offset lineage changed: {row['id']}")
            a.check_pixels(a.sprite('modern-interiors', alias['rect']), row['normalizedRgbaSHA256'], images, row['id'])
        chosen = next(alias for alias in aliases if alias['originalSourceId'] == row['primarySourceId']
                      and alias['originalSourceRect'] == row['sourceRect'])
        image = a.sprite('modern-interiors', chosen['rect'])
        verify_record(a, row, image, images, 'sourceRect')
        a.require(row['topology']['standaloneEligibility'].startswith('forbidden'), 'Room Builder standalone rule changed')
        values[row['id']] = a.variant('original', 'Original', [row['id']], image)
    floors, body, shadows = [], [], []
    for number, row in enumerate(packet['candidates'], 1):
        key = row['id']
        is_floor = key.startswith('RB01-P')
        is_shadow = key in ('RB01-A07', 'RB01-A08')
        facts = [a.fact('Use', 'Cannot stand alone; combine with matching pieces.')]
        if is_floor:
            facts.append(a.fact('Join', 'Only the arrangements shown below have been checked.'))
        elif is_shadow:
            facts.append(a.fact('Join', 'Optional strip below the matching lower arch pier.'))
        else:
            facts.append(a.fact('Join', 'Six body pieces make a fixed two-column, three-row arch.'))
        card = a.member(key, number, ROOM_LABELS.get(key, row['fields']['identity']['value'].capitalize()), 'component', facts, [values[key]])
        (floors if is_floor else shadows if is_shadow else body).append(card)
    experiments = {row['id']: row for row in packet['assemblyExperiments']}
    examples = []
    for key, label in RB_EXAMPLES:
        experiment = experiments[key]
        is_open = key in ('L-continuation-window', 'T-continuation-window')
        a.require(experiment['topologyDisposition'].startswith('proposed-valid-') and
                  bool(experiment['explicitContinuationBoundaryPorts']) == is_open,
                  f'Room Builder example disposition changed: {key}')
        recipe = experiment['renderRecipe']
        a.require(a.sha(json.dumps(recipe, sort_keys=True, separators=(',', ':')).encode()) ==
                  experiment['renderRecipeSHA256'], f'Room Builder recipe changed: {key}')
        image, records = assemble(a, recipe['placements'], values, recipe['size'], 'targetOffset', 'sourceRect')
        a.check_pixels(image, experiment['outputNormalizedRgbaSHA256'], images, key)
        description = ('Open cuts at the boundary need continuing path pieces; this is a section of a network.' if is_open else
                       'A bounded source arrangement; further extension is unproven.' if key.startswith('shaded-') else
                       'Fixed 32 × 48 body, with two optional shadow strips below.' if key == 'stone-arch-with-shadow' else
                       'Fixed 32 × 48 body; width and height repetition are unproven.' if key == 'stone-arch-body-three-rows' else
                       'The small closed source motif; larger inset extensions remain unresolved.')
        example = {'id': key, 'label': label, 'description': description,
                   'variants': [a.variant('original', 'Original', records, image)]}
        if is_open:
            example['groupLabel'] = 'Open path sections'
        examples.append(example)
    a.require([len(floors), len(body), len(shadows)] == [17, 6, 2], 'Room Builder card count changed')
    return a.family('room-builder', 'Floors and stone arches', 'Pale floor pieces and a fixed stone arch.',
                    'Appearance', ORIGINAL,
                    [a.fact('Assembly', 'These are pieces to combine, not separate whole objects.'),
                     a.fact('Arch', 'Six body pieces; ground shadow is optional. Source shadows differ from the master.'),
                     a.fact('Limits', 'Only the shown arrangements are supported. Other joins and larger inset floors are unknown.'),
                     a.fact('Gameplay', 'Walkability, collision, arch height and clearance are unknown.')],
                    [a.group('floors', 'Floor pieces', floors), a.group('arch-body', 'Stone arch body', body),
                     a.group('arch-shadow', 'Optional ground shadow', shadows)], examples, sheets)


def build_tubes(a, packet, images, sheets):
    sources = {row['id']: row for row in packet['sources']}
    master = next(row for row in sources.values() if row['path'].endswith('me-complete.png'))
    verify_public_source(a, master, 'me-complete', images, sheets)
    legacy = a.load(a.ROOT / packet['pins']['legacyIndex']['path'])['themes']
    values = {}
    rows = {row['id']: row for row in packet['candidates']}
    for key, row in rows.items():
        rendering = row['committedRendering']
        a.require(rendering['sourceId'] == master['id'] and row['masterOccurrences'], 'Tube master lineage changed')
        alias = row['legacyIndexAlias']
        a.require(legacy[alias['theme']][alias['key']] == alias['rect'] == rendering['rect'],
                  f'Tube legacy index lineage changed: {key}')
        a.require(alias['key'] == row['sourceKey']['key'], f'Tube source key changed: {key}')
        for occurrence in row['masterOccurrences']:
            a.check_pixels(a.sprite('me-complete', occurrence['rect']), row['normalizedRgbaSHA256'], images, key)
        image = a.sprite('me-complete', rendering['rect'])
        verify_record(a, row, image, images, 'exportRect')
        a.require(row['topology']['standaloneEligibility'] == 'forbidden', 'Tube standalone rule changed')
        color = ['ochre', 'blue', 'red'][int(row['sourceKey']['key'].split('_')[-2]) - 1]
        values[key] = a.variant(color, dict(COLORS)[color], [key], image)
    members = []
    for number in range(1, 20):
        key = f'E03-{number:02}'
        row = rows[key]
        variants = [values[key]]
        if number in (15, 16, 17):
            variants.extend([values[f'E03-{number + 5:02}'], values[f'E03-{number + 8:02}']])
        neighbors = row['topology']['requiredNeighbors']
        facts = [a.fact('Use', 'Cannot stand alone.'),
                 a.fact('Join', 'Needs another piece on the ' + ' and '.join(neighbors) + '.'),
                 a.fact('Padding', 'Joins follow the tube body; transparent padding and overlapping shadows stay intact.')]
        if number in (12, 14):
            facts.append(a.fact('Unknown', 'The rounded area may be a closed end or a hidden mouth.'))
        if number in (18, 19):
            facts.append(a.fact('Unknown', 'The rim’s purpose and compatible joins are unknown.'))
        if number == 6:
            facts.append(a.fact('Pixels', 'Same pixels as horizontal straight section 2; both source names are retained.'))
        if number in (8, 10):
            facts.append(a.fact('Pixels', 'Subtle shading differs from the similar-looking counterpart.'))
        members.append(a.member(key, number, TUBE_LABELS[number - 1], 'component', facts, variants))
    experiments = {row['id']: row for row in packet['experiments']['assemblies']}
    examples = []
    for key, label, color in TUBE_EXAMPLES:
        experiment = experiments[key]
        a.require(experiment['topologyValidity'] == 'valid' and not experiment['portEvaluation']['unmatchedPorts'],
                  f'Tube example has an unmatched continuation cut: {key}')
        a.require(experiment['operation'] == 'Pillow RGBA alpha_composite in listed order; native pixels, no scaling',
                  f'Tube composition operation changed: {key}')
        image, records = assemble(a, experiment['placements'], values, experiment['size'], 'offsetXY', blend='over')
        a.check_pixels(image, experiment['normalizedRgbaSHA256'], images, key)
        examples.append({'id': key, 'label': label,
                         'description': 'Every continuation cut has a neighbor. Visible mouths stay at the outside; traversal is unknown.',
                         'variants': [a.variant(color, dict(COLORS)[color], records, image)]})
    return a.family('playground-tubes', 'Playground tubes', 'Bends, straight sections and entrance mouths to combine.',
                    'Color', COLORS,
                    [a.fact('Join', 'Continuation cuts need neighbors; entrance mouths are different.'),
                     a.fact('Variants', 'Only the crossing and two side entrances have blue and red variants. Other pieces stay ochre.'),
                     a.fact('Limits', 'Only the pictured same-color joins are checked; arbitrary color mixing is unproven.'),
                     a.fact('Gameplay', 'Traversal, collision, anchors and climbing are unknown.')],
                    [a.group('pieces', 'Pieces to combine', members)], examples, sheets)


def build_doors(a, packet, images, sheets):
    sources = {row['id']: row for row in packet['sources']}
    rows = {row['id']: row for row in packet['candidates']}
    demonstrations = {row['id']: row for row in packet['sourceGifDemonstrations']}
    cards, examples = [], []
    for number, (sequence, sheet_id, label) in enumerate(zip(packet['sequences'],
            ['interiors-door-1', 'interiors-door-1-locked'], ['Door opening frames', 'Locked-door attempt frames']), 1):
        records = sequence['memberRecords']
        source_id = rows[records[0]]['sourceStrip']
        source = sources[source_id]
        verify_public_source(a, source, sheet_id, images, sheets)
        a.require(sequence['proposedPlaybackOrder'] == records, 'Door source order changed')
        a.require(not packet['topology']['sourceFramesAreAssemblyParts'], 'Animation frames became spatial assembly parts')
        a.require(all(value is None for value in sequence['gameplayPlayback'].values()), 'Unknown door game playback changed')
        variants = []
        for index, key in enumerate(records):
            row = rows[key]
            a.require(row['sourceStrip'] == source_id and row['sourceFrameIndex'] == index and
                      row['sourceRect'] == [index * 16, 0, 16, 32] and row['frameDimensions'] == [16, 32] and
                      not row['packedOccurrences'] and not row['namedExportAliases'], 'Door frame lineage changed')
            image = a.sprite(sheet_id, row['sourceRect'])
            verify_record(a, row, image, images, 'sourceRect')
            variants.append(a.variant(f'frame-{index + 1}', f'Frame {index + 1}', [key], image))
        gif = demonstrations[sequence['companionGifEvidence']]
        a.require(gif['decodedFrameCount'] == len(variants) == len(gif['frames']) and
                  gif['frameDimensions'] == [16, 32] and gif['loopExtension'] == 0,
                  'Door GIF demonstration frame/loop evidence changed')
        durations = []
        for index, (key, frame) in enumerate(zip(records, gif['frames'])):
            a.require(frame['decodedFrameIndex'] == index and frame['exactSourceFrameIds'] == [key] and
                      frame['deltaToSameIndexPngFrame']['changedPixels'] == 0 and
                      frame['normalizedRgbaSHA256'] == rows[key]['normalizedRgbaSHA256'] and
                      type(frame['durationMs']) is int and frame['durationMs'] > 0,
                      'Door GIF demonstration correspondence changed')
            a.check_pixels(variants[index]['sprite'], frame['normalizedRgbaSHA256'], images, f'GIF demonstration {key}')
            durations.append(frame['durationMs'])
        a.require(sum(durations) == gif['demonstrationCycleDurationMs'], 'GIF demonstration duration changed')
        card = a.member(sequence['id'], number, label, 'frame',
                        [a.fact('Form', 'Frames of one source strip; these are not spatial assembly pieces.'),
                         a.fact('Use', 'Standalone placement is unknown; the frames grant no placement permission.'),
                         a.fact('Playback', 'Source order and companion GIF timing are demonstration evidence only.')], variants)
        if number == 2:
            card['facts'].insert(0, a.fact('Interpretation', 'Likely a failed opening attempt: the panel shifts but stays closed. The source is named locked.'))
        card['variantLabel'] = 'Frame'
        cards.append(card)
        examples.append({'id': sequence['id'] + '-demonstration',
                         'groupLabel': 'Source demonstrations',
                         'label': 'Door opening demonstration' if number == 1 else 'Locked-door attempt demonstration',
                         'description': 'Repeats the companion GIF in source order. Game timing, triggers and lock mechanics are unknown.' +
                                        (' The reset to closed is not a closing sequence.' if number == 1 else ' Press Play to see the closed panel rattle; a failed opening attempt is the proposed interpretation.'),
                         'variants': variants, 'animation': {'frameDurationsMs': durations, 'loop': True}})
    return a.family('animated-doors', 'Animated doors', 'Two source strips of the same brown door.',
                    'Frame', [('frame-1', 'Frame 1')],
                    [a.fact('Frames', 'Five opening frames and four possible locked-door attempt frames; the closed first frame is shared.'),
                     a.fact('Playback', 'Examples replay the companion GIF demonstrations. Game playback is unknown.'),
                     a.fact('Gameplay', 'Placement, collision, opening triggers, reverse closing and lock mechanics are unknown.')],
                    [a.group('strips', 'Source frame strips', cards)], examples, sheets)


def build_expansion(adapter, images, sheets):
    """Return exactly three FamilySheet dictionaries after checking all evidence."""
    a = adapter
    for name, expected in PINS.items():
        a.require(a.sha((a.PACKETS / name).read_bytes()) == expected, f'Pinned expansion proposal/review changed: {name}')
    packets = [a.load(a.PACKETS / name) for name in
               ('RB01-room-builder-path-arch.json', 'E03-playground-tubes.json', 'A01-animation.json')]
    for packet in packets:
        for pin in packet['pins'].values():
            a.require(a.sha((a.ROOT / pin['path']).read_bytes()) == pin['sha256'], f"Expansion input pin changed: {pin['path']}")
    result = [builder(a, packet, images, sheets) for builder, packet in
              zip((build_room_builder, build_tubes, build_doors), packets)]
    for item, packet, count in zip(result, packets, (25, 19, 2)):
        cards = [member for group in item['groups'] for member in group['members']]
        ids = [key for card in cards for value in card['variants'] for key in value['recordIds']]
        a.require(len(cards) == count and Counter(ids) == Counter(row['id'] for row in packet['candidates']),
                  f"Incomplete or duplicated expansion coverage: {item['id']}")
    return result
