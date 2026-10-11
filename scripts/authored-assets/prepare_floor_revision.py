"""Prepare a new floor-only revision from a pinned retained vehicle scene."""
import argparse
from pathlib import Path
import shutil
import subprocess

from inspect_vehicle import inspect
from pipeline import HERE, ROOT, bake, digest, evaluate, read, write


def prepare(vehicle, config_path, output, blender):
    config = read(config_path)
    if config['schema'] != 'tilefun-vehicle-floor-revisions-v1' or config['margin'] != .75:
        raise ValueError('Unknown floor revision configuration')
    record = config['vehicles'][vehicle]
    source = ROOT / record['source']
    if digest(source / 'car.blend') != record['sceneSha256']:
        raise ValueError('Retained base scene changed')
    output.mkdir()
    for name in ['car-atlas.png', 'family-config.json', 'rig.json', 'paint-ownership.json', 'lights.json', 'recipe.json']:
        shutil.copyfile(source / name, output / name)
    shutil.copytree(source / 'refs', output / 'refs')
    recipe = read(output / 'recipe.json')
    recipe['source']['image'] = str((ROOT / recipe['source']['image']).resolve())
    recipe['workingBlend'] = 'car.blend'
    with (output / 'floor-edit.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', '--python-exit-code', '1',
                        '--python', str(HERE / 'open_retained_floor.py'), '--',
                        str(source / 'car.blend'), str(output / 'car.blend')],
                       check=True, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    recipe['template'] = {'path': str(output / 'car.blend'), 'sha256': digest(output / 'car.blend')}
    write(output / 'recipe.json', recipe)
    revision = read(output / 'floor-revision.json')
    revision['sourceSceneSha256'] = record['sceneSha256']
    revision['sourceBundle'] = record['source']
    write(output / 'floor-revision.json', revision)
    write(output / 'wheel-alignment.json', {
        'status': 'Original source cameras, wheel centers and cap paint unchanged',
        'scope': 'Floor revision; actual exported whole-body neutral-roll qualification required'})
    bake(output / 'recipe.json', output / 'car.blend', blender, output / 'projection-001')
    evaluate(output / 'recipe.json', output / 'car.blend', blender, output / 'render-001', output / 'car-atlas.png')
    inspect(output / 'render-001', output / 'inspection-001')
    with (output / 'pack-draft.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', str(output / 'render-001/asset.blend'),
                        '--python-exit-code', '1', '--python', str(HERE / 'pack_draft.py'), '--',
                        str(output / 'projection-001/projection-draft.png'), str(output / 'final.blend')],
                       check=True, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
    print('Prepared exact floor revision', vehicle)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vehicle', required=True)
    for key in ['config', 'out', 'blender']:
        parser.add_argument('--' + key, type=Path, required=True)
    args = parser.parse_args()
    prepare(args.vehicle, args.config.resolve(), args.out.resolve(), args.blender.resolve())
