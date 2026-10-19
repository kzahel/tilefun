"""Great apes: fixed-volume knuckle-walking anatomy and projected pixel masters.
Run from Blender in a fresh empty scene; no previous animal source or pixels are read.
Existing registered banks are read-only. Fresh outputs use a separate roster-v3 identity.
"""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[4]
SPECIES = globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];SC=P['scale']
S = ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v3'
OUT = ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v3'
TMP = ROOT/f'data/wildlife-147/{SPECIES}/renders'
assert not (S/'receipt.json').exists(), 'Registered bank is immutable; use a new revision'
for p in [S,OUT,TMP]: p.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True;scene.view_settings.view_transform='Standard'
def material(name,color,key):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*[v/255 for v in bytes.fromhex(P['coat'][key][1:])],1);mat['paintKey']=key;return mat
fur=material('dark ape fur',(.23,.27,.29),'B');upper=material('upper fur planes',(.36,.41,.43),'H');silver=material('fur highlight',(.54,.58,.58),'S');skin=material('bare face skin',(.32,.35,.36),'F');muzzle=material('muzzle planes',(.49,.52,.50),'M');ink=material('eyes nostrils and contour',(.09,.12,.13),'K');palm=material('knuckle skin',(.20,.24,.26),'P')
def node(name,parent=None,loc=(0,0,0)):
    obj=bpy.data.objects.new(name,None);scene.collection.objects.link(obj);obj.parent=parent;obj.location=Vector(loc)*SC;return obj
root=node('ROOT-fixed-ground');body=node('BODY-rigid',root);head=node('HEAD-rigid',body,(0,1.0,3.70));head_rest=head.location.copy()
def volume(name,loc,radii,mat,parent,group):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);obj=bpy.context.object;obj.name=name;obj.scale=[v*SC for v in radii];bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.parent=parent;obj.location=Vector(loc)*SC;obj.data.materials.append(mat);obj['paintGroup']=group;return obj
def solid(name,vertices,faces,mat,parent,group):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=parent;obj.data.materials.append(mat);obj['paintGroup']=group;return obj
torso=volume('deep barrel torso',(0,-.05,2.65),(.67,.78,.90),fur,body,'body');volume('broad shoulders',(0,.55,2.94),(P['shoulderRadius'],.50,.52),upper,body,'body');volume('narrower pelvis',(0,-.74,2.05),(.60,.50,.65),fur,body,'body');volume('neck mass',(0,.73,3.28),(.55,.40,.51),fur,body,'body')

volume('heavy skull',(0,0,0),(.49,.48,.51),fur,head,'head');volume('bare facial mask',(0,.47,-.01),(.39,.16,.37),skin,head,'head');volume('lower jaw',(0,.32,-.38),(.36,.34,.25),skin,head,'head');volume('broad muzzle',(0,.59,-.24),(.33,.19,.18),muzzle,head,'head');volume('flat dark nose',(0,.69,-.09),(.23,.11,.13),palm,head,'head');volume('heavy brow',(0,.59,.19),(.35,.11,.075),fur,head,'head')
for side in [-1,1]:
    volume(f'eye {side}',(side*.25,.605,.08),(.035,.035,.03),ink,head,'head');volume(f'nostril {side}',(side*.09,.79,-.11),(.045,.022,.026),ink,head,'head');volume(f'round ear {side}',(side*.49,-.02,-.05),(.12,.10,.15),skin,head,'head')
if SPECIES=='chimpanzee':
    for side in [-1,1]:volume(f'large ear inner {side}',(side*.50,.01,-.04),(.13,.10,.18),muzzle,head,'head')
    volume('crown crest',(0,-.05,.46),(.20,.27,.16),fur,head,'head')
else:
    for side in [-1,1]:
        volume(f'wide cheek flange {side}',(side*.48,.16,-.02),(.23,.18,.39),palm,head,'head')
        for j in range(3):volume(f'long shoulder hair {side} {j}',(side*(.65+j*.08),.32,2.7-j*.1),(.14,.20,.42),upper,body,'body')
    volume('throat pouch',(0,.45,-.52),(.30,.25,.25),skin,head,'head')
bpy.ops.object.camera_add();scene.camera=bpy.context.object;scene.camera.data.type='ORTHO'
W = 96
ANCHOR = [48,72]
PIVOT = 2.65*SC
STRIDE = 2.24*SC
STANCE = .76
N = 32
FRAME_MS = P["frameMs"]
OFF = {'hind-1':0,'fore1':.25,'hind1':.5,'fore-1':.75}

def empty(name,parent=None,loc=(0,0,0)):
    o = bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    o.parent=parent;o.location=loc;return o

pivot = empty('MOTION-torso',root,(0,0,PIVOT))
body.parent = pivot;body.location=(0,0,-PIVOT)
materials = {m.name:m for m in bpy.data.materials}
coat = fur
dark = fur
hoof_mat = palm

def egg(name,radii,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
    o=bpy.context.object;o.name=name;o.scale=radii
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.parent=root;o.data.materials.append(mat);o['paintGroup']='limb';return o

def align(o,a,b):
    o.location=(a+b)/2;z=(b-a).normalized();x=Vector((0,1,0))
    x=(x-z*x.dot(z)).normalized();y=z.cross(x)
    q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=q

legs={}
specs = [('fore',.65*SC,3.1*SC,[v*SC for v in P['foreLengths']]),('hind',-.76*SC,2.0*SC,[v*SC for v in [.95,.85,.40,.15]])]
for end,y,z,lengths in specs:
    for side in [-1,1]:
        name=f'{end}{side}'
        radii = [v*SC for v in ([.27,.22,.14,.13] if end=='fore' else [.32,.22,.15,.12])]
        links=[egg(f'{name}-link-{i}',(r,r*1.08,L/2),coat) for i,(r,L) in enumerate(zip(radii,lengths))]
        hh=(.14 if end=='fore' else .11)*SC
        hoof=egg(f'{name}-hoof',(.20*SC,(.25 if end=='fore' else .34)*SC,(.11*SC) if end=='fore' else hh),hoof_mat)
        if end=='fore':
            for j in range(4):volume(f'{name} knuckle {j}',((j-1.5)*.09,.17,-.06),(.047,.11,.08),palm,hoof,'foot')
        else:volume(f'{name} big toe',(-side*.17,.26,-.015),(.09,.20,.09),palm,hoof,'foot')
        joints=[empty(f'{name}-joint-{i}',root) for i in range(5)]
        bulbs=[egg(f'{name}-joint-volume-{i}',(r,r,r),coat if i<3 else dark) for i,r in enumerate([v*SC for v in [.21,.18,.14]],1)]
        x=side*(P['shoulderX'] if end=='fore' else .43)*SC
        legs[name]=dict(rest=Vector((x,y,z)),end=end,lengths=lengths,links=links,hoof=hoof,joints=joints,bulbs=bulbs,hh=hh)

def pose(t,clip='walk',travel=False):
    moving=clip=='walk'
    root.location.y=STRIDE*t if travel else 0
    amount=math.sin(math.pi*t)**2 if clip=='action' else 0
    heave=.10*SC*math.sin(4*math.pi*t) if moving else .04*SC*amount*math.sin(6*math.pi*t)
    pitch=.035*math.cos(4*math.pi*t) if moving else .03*amount
    pivot.location=(.025*SC*math.sin(2*math.pi*t) if moving else 0,0,PIVOT+heave)
    pivot.rotation_euler=(pitch,.012*math.sin(2*math.pi*t) if moving else 0,0)
    head.location=head_rest;head.rotation_euler.x=(-.025*math.cos(4*math.pi*t) if moving else -.06*amount)
    bpy.context.view_layer.update()
    info={}
    for name,l in legs.items():
        p=(t-OFF[name])%1 if moving else .33;planted=p<STANCE if moving else True
        q=0 if planted else (p-STANCE)/(1-STANCE)
        y=STRIDE*STANCE/2-STRIDE*p if planted and moving else (-STRIDE*STANCE/2+STRIDE*STANCE*q*q*(3-2*q) if moving else 0)
        lift=.22*SC*math.sin(math.pi*q)**1.4
        foot=Vector((l['rest'].x,l['rest'].y+y+((.40 if l['end']=='hind' else -.05)*SC),l['hh']+lift))
        if clip=='action' and name=='fore1':
            side=1 if l['rest'].x>0 else -1
            target=(pivot.matrix_local@body.matrix_local)@Vector((.38*SC,1.12*SC,(2.65+.10*math.sin(4*math.pi*t))*SC))
            foot=foot.lerp(target,amount);planted=amount<1e-8
        hip=pivot.matrix_local@body.matrix_local@l['rest']
        L1,L2,L3,L4=l['lengths']
        fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
        flex=(.10 if l['end']=='fore' else .50)+(.95 if l['end']=='fore' else .50)*math.sin(math.pi*q)**2
        if clip=='action' and name=='fore1':flex=.10+1.9*amount
        chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex))
        delta=fetlock-hip;d=delta.length;u=delta.normalized()
        assert abs(L1-chord)<d<L1+chord,(SPECIES,name,t,'upper reach',d,L1+chord)
        a=(L1*L1-chord*chord+d*d)/(2*d)
        pole=Vector((0,-1 if l['end']=='fore' else 1,0));pole=(pole-u*pole.dot(u)).normalized()
        elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a))
        delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d)
        pole=Vector(((1 if l['rest'].x>0 else -1)*.65*amount,1 if l['end']=='fore' else -1,0));pole=(pole-u*pole.dot(u)).normalized()
        knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a))
        points=[hip,elbow,knee,fetlock,foot]
        for o,a,b in zip(l['links'],points,points[1:]):align(o,a,b)
        for o,pnt in zip(l['joints'],points):o.location=pnt
        for o,pnt in zip(l['bulbs'],points[1:4]):o.location=pnt
        l['hoof'].location=foot;l['hoof'].rotation_euler.x=-amount*math.pi/2 if clip=='action' and name=='fore1' else 0
        info[name]=dict(phase=p,planted=planted,lengths=l['lengths'])
    bpy.context.view_layer.update();return info

def key(o,f):
    o.keyframe_insert('location',frame=f)
    o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)

animated=[pivot,head]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['hoof']]]+[o for o in scene.objects if o.name.startswith('EAR-')]
clips=[('idle',1,1),('walk',10,32),('action',260,16)]
steps={'idle':1,'walk':FRAME_MS/10,'action':5}
for clip,start,count in clips:
    substeps=16 if clip=='action' else 1
    for i in range(count*substeps+1):
        pose(i/(count*substeps),clip)
        for o in animated:key(o,start+i*steps[clip]/substeps)
for o in animated:
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:k.interpolation='LINEAR'
scene.frame_start=10;scene.frame_end=227;scene.render.fps=100;scene.render.fps_base=1
cam=scene.camera;camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.frame_set(1);pose(0,'idle')
scene['motionIdentity']=f'{SPECIES}-roster-v3';scene['strideWorldUnits']=STRIDE;scene['stanceFraction']=STANCE
scene['poseCount']=32;scene['frameDurationMs']=FRAME_MS;scene['walkFrameStep']=FRAME_MS/10
scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()})
scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()})
scene['footfallOffsets']=json.dumps(OFF);scene['bodyName']=body.name
scene['bodyAnchor']=json.dumps([0,-.05*SC,2.65*SC])
scene['clipFrameSpecs']=json.dumps(clips);scene['clipFrameSteps']=json.dumps(steps);scene['actionSubsteps']=16
scene.timeline_markers.new('WALK - diagonal planted knuckles',frame=10);scene.timeline_markers.new('GROOM - 16 poses, dense source keys',frame=260)
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))

def project_world(p):
    v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def projected(o,p=(0,0,0)):
    return project_world(o.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world@Vector(p))
body_anchor=Vector((0,-.05*SC,2.65*SC))
def paint_volumes():
    result={}
    for obj in scene.objects:
        if obj.type!='MESH' or not obj.get('paintGroup'):continue
        points=[project_world(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world@v.co) for v in obj.data.vertices]
        result[obj.name]=dict(group=obj['paintGroup'],key=obj.data.materials[0]['paintKey'],points=points,depth=sum(p[2] for p in points)/len(points))
    return result

def contour(points):
    ps=sorted(set((round(p[0],5),round(p[1],5)) for p in points));lo=[];hi=[]
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    for p in ps:
        while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
        hi.append(p)
    return lo[:-1]+hi[:-1]

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
            frame=start+i*steps[clip];scene.frame_set(math.floor(frame),subframe=frame%1);info=pose(i/count,clip)
            r=dict(volumes=[dict(name=n,key=v['key'],depth=v['depth'],points=contour(v['points'])) for n,v in paint_volumes().items()],facing=facing,clip=clip,index=i,frame=start+i*steps[clip],body=projected(body,body_anchor),head=projected(head),bodyAngle=angle(body),headAngle=angle(head),bodyBasis=basis(body,body_anchor),headBasis=basis(head,(0,0,0)),contacts={})
            for n,l in legs.items():
                r['contacts'][n]={**info[n],'screen':[projected(o) for o in l['joints']]}
            r['hands']={n:[project_world(obj.matrix_world@v.co) for obj in [l['hoof'],*l['hoof'].children] if obj.type=='MESH' for v in obj.data.vertices] for n,l in legs.items()}
            r['knuckles']={n:[projected(obj) for obj in l['hoof'].children if 'knuckle' in obj.name] for n,l in legs.items()}
            r['actionAmount']=math.sin(math.pi*i/count)**2 if clip=='action' else 0
            records.append(r)
            # Separate raw geometry evidence is never substituted for pixel art.
            scene.render.filepath=str(TMP/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
result=dict(identity=f'{SPECIES}-roster-v3',canvas=W,anchor=ANCHOR,frameDurationMs=FRAME_MS,strideWorldUnits=STRIDE,stanceFraction=STANCE,footfallOffsets=OFF,references=references,records=records,palette=P['coat'],motionClip='walk',walkStride=STRIDE,exampleDistance=STRIDE*10,speed=STRIDE*10/(FRAME_MS*32/1000),clipSpecs=[(c,start,count,steps[c]) for c,start,count in clips])
(S/'projection.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf8')
print('LONG_LEGGED_SOURCE_OK',SPECIES,len(records))
