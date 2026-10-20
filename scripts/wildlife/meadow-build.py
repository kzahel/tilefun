"""New action banks derived from retained editable sources; native travel is unchanged.
Run only for explicit authoring, never from normal builds.
"""
import bpy, copy, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
species = sys.argv[sys.argv.index('--') + 1]
S = ROOT / f'art-source/wildlife-v2/{species}/behavior-v1'
O = ROOT / f'public/demos/wildlife-v2/{species}/behavior-v1'
assert not (S/'receipt.json').exists(), 'Registered identities are immutable'
inputs = json.loads((S/'inputs.json').read_text())
for name, digest in inputs['sha256'].items():
    assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest() == digest, name
O.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/inputs['blend']))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.frame_set(1)
root = bpy.data.objects['ROOT-ground-fixed' if species == 'robin' else 'ROOT-fixed-ground']
root.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()
objects = [o for o in scene.objects if o != root and o.type != 'CAMERA']
rest = {o.name: (o.location.copy(), o.rotation_euler.copy(), o.rotation_quaternion.copy()) for o in objects}
meshes = [o for o in scene.objects if o.type == 'MESH']
geometry = {o.name: hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
W, anchor = inputs['canvas'], inputs['anchor']
camera = scene.camera
contract = json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
idle = json.loads((S/'idle-guides.json').read_text()) if species != 'meerkat' else None
P = inputs.get('profile')

def align(o, a, b):
    o.location = (a+b)/2
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (b-a).to_track_quat('Z','Y')

def pose(clip, index, count):
    for o in objects:
        o.location, o.rotation_euler, o.rotation_quaternion = rest[o.name]
    t = index/(count-1)
    amount = math.sin(math.pi*t)**2
    if species == 'rabbit':
        head = bpy.data.objects['HEAD-stable-volume']
        head.location += Vector((0, .10*amount, -.27*amount))
        # Jaw/muzzle motion remains rigid; no head squashing.
        bpy.data.objects['muzzle'].location.z -= .025*amount*(.5+.5*math.sin(8*math.pi*t))
    elif species == 'robin':
        head = bpy.data.objects['HEAD-rigid-skull']
        head.location += Vector((0, .12*amount, -.34*amount))
        bpy.data.objects['JAW-song'].rotation_euler.x = -.25*amount
        bpy.data.objects['TAIL-cock'].rotation_euler.x = -.75*amount
    else:
        pivot = bpy.data.objects['MOTION-torso']
        # Rotate the same torso above planted hind feet; rebuild fixed-length links.
        posture = math.sin(math.pi*t/2)**2 if clip == 'rear' else math.cos(math.pi*t/2)**2 if clip == 'lower' else 1
        pivot.rotation_euler.x = 1.05*posture
        head = bpy.data.objects['HEAD-rigid']
        head.rotation_euler = (-.55*posture, 0, .30*math.sin(2*math.pi*t) if clip == 'scan' else .12*math.sin(4*math.pi*t)*posture)
        bpy.data.objects['JAW'].rotation_euler.x = -.45*amount if clip == 'alarm' else 0
        bpy.context.view_layer.update()
        body = bpy.data.objects['BODY-rigid']
        for end in ['fore','hind']:
            for side in [-1,1]:
                n = f'{end}{side}'
                hip = Vector(P[end+'Hip']); hip.x *= side
                hip = pivot.matrix_local @ body.matrix_local @ hip
                foot = Vector((hip.x, .34+.24*posture if end == 'fore' else -.41, .06+.84*posture if end == 'fore' else .06))
                L1,L2,L3,L4 = P[end+'Lengths']
                fetlock = foot + Vector((0,-.035,.10)).normalized()*L4
                chord = math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(.45))
                delta = fetlock-hip; d = delta.length; u = delta.normalized()
                assert abs(L1-chord) < d < L1+chord, (n,d)
                a = (L1*L1-chord*chord+d*d)/(2*d)
                pole = Vector((0,-1 if end == 'fore' else 1,0)); pole = (pole-u*pole.dot(u)).normalized()
                elbow = hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a))
                delta = fetlock-elbow; d = delta.length; u = delta.normalized()
                a = (L2*L2-L3*L3+d*d)/(2*d)
                pole = Vector((0,1 if end == 'fore' else -1,0)); pole = (pole-u*pole.dot(u)).normalized()
                knee = elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a))
                ps = [hip,elbow,knee,fetlock,foot]
                for j,(a,b) in enumerate(zip(ps,ps[1:])): align(bpy.data.objects[f'{n}-link-{j}'],a,b)
                for j,p in enumerate(ps): bpy.data.objects[f'{n}-joint-{j}'].location = p
                for j,p in enumerate(ps[1:4],1): bpy.data.objects[f'{n}-joint-volume-{j}'].location = p
                bpy.data.objects[f'{n}-foot'].location = foot
        # Tail stays connected to the upright pelvis and supports the tripod silhouette.
        base = pivot.matrix_local @ body.matrix_local @ Vector((0,P['tailY'],P['torso'][2]+.03))
        points = [base]
        for i,length in enumerate(P['tailLengths']): points.append(points[-1]+Vector((0,-.72,-.70)).normalized()*length)
        for i,(a,b) in enumerate(zip(points,points[1:])): align(bpy.data.objects[f'tail-link-{i}'],a,b)
        for i,p in enumerate(points): bpy.data.objects[f'tail-joint-{i}'].location = p
    bpy.context.view_layer.update()

def project(p):
    v = world_to_camera_view(scene,camera,p)
    return [round(v.x*W,5),round((1-v.y)*W,5),round(v.z,5)]
def hull(ps):
    ps = sorted(set(tuple(p[:2]) for p in ps)); cross = lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[]; hi=[]
    for p in ps:
        while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0: lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0: hi.pop()
        hi.append(p)
    return lo[:-1]+hi[:-1]

clips = [('eat',8)] if species != 'meerkat' else [('scan',12),('alarm',8),('rear',8),('lower',8)]
records=[]
for c,(clip,count) in enumerate(clips):
    for i in range(count):
        frame = 200+c*40+i
        scene.frame_set(frame); pose(clip,i,count)
        for o in objects:
            o.keyframe_insert('location',frame=frame)
            o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
for row,(facing,yaw) in enumerate(contract['modelYawDegrees'].items()):
    for c,(clip,count) in enumerate(clips):
        for i in range(count):
            scene.frame_set(200+c*40+i); root.rotation_euler.z=math.radians(yaw); bpy.context.view_layer.update()
            r = copy.deepcopy(next(x for x in idle['records'] if x['facing']==facing)) if idle else dict(volumes=[])
            r.update(facing=facing,clip=clip,index=i)
            if idle:
                for name in r['landmarks']:
                    if name in bpy.data.objects: r['landmarks'][name] = project(bpy.data.objects[name].matrix_world.translation)
                if species=='robin':
                    r['head']=project(bpy.data.objects['HEAD-rigid-skull'].matrix_world.translation)
                    r['body']=project(bpy.data.objects['BODY-hop-flight'].matrix_world.translation)
                    for key,name in [('bill-tip','upper-bill-volume'),('lower-bill-tip','lower-bill-volume')]:
                        o=bpy.data.objects[name];r['landmarks'][key]=project(o.matrix_world@o.data.vertices[2].co)
                    tail=bpy.data.objects['tail-volume'];r['landmarks']['tail-tip']=project(sum((tail.matrix_world@tail.data.vertices[j].co for j in [2,3,6,7]),Vector())/4)
                for o in meshes:
                    ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
                    r['volumes'][o.name].update(hull=hull(ps), **{'bounds' if species=='rabbit' else 'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]})
            else:
                for o in meshes:
                    ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
                    r['volumes'].append(dict(name=o.name,key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
            records.append(r)
root.rotation_euler=(0,0,0);scene.frame_set(200)
scene['behaviorIdentity']=f'{species}-behavior-v1'
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{species}.blend'))
(S/'projection.json').write_text(json.dumps(dict(records=records),separators=(',',':'))+'\n')
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
(O/'source-audit.json').write_text(json.dumps(dict(identity=f'{species}-behavior-v1',poses=len(records),meshGeometryUnchanged=geometry,fixedCamera=True,rootMotion=False),indent=2)+'\n')
print('MEADOW_SOURCE_OK',species,len(records))
