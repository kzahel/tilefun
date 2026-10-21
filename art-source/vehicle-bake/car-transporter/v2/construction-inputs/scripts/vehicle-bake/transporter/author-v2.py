"""Original single-car transporter derived from the retained flatbed cab/wheels.
Blender --background --python THIS -- --output repository-relative-directory
Old bundles are immutable. All dimensions below are world pixels.
"""
import bpy, sys, json, hashlib, shutil
from pathlib import Path
from mathutils import Vector

ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'AGENTS.md').exists())
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ROOT / args[args.index('--output') + 1]
if (OUT / 'recipe.json').exists(): raise SystemExit('Choose a fresh output.')
OUT.mkdir(parents=True, exist_ok=True)
OLD = ROOT / 'art-source/vehicle-bake/flatbed-truck/v1'
cfg = json.loads((OLD / 'family.json').read_text(encoding='utf-8'))
S = cfg['exportWorldScale']
bpy.ops.wm.open_mainfile(filepath=str(OLD / 'car.blend'))
bpy.context.preferences.filepaths.save_version = 0
body = bpy.data.objects['Body_static']
root = body.parent
assert root and root.type == 'EMPTY'
material = body.data.materials[0]
image = next(n.image for n in material.node_tree.nodes if n.type == 'TEX_IMAGE')
pixels = list(image.pixels[:]); W, H = image.size[:]
def uv_for(role):
    rgb = cfg['palette'][role]
    for i in range(W * H):
        if all(abs(pixels[i * 4 + j] * 255 - rgb[j]) < 1 for j in range(3)):
            return ((i % W + .5) / W, (i // W + .5) / H)
    raise ValueError(role)

# Extend the original platform/underframe behind the cab, move the real rear
# axle and guards, then recenter the whole machine. Cab and wheel UVs stay exact.
for o in list(root.children_recursive):
    if o.type != 'MESH': continue
    print('SOURCE', o.name, len(o.data.vertices))
# All static geometry is joined; transform its source vertices by region.
# The original back axle/fenders move rigidly; the long thin platform stretches.
for v in body.data.vertices:
    p = v.co
    if p.x > .9 and p.z < 1.06:
        p.x += 2.6
    elif p.x > -.85:
        p.x = -.85 + (p.x + .85) * (6.52 / 3.92)
    p.x -= 1.3
    # A wider load deck, while the retained cab and original wheel track stay.
    if p.x > -2.15 and p.z >= 1.08:
        p.y *= 2.8 / 2.2
        p.z += (24.65 - 1.24 * S) / S
for child in root.children:
    if child is body: continue
    child.location.x += (2.6 if child.location.x > 0 else 0) - 1.3

def box(name, parent, center, size, role):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object; o.name = name; o.parent = parent
    # Input coordinates use game +X forward, Blender uses -X forward.
    o.location = (-center[0] / S, -center[1] / S, center[2] / S)
    o.scale = tuple(v / S for v in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    uv = uv_for(role)
    o.data.uv_layers.active.name = body.data.uv_layers.active.name
    for corner in o.data.uv_layers.active.data: corner.uv = uv
    return o

# A separate two-stage sliding loading ramp: stowed on the deck, extended aft.
ramp = bpy.data.objects.new('Transport_Loading_Ramp', None)
bpy.context.scene.collection.objects.link(ramp); ramp.parent = root
ramp['tilefun_transport_ramp'] = 1
ramp.location = (76 / S, 0, 24.65 / S)
for side in [-1, 1]:
    box('Ramp steel track', ramp, (-36, side * 16, 24.9), (80, 13, .5), 'deckLight')
    for x in range(-72, -3, 8):
        box('Ramp grip', ramp, (x, side * 16, 25.2), (2, 12, .2), 'deckSeam')
# Convert the authored absolute coordinates into the rear hinge's local frame.
for o in ramp.children: o.location -= ramp.location
# Low side guides and a cab guard stay below loaded-car doors.
for side in [-1, 1]:
    box('Platform edge', root, (-19, side * 25, 24), (112, 2, 3), 'deckEdge')
box('Cab protection bar', root, (35, 0, 28), (2, 48, 12), 'frame')
box('Rear warning stripe', root, (-76, 0, 22), (2, 49, 2), 'amber')

# One rigid chassis draw; the ramp and four real wheels retain separate groups.
bpy.ops.object.select_all(action='DESELECT')
for o in root.children:
    if o.type == 'MESH': o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
for parent, name in [(ramp, 'Transport_Ramp_Steel')]:
    bpy.ops.object.select_all(action='DESELECT')
    for o in parent.children: o.select_set(True)
    bpy.context.view_layer.objects.active = parent.children[0]
    bpy.ops.object.join(); bpy.context.object.name = name
for o in root.children_recursive:
    if o.type == 'MESH':
        mod = o.modifiers.new('Runtime triangles', 'TRIANGULATE')
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
for im in bpy.data.images:
    if im.source == 'FILE': im.pack()
root.scale = (S,) * 3; bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
for o in root.children_recursive: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'model.glb'), export_format='GLB',
    use_selection=True, export_extras=True, export_yup=True, export_materials='EXPORT')
shutil.copy2(OLD / 'atlas.png', OUT / 'atlas.png')
root.scale = (1,) * 3; bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'car.blend'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = {'model': 'car-transporter', 'revision': 'v2',
    'method': 'Retained orange flatbed cab and independent wheel rigs; extended/recentered platform and sliding ramp',
    'deckGame': [-76, 34, -24, 24, 24.65], 'rampGame': [-152, -76, -24, 24, 0, 24.65],
    'artReviewStatus': 'awaiting-owner-inspection',
    'inputs': {p.relative_to(ROOT).as_posix(): sha(p) for p in [OLD / 'car.blend', OLD / 'family.json', OLD / 'atlas.png', Path(__file__)]},
    'outputs': {n: sha(OUT / n) for n in ['model.glb', 'car.blend', 'atlas.png']}}
(OUT / 'recipe.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(record, indent=2))
