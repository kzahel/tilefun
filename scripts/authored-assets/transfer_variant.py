"""Transfer a fitted family atlas only after exact sprite correspondence checks."""
import argparse
from collections import Counter
from pathlib import Path

from PIL import Image

from pipeline import ROOT, digest, initialize, read, vehicle_spec, write


def correspondences(template, target, image):
    mapping, checks = {}, []
    for source, variant in zip(template['views'], target['views']):
        if source['id'] != variant['id']:
            raise ValueError('Source directions differ.')
        for key in ['anchor', 'footprint', 'colliders', 'depthOffset']:
            if source['metadata'].get(key) != variant['metadata'].get(key):
                raise ValueError(f"{source['id']}: {key} differs; fit a new family template.")
        crops = []
        for view in [source, variant]:
            x, y, w, h = view['rect']
            crops.append(image.crop((x, y, x+w, y+h)))
        a, b = crops
        if a.size != b.size or a.getchannel('A').tobytes() != b.getchannel('A').tobytes():
            raise ValueError(f"{source['id']}: silhouette differs; fit geometry/cameras first.")
        opaque = 0
        for before, after in zip(a.get_flattened_data(), b.get_flattened_data()):
            if not before[3]:
                continue
            opaque += 1
            if before in mapping and mapping[before] != after:
                raise ValueError(f"{source['id']}: inconsistent palette correspondence for {before}; author a separate texture recipe.")
            mapping[before] = after
        checks.append({'view': source['id'], 'identicalAlpha': True, 'identicalPhysicalMetadata': True,
                       'opaqueSourcePixels': opaque})
    return mapping, checks


def transfer(vehicle, config_path, output):
    if output.exists():
        raise FileExistsError('Choose a new variant workspace.')
    config = read(config_path)
    if vehicle not in config['vehicles']:
        raise ValueError('Vehicle is outside this configured family; author and fit a new template.')
    template, target = vehicle_spec(config['templateVehicle']), vehicle_spec(vehicle)
    source = ROOT / target['source']['image']
    if digest(source) != target['source']['sha256']:
        raise ValueError('Source bank changed.')
    blend, atlas_path = ROOT / config['blend'], ROOT / config['atlas']
    for path in [blend, atlas_path, ROOT / config['windshield'], ROOT / config['rig']]:
        if not path.is_file():
            raise FileNotFoundError(
                f'Local template input is missing: {path}. Restore the pinned ignored '
                'template bundle or author a new template; see scripts/authored-assets/README.md.')
    for path, pin in [(blend, config['blendSha256']), (atlas_path, config['atlasSha256'])]:
        if digest(path) != pin:
            raise ValueError(f'Template bytes changed: {path.name}')
    mapping, checks = correspondences(template, target, Image.open(source).convert('RGBA'))
    observed_mapping = dict(mapping)
    for policy in config['authoredColors']:
        before = (*policy['rgb'], 255)
        if before in mapping:
            raise ValueError('Authored colour policy collides with an observed colour.')
        mapping[before] = before if policy.get('keep') else observed_mapping[(*policy['sourceRgb'], 255)]
    atlas = Image.open(atlas_path).convert('RGBA')
    histogram = Counter(atlas.get_flattened_data())
    unknown = [color for color in histogram if color not in mapping and color[3]]
    if unknown:
        raise ValueError(f'Assign explicit material roles to remaining authored colours: {unknown}')
    replacement = Image.new('RGBA', atlas.size)
    replacement.putdata([mapping.get(color, color) for color in atlas.get_flattened_data()])
    if replacement.getchannel('A').tobytes() != atlas.getchannel('A').tobytes():
        raise ValueError('Palette transfer changed atlas alpha.')
    setup = read(ROOT / config['setup'])
    setup['blend'] = config['blend']
    setup['note'] = 'Palette variant of the fitted v7 compact; four exact source correspondence checks passed. Unreviewed.'
    initialize(target, output, setup)
    initialize(template, output / 'template-refs')
    replacement.save(output / 'atlas.png')
    write(output / 'transfer.json', {
        'vehicle': vehicle, 'templateVehicle': config['templateVehicle'], 'checks': checks,
        'configSha256': digest(config_path), 'templateBlendSha256': digest(blend),
        'templateAtlasSha256': digest(atlas_path), 'atlasSha256': digest(output / 'atlas.png'),
        'sourceFingerprint': target['source']['sha256'],
        'observedPalette': [{'from': a, 'to': b} for a, b in observed_mapping.items()],
        'authoredColorPolicies': config['authoredColors'],
        'changedAtlasTexels': sum(count for color, count in histogram.items() if mapping.get(color, color) != color),
        'status': 'Authored family texture transfer; hidden surfaces inherited, observation coverage unchanged; unreviewed'})
    print(f'Four-view correspondence verified; variant workspace: {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vehicle', required=True)
    parser.add_argument('--template', type=Path, default=Path(__file__).with_name('compact-variant-template.json'))
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    transfer(args.vehicle, args.template.resolve(), args.out.resolve())
