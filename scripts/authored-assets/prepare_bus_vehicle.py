"""Prepare a fresh bus-family checkpoint with own draft and packed scene."""
import argparse
from pathlib import Path
import subprocess

from author_bus_vehicle import author
from inspect_vehicle import inspect
from pipeline import HERE, ROOT, bake, evaluate


def prepare(vehicle, config, output, blender):
    author(vehicle, config, output, blender)
    recipe = output / 'recipe.json'
    blend = output / 'car.blend'
    bake(recipe, blend, blender, output / 'projection-001')
    evaluate(recipe, blend, blender, output / 'render-001', output / 'car-atlas.png')
    inspect(output / 'render-001', output / 'inspection-001')
    with (output / 'pack-draft.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', str(output / 'render-001/asset.blend'),
                        '--python-exit-code', '1', '--python', str(HERE / 'pack_draft.py'), '--',
                        str(output / 'projection-001/projection-draft.png'), str(output / 'final.blend')],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    print('Prepared own family checkpoint:', vehicle, output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['config', 'out', 'blender']:
        parser.add_argument('--'+key, type=Path, required=True)
    parser.add_argument('--vehicle', required=True)
    args = parser.parse_args()
    prepare(args.vehicle, args.config.resolve(), args.out.resolve(), args.blender.resolve())
