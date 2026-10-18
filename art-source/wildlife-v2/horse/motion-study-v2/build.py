"""Bounded horse clay study; never writes the registered draft-v1 bank.
Blender background CLI. Geometry is animated, never the rendered sprite.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[4]
S = Path(__file__).resolve().parent
if (S/'receipt.json').exists():
    raise RuntimeError('Registered study is immutable; reproduce in an isolated checkout without its receipt, or author a new revision.')
OUT = ROOT / 'public/demos/wildlife-v2/horse/motion-study-v2'
TMP = ROOT / 'data/horse-motion-139/renders'
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
old = S.parent / 'draft-v1/horse.blend'
old_hash = hashlib.sha256(old.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(old))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
for o in list(bpy.data.objects):
    o.animation_data_clear()
    if o.name.startswith('LEG-') or any(o.name.startswith(p) for p in ['fore-1-', 'fore1-', 'hind-1-', 'hind1-']):
        bpy.data.objects.remove(o, do_unlink=True)
root = bpy.data.objects['ROOT-fixed-ground']
root.rotation_euler = (0, 0, 0)
body = bpy.data.objects['BODY-rigid']
body.location = (0, 0, 0)

def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o

pivot = empty('BODY-weight-transfer', root, (0, 0, 2.25))
body.parent = pivot
body.location = (0, 0, -2.25)
head = bpy.data.objects['HEAD-rigid']
head_rest = head.location.copy()

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    return m

clay = material('study warm clay', (.66, .63, .54))
hair = material('study dark clay', (.28, .29, .27))
fore = material('study forelimbs blue', (.30, .49, .57))
hind = material('study hindlimbs terracotta', (.64, .39, .28))
hoof_mat = material('study solid hooves', (.19, .23, .23))
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.materials.clear()
        o.data.materials.append(hair if any(k in o.name for k in ['mane', 'tail', 'forelock', 'eye', 'nose', 'ear-inner']) else clay)

def ellipsoid(name, radii, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8)
    o = bpy.context.object
    o.name = name
    o.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.parent = root
    o.data.materials.append(mat)
    return o

def align(o, a, b):
    o.location = (a + b) / 2
    z = (b-a).normalized()
    x = Vector((1,0,0))
    x = (x-z*x.dot(z)).normalized()
    y = z.cross(x)
    rotation = Matrix((x,y,z)).transposed().to_quaternion()
    rotation.make_compatible(o.rotation_quaternion)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = rotation

LEGS = {}
for end, y, z, lengths in [('fore', .95, 2.55, [.72, .98, .76, .22]), ('hind', -1.02, 2.55, [.82, .98, .76, .23])]:
    for side in [-1, 1]:
        name = f'{end}{side}'
        mat = fore if end == 'fore' else hind
        radii = [(.17, .21), (.105, .11), (.055, .058), (.065, .065)] if end == 'fore' else [(.265, .28), (.135, .14), (.06, .063), (.07, .07)]
        links = [ellipsoid(f'{name}-link-{i}', (rx, ry, length / 2), clay if i == 0 else mat) for i, (length, (rx, ry)) in enumerate(zip(lengths, radii))]
        bpy.ops.mesh.primitive_cube_add(size=1)
        hoof = bpy.context.object
        hoof.name = f'{name}-hoof'
        hoof.scale = (.25, .36, .18)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bevel = hoof.modifiers.new('rounded hoof edge', 'BEVEL')
        bevel.width = .035
        bevel.segments = 2
        hoof.parent = root
        hoof.data.materials.append(hoof_mat)
        joints = [empty(f'{name}-joint-{i}', root) for i in range(5)]
        joint_meshes = [ellipsoid(f'{name}-joint-volume-{i}', (r, r, r), mat) for i, r in enumerate([.11, .078, .07], 1)]
        LEGS[name] = dict(end=end, side=side, rest=Vector((side * .36, y, z)), lengths=lengths, links=links, hoof=hoof, joints=joints, joint_meshes=joint_meshes)

N = 32
STRIDE = 1.44
STANCE = .66
OFFSETS = {'hind-1': 0, 'fore-1': .25, 'hind1': .5, 'fore1': .75}

def pose(t, travel=False):
    root.location.y = STRIDE * t if travel else 0
    pivot.location = (.035 * math.sin(2 * math.pi * t), 0, 2.25 + .075 * math.sin(4 * math.pi * t))
    pivot.rotation_euler = (.06 * math.cos(4 * math.pi * t), .015 * math.sin(2 * math.pi * t), 0)
    # Small head counter-follow, with its attachment still carried by the torso.
    head.location = head_rest
    head.rotation_euler.x = -.035 * math.cos(4 * math.pi * (t - .04))
    bpy.context.view_layer.update()
    records = {}
    for name, leg in LEGS.items():
        p = (t - OFFSETS[name]) % 1
        planted = p < STANCE
        q = 0 if planted else (p - STANCE) / (1 - STANCE)
        y = STRIDE * STANCE / 2 - STRIDE * p if planted else -STRIDE * STANCE / 2 + STRIDE * STANCE * (q*q*(3-2*q))
        lift = 0 if planted else .26 * math.sin(math.pi * q) ** 1.4
        foot = Vector((leg['side'] * .39, leg['rest'].y + y, .09 + lift))
        hip = body.matrix_local @ leg['rest']
        # body.matrix_local includes the inverse pivot displacement. Use the
        # complete body transform in root coordinates, including weight transfer.
        hip = pivot.matrix_local @ hip
        L1, L2, L3, L4 = leg['lengths']
        fetlock = foot + Vector((0, -.065, .22)).normalized() * L4
        # Prescribe modest loaded carpus/hock flexion, then solve the upper
        # articulation against that composite lower chain. A free two-link
        # lower solve alone produces the rejected deep zigzag under load.
        flex = (.10 if leg['end'] == 'fore' else .50) + (.95 if leg['end'] == 'fore' else .50) * math.sin(math.pi*q)**2
        lower_chord = math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex))
        upper_delta = fetlock-hip
        upper_dist = upper_delta.length
        if not abs(L1-lower_chord) < upper_dist < L1+lower_chord:
            raise RuntimeError(f'Unreachable composite {name} at {t}: {upper_dist}, {L1+lower_chord}')
        upper_unit = upper_delta.normalized()
        upper_along = (L1*L1-lower_chord*lower_chord+upper_dist*upper_dist)/(2*upper_dist)
        upper_pole = Vector((0, -1 if leg['end'] == 'fore' else 1, 0))
        upper_pole = (upper_pole-upper_unit*upper_pole.dot(upper_unit)).normalized()
        elbow = hip + upper_unit*upper_along + upper_pole*math.sqrt(max(0, L1*L1-upper_along*upper_along))
        delta = fetlock - elbow
        dist = delta.length
        if not abs(L2-L3) < dist < L2+L3:
            raise RuntimeError(f'Unreachable {name} at {t}: {dist}')
        unit = delta.normalized()
        along = (L2*L2-L3*L3+dist*dist)/(2*dist)
        pole = Vector((0, 1 if leg['end'] == 'fore' else -1, 0))
        pole = (pole-unit*pole.dot(unit)).normalized()
        carpus = elbow + unit*along + pole*math.sqrt(max(0, L2*L2-along*along))
        points = [hip, elbow, carpus, fetlock, foot]
        for o, a, b in zip(leg['links'], points, points[1:]):
            align(o, a, b)
        leg['hoof'].location = foot
        for o, point in zip(leg['joints'], points):
            o.location = point
        for o, point in zip(leg['joint_meshes'], points[1:4]):
            o.location = point
        records[name] = dict(phase=p, planted=planted, points=[list(p) for p in points], lengths=leg['lengths'])
    bpy.context.view_layer.update()
    return records

def key(o, frame):
    o.keyframe_insert('location', frame=frame)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode == 'QUATERNION' else 'rotation_euler', frame=frame)

animated = [pivot, head] + [o for l in LEGS.values() for o in l['links'] + l['joints'] + l['joint_meshes'] + [l['hoof']]]
for frame in range(N+1):
    pose(frame/N)
    for o in animated:
        key(o, frame+1)
for o in animated:
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:
                        k.interpolation = 'LINEAR'
scene.frame_start = 1
scene.frame_end = N
scene.render.fps = 20
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = False
scene.display.shading.show_cavity = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_percentage = 100
cam = scene.camera
camera = json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 8
cam.data.shift_y = 21/80
cam.location = camera['cameraLocationAtDistance10']
cam.rotation_euler = (-cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = scene.render.resolution_y = 80
scene.frame_set(1)
pose(0)
scene['study'] = 'Horse focused clay motion study 139; pending human review; not game art'
scene['sourceDraftSha256'] = old_hash
scene['strideWorldUnits'] = STRIDE
scene['stanceFraction'] = STANCE
scene['poseCount'] = N
bpy.ops.wm.save_as_mainfile(filepath=str(S/'horse-motion.blend'))

records = []
for facing, yaw in camera['modelYawDegrees'].items():
    root.rotation_euler.z = math.radians(yaw)
    for i in range(N):
        scene.frame_set(i+1)
        contacts = pose(i/N)
        p = world_to_camera_view(scene, cam, body.matrix_world @ Vector((0, -.1, 2.24)))
        records.append(dict(facing=facing, pose=i, bodyScreen=[p.x*80, (1-p.y)*80], contacts=contacts))
        scene.render.filepath = str(TMP/f'{facing}-{i:02}.png')
        bpy.ops.render.render(write_still=True)

# True side is deliberately a diagnostic camera, separate from game projection.
root.rotation_euler.z = 0
cam.data.shift_y = 0
cam.data.ortho_scale = 5.8
cam.location = (10, .20, 2.15)
target = Vector((0, .20, 2.15))
cam.rotation_euler = (target-cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = 640
scene.render.resolution_y = 520
for i in range(N):
    scene.frame_set(i+1)
    pose(i/N)
    scene.render.filepath = str(TMP/f'side-{i:02}.png')
    bpy.ops.render.render(write_still=True)
cam.data.ortho_scale = 8
cam.location = (10, 1.6, 2.05)
cam.rotation_euler = (Vector((0, 1.6, 2.05))-cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = 960
scene.render.resolution_y = 520
for i in range(N*2):
    scene.frame_set(i%N+1)
    pose(i/N, True)
    scene.render.filepath = str(TMP/f'travel-{i:02}.png')
    bpy.ops.render.render(write_still=True)
(S/'projection.json').write_text(json.dumps(dict(identity='horse-motion-study-v2', records=records, sourceDraftSha256=old_hash), separators=(',', ':')), encoding='utf8')
assert hashlib.sha256(old.read_bytes()).hexdigest() == old_hash
print('HORSE_MOTION_STUDY_RENDER_OK', len(records))
