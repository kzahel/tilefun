"""Existing fixed-anatomy rigs: browsing/stamping, partner display and bill work."""
import bpy,hashlib,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view

R=Path(__file__).resolve().parents[2];a=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{a}/behavior-v1';O=R/f'public/demos/wildlife-v2/{a}/behavior-v1'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'));assert not (S/'receipt.json').exists(),'Registered banks are immutable'
for p,h in I['sha256'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.frame_set(1);scene.render.fps=100
deer=a=='deer';peacock=a=='peacock';raven=a=='raven';root=bpy.data.objects['ROOT-ground' if raven else 'ROOT-fixed-ground'];root.rotation_euler=(0,0,0)
body=bpy.data.objects['BODY-flight' if raven else 'BODY-rigid'];head=bpy.data.objects['HEAD-rigid'];pivot=body if raven else bpy.data.objects['MOTION-torso'];cam=scene.camera;W=I['canvas']
camera=json.loads((R/'art-source/wildlife-v2/camera.json').read_text(encoding='utf8'));palette=json.loads((R/I['masters']).read_text(encoding='utf8'))['palette']
anchor=Vector(json.loads(scene['bodyAnchor']));hipRest=json.loads(scene['hipRest']);lengths=json.loads(scene['legLengths' if raven else 'limbLengths']);neckLengths=json.loads(scene['neckLengths']) if peacock else []
bill=Vector((0,.18+I.get('beakLength',.38),-.025)) if raven else Vector((0,.54,-.13)) if deer else Vector((0,.36,-.08))
def frame(f):scene.frame_set(math.floor(f),subframe=f-math.floor(f))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [round(v.x*W,5),round((1-v.y)*W,5),round(v.z,6)]
def at(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
native=[];base=json.loads((R/I['metadata']).read_text(encoding='utf8'))
if raven:
 for facing,yaw in camera['modelYawDegrees'].items():
  root.rotation_euler.z=math.radians(yaw)
  for clip,meta in base['clips'].items():
   for i in range(meta['count']):
    f=1 if clip=='idle' else 10+i*I['motionMs']/10 if clip=='fly' else 120+i*10
    frame(f);bpy.context.view_layer.update();native.append(dict(facing=facing,column=meta['start']+i,socket=at(head,bill)))
root.rotation_euler=(0,0,0);frame(1);bpy.context.view_layer.update()
def node(name,parent,p):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=p;return o
def reparent(o,parent):
 world=o.matrix_world.copy();o.parent=parent;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_world=world;bpy.context.view_layer.update()
if not peacock:
 neck=node('BEHAVIOR-neck-connected',body,(0,.55,1.90) if deer else (0,.20,.65));bpy.context.view_layer.update()
 for o in [head,bpy.data.objects['neck']]+([bpy.data.objects['throat']] if deer else []):reparent(o,neck)
 neckBase=neck.location.copy();headLocal=head.location.copy()
 if deer:
  jaw=node('BEHAVIOR-jaw',head,(0,.10,-.12));bpy.context.view_layer.update()
  for n in ['muzzle','muzzle-white','nose']:reparent(bpy.data.objects[n],jaw)
 else:jaw=bpy.data.objects['JAW']
else:jaw=bpy.data.objects['JAW']
objects=[o for o in scene.objects if o!=root and o.type!='CAMERA'];meshes=[o for o in objects if o.type=='MESH']
rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objects};scales={o.name:list(o.scale) for o in objects}
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
footNames={n:n+('-hoof' if deer else '-foot') for n in lengths};feet={n:bpy.data.objects[k].location.copy() for n,k in footNames.items()}
def align(o,p,q):o.location=(p+q)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(q-p).to_track_quat('Z','Y')
def solve(p,q,L1,L2,pole):
 d=(q-p).length;u=(q-p).normalized();assert abs(L1-L2)+1e-5<d<L1+L2-1e-5,(a,'reach',d,L1,L2)
 along=(L1*L1-L2*L2+d*d)/(2*d);v=(pole-u*pole.dot(u)).normalized();return p+u*along+v*math.sqrt(max(0,L1*L1-along*along))
clips=[('lower',10,75),('browse',12,100),('raise',10,75),('stamp',12,50)] if deer else [('open',12,100),('display',16,125),('close',12,100)] if peacock else [('pickup',12,70),('bury',14,90)]
def pose(clip,t):
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 smooth=t*t*(3-2*t);wave=math.sin(math.tau*t)
 if deer:
  lower=smooth if clip=='lower' else 1-smooth if clip=='raise' else 1 if clip=='browse' else 0
  pivot.location.z-=.045*lower;neck.rotation_euler.x=-1.25*lower+(.045*math.sin(4*math.pi*t) if clip=='browse' else 0);head.rotation_euler.x+=.20*lower
  if clip=='browse':jaw.rotation_euler.x=-.16*math.sin(4*math.pi*t)**2
  if clip=='stamp':
   pivot.location.x+=.035*math.sin(math.pi*t)**2;pivot.location.z-=.025*math.sin(math.pi*t)**2
   bpy.data.objects['TAIL-hinge'].rotation_euler.x=-1.1*math.sin(math.pi*t)
   for side in [-1,1]:bpy.data.objects[f'EAR-{side}'].rotation_euler.y+=side*.25*math.sin(math.pi*t)
 elif peacock:
  fan=smooth if clip=='open' else 1-smooth if clip=='close' else 1
  pivot.location.z+=.035*wave*(1 if clip=='display' else math.sin(math.pi*t));head.location.z+=.035*wave;head.rotation_euler.z=.055*wave*fan
  tail=bpy.data.objects['TAIL-root'];tail.rotation_euler.z=.035*math.sin(4*math.pi*t)*fan
  Ls=json.loads(scene['tailFeathers'])
  for i,L in enumerate(Ls):
   f=2*i/(len(Ls)-1)-1;closed=Vector((math.sin(f*.20),-1,.08));opened=Vector((math.sin(f*1.20),-.30,math.cos(f*1.20)));v=(closed*(1-fan)+opened*fan).normalized();align(bpy.data.objects[f'TAIL-feather-{i}'],Vector(),v*L)
  for side in [-1,1]:bpy.data.objects[f'WING-{side}'].rotation_euler.y+=side*.12*fan*(.75+.25*wave)
  bm=pivot.matrix_local@body.matrix_local;p=bm@Vector(json.loads(scene['neckRoot']));q=head.location;mid=solve(p,q,*neckLengths,Vector((0,1,0)))
  for i,v in enumerate([p,mid,q]):bpy.data.objects[f'NECK-joint-{i}'].location=v
  for i,(p,q) in enumerate(zip([p,mid],[mid,q])):align(bpy.data.objects[f'NECK-link-{i}'],p,q)
 else:
  lower=math.sin(math.pi*t)**2 if clip=='pickup' else .75+.25*math.cos(4*math.pi*t)
  body.location.z-=.06*lower;neck.rotation_euler.x=-1.45*lower
  # Aim the bill at a small real object while keeping the entire neck/head rigid.
  headZ=neckBase.z+(Matrix.Rotation(neck.rotation_euler.x,3,'X')@headLocal).z+body.location.z
  target=.12+(1-lower)*(headZ+bill.z-.12);L=math.hypot(bill.y,bill.z)
  angle=math.asin(max(-.99,min(.99,(target-headZ)/L)))-math.atan2(bill.z,bill.y)
  head.rotation_euler.x=angle-neck.rotation_euler.x;jaw.rotation_euler.x=-.18*math.sin(math.pi*t)**2
 bpy.context.view_layer.update()
 bm=body.matrix_local if raven else pivot.matrix_local@body.matrix_local
 for n,Ls in lengths.items():
  hip=bm@Vector(hipRest[n]);foot=feet[n].copy()
  if deer and clip=='stamp' and n=='fore-1':foot.z+=.22*math.sin(math.pi*t)**2;foot.y+=.09*math.sin(math.pi*t)**2
  if raven:
   L1,L2,L3=Ls;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(.55));knee=solve(hip,foot,L1,chord,Vector((0,1,0)));ankle=solve(knee,foot,L2,L3,Vector((0,-1,0)));ps=[hip,knee,ankle,foot]
  else:
   L1,L2,L3,L4=Ls;ankle=foot+Vector((0,-.025,.10)).normalized()*L4;fore=n.startswith('fore');flex=(.10 if fore else .50) if deer else .65
   chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));knee=solve(hip,ankle,L1,chord,Vector((0,-1 if fore else 1,0)));mid=solve(knee,ankle,L2,L3,Vector((0,1 if fore else -1,0)));ps=[hip,knee,mid,ankle,foot]
  for j,(p,q) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'{n}-link-{j}'],p,q)
  for j,p in enumerate(ps):bpy.data.objects[f'{n}-joint-{j}'].location=p
  if not raven:
   for j,p in enumerate(ps[1:4],1):bpy.data.objects[f'{n}-joint-volume-{j}'].location=p
  bpy.data.objects[footNames[n]].location=foot
 bpy.context.view_layer.update()
starts={};cursor=500
for clip,count,ms in clips:
 starts[clip]=cursor;loop=clip in ['browse','display'];steps=(count if loop else count-1)*4
 for i in range(steps+1):
  t=i/steps;f=cursor+i*ms/40;frame(f);pose(clip,t)
  for o in objects:o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
 cursor+=count*ms/10+10
for o in objects:
 if not o.animation_data:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:
      if key.co.x>=500:key.interpolation='LINEAR'
def hull(ps):
 points=sorted(set(tuple(p[:2]) for p in ps));cross=lambda p,q,r:(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);lo=[];hi=[]
 for p in points:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(points):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
colorMap={'summer tan':'B','dorsal warm light':'H','throat belly tail underside':'C','nose hoof eye':'E'}
def record(f,clip,i):
 volumes=[]
 for o in meshes:
  mat=o.data.materials[0];key=mat.get('paintKey') or colorMap[mat.name]
  volumes.append(dict(name=o.name,key=key,points=hull([project(o.matrix_world@v.co) for v in o.data.vertices]),depth=at(o)[2]))
 return dict(facing=f,clip=clip,index=i,body=at(body,anchor),head=at(head),socket=at(head,bill),volumes=volumes)
records=[]
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,count,ms in clips:
  for i in range(count):frame(starts[clip]+i*ms/10);bpy.context.view_layer.update();records.append(record(facing,clip,i))
root.rotation_euler=(0,0,0);frame(500);scene.frame_start=500;scene.frame_end=math.ceil(cursor);scene['behaviorIdentity']=a+'-behavior-v1';scene['behaviorClips']=json.dumps(dict(clips=clips,starts=starts))
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{a}.blend'))
(S/'projection.json').write_text(json.dumps(dict(canvas=W,anchor=I['anchor'],palette=palette,clips=clips,records=records,nativeSockets=native),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
bodyName=body.name
bpy.ops.wm.open_mainfile(filepath=str(S/f'{a}.blend'));scene=bpy.context.scene
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
assert all(list(bpy.data.objects[n].scale)==v for n,v in scales.items())
checks=planted=hips=necks=feathers=0;maximum=0
for clip,count,ms in clips:
 for i in range((count-1)*2+1):
  frame(starts[clip]+i*ms/20);bpy.context.view_layer.update();b=bpy.data.objects[bodyName]
  for n,Ls in lengths.items():
   assert (b.matrix_world@Vector(hipRest[n])-bpy.data.objects[f'{n}-joint-0'].matrix_world.translation).length<.003;hips+=1
   for j,L in enumerate(Ls):
    link=bpy.data.objects[f'{n}-link-{j}'];p=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;q=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation
    error=max((link.matrix_world@Vector((0,0,-L/2))-p).length,(link.matrix_world@Vector((0,0,L/2))-q).length);assert error<.003,(a,clip,i,n,j,error);maximum=max(maximum,error);checks+=1
   foot=bpy.data.objects[footNames[n]].matrix_world.translation;assert foot.z>=.02
   if not(deer and clip=='stamp' and n=='fore-1'):assert (foot-feet[n]).length<.003;planted+=1
  if peacock:
   for j,L in enumerate(neckLengths):
    link=bpy.data.objects[f'NECK-link-{j}'];p=bpy.data.objects[f'NECK-joint-{j}'].matrix_world.translation;q=bpy.data.objects[f'NECK-joint-{j+1}'].matrix_world.translation
    assert max((link.matrix_world@Vector((0,0,-L/2))-p).length,(link.matrix_world@Vector((0,0,L/2))-q).length)<.003;necks+=1
   for j,L in enumerate(json.loads(scene['tailFeathers'])):
    o=bpy.data.objects[f'TAIL-feather-{j}'];assert (o.matrix_world@Vector((0,0,-L/2))-bpy.data.objects['TAIL-root'].matrix_world.translation).length<.003;feathers+=1
  else:
   n=bpy.data.objects['BEHAVIOR-neck-connected'];assert (n.matrix_world.translation-b.matrix_world@neckBase).length<.0001
   assert (bpy.data.objects['HEAD-rigid'].matrix_world.translation-n.matrix_world@headLocal).length<.0001;necks+=1
O.mkdir(parents=True,exist_ok=True)
(O/'source-audit.json').write_text(json.dumps(dict(identity=a+'-behavior-v1',savedSourceIndependentlyChecked=True,fixedMeshGeometry=geometry,fixedScale=True,fixedCamera=True,rootMotion=False,physicalTimelineMilliseconds=True,fixedLengthEndpointChecks=checks,plantedFootChecks=planted,hipAttachmentChecks=hips,neckAttachmentChecks=necks,featherRootChecks=feathers,maxEndpointGapWorldUnits=maximum),indent=2)+'\n',encoding='utf8',newline='\n')
print('FOREST_SOURCE_OK',a,len(records),checks,planted,necks)
