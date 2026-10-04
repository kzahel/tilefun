"""Fresh fox rigid-volume studio. Run ONLY inside Blender; no external scene inputs.

Axes: +Y is anatomical forward, +Z up. Camera elevation is ABOVE GROUND.
All geometry scale is applied at construction and remains (1,1,1) through poses.
Object controls form an editable articulated rig; two-segment legs use analytical
fixed-length IK, not resizing cylinders. Sprite finishing consumes real evaluated
mesh vertices and contacts projected by bpy_extras.world_to_camera_view.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art-source/wildlife-v2/fox/pilot-v1'
OUT = ROOT / 'public/demos/wildlife-v2/fox/pilot-v1'
parser = argparse.ArgumentParser()
parser.add_argument('--probe', action='store_true')
parser.add_argument('--elevation', type=float, default=40)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SOURCE.mkdir(parents=True, exist_ok=True)
(OUT / 'guides').mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = False
scene.display.shading.show_cavity = True
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 192, 192
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 8
scene.view_settings.view_transform = 'Standard'

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    return m

orange = material('russet dorsal fur', (.72, .29, .09))
light = material('orange upper surfaces', (.94, .46, .14))
cream = material('cream cheeks chest tail tip', (.95, .84, .60))
dark = material('dark socks and nose', (.15, .12, .13))
inner = material('ear inside', (.45, .22, .17))

def empty(name, parent=None, location=(0,0,0)):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.empty_display_type = 'PLAIN_AXES'
    o.empty_display_size = .12
    o.parent, o.location = parent, location
    return o

root = empty('ROOT-fixed-ground')
body_ctl = empty('BODY-rigid', root)
head_ctl = empty('HEAD-fixed-orientation', body_ctl, (0,.78,.92))
meshes = []

def ellipsoid(name, loc, radii, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8)
    o = bpy.context.object
    o.name = name
    o.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.parent, o.location = parent, loc
    o.data.materials.append(mat)
    meshes.append(o)
    return o

ellipsoid('trunk-volume', (0,-.06,.70), (.28,.65,.28), orange, body_ctl)
ellipsoid('shoulder-volume', (0,.38,.72), (.26,.28,.30), light, body_ctl)
ellipsoid('haunch-volume', (0,-.48,.64), (.30,.26,.29), orange, body_ctl)
ellipsoid('chest-cream', (0,.56,.60), (.22,.10,.23), cream, body_ctl)
ellipsoid('skull-volume', (0,0,0), (.25,.28,.24), light, head_ctl)
ellipsoid('cheek-left', (-.16,.12,-.08), (.12,.18,.13), cream, head_ctl)
ellipsoid('cheek-right', (.16,.12,-.08), (.12,.18,.13), cream, head_ctl)

def tapered_muzzle():
    verts = [(-.17,.13,-.13),(.17,.13,-.13),(-.15,.13,.08),(.15,.13,.08),
             (-.065,.49,-.12),(.065,.49,-.12),(-.055,.49,-.035),(.055,.49,-.035)]
    faces = [(0,1,3,2),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3),(4,6,7,5)]
    mesh = bpy.data.meshes.new('pointed muzzle mesh')
    mesh.from_pydata(verts, [], faces)
    o = bpy.data.objects.new('pointed-muzzle-volume', mesh)
    scene.collection.objects.link(o)
    o.parent = head_ctl
    o.data.materials.append(cream)
    meshes.append(o)
tapered_muzzle()
ellipsoid('nose', (0,.49,-.07), (.065,.045,.055), dark, head_ctl)
for side in [-1,1]:
    ellipsoid(f'eye-{side}', (side*.22,.16,.025), (.025,.035,.035), dark, head_ctl)
    ctl = empty(f'EAR-{side}-hinge', head_ctl, (side*.18,-.075,.16))
    verts = [(-.09,-.06,0),(.09,-.06,0),(.085,.08,0),(-.085,.08,0), (side*.025,-.015,.41)]
    mesh = bpy.data.meshes.new(f'ear-{side}-mesh')
    mesh.from_pydata(verts, [], [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)])
    o = bpy.data.objects.new(f'ear-{side}-volume', mesh)
    scene.collection.objects.link(o)
    o.parent = ctl
    o.data.materials.append(orange)
    o.data.materials.append(inner)
    o.data.polygons[2].material_index = 1
    meshes.append(o)

def segment(name, length, radius, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8)
    o = bpy.context.object
    o.name = name
    o.scale = (radius, radius, length/2 + radius*.15)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.parent = parent
    o.data.materials.append(mat)
    meshes.append(o)
    return o

legs = {}
for end, y in [('fore',.40),('hind',-.48)]:
    for side in [-1,1]:
        name = f'{end}-{side}'
        ctl = empty('LEG-'+name, root)
        upper = segment(name+'-upper-volume', .36, .082 if end=='fore' else .11, orange, ctl)
        lower = segment(name+'-lower-volume', .34, .055, dark, ctl)
        paw = ellipsoid(name+'-paw-volume', (0,0,0), (.075,.12,.055), dark, ctl)
        legs[name] = dict(upper=upper, lower=lower, paw=paw, hip=Vector((side*.21,y,.64)), phase=(0 if side==-1 else .5)+(0 if end=='fore' else .25), end=end)

tail_ctls, tail_meshes = [], []
for i, (length, radius) in enumerate([(.35,.14),(.38,.19),(.38,.16),(.24,.09)]):
    ctl = empty(f'TAIL-{i}-rigid-joint', root)
    tail_ctls.append(ctl)
    tail_meshes.append(segment(f'tail-{i}-volume', length, radius, cream if i==3 else orange, ctl))

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = 'CAMERA-fixed-elevated-orthographic'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.8  # horizontal width; 10 native pixels per world unit
camera.data.shift_y = 7/48  # origin projects to native (24,31) on a padded 48x48 canvas
scene.camera = camera

def set_camera(elevation):
    a = math.radians(elevation)
    camera.location = (0,-10*math.cos(a),10*math.sin(a))
    camera.rotation_euler = (-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()

def key(o, frame):
    o.keyframe_insert('location', frame=frame)
    o.keyframe_insert('rotation_euler', frame=frame)

def align(o, a, b):
    o.location = (a+b)/2
    o.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()

def pose(clip, index, frame):
    phase = index/8
    body_ctl.location = (0,0,0)  # no head bob or pumping; weight shown by limb timing
    key(body_ctl, frame)
    contacts = {}
    for name, leg in legs.items():
        t = (phase+leg['phase'])%1 if clip=='walk' else .25
        if clip=='walk' and t>=.625:
            s = (t-.625)/.375
            travel = -.20+.40*s
            lift = .18*math.sin(math.pi*s)
            contact = False
        else:
            travel = .20-.40*t/.625 if clip=='walk' else 0
            lift, contact = 0, True
        hip = leg['hip']
        foot = Vector((hip.x,hip.y+travel,.065+lift))
        delta = foot-hip
        dist = delta.length
        L1,L2 = .36,.34
        if dist > L1+L2: raise RuntimeError('leg unreachable without scaling')
        along = (L1*L1-L2*L2+dist*dist)/(2*dist)
        perpendicular = Vector((0,1,0))
        unit = delta.normalized()
        perpendicular = (perpendicular-unit*perpendicular.dot(unit)).normalized()
        knee = hip+unit*along+perpendicular*math.sqrt(max(0,L1*L1-along*along))*(1 if leg['end']=='hind' else -1)
        align(leg['upper'],hip,knee)
        align(leg['lower'],knee,foot)
        leg['paw'].location = foot
        for o in [leg['upper'],leg['lower'],leg['paw']]: key(o,frame)
        contacts[name] = dict(hip=list(hip),knee=list(knee),foot=list(foot),ground=list(Vector((foot.x,foot.y,0))),planted=contact, lengths=[(knee-hip).length,(foot-knee).length])
    base = Vector((0,-.66,.66))
    points = [base]
    flick = ([0,-.10,-.28,.08,.42,.22,.06,0][index%8] if clip=='action' else 0)
    for i, (ctl, mesh) in enumerate(zip(tail_ctls,tail_meshes)):
        length = [.35,.38,.38,.24][i]
        a = -.16+flick*(.4+i*.20)
        direction = Vector((math.sin(a),-math.cos(a),[-.30,-.25,.12,.24][i])).normalized()
        nxt = base+direction*length
        align(mesh,base,nxt)
        key(mesh,frame)
        points.append(nxt)
        base = nxt
    for side in [-1,1]:
        ear = bpy.data.objects[f'EAR-{side}-hinge']
        ear.rotation_euler = (0, ([-.03,-.05,-.11,-.04,.07,.04,0,0][index%8] if clip=='action' else 0)*side,0)
        key(ear,frame)
    return contacts, points

def project(v):
    p = world_to_camera_view(scene,camera, root.matrix_world @ Vector(v))
    return [round(p.x*48,5),round((1-p.y)*48,5),round(p.z,5)]

def volume(o):
    evaluated = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    verts = [world_to_camera_view(scene,camera,evaluated.matrix_world @ v.co) for v in evaluated.data.vertices]
    points = [[round(v.x*48,4),round((1-v.y)*48,4)] for v in verts]
    return {'vertices':points,'bbox':[min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)]}

facings = {'down':180,'up':0,'left':100,'right':260}
records = []
set_camera(args.elevation)
clips = [('idle',1,1),('walk',8,10),('action',8,30)]
for clip,count,start in clips:
    for index in range(count+1): pose(clip,index%count,start+index)
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        if fc.data_path=='scale': raise RuntimeError('forbidden scale animation')
                        for kp in fc.keyframe_points: kp.interpolation='LINEAR'
scene.frame_start,scene.frame_end = 1,38
scene.timeline_markers.new('IDLE',frame=1)
scene.timeline_markers.new('WALK eight poses + closing key',frame=10)
scene.timeline_markers.new('TAIL FLICK / EAR PERK eight poses + closing key',frame=30)
scene['contract'] = 'Fox-only pilot; fixed geometry; camera angle ABOVE GROUND; pending coordinator review'
scene.frame_set(1)
pose('idle',0,1)
root.rotation_euler.z = math.radians(260)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'fox.blend'))

camera_studies = []
for elevation in [30,40,50]:
    set_camera(elevation)
    camera_studies.append(dict(elevationAboveGround=elevation,polarAngleFromVertical=90-elevation,location=list(camera.location),euler=list(camera.rotation_euler),orthoScale=camera.data.ortho_scale,shiftY=camera.data.shift_y,canvas=[48,48]))
    for facing,yaw in facings.items():
        root.rotation_euler.z = math.radians(yaw)
        bpy.context.view_layer.update()
        scene.render.filepath = str(OUT/'guides'/f'camera-{elevation}-{facing}.png')
        bpy.ops.render.render(write_still=True)
set_camera(args.elevation)
if not args.probe:
    for facing,yaw in facings.items():
        root.rotation_euler.z = math.radians(yaw)
        for clip,count,start in clips:
            for index in range(count):
                scene.frame_set(start+index)
                contacts,tail = pose(clip,index,start+index)
                bpy.context.view_layer.update()
                for o in meshes:
                    if any(abs(s-1)>1e-6 for s in o.scale): raise RuntimeError('geometry scaling failure '+o.name)
                record = dict(facing=facing,clip=clip,index=index,frame=start+index,anchor=project((0,0,0)),head=project((0,.78,.92)),body=project((0,-.06,.70)),tail=[project(p) for p in tail],
                    contacts={name:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','foot','ground']}} for name,c in contacts.items()},volumes={o.name:volume(o) for o in meshes})
                records.append(record)
                scene.render.filepath = str(OUT/'guides'/f'{facing}-{clip}-{index:02}.png')
                bpy.ops.render.render(write_still=True)
    mesh_hashes = {o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
    topology = {o.name:[list(p.vertices) for p in o.data.polygons] for o in meshes}
    contract = dict(blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=args.elevation,polarAngleFromVertical=90-args.elevation,cameraLocation=list(camera.location),cameraEuler=list(camera.rotation_euler),orthoScale=camera.data.ortho_scale,shiftY=camera.data.shift_y,canvas=[48,48],anchor=[24,31],pixelsPerWorldUnit=10,facings=facings,cameraStudies=camera_studies,meshLocalGeometrySha256=mesh_hashes,meshTopology=topology,geometryScaleAnimation=False,limbLengths=[.36,.34],records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (OUT/'projected-guides.json').write_text(json.dumps(contract,indent=2))
    (SOURCE/'projected-guides.json').write_text(json.dumps(contract,indent=2))
    scene.frame_set(1)
    root.rotation_euler.z = math.radians(260)
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'fox.blend'))
print('FOX_BUILD_OK',len(records),str(OUT))
