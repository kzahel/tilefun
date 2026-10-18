"""Fresh buff hen: source-driven rigid anatomy and projected pixel masters.
Run from Blender in a fresh empty scene; no previous animal source or pixels are read.
Existing registered banks are read-only. Fresh outputs use a separate roster-v2 identity.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[4]
SPECIES = 'chicken'
assert SPECIES=='chicken'
S = ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v2'
OUT = ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v2'
TMP = ROOT/f'data/wildlife-140/{SPECIES}/renders'
assert not (S/'receipt.json').exists(), 'Registered bank is immutable; use a new revision'
for p in [S,OUT,TMP]: p.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True;scene.view_settings.view_transform='Standard'
def material(name,color,key):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat['paintKey']=key;return mat
buff=material('buff hen feathers',(.70,.48,.24),'B');cream=material('cream neck and feather highlights',(.89,.76,.48),'H');wingmat=material('warm wing and tail feathers',(.47,.30,.16),'S');red=material('red comb and wattles',(.73,.18,.13),'R');beakmat=material('ochre beak and scales',(.78,.55,.17),'Y');eye_mat=material('dark eyes and contour',(.16,.14,.10),'K')
def node(name,parent=None,loc=(0,0,0)):
    obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);obj.parent=parent;obj.location=loc;return obj
root=node('ROOT-fixed-ground');body=node('BODY-rigid',root);head=node('HEAD-rigid',body,(0,.45,1.55));head_rest=head.location.copy()
def volume(name,loc,radii,mat,parent,group):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);obj=bpy.context.object;obj.name=name;obj.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.parent=parent;obj.location=loc;obj.data.materials.append(mat);obj['paintGroup']=group;return obj
def solid(name,vertices,faces,mat,parent,group):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=parent;obj.data.materials.append(mat);obj['paintGroup']=group;return obj
volume('pear torso',(0,-.06,.98),(.34,.48,.40),buff,body,'body');volume('round breast',(0,.23,1.03),(.30,.32,.36),buff,body,'body');volume('feather neck',(0,.30,1.29),(.17,.18,.33),cream,body,'body')
volume('small skull',(0,0,0),(.21,.23,.24),cream,head,'head')
solid('short pointed beak',[(-.085,.17,-.08),(.085,.17,-.08),(-.075,.17,.035),(.075,.17,.035),(0,.39,-.055)],[(0,1,4),(1,3,4),(3,2,4),(2,0,4),(0,2,3,1)],beakmat,head,'head')
for side in [-1,1]:
    volume(f'eye {side}',(side*.195,.12,.04),(.025,.028,.028),eye_mat,head,'head')
    volume(f'wattle {side}',(side*.06,.20,-.22),(.05,.07,.105),red,head,'head')
    volume(f'folded feather wing {side}',(side*.285,-.09,1.02),(.09,.34,.23),wingmat,body,'body')
    volume(f'wing highlight {side}',(side*.35,-.04,1.09),(.035,.24,.10),buff,body,'body')
for j,(y,z) in enumerate([(-.13,.23),(0,.29),(.13,.25)]):volume(f'comb lobe {j}',(0,y,z),(.055,.075,.095),red,head,'head')
for j in range(3):
    x=(j-1)*.13
    solid(f'raised tail feather {j}',[(x-.075,-.40,1.02),(x+.075,-.40,1.02),(x+.10,-.70,1.38+j*.04),(x-.10,-.73,1.38+j*.04)],[(0,1,2,3),(3,2,1,0)],wingmat,body,'body')
bpy.ops.object.camera_add();scene.camera=bpy.context.object;scene.camera.data.type='ORTHO'
W = 48
ANCHOR = [24,35]
PIVOT = .98
STRIDE = 10*1.28/10
STANCE = .66
N = 32
FRAME_MS = 40
OFF = {'leg-1':0,'leg1':.5}

def empty(name,parent=None,loc=(0,0,0)):
    o = bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    o.parent=parent;o.location=loc;return o

pivot = empty('MOTION-torso',root,(0,0,PIVOT))
body.parent = pivot;body.location=(0,0,-PIVOT)
materials = {m.name:m for m in bpy.data.materials}
coat = beakmat
dark = beakmat
hoof_mat = beakmat

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
specs = [('leg',.08,.95,[.33,.45,.30,.10])]
for end,y,z,lengths in specs:
    for side in [-1,1]:
        name=f'{end}{side}'
        radii = [.095,.055,.035,.025]
        links=[egg(f'{name}-link-{i}',(r,r*1.08,L/2),coat) for i,(r,L) in enumerate(zip(radii,lengths))]
        hh=.025
        vertices=[];faces=[]
        for toe,dx,dy in [(0,-.10,.14),(1,0,.19),(2,.10,.14),(3,0,-.13)]:
            offset=len(vertices);vertices += [(x,y,z) for x,y,z in [(-.018,-.035,-hh),(.018,-.035,-hh),(dx+.018,dy,-hh),(dx-.018,dy,-hh),(-.018,-.035,hh),(.018,-.035,hh),(dx+.018,dy,hh),(dx-.018,dy,hh)]]
            faces += [tuple(offset+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]]
        hoof=solid(f'{name}-hoof',vertices,faces,hoof_mat,root,'foot')
        joints=[empty(f'{name}-joint-{i}',root) for i in range(5)]
        bulbs=[egg(f'{name}-joint-volume-{i}',(r,r,r),coat if i<3 else dark) for i,r in enumerate([.06,.045,.04],1)]
        x=side*.16
        legs[name]=dict(rest=Vector((x,y,z)),end=end,lengths=lengths,links=links,hoof=hoof,joints=joints,bulbs=bulbs,hh=hh)

def pose(t,clip='walk',travel=False):
    moving=clip=='walk'
    root.location.y=STRIDE*t if travel else 0
    heave=.075*math.sin(4*math.pi*t) if moving else 0
    pitch=.03*math.cos(4*math.pi*t) if moving else 0
    pivot.location=(.022*math.sin(2*math.pi*t) if moving else 0,0,PIVOT+heave)
    pivot.rotation_euler=(pitch,.012*math.sin(2*math.pi*t) if moving else 0,0)
    head.location=head_rest
    amount=math.sin(math.pi*t)**2 if clip=='action' else 0
    head.location=head_rest+Vector((0,.10*amount,-.16*amount));head.rotation_euler.x=-.85*amount+(-.035*math.cos(4*math.pi*(t-.04)) if moving else 0)
    bpy.context.view_layer.update()
    info={}
    for name,l in legs.items():
        p=(t-OFF[name])%1 if moving else .33
        planted=p<STANCE if moving else True
        q=0 if planted else (p-STANCE)/(1-STANCE)
        y=STRIDE*STANCE/2-STRIDE*p if planted and moving else (-STRIDE*STANCE/2+STRIDE*STANCE*q*q*(3-2*q) if moving else 0)
        lift=.10*math.sin(math.pi*q)**1.4
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
    bpy.context.view_layer.update();return info

def key(o,f):
    o.keyframe_insert('location',frame=f)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)

animated=[pivot,head]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['hoof']]]+[o for o in scene.objects if o.name.startswith('TAIL-') or o.name.startswith('EAR-')]
clips=[('idle',1,1),('walk',10,32),('action',160,8)]
steps={'idle':1,'walk':4,'action':10}
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
scene.frame_start=10;scene.frame_end=134;scene.render.fps=100;scene.render.fps_base=1
cam=scene.camera;camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.frame_set(1);pose(0,'idle')
scene['motionIdentity']=f'{SPECIES}-roster-v2';scene['strideWorldUnits']=STRIDE;scene['stanceFraction']=STANCE
scene['poseCount']=32;scene['frameDurationMs']=FRAME_MS;scene['walkFrameStep']=4
scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()})
scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()})
scene['footfallOffsets']=json.dumps(OFF);scene['bodyName']=body.name
scene['bodyAnchor']=json.dumps([0,-.06,.98])
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))

def project_world(p):
    v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def projected(o,p=(0,0,0)):
    return project_world(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world@Vector(p))
body_anchor=Vector((0,-.06,.98))
def paint_volumes():
    result={}
    for obj in scene.objects:
        if obj.type!='MESH' or not obj.get('paintGroup'):continue
        points=[project_world(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world@v.co) for v in obj.data.vertices]
        result[obj.name]=dict(group=obj['paintGroup'],key=obj.data.materials[0]['paintKey'],points=points,depth=sum(p[2] for p in points)/len(points))
    return result

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
    references[facing]=dict(volumes=paint_volumes(),body=projected(body,body_anchor),head=projected(head),bodyAngle=angle(body),headAngle=angle(head),bodyBasis=basis(body,body_anchor),headBasis=basis(head,(0,0,0)))
    for clip,start,count in clips:
        for i in range(count):
            scene.frame_set(start+i*steps[clip]);info=pose(i/count,clip)
            r=dict(facing=facing,clip=clip,index=i,frame=start+i*steps[clip],body=projected(body,body_anchor),head=projected(head),bodyAngle=angle(body),headAngle=angle(head),bodyBasis=basis(body,body_anchor),headBasis=basis(head,(0,0,0)),contacts={})
            for n,l in legs.items():
                r['contacts'][n]={**info[n],'screen':[projected(o) for o in l['joints']]}
            r['toes']={n:[projected(l['hoof'],p) for p in [(0,-.035,0),(-.10,.14,0),(0,.19,0),(.10,.14,0),(0,-.13,0)]] for n,l in legs.items()}
            records.append(r)
            # Separate raw geometry evidence is never substituted for pixel art.
            scene.render.filepath=str(TMP/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
result=dict(identity=f'{SPECIES}-roster-v2',canvas=W,anchor=ANCHOR,frameDurationMs=FRAME_MS,strideWorldUnits=STRIDE,stanceFraction=STANCE,footfallOffsets=OFF,references=references,records=records)
(S/'projection.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
print('LONG_LEGGED_SOURCE_OK',SPECIES,len(records))
