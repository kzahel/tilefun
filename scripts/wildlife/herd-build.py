"""Fixed-anatomy rumination, bleating and ground-supported rolling actions."""
import bpy,hashlib,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view

R=Path(__file__).resolve().parents[2];animal=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{animal}/behavior-v1';O=R/f'public/demos/wildlife-v2/{animal}/behavior-v1'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'));assert not (S/'receipt.json').exists(),'Registered banks are immutable'
for p,h in I['sha256'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.fps=100;scene.frame_set(1)
root=bpy.data.objects['ROOT-fixed-ground'];root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
W=I['canvas'];cam=scene.camera;cow=animal=='cow';donkey=animal=='donkey';sheep=animal=='sheep'
body=bpy.data.objects['BODY-rigid'];head=bpy.data.objects['HEAD-rigid'];pivot=bpy.data.objects['MOTION-torso']
lengths=json.loads(scene['limbLengths']);hips=json.loads(scene['hipRest']);anchor=Vector(json.loads(scene['bodyAnchor']))
camera=json.loads((R/'art-source/wildlife-v2/camera.json').read_text(encoding='utf8'))
def node(name,parent,p=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=p;return o
def reparent(o,parent):
 world=o.matrix_world.copy();o.parent=parent;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_world=world;bpy.context.view_layer.update()
if not donkey:
 neck=node('NECK-connected-rigid',body,(0,.8,1.32) if cow else (0,.48,.90));bpy.context.view_layer.update()
 for o in [head,bpy.data.objects['neck']]:reparent(o,neck)
 jaw=node('JAW-chew',head,(0,.12,-.15));bpy.context.view_layer.update()
 jawParts=[bpy.data.objects['muzzle']]+([bpy.data.objects[f'nostril-{s}'] for s in [-1,1]] if cow else [bpy.data.objects['nose']])
 for o in jawParts:reparent(o,jaw)
 if cow:
  udder=node('UDDER-support',body);bpy.context.view_layer.update()
  for o in [o for o in scene.objects if o.name=='udder' or o.name.startswith('teat-')]:reparent(o,udder)
 else:
  tailCtl=node('TAIL-bleat',body,(0,-.77,1.03));bpy.context.view_layer.update();reparent(bpy.data.objects['tail-short-volume'],tailCtl)
 neckHeadLocal=neck.matrix_world.inverted()@head.matrix_world.translation
else:
 jaw=bpy.data.objects['JAW'];headRest=head.location.copy();neckL=json.loads(scene['neckLengths']);neckBase=Vector(json.loads(scene['neckBase']))
 roll=node('BATH-roll',root);bpy.context.view_layer.update()
 for o in list(root.children):
  if o!=roll:reparent(o,roll)
objects=[o for o in scene.objects if o!=root and o.type!='CAMERA'];meshes=[o for o in objects if o.type=='MESH']
rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objects}
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
scales={o.name:list(o.scale) for o in objects}
for o in objects:o.animation_data_clear()
clips=[('lower',10,75),('graze',12,100),('raise',10,75),('lie',12,100),('ruminate',16,150),('stand',12,100)] if cow else [('bleat',12,100)] if sheep else [('lie',12,100),('roll',24,150),('stand',12,100)]
def frame(f):scene.frame_set(math.floor(f),subframe=f-math.floor(f))
def align(o,a,b):o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
def solve(a,b,L1,L2,pole):
 delta=b-a;d=delta.length;u=delta.normalized();assert abs(L1-L2)+1e-5<d<L1+L2-1e-5,(animal,'IK reach',d,L1,L2)
 v=(L1*L1-L2*L2+d*d)/(2*d);pole=(pole-u*pole.dot(u)).normalized();return a+u*v+pole*math.sqrt(max(0,L1*L1-v*v))
def pose(clip,t):
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 smooth=t*t*(3-2*t);lying=smooth if clip=='lie' else 1-smooth if clip=='stand' else 1 if clip in ['ruminate','roll'] else 0
 pivot.location.z-=(.75 if cow else .85)*lying
 if cow:
  udder.location.z+=.30*lying
  lower=smooth if clip=='lower' else 1-smooth if clip=='raise' else 1 if clip=='graze' else 0
  neck.rotation_euler.x=-1.8*lower+(.035*math.sin(4*math.pi*t) if clip in ['graze','ruminate'] else 0)
  head.rotation_euler.x+=.40*lower
  if clip in ['ruminate','graze']:
   jaw.rotation_euler.x=-.16*math.sin(4*math.pi*t)**2;jaw.rotation_euler.z=.06*math.sin(4*math.pi*t)
  pivot.location.z+=.025*lying*math.sin(2*math.pi*t)
 elif sheep:
  amount=math.sin(2*math.pi*t);neck.rotation_euler.x=.22*amount;head.rotation_euler.z=.10*amount
  jaw.rotation_euler.x=-.28*math.sin(2*math.pi*t)**2
  for s in [-1,1]:bpy.data.objects[f'EAR-{s}'].rotation_euler.y+=s*.5*amount
  tailCtl.rotation_euler.z=1.3*amount;pivot.location.z+=.02*math.sin(4*math.pi*t)
 else:
  bm=pivot.matrix_local@body.matrix_local;head.location=bm@headRest;head.rotation_euler.x=-.12*lying
  base=bm@neckBase;tip=head.location;knee=solve(base,tip,*neckL,Vector((0,0,1)))
  for j,p in enumerate([base,knee,tip]):
   bpy.data.objects[f'neck-joint-{j}'].location=p;bpy.data.objects[f'neck joint volume {j}'].location=p
  for j,(p,q) in enumerate(zip([base,knee],[knee,tip])):align(bpy.data.objects[f'neck-link-{j}'],p,q)
 bpy.context.view_layer.update()
 for n,Ls in lengths.items():
  fore=n.startswith('fore');hip=pivot.matrix_local@body.matrix_local@Vector(hips[n]);foot=Vector(rest[f'{n}-joint-4'][0])
  L1,L2,L3,L4=Ls;fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
  flex=(.10 if fore else .50)+(1.65 if fore else 1.15)*lying
  chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));elbow=solve(hip,fetlock,L1,chord,Vector((0,-1 if fore else 1,0)))
  knee=solve(elbow,fetlock,L2,L3,Vector((0,1 if fore else -1,0)));ps=[hip,elbow,knee,fetlock,foot]
  for j,(p,q) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'{n}-link-{j}'],p,q)
  for j,p in enumerate(ps):bpy.data.objects[f'{n}-joint-{j}'].location=p
  for j,p in enumerate(ps[1:4],1):bpy.data.objects[f'{n}-joint-volume-{j}'].location=p
  bpy.data.objects[f'{n}-foot' if donkey else f'{n}-hoof'].location=foot
 if cow or donkey:
  base=pivot.matrix_local@body.matrix_local@Vector((0,-1.31,1.77) if cow else (0,-.90,1.86));ps=[base]
  tailL=[.38,.40,.30] if cow else json.loads(scene['tailLengths'])
  for j,L in enumerate(tailL):
   delta=Vector((.30*math.sin(2*math.pi*t-j*.3),-.4-.6*lying,-1+.65*lying));ps.append(ps[-1]+delta.normalized()*L)
  for j,(p,q) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'tail-{j}' if cow else f'tail-link-{j}'],p,q)
  for j,p in enumerate(ps):bpy.data.objects[f'TAIL-joint-{j}' if cow else f'tail-joint-{j}'].location=p
 if donkey and clip=='roll':
  angle=2*math.pi*t;center=Vector((0,0,.85));roll.matrix_basis=Matrix.Translation(center)@Matrix.Rotation(angle,4,'Y')@Matrix.Translation(-center)
  bpy.context.view_layer.update();bottom=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
  roll.location.z+=.02-bottom
 bpy.context.view_layer.update()
starts={};cursor=500
for clip,count,ms in clips:
 starts[clip]=cursor;step=ms/10;loop=clip in ['graze','ruminate','bleat','roll']
 for i in range((count if loop else count-1)*4+1):
  t=i/(count*4 if loop else (count-1)*4);f=cursor+i*step/4;frame(f);pose(clip,t)
  for o in objects:
   o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
 cursor+=count*step+10
def project(p):
 v=world_to_camera_view(scene,cam,p);return [round(v.x*W,6),round((1-v.y)*W,6),round(v.z,6)]
def at(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def basis(o,p,f):
 a=at(o,p);b=at(o,Vector(p)+Vector((0,1,0) if f in ['left','right'] else (1,0,0)));c=at(o,Vector(p)+Vector((0,0,1)));return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
def record(f,clip,i):
 r=dict(facing=f,clip=clip,index=i,body=at(body,anchor),head=at(head),socket=at(head,(0,.61,-.27) if cow else (0,.45,-.17)),contacts={n:dict(screen=[at(bpy.data.objects[f'{n}-joint-{j}']) for j in range(5)]) for n in lengths})
 if donkey:
  r['volumes']=[dict(name=o.name,key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co) for v in o.data.vertices],depth=at(o)[2]) for o in meshes]
 else:
  r.update(bodyBasis=basis(body,anchor,f),headBasis=basis(head,(0,0,0),f),headHull=[project(bpy.data.objects['skull'].matrix_world@v.co) for v in bpy.data.objects['skull'].data.vertices],neckBase=at(neck),neckBasis=basis(neck,(0,0,0),f),neckHull=[project(bpy.data.objects['neck'].matrix_world@v.co) for v in bpy.data.objects['neck'].data.vertices],jaw=at(jaw),jawBasis=basis(jaw,(0,0,0),f),jawHull=[project(o.matrix_world@v.co) for o in jawParts for v in o.data.vertices])
  if cow:r.update(udder=at(bpy.data.objects['udder']),udderBasis=basis(udder,(0,0,0),f),tail=[at(bpy.data.objects[f'TAIL-joint-{j}']) for j in range(4)])
  else:r.update(tail=[at(bpy.data.objects['tail-short-volume'])],ears={str(s):dict(base=at(bpy.data.objects[f'EAR-{s}']),tip=at(bpy.data.objects[f'EAR-{s}'],(s*.3,.07,-.12))) for s in [-1,1]})
 return r
references={};records=[]
for f,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);pose('idle',0);references[f]=record(f,'idle',0)
 for clip,count,ms in clips:
  for i in range(count):frame(starts[clip]+i*ms/10);bpy.context.view_layer.update();records.append(record(f,clip,i))
root.rotation_euler=(0,0,0);frame(500);scene.frame_start=500;scene.frame_end=math.ceil(cursor)
scene['behaviorIdentity']=f'{animal}-behavior-v1';scene['behaviorClips']=json.dumps(dict(clips=clips,starts=starts));bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{animal}.blend'))
palette=json.loads((R/I['masters']).read_text(encoding='utf8'))['palette']
(S/'projection.json').write_text(json.dumps(dict(canvas=W,anchor=I['anchor'],palette=palette,clips=clips,references=references,records=records),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
# Reopen the saved source and inspect continuous half-pose samples, independently of pose().
bpy.ops.wm.open_mainfile(filepath=str(S/f'{animal}.blend'));scene=bpy.context.scene
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
assert all(list(bpy.data.objects[n].scale)==s for n,s in scales.items())
checks=feet=attachments=neckChecks=groundChecks=0;maximum=0;minimum=100
for clip,count,ms in clips:
 for i in range((count-1)*2+1):
  frame(starts[clip]+i*ms/20);bpy.context.view_layer.update();root=bpy.data.objects['ROOT-fixed-ground'];assert root.location.length<1e-5
  for n,Ls in lengths.items():
   hip=bpy.data.objects['BODY-rigid'].matrix_world@Vector(hips[n]);actual=bpy.data.objects[f'{n}-joint-0'].matrix_world.translation;assert (hip-actual).length<.003;attachments+=1
   for j,L in enumerate(Ls):
    link=bpy.data.objects[f'{n}-link-{j}'];a=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation
    error=max((link.matrix_world@Vector((0,0,-L/2))-a).length,(link.matrix_world@Vector((0,0,L/2))-b).length);assert error<.003,(animal,clip,i,n,j,error);maximum=max(maximum,error);checks+=1
   if clip!='roll':
    foot=bpy.data.objects[f'{n}-joint-4'].matrix_world.translation;assert (foot-Vector(rest[f'{n}-joint-4'][0])).length<.003;feet+=1
  if not donkey:
   neck=bpy.data.objects['NECK-connected-rigid'];expected=neck.matrix_world@neckHeadLocal;actual=bpy.data.objects['HEAD-rigid'].matrix_world.translation;assert (expected-actual).length<.0001;neckChecks+=1
  else:
   for j,L in enumerate(neckL):
    link=bpy.data.objects[f'neck-link-{j}'];a=bpy.data.objects[f'neck-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'neck-joint-{j+1}'].matrix_world.translation;error=max((link.matrix_world@Vector((0,0,-L/2))-a).length,(link.matrix_world@Vector((0,0,L/2))-b).length);assert error<.003;neckChecks+=1
   if clip=='roll':
    bottom=min((o.matrix_world@v.co).z for o in scene.objects if o.type=='MESH' for v in o.data.vertices);assert bottom>=.005,(clip,i,bottom);minimum=min(minimum,bottom);groundChecks+=1
O.mkdir(parents=True,exist_ok=True)
(O/'source-audit.json').write_text(json.dumps(dict(identity=f'{animal}-behavior-v1',savedSourceIndependentlyChecked=True,meshGeometryUnchanged=geometry,fixedCamera=True,rootMotion=False,physicalTimelineMilliseconds=True,fixedLengthEndpointChecks=checks,plantedFootChecks=feet,hipAttachmentChecks=attachments,neckAttachmentChecks=neckChecks,rollingGroundClearanceChecks=groundChecks,minimumRollingGroundWorldUnits=minimum if groundChecks else None,maxEndpointGapWorldUnits=maximum),indent=2)+'\n',encoding='utf8',newline='\n')
print('HERD_SOURCE_OK',animal,len(records),checks,feet,maximum)
