"""Append existing-animal actions from retained fixed-volume Blender anatomy."""
import bpy,hashlib,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[2];animal=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{animal}/behavior-v1';O=R/f'public/demos/wildlife-v2/{animal}/behavior-v1'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'));assert not (S/'receipt.json').exists(),'Immutable registered bank'
for path,digest in I['sha256'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==digest,path
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.frame_set(1);root=bpy.data.objects['ROOT-fixed-ground'];root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
objects=[o for o in scene.objects if o!=root and o.type!='CAMERA'];meshes=[o for o in objects if o.type=='MESH']
rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objects}
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
for o in objects:o.animation_data_clear()
lengths=json.loads(scene['limbLengths']);hips=json.loads(scene['hipRest']);body=bpy.data.objects[scene['bodyName']];pivot=bpy.data.objects['MOTION-torso'];head=bpy.data.objects['HEAD-fixed-orientation' if animal=='elephant' else 'HEAD-rigid']
W=I['canvas'];anchor=Vector(json.loads(scene['bodyAnchor']));camera=scene.camera
clips=[('rear',8,75),('browse',12,100),('lower',8,75),('hop',10,90)] if animal=='goat' else [('sniff',8,100),('root',12,125),('pickup',7,100),('eat',8,200)] if animal=='piglet' else [('reach',12,125),('curl',12,125),('eat',8,200),('shake',12,125)]
trunk_lengths=[.616]*5

def align(o,a,b):
 o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')

def pose(clip,t):
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 amount=math.sin(math.pi*t)**2
 if animal=='goat':
  rear=math.sin(math.pi*t/2)**2 if clip=='rear' else math.cos(math.pi*t/2)**2 if clip=='lower' else 1 if clip=='browse' else 0
  pivot.rotation_euler.x=.52*rear
  hind=Vector((0,-.61,1.26));local=body.matrix_local@hind
  pivot.location=hind-pivot.rotation_euler.to_matrix()@local
  pivot.location.z+=-.10*amount if clip=='hop' else .012*math.sin(4*math.pi*t)*rear if clip=='browse' else 0
  head.rotation_euler.x=-.20*rear+(.045*math.sin(4*math.pi*t) if clip=='browse' else 0)
  head.rotation_euler.z=.055*math.sin(4*math.pi*t) if clip=='browse' else 0
  bpy.data.objects['TAIL-upright-rigid'].rotation_euler.z=.14*math.sin(2*math.pi*t)
 elif animal=='piglet':
  bend=.6 if clip=='root' else .6*(1-t) if clip=='pickup' else .18*amount if clip=='sniff' else .08*math.sin(4*math.pi*t)**2
  pivot.rotation_euler.x=-.04*bend;pivot.location.z-=.035*bend
  head.location+=Vector((0,.04*bend,-.48*bend));head.rotation_euler.x=-.72*bend
  head.rotation_euler.z=.16*math.sin(4*math.pi*t) if clip=='root' else .07*math.sin(2*math.pi*t)
  bpy.data.objects['TAIL-rigid-curl'].rotation_euler.z=.15*math.sin(4*math.pi*t)
 else:
  pivot.location.z+=.018*math.sin(4*math.pi*t);head.rotation_euler.x=(.08 if clip=='eat' else .018)*math.sin(4*math.pi*t)
  reach=[20,50,90,125,155];mouth=[25,60,150,235,285];idle=[8,12,18,26,38]
  f=t*t*(3-2*t)
  angles=[idle[j]+(reach[j]-idle[j])*f for j in range(5)] if clip=='reach' else [reach[j]+(mouth[j]-reach[j])*f for j in range(5)] if clip=='curl' else [mouth[j]+8*math.sin(4*math.pi*t)*(j/4) for j in range(5)] if clip=='eat' else [reach[j]+6*math.sin(6*math.pi*t)*(j/4) for j in range(5)]
  base=Vector((0,2.59,3.23))*1.12;bpy.data.objects['TRUNK-joint-0'].location=base
  for j,L in enumerate(trunk_lengths):
   angle=math.radians(angles[j]);end=base+Vector((.025*math.sin(6*math.pi*t) if clip=='shake' else 0,math.sin(angle),-math.cos(angle))).normalized()*L
   align(bpy.data.objects[f'trunk-{j}-volume'],base,end);bpy.data.objects[f'TRUNK-joint-{j+1}'].location=end;base=end
 bpy.context.view_layer.update()
 for name,Ls in lengths.items():
  fore=name.startswith('fore');hip=pivot.matrix_local@body.matrix_local@Vector(hips[name]);foot=Vector(rest[f'{name}-joint-4'][0]);foot.z=.2576 if animal=='elephant' else .075 if animal=='goat' else .08
  if animal=='goat':
   if fore:foot=foot+Vector((0,-.12*rear,.75*rear))
   if clip=='hop':foot+=Vector((0,(.10 if fore else -.08)*amount,.18*amount))
  L1,L2,L3,L4=Ls;fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
  chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(.45));delta=fetlock-hip;d=delta.length;u=delta.normalized()
  assert abs(L1-chord)+.002<d<L1+chord-.002,(animal,clip,t,name,'reach',d,L1+chord)
  n=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,-1 if fore else 1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*n+pole*math.sqrt(max(0,L1*L1-n*n))
  delta=fetlock-elbow;d=delta.length;u=delta.normalized();n=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,1 if fore else -1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*n+pole*math.sqrt(max(0,L2*L2-n*n));ps=[hip,elbow,knee,fetlock,foot]
  for j,(a,b) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'{name}-link-{j}'],a,b)
  for j,p in enumerate(ps):bpy.data.objects[f'{name}-joint-{j}'].location=p
  for j,p in enumerate(ps[1:4],1):bpy.data.objects[f'{name}-joint-volume-{j}'].location=p
  bpy.data.objects[f'{name}-hoof'].location=foot
 bpy.context.view_layer.update()

for c,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  frame=500+c*40+i;scene.frame_set(frame);pose(clip,i/(count if clip in ['browse','root','eat','shake'] else count-1))
  for o in objects:o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)

def project(p):
 v=world_to_camera_view(scene,camera,p);return [round(v.x*W,6),round((1-v.y)*W,6),round(v.z,6)]
def at(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def basis(o,p,facing):
 a=at(o,p);v=Vector((0,1,0) if facing in ['left','right'] else (1,0,0));b=at(o,Vector(p)+v);c=at(o,Vector(p)+Vector((0,0,1)))
 return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
def record(facing,clip,i):
 r=dict(facing=facing,clip=clip,index=i,body=at(body,anchor),head=at(head),bodyBasis=basis(body,anchor,facing),headBasis=basis(head,(0,0,0),facing),contacts={})
 for n in lengths:r['contacts'][n]={'screen':[at(bpy.data.objects[f'{n}-joint-{j}']) for j in range(5)]}
 if animal=='elephant':
  r['tail']=[at(body,(0,-1.97*1.12,2.85*1.12)),at(bpy.data.objects['tail-tuft'])];r['trunk']=[at(bpy.data.objects[f'TRUNK-joint-{j}']) for j in range(6)];r['socket']=r['trunk'][-1]
 else:
  r['ears']={str(side):{'base':at(bpy.data.objects[f'EAR-{side}']),'tip':at(bpy.data.objects[f'EAR-{side}'],(side*.33,-.005,.035) if animal=='goat' else (side*.33,.035,-.06)),'points':[project(bpy.data.objects[f'ear-{side}'].matrix_world@v.co) for v in bpy.data.objects[f'ear-{side}'].data.vertices]} for side in [-1,1]}
  if animal=='goat':
   r['neckHull']=[project(bpy.data.objects['neck'].matrix_world@v.co) for v in bpy.data.objects['neck'].data.vertices]
   r['horns']={str(side):[at(head,p) for p in [(side*.145,-.085,.21),(side*.21,-.29,.53),(side*.235,-.48,.55)]] for side in [-1,1]};r['beard']=[at(head,p) for p in [(0,.22,-.25),(0,.20,-.48)]];ctl=bpy.data.objects['TAIL-upright-rigid'];r['tail']=[at(ctl),at(ctl,(0,-.12,.21))]
  else:
   ctl=bpy.data.objects['TAIL-rigid-curl'];ps=[Vector((0,0,0)),Vector((0,-.14,0))]
   for j in range(1,17):
    angle=2*math.pi*j/16;radius=.14*(1-.40*j/16);ps.append(Vector((radius*math.sin(angle),-.14-.02*angle,radius*math.cos(angle)-.14)))
   r['tail']=[at(ctl,p) for p in ps]
  r['socket']=at(head,(0,.48,-.14))
 return r
records=[];references={};contract=json.loads((R/'art-source/wildlife-v2/camera.json').read_text())
for facing,yaw in contract['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 # The native idle is the unchanged basis of the retained palette-letter masters.
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 bpy.context.view_layer.update();references[facing]=record(facing,'idle',0)
 for c,(clip,count,ms) in enumerate(clips):
  for i in range(count):scene.frame_set(500+c*40+i);bpy.context.view_layer.update();records.append(record(facing,clip,i))
root.rotation_euler=(0,0,0);scene.frame_set(500);scene.frame_start=500;scene.frame_end=500+(len(clips)-1)*40+clips[-1][1]-1
scene['behaviorIdentity']=f'{animal}-behavior-v1';bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{animal}.blend'))
(S/'projection.json').write_text(json.dumps(dict(canvas=W,anchor=I['anchor'],clips=clips,references=references,records=records),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
bpy.ops.wm.open_mainfile(filepath=str(S/f'{animal}.blend'));scene=bpy.context.scene;checks=0;trunk_checks=0;maximum=0
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
for c,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  scene.frame_set(500+c*40+i);bpy.context.view_layer.update()
  for n,Ls in lengths.items():
   for j,L in enumerate(Ls):
    link=bpy.data.objects[f'{n}-link-{j}'];a=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation;error=max((link.matrix_world@Vector((0,0,-L/2))-a).length,(link.matrix_world@Vector((0,0,L/2))-b).length);assert error<.0001,(animal,clip,i,n,j,error);maximum=max(maximum,error);checks+=1
  if animal=='elephant':
   for j,L in enumerate(trunk_lengths):
    link=bpy.data.objects[f'trunk-{j}-volume'];a=bpy.data.objects[f'TRUNK-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'TRUNK-joint-{j+1}'].matrix_world.translation;error=max((link.matrix_world@Vector((0,0,-L/2))-a).length,(link.matrix_world@Vector((0,0,L/2))-b).length);assert error<.0001,(clip,i,j,error);maximum=max(maximum,error);trunk_checks+=1
O.mkdir(parents=True,exist_ok=True)
(O/'source-audit.json').write_text(json.dumps(dict(identity=f'{animal}-behavior-v1',savedSourceIndependentlyChecked=True,meshGeometryUnchanged=geometry,fixedCamera=True,rootMotion=False,fixedLengthEndpointChecks=checks,fixedLengthTrunkChecks=trunk_checks,maxEndpointGapWorldUnits=maximum),indent=2)+'\n',encoding='utf8',newline='\n')
print('PASTURE_SOURCE_OK',animal,len(records),checks,trunk_checks,maximum)
