"""Retained fixed-volume grazing, canopy browsing and beaver construction actions."""
import bpy, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

R=Path(__file__).resolve().parents[2];animal=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{animal}/behavior-v1';O=R/f'public/demos/wildlife-v2/{animal}/behavior-v1'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'));assert not (S/'receipt.json').exists(),'Registered banks are immutable'
for p,h in I['sha256'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.frame_set(1);root=bpy.data.objects['ROOT-fixed-ground'];root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
W=I['canvas'];cam=scene.camera;horse=animal=='horse';beaver=animal=='beaver'
body=bpy.data.objects['BODY-rigid' if horse or beaver else 'BODY-weight-transfer'];head=bpy.data.objects['HEAD-rigid' if horse or beaver else 'HEAD-fixed-volume'];pivot=bpy.data.objects['MOTION-torso']
lengths=json.loads(scene['limbLengths']);hips=json.loads(scene['hipRest']);anchor=Vector((0,-.1,2.24) if horse else json.loads(scene['bodyAnchor']) if beaver else (0,0,0))
camera=json.loads((R/'art-source/wildlife-v2/camera.json').read_text(encoding='utf8'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [round(v.x*W,6),round((1-v.y)*W,6),round(v.z,6)]
def at(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
mouth=Vector((0,.74,-.49) if horse else (0,.50,-.18) if beaver else (0,.92,-.26))
travel=[]
if beaver:
 for facing,yaw in camera['modelYawDegrees'].items():
  root.rotation_euler.z=math.radians(yaw)
  for i in range(32):
   scene.frame_set(10+i*4);bpy.context.view_layer.update();travel.append(dict(facing=facing,column=1+i,socket=at(head,mouth)))
 root.rotation_euler=(0,0,0);scene.frame_set(1);bpy.context.view_layer.update()
if not beaver:
 neck=bpy.data.objects.new('NECK-connected-rigid',None);scene.collection.objects.link(neck);neck.parent=body;neck.location=(0,.82,2.55) if horse else (0,.94,4.28);bpy.context.view_layer.update()
 parts=[head]+[o for o in scene.objects if o.name=='neck' or o.name.startswith('mane-')] if horse else [head]+[bpy.data.objects[n] for n in ['neck-volume','mane-volume','throat-volume']]
 for o in parts:
  mw=o.matrix_world.copy();o.parent=neck;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_world=mw
 bpy.context.view_layer.update();headAnchor=neck.matrix_world.inverted()@head.matrix_world.translation
objects=[o for o in scene.objects if o!=root and o.type!='CAMERA'];meshes=[o for o in objects if o.type=='MESH']
rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objects}
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
for o in objects:o.animation_data_clear()
clips=[('lower',10,75),('graze',12,100),('drink',12,125),('raise',10,75)] if horse else [('reach',12,100),('browse',16,100),('lower',12,100)] if not beaver else [('pickup',10,100),('build',16,100),('settle',12,125)]
def align(o,a,b):o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
def pose(clip,t):
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 if not beaver:
  smooth=t*t*(3-2*t)
  f=(smooth if clip=='lower' else 1-smooth if clip=='raise' else 1) if horse else (smooth if clip=='reach' else 1-smooth if clip=='lower' else 1)
  if horse:
   neck.rotation_euler.x=-1.95*f + (.065*math.sin(4*math.pi*t) if clip in ['graze','drink'] else 0)
   neck.rotation_euler.z=.065*math.sin(4*math.pi*t) if clip=='graze' else 0
   head.rotation_euler.x+=1.2*f
   if clip in ['graze','drink']:
    base=Vector((0,-1.47,2.58))
    for j,L in enumerate([.32,.36,.40,.42,.36]):
     end=base+Vector((.35*math.sin(2*math.pi*t-j*.2),-.30,-1)).normalized()*L;align(bpy.data.objects[f'tail-{j}'],base,end);base=end
  else:
   neck.rotation_euler.x=-1.32*f + (.035*math.sin(4*math.pi*t) if clip=='browse' else 0)
   head.rotation_euler.x+=1.0*f
  pivot.location.z-=.025*f;pivot.rotation_euler.x=-.008*f
 else:
  amount=math.sin(math.pi*t)**2
  head.rotation_euler.x=-.30*amount if clip=='pickup' else -.10-.10*math.sin(4*math.pi*t)**2 if clip=='build' else -.08*amount
  pivot.location.z-=.035*amount
  bpy.data.objects['JAW'].rotation_euler.x=-.22*math.sin(4*math.pi*t)**2 if clip=='build' else 0
 bpy.context.view_layer.update()
 for n,Ls in lengths.items():
  fore=n.startswith('fore');hip=pivot.matrix_local@body.matrix_local@Vector(hips[n]);foot=Vector(rest[f'{n}-joint-4'][0]);foot.z=.09 if horse else .06 if beaver else .14
  if beaver and clip=='build' and fore:foot+=Vector((0,.12*math.sin(4*math.pi*t)**2,.18*math.sin(4*math.pi*t)**2))
  L1,L2,L3,L4=Ls;fetlock=foot+Vector((0,-.035,.10)).normalized()*L4;flex=.20 if fore else .50;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=fetlock-hip;d=delta.length;u=delta.normalized()
  assert abs(L1-chord)+.001<d<L1+chord-.001,(animal,clip,t,n,'reach',d,L1+chord)
  v=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,-1 if fore else 1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*v+pole*math.sqrt(max(0,L1*L1-v*v))
  delta=fetlock-elbow;d=delta.length;u=delta.normalized();v=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,1 if fore else -1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*v+pole*math.sqrt(max(0,L2*L2-v*v));ps=[hip,elbow,knee,fetlock,foot]
  for j,(a,b) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'{n}-link-{j}'],a,b)
  for j,p in enumerate(ps):bpy.data.objects[f'{n}-joint-{j}'].location=p
  for j,p in enumerate(ps[1:4],1):bpy.data.objects[f'{n}-joint-volume-{j}'].location=p
  bpy.data.objects[f'{n}-foot' if beaver else f'{n}-hoof'].location=foot
 bpy.context.view_layer.update()
for c,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  frame=500+c*40+i;scene.frame_set(frame);pose(clip,i/(count if clip in ['graze','drink','browse','build','settle'] else count-1))
  for o in objects:o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
def basis(o,p,f):
 a=at(o,p);b=at(o,Vector(p)+Vector((0,1,0) if f in ['left','right'] else (1,0,0)));c=at(o,Vector(p)+Vector((0,0,1)));return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
def hull(ps):
 ps=sorted(set((round(p[0],5),round(p[1],5)) for p in ps));cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);lo=[];hi=[]
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def record(f,clip,i):
 r=dict(facing=f,clip=clip,index=i,body=at(body,anchor),head=at(head),socket=at(head,mouth),contacts={})
 if beaver:
  volumes=[];dg=bpy.context.evaluated_depsgraph_get()
  for original in meshes:
   o=original.evaluated_get(dg);ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
   volumes.append(dict(name=o.name,group=o.get('paintGroup'),key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
  r['volumes']=volumes
 else:
  r['bodyBasis']=basis(body,anchor,f);r['headBasis']=basis(head,(0,0,0),f);r['neckBase']=at(neck);r['neckBasis']=basis(neck,(0,0,0),f)
  r['neckHull']=[project(bpy.data.objects['neck' if horse else 'neck-volume'].matrix_world@v.co) for v in bpy.data.objects['neck' if horse else 'neck-volume'].data.vertices]
  if not horse:r['ears']={str(s):[project(bpy.data.objects[f'ear-{s}-volume'].matrix_world@v.co) for v in bpy.data.objects[f'ear-{s}-volume'].data.vertices] for s in [-1,1]}
  r['tail']=[at(body,(0,-1.47,2.58) if horse else (0,-1.76,3.93))]+[at(bpy.data.objects[f'tail-{j}' if horse else f'tail-{j}-volume'],(0,0,-L/2)) for j,L in enumerate([.32,.36,.40,.42,.36] if horse else [.60,.58,.54])]
  for n in lengths:r['contacts'][n]={'screen':[at(bpy.data.objects[f'{n}-joint-{j}']) for j in range(5)]}
 return r
references={};records=[]
for f,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 bpy.context.view_layer.update();references[f]=record(f,'idle',0)
 for c,(clip,count,ms) in enumerate(clips):
  for i in range(count):scene.frame_set(500+c*40+i);bpy.context.view_layer.update();records.append(record(f,clip,i))
root.rotation_euler=(0,0,0);scene.frame_set(500);scene.frame_start=500;scene.frame_end=500+(len(clips)-1)*40+clips[-1][1]-1
scene['behaviorIdentity']=f'{animal}-behavior-v1';bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{animal}.blend'))
palette=json.loads((R/I['masters']).read_text(encoding='utf8'))['palette']
(S/'projection.json').write_text(json.dumps(dict(canvas=W,anchor=I['anchor'],palette=palette,clips=clips,references=references,records=records,travelSockets=travel),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
bodyName=body.name;headName=head.name
bpy.ops.wm.open_mainfile(filepath=str(S/f'{animal}.blend'));scene=bpy.context.scene;checks=0;maximum=0;grounded=0;neckChecks=0
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
for c,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  scene.frame_set(500+c*40+i);bpy.context.view_layer.update()
  assert bpy.data.objects['ROOT-fixed-ground'].location.length<.00001
  if not beaver:
   ctl=bpy.data.objects['NECK-connected-rigid'];torso=bpy.data.objects[bodyName];skull=bpy.data.objects[headName]
   expected=torso.matrix_world@Vector((0,.82,2.55) if horse else (0,.94,4.28))
   assert (expected-ctl.matrix_world.translation).length<.0001
   assert (ctl.matrix_world@headAnchor-skull.matrix_world.translation).length<.0001
   neckChecks+=2
  for n,Ls in lengths.items():
   for j,L in enumerate(Ls):
    link=bpy.data.objects[f'{n}-link-{j}'];a=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation;error=max((link.matrix_world@Vector((0,0,-L/2))-a).length,(link.matrix_world@Vector((0,0,L/2))-b).length);assert error<.0001,(animal,clip,i,n,j,error);maximum=max(maximum,error);checks+=1
   if not (beaver and clip=='build' and n.startswith('fore')):
    z=bpy.data.objects[f'{n}-joint-4'].matrix_world.translation.z;expected=.09 if horse else .06 if beaver else .14;assert abs(z-expected)<.0001;grounded+=1
O.mkdir(parents=True,exist_ok=True)
(O/'source-audit.json').write_text(json.dumps(dict(identity=f'{animal}-behavior-v1',savedSourceIndependentlyChecked=True,meshGeometryUnchanged=geometry,fixedCamera=True,rootMotion=False,fixedLengthEndpointChecks=checks,plantedFootChecks=grounded,neckAttachmentChecks=neckChecks,maxEndpointGapWorldUnits=maximum),indent=2)+'\n',encoding='utf8',newline='\n')
print('RANGE_SOURCE_OK',animal,len(records),checks,grounded,maximum)
