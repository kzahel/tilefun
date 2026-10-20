"""Fresh red squirrel: fixed-volume bounding anatomy and projected pixel masters.
Run from Blender in a fresh empty scene; no previous animal source or pixels are read.
Existing registered banks are read-only. Fresh outputs use a separate roster-v2 identity.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[4]
SPECIES = 'red-squirrel'
assert SPECIES=='red-squirrel'
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
russet=material('red squirrel russet',(.67,.29,.12),'B');upper=material('warm upper fur',(.85,.45,.19),'H');cream=material('cream throat and paws',(.91,.81,.59),'C');dark=material('dark eye nose contour',(.19,.16,.12),'K');tailmat=material('deep tail fur',(.49,.22,.12),'S');nutmat=material('held chestnut',(.48,.35,.17),'N')
def node(name,parent=None,loc=(0,0,0)):
    obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);obj.parent=parent;obj.location=loc;return obj
root=node('ROOT-fixed-ground');body=node('BODY-rigid',root);head=node('HEAD-rigid',body,(0,.39,.80));head_rest=head.location.copy()
def volume(name,loc,radii,mat,parent,group):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);obj=bpy.context.object;obj.name=name;obj.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.parent=parent;obj.location=loc;obj.data.materials.append(mat);obj['paintGroup']=group;return obj
def solid(name,vertices,faces,mat,parent,group):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=parent;obj.data.materials.append(mat);obj['paintGroup']=group;return obj
volume('slim torso',(0,-.02,.54),(.22,.41,.23),russet,body,'body');volume('shoulder',(0,.21,.60),(.20,.22,.24),upper,body,'body');volume('round haunch',(0,-.25,.50),(.23,.25,.25),russet,body,'body');volume('cream throat',(0,.31,.60),(.12,.10,.20),cream,body,'body');volume('cream belly',(0,-.02,.37),(.15,.29,.07),cream,body,'body')
volume('small round skull',(0,0,0),(.18,.20,.19),russet,head,'head');volume('cream muzzle',(0,.18,-.03),(.11,.15,.08),cream,head,'head');volume('small dark nose',(0,.30,-.035),(.045,.035,.03),dark,head,'head')
for side in [-1,1]:
    volume(f'eye {side}',(side*.16,.11,.05),(.025,.025,.027),dark,head,'head')
    ear=node(f'EAR-{side}',head,(side*.13,-.05,.13));volume(f'ear {side}',(0,0,.08),(.055,.065,.13),russet,ear,'head');solid(f'tuft {side}',[(-.035,-.015,.13),(.035,-.015,.13),(side*.025,.015,.28)],[(0,1,2),(2,1,0)],tailmat,ear,'head')
bpy.ops.object.camera_add();scene.camera=bpy.context.object;scene.camera.data.type='ORTHO'
W = 48
ANCHOR = [24,35]
PIVOT = .55
STRIDE = 1.6
STANCE = .66
N = 32
FRAME_MS = 20
OFF = {'hind-1':0,'fore-1':0,'hind1':0,'fore1':0}

def empty(name,parent=None,loc=(0,0,0)):
    o = bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    o.parent=parent;o.location=loc;return o

pivot = empty('MOTION-torso',root,(0,0,PIVOT))
body.parent = pivot;body.location=(0,0,-PIVOT)
materials = {m.name:m for m in bpy.data.materials}
coat = russet
dark = russet
hoof_mat = cream

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
specs = [('fore',.25,.62,[.24,.25,.22,.07]),('hind',-.28,.58,[.26,.25,.23,.07])]
for end,y,z,lengths in specs:
    for side in [-1,1]:
        name=f'{end}{side}'
        radii = [.075,.05,.035,.03] if end=='fore' else [.10,.055,.04,.03]
        links=[egg(f'{name}-link-{i}',(r,r*1.08,L/2),coat) for i,(r,L) in enumerate(zip(radii,lengths))]
        hh=.045
        hoof=egg(f'{name}-hoof',(.06,.11 if end=='fore' else .15,hh),hoof_mat)
        joints=[empty(f'{name}-joint-{i}',root) for i in range(5)]
        bulbs=[egg(f'{name}-joint-volume-{i}',(r,r,r),coat if i<3 else dark) for i,r in enumerate([.06,.045,.04],1)]
        x=side*.15
        legs[name]=dict(rest=Vector((x,y,z)),end=end,lengths=lengths,links=links,hoof=hoof,joints=joints,bulbs=bulbs,hh=hh)

tail_rest=[Vector(p) for p in [(0,-.48,.54),(0,-.70,.83),(0,-.72,1.15),(0,-.45,1.38),(0,-.22,1.30)]]
tail_lengths=[(b-a).length for a,b in zip(tail_rest,tail_rest[1:])]
tail_links=[egg(f'TAIL-fur-{i}',(r,r,L/2+.08),tailmat) for i,(r,L) in enumerate(zip([.17,.23,.23,.14],tail_lengths))]
tail_joints=[empty(f'TAIL-joint-{i}',root) for i in range(5)]
nut=egg('NUT-held',(.075,.085,.055),nutmat)

def pose(t,clip='walk',travel=False):
    moving=clip=='bound'
    root.location.y=STRIDE*t if travel else 0
    amount=math.sin(math.pi*t)**2 if clip=='action' else 0
    heave=-.14*math.sin(2*math.pi*t)**2 if moving else 0
    pitch=-.10*math.sin(2*math.pi*t) if moving else .55*amount
    pivot.location=(.012*math.sin(2*math.pi*t) if moving else 0,0,PIVOT+heave)
    pivot.rotation_euler=(pitch,.012*math.sin(2*math.pi*t) if moving else 0,0)
    head.location=head_rest+Vector((0,.04*amount,-.04*amount));head.rotation_euler.x=-.50*amount+(-.06*math.sin(2*math.pi*t) if moving else 0)
    bpy.context.view_layer.update()
    info={}
    for name,l in legs.items():
        air=max(0,min(1,(t-.15625)/.6875)) if moving else 0
        planted=not moving or air in [0,1]
        q=air if moving else 0
        y=(.14 if l['end']=='fore' else .22)*math.sin(2*math.pi*air) if moving else 0
        lift=.18*math.sin(math.pi*air)**1.2 if moving else 0
        foot=Vector((l['rest'].x+(.012 if l['rest'].x>0 else -.012),l['rest'].y+y,l['hh']+lift))
        if clip=='action' and l['end']=='fore':
            target=(pivot.matrix_local@body.matrix_local@head.matrix_local)@Vector((.07 if l['rest'].x>0 else -.07,.17,-.17))
            foot=foot.lerp(target,amount);planted=amount<1e-8
        p=t
        hip=pivot.matrix_local@body.matrix_local@l['rest']
        L1,L2,L3,L4=l['lengths']
        fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
        flex=(.10 if l['end']=='fore' else .50)+(.7 if l['end']=='fore' else .4)*math.sin(math.pi*q)**2
        if clip=='action' and l['end']=='fore':flex=.10+1.4*amount
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
    transform=pivot.matrix_local@body.matrix_local;base=transform@tail_rest[0];tail_joints[0].location=base
    for i,(obj,L) in enumerate(zip(tail_links,tail_lengths)):
        angle=.08*(math.sin(2*math.pi*t-i*.35)-math.sin(-i*.35)) if moving else .06*amount
        direction=(tail_rest[i+1]-tail_rest[i]).normalized();direction=Matrix.Rotation(angle,3,'Z')@direction
        nxt=base+(transform.to_3x3()@direction)*L;align(obj,base,nxt);tail_joints[i+1].location=nxt;base=nxt
    nut.location=(legs['fore-1']['hoof'].location+legs['fore1']['hoof'].location)/2+Vector((0,.02,.025));nut.hide_render=clip!='action'
    bpy.context.view_layer.update();return info

def key(o,f):
    o.keyframe_insert('location',frame=f)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
    if o==nut:o.keyframe_insert('hide_render',frame=f)

animated=tail_links+tail_joints+[nut,pivot,head]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['hoof']]]+[o for o in scene.objects if o.name.startswith('EAR-')]
clips=[('idle',1,1),('bound',10,32),('action',100,8)]
steps={'idle':1,'bound':2,'action':10}
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
scene.frame_start=10;scene.frame_end=72;scene.render.fps=100;scene.render.fps_base=1
cam=scene.camera;camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.frame_set(1);pose(0,'idle')
scene['motionIdentity']=f'{SPECIES}-roster-v2';scene['strideWorldUnits']=STRIDE;scene['stanceFraction']=STANCE
scene['poseCount']=32;scene['frameDurationMs']=FRAME_MS;scene['walkFrameStep']=2;scene['flightPush']=.10;scene['flightLand']=.54;scene['hopHeightPixels']=6;scene['tailLinkLengths']=json.dumps(tail_lengths)
scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()})
scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()})
scene['footfallOffsets']=json.dumps(OFF);scene['bodyName']=body.name
scene['bodyAnchor']=json.dumps([0,-.02,.54])
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))

def project_world(p):
    v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def projected(o,p=(0,0,0)):
    return project_world(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world@Vector(p))
body_anchor=Vector((0,-.02,.54))
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
            r['tail']=[projected(p) for p in tail_joints];r['nut']=projected(nut);r['actionAmount']=math.sin(math.pi*i/count)**2 if clip=='action' else 0
            records.append(r)
            # Separate raw geometry evidence is never substituted for pixel art.
            scene.render.filepath=str(TMP/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
result=dict(identity=f'{SPECIES}-roster-v2',canvas=W,anchor=ANCHOR,frameDurationMs=FRAME_MS,strideWorldUnits=STRIDE,stanceFraction=STANCE,footfallOffsets=OFF,references=references,records=records)
(S/'projection.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
print('LONG_LEGGED_SOURCE_OK',SPECIES,len(records))
