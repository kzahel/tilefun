"""Blender builder: reuse mesh/UV export conventions, parent wheels to bogies."""
from pathlib import Path
import json
import runpy
import sys

import bpy

out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
runpy.run_path(str(Path(__file__).with_name('build_emergency_vehicle.py')),run_name='__main__')
spec=json.loads((out/'mesh-spec.json').read_text(encoding='utf-8'))
root=bpy.data.objects['CarRoot'];root.name='TrainRoot'
root['asset_class']='train-carriage'
for wheel in spec['wheels']:
    steer=bpy.data.objects[wheel['steer']]
    world=steer.matrix_world.copy()
    steer.parent=bpy.data.objects[wheel['bogie']]
    steer.matrix_world=world
bpy.context.scene['review_status']='Authored blue train prototype; live activation awaits moving-art review'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'car.blend'))
