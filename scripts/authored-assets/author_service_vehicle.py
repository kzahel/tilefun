"""Fit source-owned orange garbage and raised fire with independent rigid equipment."""
import argparse
import hashlib
import math
from pathlib import Path
import subprocess
from PIL import Image

from author_emergency_vehicle import Author, fire
from author_garbage_truck import geometry as garbage, wheels
from refine_fire_wheels import cut_floor, clean_wheel_paint, alignment
from projection_math import project
from pipeline import HERE, ROOT, read, write, digest, bake, evaluate
from inspect_vehicle import inspect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('config',type=Path)
parser.add_argument('output',type=Path)
parser.add_argument('--blender',type=Path,required=True)
args=parser.parse_args()
config_path, output, blender = args.config.resolve(), args.output.resolve(), args.blender.resolve()
config = read(config_path)
a = Author(config['vehicle'], output, config)
if config['vehicle'] == 'garbage-truck-orange':
    family = config['sourceFamily']
    registration = []
    for direction, delta in family['rawOriginDeltas'].items():
        baseline = Image.open(ROOT/family['base']/'refs'/f'{direction}.png').convert('RGBA')
        own = Image.open(output/'refs'/f'{direction}.png').convert('RGBA')
        assert baseline.size == own.size
        differences = []
        for y in range(baseline.height):
            for x in range(baseline.width):
                xx, yy = x+delta[0], y+delta[1]
                alpha = own.getpixel((xx,yy))[3] if 0 <= xx < own.width and 0 <= yy < own.height else 0
                if baseline.getpixel((x,y))[3] != alpha: differences.append([x,y])
        if direction == 'west':
            assert len(differences) == family['westAlphaExceptions']
            assert [min(p[0] for p in differences),min(p[1] for p in differences),max(p[0] for p in differences),max(p[1] for p in differences)] == family['westExceptionBounds']
        else:
            assert not differences, (direction, len(differences))
        registration.append({'view':direction,'originDelta':delta,'alphaExceptionPixels':differences,
                             'ownRgbaSha256':hashlib.sha256(own.tobytes()).hexdigest(),
                             'baseRgbaSha256':hashlib.sha256(baseline.tobytes()).hexdigest()})
    config['sourceRegistration'] = registration
    garbage(a)
    a.box('Orange-cab-west-edge', -60, -59, -19, -18, 8, 30,
          color=(116,118,143,255))
    region = next(r for r in a.regions if r['region'] == 'Container-front')
    tile = region['rect'][:2]
    a.atlas.paste((188,111,32,255), (tile[0],tile[1],tile[0]+a.cell,tile[1]+a.cell))
    region['cleanup'] = 'Unobserved container front uses explicit orange source palette.'
    fit = wheels(a)
else:
    fire(a)
    wheel_fit = read(HERE / 'fire-wheel-fit.json')
    cut_floor(a, wheel_fit)
    a.wheel_rig()
    clean_wheel_paint(a, wheel_fit)
    fit = alignment(a, wheel_fit)
    angle = math.radians(config['ladder']['raisedAngleDegrees'])
    pivot = a.positions['Ladder_Hinge']
    for obj in a.objects:
        if obj['parent'] != 'Ladder_Hinge':
            continue
        obj['vertices'] = [[v[0]*math.cos(angle)+v[2]*math.sin(angle), v[1],
                            -v[0]*math.sin(angle)+v[2]*math.cos(angle)] for v in obj['vertices']]
        region = next(r for r in a.regions if r['region'] == obj['region'])
        owner = region.get('owner')
        if owner:
            pixels = [project([v[k]+pivot[k] for k in range(3)],config['cameras'][owner]) for v in obj['vertices']]
            obj['uvs'] = [[a.uv(region['rect'][:2], pixels[i]) for i in face] for face in obj['faces']]
        region['cleanup'] = 'Own raised ladder rest pose; projected owned faces and explicit hidden metal fill.'
    a.nodes[0]['extras']['rest_pose_degrees'] = config['ladder']['raisedAngleDegrees']
a.finish()
rig = read(output/'rig.json'); rig['wheelWellFit'] = fit; write(output/'rig.json',rig)
write(output/'wheel-alignment.json',fit)
if config['vehicle'] == 'garbage-truck-orange':
    lights = read(output/'lights.json'); lights['signal'] = 'warning'
    for lens in lights['lenses']: lens['signal'] = 'warning'
    write(output/'lights.json',lights)
with (output/'build.log').open('w',encoding='utf-8') as log:
    subprocess.run([str(blender),'--background','--factory-startup','--python-exit-code','1','--python',str(HERE/'build_emergency_vehicle.py'),'--',str(output)],check=True,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
recipe = read(output/'recipe.json'); recipe['template']={'path':str(output/'car.blend'),'sha256':digest(output/'car.blend')};write(output/'recipe.json',recipe)
bake(output/'recipe.json',output/'car.blend',blender,output/'projection-001')
evaluate(output/'recipe.json',output/'car.blend',blender,output/'render-001',output/'car-atlas.png')
inspect(output/'render-001',output/'inspection-001')
with (output/'pack-draft.log').open('w',encoding='utf-8') as log:
    subprocess.run([str(blender),'--background','--factory-startup',str(output/'render-001/asset.blend'),'--python-exit-code','1','--python',str(HERE/'pack_draft.py'),'--',str(output/'projection-001/projection-draft.png'),str(output/'final.blend')],check=True,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
print('Prepared independent service vehicle',config['vehicle'],flush=True)
