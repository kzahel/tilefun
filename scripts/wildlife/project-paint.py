"""Read retained Blender scenes to recover paint owners; never save source scenes.

blender -b --python-exit-code 1 --python scripts/wildlife/project-paint.py -- deer
The original pose timelines, geometry and sockets are not authored again here.
"""
import bpy
import hashlib
import json
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
species = sys.argv[sys.argv.index('--')+1]
assert species in ['deer', 'cat', 'cat-ginger', 'cat-black', 'donkey']
cat = species.startswith('cat')
variant = species in ['cat-ginger', 'cat-black']
native_revision = 'draft-v1' if variant else 'roster-v2' if species == 'donkey' else 'motion-v2'
native = f'art-source/wildlife-v2/{species}/{native_revision}/' + ('animal.blend' if variant else f'{species}.blend')
action_species = 'cat' if cat else species
action = f'art-source/wildlife-v2/{action_species}/behavior-v1/{action_species}.blend'
output = ROOT / f'art-source/wildlife-v2/{species}/finish-v1/paint-projection.json'
assert not (output.parent / 'receipt.json').exists(), 'Registered banks are immutable'
output.parent.mkdir(parents=True, exist_ok=True)
hashes = {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in [native, action]}
camera_contract = json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
width = 48 if cat or species == 'deer' else 64


def setup(path):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/path))
    scene = bpy.context.scene
    scene.frame_set(1)
    root = bpy.data.objects['ROOT-ground-anchor' if variant and path == native else 'ROOT-fixed-ground']
    body = bpy.data.objects['BODY-weight-transfer' if variant and path == native else 'BODY-rigid']
    head = bpy.data.objects['HEAD-follow' if variant and path == native else 'HEAD-fixed-orientation' if cat else 'HEAD-rigid']
    anchor = Vector(json.loads(scene['bodyAnchor'])) if 'bodyAnchor' in scene else Vector((0, -.02, .6))
    return scene, root, body, head, anchor


def project(point):
    v = world_to_camera_view(scene, scene.camera, point)
    return [round(v.x*width, 6), round((1-v.y)*width, 6), round(v.z, 6)]


def at(obj, point=(0, 0, 0)):
    return project(obj.matrix_world @ Vector(point))


def matrix_basis(matrix, anchor, facing):
    p = Vector(anchor)
    a = project(matrix @ p)
    u = Vector((0, 1, 0) if facing in ['left', 'right'] else (1, 0, 0))
    b = project(matrix @ (p+u))
    c = project(matrix @ (p+Vector((0, 0, 1))))
    return [[b[0]-a[0], c[0]-a[0]], [b[1]-a[1], c[1]-a[1]]]


def record(facing, clip, index):
    r = dict(facing=facing, clip=clip, index=index,
             body=at(body, body_anchor), head=at(head),
             bodyBasis=matrix_basis(body.matrix_world, body_anchor, facing),
             headBasis=matrix_basis(head.matrix_world, (0, 0, 0), facing))
    r['volumes'] = {o.name: dict(points=[project(o.matrix_world @ v.co) for v in o.data.vertices],
                                depth=at(o)[2], group=o.get('paintGroup'),
                                key=o.data.materials[0].get('paintKey'))
                    for o in scene.objects if o.type == 'MESH'}
    if 'limbLengths' in scene:
        names = json.loads(scene['limbLengths'])
        r['contacts'] = {name: dict(screen=[at(bpy.data.objects[f'{name}-joint-{j}']) for j in range(5)])
                         for name in names}
    if cat and not (variant and clip == 'reference'):
        r['tail'] = [at(bpy.data.objects[f'TAIL-guide-{j}']) for j in range(6)]
    if species == 'deer':
        tail = bpy.data.objects['TAIL-hinge']
        r['tail'] = [at(tail), at(tail, (0, -.36, -.23))]
        neck = bpy.data.objects.get('BEHAVIOR-neck-connected')
        matrix = neck.matrix_world if neck else body.matrix_world @ Matrix.Translation((0, .55, 1.90))
        r.update(neckBase=project(matrix.translation), neckBasis=matrix_basis(matrix, (0, 0, 0), facing),
                 neckHull=[p for n in ['neck', 'throat'] for p in r['volumes'][n]['points']],
                 headHull=r['volumes']['skull']['points'])
        jaw = bpy.data.objects.get('BEHAVIOR-jaw')
        matrix = jaw.matrix_world if jaw else head.matrix_world @ Matrix.Translation((0, .10, -.12))
        r.update(jaw=project(matrix.translation), jawBasis=matrix_basis(matrix, (0, 0, 0), facing),
                 jawHull=[p for n in ['muzzle', 'muzzle-white', 'nose'] for p in r['volumes'][n]['points']])
    if species == 'donkey':
        jaw = bpy.data.objects['JAW']
        r.update(jaw=at(jaw), jawBasis=matrix_basis(jaw.matrix_world, (0, 0, 0), facing),
                 tail=[at(bpy.data.objects[f'tail-joint-{j}']) for j in range(4)],
                 neck=[at(bpy.data.objects[f'neck-joint-{j}']) for j in range(3)],
                 nativeFootHulls={name: r['volumes'][f'{name}-foot']['points'] for name in r['contacts']},
                 hoofSplit={name: at(bpy.data.objects[f'{name}-foot'], (0, .20, -.02)) for name in r['contacts']},
                 mane=[dict(key=v['key'], points=v['points']) for v in r['volumes'].values() if v['group'] == 'mane'])
    return r


references = {}
scene, root, body, head, body_anchor = setup(native)
for facing, yaw in camera_contract['modelYawDegrees'].items():
    root.rotation_euler.z = math.radians(yaw)
    bpy.context.view_layer.update()
    references[facing] = record(facing, 'reference', 0)

records = []
scene, root, body, head, body_anchor = setup(action)
metadata = json.loads((ROOT/f'public/demos/wildlife-v2/{species}/behavior-v1/sprite.json').read_text())
if cat:
    clips = [(name, definition['count'], 500+j*40, 1)
             for j, (name, definition) in enumerate((n, d) for n, d in metadata['clips'].items()
                                                   if n not in ['idle', 'walk', 'action'])]
else:
    behavior = json.loads(scene['behaviorClips'])
    clips = [(name, count, behavior['starts'][name], milliseconds/10)
             for name, count, milliseconds in behavior['clips']]
for facing, yaw in camera_contract['modelYawDegrees'].items():
    root.rotation_euler.z = math.radians(yaw)
    for clip, count, start, step in clips:
        for i in range(count):
            frame = start+i*step
            scene.frame_set(math.floor(frame), subframe=frame-math.floor(frame))
            bpy.context.view_layer.update()
            records.append(record(facing, clip, i))

assert hashes == {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in hashes}
output.write_text(json.dumps(dict(identity=f'{species}-finish-v1-paint-owners',
                                  inputBlends=hashes, sourceScenesUnchanged=True,
                                  references=references, records=records), separators=(',', ':'))+'\n', newline='\n')
print('PAINT_PROJECTION_OK', species, len(records))
