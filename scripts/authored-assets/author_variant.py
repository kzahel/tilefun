"""Repeat a source-checked family transfer, Blender projection/render and inspection.

Writes only a fresh offline workspace. Publishing/registering a retained revision
is a separate repository operation; this command never promotes game artwork.
"""
import argparse
from pathlib import Path
import subprocess
import sys

from inspect_vehicle import inspect
from pipeline import HERE, ROOT, bake, evaluate, read
from transfer_variant import transfer


def author(vehicle, config_path, blender, output):
    config = read(config_path)
    transfer(vehicle, config_path, output)
    recipe, working = output/'recipe.json', output/'working.blend'
    bake(recipe, working, blender, output/'projection-001')
    evaluate(recipe, working, blender, output/'render-001', output/'atlas.png')
    inspect(output/'render-001', output/'inspection-001', ROOT/config['windshield'] if config.get('windshield') else None)
    with (output/'pack-draft.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(blender), '--background', '--factory-startup', str(output/'render-001/asset.blend'),
                        '--python-exit-code', '1', '--python', str(HERE/'pack_draft.py'), '--',
                        str(output/'projection-001/projection-draft.png'), str(output/'car.blend')],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    if config.get('rig'):
        with (output/'wheel-render.log').open('w', encoding='utf-8') as log:
            subprocess.run([str(blender), '--background', '--factory-startup', str(output/'car.blend'),
                            '--python-exit-code', '1', '--python', str(HERE/'render_wheel_roll.py'), '--',
                            str(output/'wheel-frames'), str(ROOT/config['rig'])],
                           check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
        subprocess.run([sys.executable, str(HERE/'wheel_roll_panels.py'), '--frames', str(output/'wheel-frames'),
                        '--out', str(output/'wheel-roll.gif')], check=True, cwd=ROOT)
    print(f"Source sprites / Blender 4×2: {output/'render-001/comparison.png'}")
    print(f"Editable scene: {output/'car.blend'}; source coverage remains explicit.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vehicle', required=True)
    parser.add_argument('--template', type=Path, default=HERE/'compact-variant-template.json')
    parser.add_argument('--blender', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    author(args.vehicle, args.template.resolve(), args.blender.resolve(), args.out.resolve())
