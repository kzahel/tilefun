"""Piglet repair: source-driven rigid anatomy and projected pixel masters.
Run from Blender with --python-exit-code 1 --python ... -- horse|giraffe.
Existing registered banks are read-only. Both outputs use new motion-v2 IDs.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[4]
SPECIES = 'piglet'
assert SPECIES in ['sheep','piglet']
HORSE = True
S = ROOT/f'art-source/wildlife-v2/{SPECIES}/motion-v2'
OUT = ROOT/f'public/demos/wildlife-v2/{SPECIES}/motion-v2'
TMP = ROOT/f'data/wildlife-140/{SPECIES}/renders'
assert not (S/'receipt.json').exists(), 'Registered bank is immutable; use a new revision'
for p in [S,OUT,TMP]: p.mkdir(parents=True,exist_ok=True)
old = S.parent/f'draft-v1/{SPECIES}.blend'
bpy.ops.wm.open_mainfile(filepath=str(old))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
for o in list(scene.objects):
    o.animation_data_clear()
    if o.name.startswith('LEG-') or o.name.startswith(('fore','hind')):
        bpy.data.objects.remove(o,do_unlink=True)
root = bpy.data.objects['ROOT-fixed-ground']
root.location = (0,0,0)
root.rotation_euler = (0,0,0)
body = bpy.data.objects['BODY-rigid' if HORSE else 'BODY-weight-transfer']
body.location = (0,0,0)
body.rotation_euler = (0,0,0)
head = bpy.data.objects['HEAD-rigid' if HORSE else 'HEAD-fixed-volume']
head_rest = head.location.copy()
W = 48
ANCHOR = [24,35]
PIVOT = 1.08 if SPECIES=='sheep' else 1.10
STRIDE = (16 if SPECIES=='sheep' else 14)*.96/10
STANCE = .66 if HORSE else .625
N = 32
FRAME_MS = 30
OFF = {'hind-1':0,'fore-1':.25 if HORSE else .125,'hind1':.5,'fore1':.75 if HORSE else .625}

def empty(name,parent=None,loc=(0,0,0)):
    o = bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    o.parent=parent;o.location=loc;return o

pivot = empty('MOTION-torso',root,(0,0,PIVOT))
body.parent = pivot;body.location=(0,0,-PIVOT)
materials = {m.name:m for m in bpy.data.materials}
coat = materials['pale domestic pig skin']
dark = materials['pale domestic pig skin']
hoof_mat = materials['eyes nostrils hooves']

def egg(name,radii,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
    o=bpy.context.object;o.name=name;o.scale=radii
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.parent=root;o.data.materials.append(mat);return o

def align(o,a,b):
    o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,0,0))
    x=(x-z*x.dot(z)).normalized();y=z.cross(x)
    q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=q

legs={}
specs = [('fore',.62,1.08,[.36,.42,.36,.10]),('hind',-.64,1.04,[.40,.40,.35,.10])]
for end,y,z,lengths in specs:
    for side in [-1,1]:
        name=f'{end}{side}'
        radii = ([.10,.065,.04,.04] if end=='fore' else [.14,.07,.045,.04]) if HORSE else ([.23,.14,.085,.085] if end=='fore' else [.30,.16,.09,.09])
        links=[egg(f'{name}-link-{i}',(r,r*1.08,L/2),coat if i<2 or not HORSE else dark) for i,(r,L) in enumerate(zip(radii,lengths))]
        hh=.07 if SPECIES=='sheep' else .08
        bpy.ops.mesh.primitive_cube_add(size=1);hoof=bpy.context.object;hoof.name=f'{name}-hoof'
        hoof.scale=(.17,.22,2*hh)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        hoof.parent=root;hoof.data.materials.append(hoof_mat)
        # Two disjoint weight-bearing digits, plus non-contact pig dewclaws.
        vertices=[];faces=[]
        blocks=[(-.045,0,0,.07,.22,2*hh),(.045,0,0,.07,.22,2*hh)]
        if SPECIES=='piglet':blocks += [(-.06,-.07,.13,.04,.05,.05),(.06,-.07,.13,.04,.05,.05)]
        for cx,cy,cz,sx,sy,sz in blocks:
            offset=len(vertices)
            vertices += [(cx+x*sx/2,cy+y*sy/2,cz+z*sz/2) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
            faces += [tuple(offset+i for i in face) for face in [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]]
        mesh=bpy.data.meshes.new(name+'-cloven-hoof');mesh.from_pydata(vertices,[],faces);mesh.update()
        hoof.data=mesh;hoof.data.materials.append(hoof_mat)
        bevel=hoof.modifiers.new('solid rounded cloven digits','BEVEL');bevel.width=.015;bevel.segments=2
        joints=[empty(f'{name}-joint-{i}',root) for i in range(5)]
        bulbs=[egg(f'{name}-joint-volume-{i}',(r,r,r),coat if i<3 else dark) for i,r in enumerate([.06,.045,.04],1)]
        x=side*(.28 if SPECIES=='sheep' else .34)
        legs[name]=dict(rest=Vector((x,y,z)),end=end,lengths=lengths,links=links,hoof=hoof,joints=joints,bulbs=bulbs,hh=hh)

def pose(t,clip='walk',travel=False):
    moving=clip=='walk'
    root.location.y=STRIDE*t if travel else 0
    heave=.075*math.sin(4*math.pi*t) if moving else 0
    pitch=.065*math.cos(4*math.pi*t) if moving else 0
    pivot.location=(.022*math.sin(2*math.pi*t) if moving else 0,0,PIVOT+heave)
    pivot.rotation_euler=(pitch,.012*math.sin(2*math.pi*t) if moving else 0,0)
    head.location=head_rest
    head.rotation_euler.x=(-.035 if HORSE else -.022)*math.cos(4*math.pi*(t-.04)) if moving else 0
    bpy.context.view_layer.update()
    info={}
    for name,l in legs.items():
        p=(t-OFF[name])%1 if moving else .33
        planted=p<STANCE if moving else True
        q=0 if planted else (p-STANCE)/(1-STANCE)
        y=STRIDE*STANCE/2-STRIDE*p if planted and moving else (-STRIDE*STANCE/2+STRIDE*STANCE*q*q*(3-2*q) if moving else 0)
        lift=.13*math.sin(math.pi*q)**1.4
        foot=Vector((l['rest'].x+(.015 if l['rest'].x>0 else -.015),l['rest'].y+y,l['hh']+lift))
        hip=pivot.matrix_local@body.matrix_local@l['rest']
        L1,L2,L3,L4=l['lengths']
        fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
        flex=(.10 if l['end']=='fore' else .50)+(.95 if l['end']=='fore' else .50)*math.sin(math.pi*q)**2
        chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex))
        delta=fetlock-hip;d=delta.length;u=delta.normalized()
        assert abs(L1-chord)<d<L1+chord,(SPECIES,name,t,'upper reach',d,L1+chord)
        a=(L1*L1-chord*chord+d*d)/(2*d)
        pole=Vector((0,-1 if l['end']=='fore' else 1,0));pole=(pole-u*pole.dot(u)).normalized()
        elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a))
        delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d)
        pole=Vector((0,1 if l['end']=='fore' else -1,0));pole=(pole-u*pole.dot(u)).normalized()
        knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a))
        points=[hip,elbow,knee,fetlock,foot]
        for o,a,b in zip(l['links'],points,points[1:]):align(o,a,b)
        for o,pnt in zip(l['joints'],points):o.location=pnt
        for o,pnt in zip(l['bulbs'],points[1:4]):o.location=pnt
        l['hoof'].location=foot
        info[name]=dict(phase=p,planted=planted,lengths=l['lengths'])
    # Retain the existing ear action and pig curl; no extra animation states.
    amount=math.sin(2*math.pi*t)*.65 if clip=='action' else 0
    for side in [-1,1]:
        bpy.data.objects[f'EAR-{side}'].rotation_euler=(amount*.15,side*amount,side*amount*.12)
    if SPECIES=='piglet':bpy.data.objects['TAIL-rigid-curl'].rotation_euler=(0,amount*.5,amount*.6)
    bpy.context.view_layer.update();return info

def key(o,f):
    o.keyframe_insert('location',frame=f)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)

animated=[pivot,head]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['hoof']]]+[o for o in scene.objects if o.name.startswith('TAIL-') or o.name.startswith('EAR-')]
clips=[('idle',1,1),('walk',10,32),('action',120,8)]
steps={'idle':1,'walk':3,'action':10}
for clip,start,count in clips:
    for i in range(count+1):
        pose(i/count,clip)
        for o in animated:key(o,start+i*steps[clip])
for o in animated:
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:k.interpolation='LINEAR'
scene.frame_start=10;scene.frame_end=105;scene.render.fps=100;scene.render.fps_base=1
cam=scene.camera;camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.frame_set(1);pose(0,'idle')
scene['motionIdentity']=f'{SPECIES}-motion-v2';scene['strideWorldUnits']=STRIDE;scene['stanceFraction']=STANCE
scene['poseCount']=32;scene['frameDurationMs']=FRAME_MS;scene['walkFrameStep']=3;scene['sourceDraftSha256']=hashlib.sha256(old.read_bytes()).hexdigest()
scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()})
scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()})
scene['footfallOffsets']=json.dumps(OFF);scene['bodyName']=body.name
scene['bodyAnchor']=json.dumps([0,-.03,1.08] if SPECIES=='sheep' else [0,-.07,1.10])
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))

def project_world(p):
    v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def projected(o,p=(0,0,0)):
    return project_world(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world@Vector(p))
body_anchor=Vector((0,-.03,1.08) if SPECIES=='sheep' else (0,-.07,1.10))
records=[];references={}
for facing,yaw in camera['modelYawDegrees'].items():
    root.rotation_euler.z=math.radians(yaw)
    scene.frame_set(1);pose(0,'idle')
    # Pixel masters remain rigid parts. The projected longitudinal axis drives
    # their screen rotation; front/rear views have no artificial planar roll.
    def angle(o):
        a=projected(o);b=projected(o,(0,1,0))
        return math.atan2(b[1]-a[1],b[0]-a[0])
    def basis(o,anchor):
        a=projected(o,anchor)
        v=Vector((0,1,0) if facing in ['left','right'] else (1,0,0))
        b=projected(o,Vector(anchor)+v);c=projected(o,Vector(anchor)+Vector((0,0,1)))
        return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
    references[facing]=dict(body=projected(body,body_anchor),head=projected(head),bodyAngle=angle(body),headAngle=angle(head),bodyBasis=basis(body,body_anchor),headBasis=basis(head,(0,0,0)))
    for clip,start,count in clips:
        for i in range(count):
            scene.frame_set(start+i*steps[clip]);info=pose(i/count,clip)
            r=dict(facing=facing,clip=clip,index=i,frame=start+i*steps[clip],body=projected(body,body_anchor),head=projected(head),bodyAngle=angle(body),headAngle=angle(head),bodyBasis=basis(body,body_anchor),headBasis=basis(head,(0,0,0)),contacts={})
            for n,l in legs.items():
                r['contacts'][n]={**info[n],'screen':[projected(o) for o in l['joints']]}
            r['ears']={str(side):{'base':projected(bpy.data.objects[f'EAR-{side}']),'tip':projected(bpy.data.objects[f'EAR-{side}'],(side*.33,.035,-.06)),'points':[project_world(bpy.data.objects[f'ear-{side}'].matrix_world@v.co) for v in bpy.data.objects[f'ear-{side}'].data.vertices]} for side in [-1,1]}
            if SPECIES=='sheep':r['tail']=[projected(body,(0,-.92,.95))]
            else:
                points=[Vector((0,0,0)),Vector((0,-.14,0))]
                for j in range(1,17):
                    theta=2*math.pi*j/16;radius=.14*(1-.40*j/16)
                    points.append(Vector((radius*math.sin(theta),-.14-.02*theta,radius*math.cos(theta)-.14)))
                ctl=bpy.data.objects['TAIL-rigid-curl']
                r['tail']=[projected(ctl,p) for p in points]
            records.append(r)
            # Separate raw geometry evidence is never substituted for pixel art.
            scene.render.filepath=str(TMP/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
result=dict(identity=f'{SPECIES}-motion-v2',canvas=W,anchor=ANCHOR,frameDurationMs=FRAME_MS,strideWorldUnits=STRIDE,stanceFraction=STANCE,footfallOffsets=OFF,references=references,records=records)
(S/'projection.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
print('LONG_LEGGED_SOURCE_OK',SPECIES,len(records))
