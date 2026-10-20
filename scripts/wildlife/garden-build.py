"""Explicit action authoring from pinned native rigs. Never invoked by normal builds."""
import bpy,json,math,hashlib,re,sys
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[2];species=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{species}/behavior-v1';O=R/f'public/demos/wildlife-v2/{species}/behavior-v1'
I=json.loads((S/'inputs.json').read_text(encoding='utf8'));assert not (S/'receipt.json').exists()
for p,h in I['sha256'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.frame_set(1);chicken=species=='chicken';root=bpy.data.objects['ROOT-fixed-ground' if chicken else 'ROOT-ground'];root.rotation_euler=(0,0,0)
body=bpy.data.objects['BODY-rigid' if chicken else 'BODY-flight'];head=bpy.data.objects['HEAD-rigid'];W=I['canvas'];cam=scene.camera
objects=[o for o in scene.objects if o!=root and o.type!='CAMERA'];geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in objects if o.type=='MESH'}
for o in objects:o.animation_data_clear()
rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objects}
lengths=json.loads(scene['limbLengths' if chicken else 'legLengths']);hips=json.loads(scene['hipRest'])
clips=[('scratch',16,100),('peck',10,80),('eat',10,120)] if chicken else [('sip',16,40),('guard',16,40)] if species!='bee' else [('sip',16,50)]

def align(o,a,b):
 o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')

if chicken:
 pivot=bpy.data.objects['MOTION-torso'];neck=bpy.data.objects['feather neck'];neckctl=bpy.data.objects.new('NECK-feeding',None);scene.collection.objects.link(neckctl);neckctl.parent=body;neckctl.location=(0,.30,1.0)
 for o in [neck,head]:
  location=o.location.copy();o.parent=neckctl;o.location=location-neckctl.location
 objects.append(neckctl);rest[neckctl.name]=(neckctl.location.copy(),neckctl.rotation_euler.copy(),neckctl.rotation_quaternion.copy())
 rest[head.name]=(head.location.copy(),head.rotation_euler.copy(),head.rotation_quaternion.copy());rest[neck.name]=(neck.location.copy(),neck.rotation_euler.copy(),neck.rotation_quaternion.copy())
else:
 family='insects-140' if species=='bee' else 'seabirds-and-hummingbird-147';P=json.loads((R/f'art-source/wildlife-v2/_families/{family}/profiles.json').read_text())[species]
 if species!='bee':P={**P,'flapCycles':4}
 legs={n:dict(side=int(n[4:].rsplit('-',1)[0]),index=int(n.split('-')[-1]),rest=Vector(hips[n]),lengths=Ls,links=[bpy.data.objects[f'{n}-link-{j}'] for j in range(3)],joints=[bpy.data.objects[f'{n}-joint-{j}'] for j in range(4)],foot=bpy.data.objects[f'{n}-foot']) for n,Ls in lengths.items()}
 wings=[(bpy.data.objects[n],L,Vector(json.loads(scene['wingRoots'])[n])) for n,L in json.loads(scene['wingLengths']).items()]
 antennae={n:dict(side=int(n[len('ANTENNA-'):]),lengths=Ls,links=[bpy.data.objects[f'{n}-link-{j}'] for j in range(2)],joints=[bpy.data.objects[f'{n}-joint-{j}'] for j in range(3)]) for n,Ls in json.loads(scene['antennaLengths']).items()}
 jaw=bpy.data.objects['JAW'];covers=[];mandibles=[];tailLs=[]
 native=(R/f'art-source/wildlife-v2/_families/{family}/build.py').read_text();native=native[native.index('def pose('):native.index('animated=[')]
 native=re.sub(r'fold=.+?;phase=', 'fold=1;phase=',native,count=1)
 native=re.sub(r' body.location.z=.+?\n for pivot', " body.location.z=.16+.018*math.sin(2*phase);body.rotation_euler=(.05*math.sin(phase),0,0);head.rotation_euler.x=-.12+.06*math.sin(2*phase);jaw.rotation_euler.x=-.15\n for pivot",native,count=1)
 ns=dict(bpy=bpy,math=math,Vector=Vector,Matrix=Matrix,P=P,SPECIES=species,body=body,head=head,jaw=jaw,legs=legs,wings=wings,antennae=antennae,covers=covers,mandibles=mandibles,tailLs=tailLs,align=align)
 exec(native,ns);hover=ns['pose']

def pose(clip,t):
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 if not chicken:
  hover(t,'fly')
  if clip=='guard':
   for wing,L,pos in wings:wing.rotation_euler.z+=wing['side']*.15*math.sin(math.tau*t)
  return
 amount=math.sin(math.pi*t/2)**2 if clip=='peck' else .85+.12*math.sin(4*math.pi*t) if clip=='eat' else .05
 pivot.location.z-=.16*amount
 pivot.location.x+=.018*math.sin(math.tau*t) if clip=='scratch' else 0
 pivot.location.z+=.035*math.sin(4*math.pi*t) if clip=='scratch' else 0
 neckctl.rotation_euler.x=-1.85*amount;head.rotation_euler.x=-.20*amount
 bpy.context.view_layer.update()
 for n,Ls in lengths.items():
  side=-1 if n.endswith('-1') else 1;phase=(t-(0 if side==-1 else .5))%1
  # Drag one foot backwards on soil, recover it above the surface; other foot supports.
  foot=Vector((hips[n][0]+side*.015,hips[n][1],.025))
  if clip=='scratch':
   if phase<.6:foot.y+=.20-.42*(phase/.6)
   else:
    q=(phase-.6)/.4;foot.y+=-.22+.42*q;foot.z+=.13*math.sin(math.pi*q)
  hip=pivot.matrix_local@body.matrix_local@Vector(hips[n]);L1,L2,L3,L4=Ls;fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
  chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(.6));delta=fetlock-hip;d=delta.length;u=delta.normalized();assert abs(L1-chord)<d<L1+chord,(clip,t,n,d)
  v=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*v+pole*math.sqrt(max(0,L1*L1-v*v))
  delta=fetlock-elbow;d=delta.length;u=delta.normalized();v=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,-1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*v+pole*math.sqrt(max(0,L2*L2-v*v));points=[hip,elbow,knee,fetlock,foot]
  for j,(a,b) in enumerate(zip(points,points[1:])):align(bpy.data.objects[f'{n}-link-{j}'],a,b)
  for j,p in enumerate(points):bpy.data.objects[f'{n}-joint-{j}'].location=p
  for j,p in enumerate(points[1:4],1):bpy.data.objects[f'{n}-joint-volume-{j}'].location=p
  bpy.data.objects[f'{n}-hoof'].location=foot
 bpy.context.view_layer.update()

for k,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  f=500+k*40+i;scene.frame_set(f);pose(clip,i/(count-1 if clip=='peck' else count))
  for o in objects:o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)

def project(p):
 v=world_to_camera_view(scene,cam,p);return [round(v.x*W,5),round((1-v.y)*W,5),round(v.z,5)]
def at(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def hull(points):
 ps=sorted(set(tuple(p[:2]) for p in points));cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);lo=[];hi=[]
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
records=[]
for facing,yaw in json.loads((R/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for k,(clip,count,ms) in enumerate(clips):
  for i in range(count):
   scene.frame_set(500+k*40+i);bpy.context.view_layer.update();volumes=[]
   for o in objects:
    if o.type!='MESH':continue
    ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
    if o.get('surfacePaint'):
     view=(cam.matrix_world.translation-o.matrix_world.translation).normalized()
     for face in o.data.polygons:
      if (o.matrix_world.to_3x3()@face.normal).dot(view)<=0:continue
      fp=[ps[j] for j in face.vertices];volumes.append(dict(name=o.name,key=o.data.materials[face.material_index]['paintKey'],depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   socket=at(head,(0,.39,-.055) if chicken else (0,.12+P.get('beakLength',.04),-.03))
   records.append(dict(facing=facing,clip=clip,index=i,volumes=volumes,socket=socket,head=at(head),body=at(body,json.loads(scene['bodyAnchor']))))
root.rotation_euler=(0,0,0);scene.frame_set(500);scene.frame_start=500;scene.frame_end=500+(len(clips)-1)*40+clips[-1][1]-1;scene['behaviorIdentity']=f'{species}-behavior-v1'
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{species}.blend'))
(S/'projection.json').write_text(json.dumps(dict(canvas=W,anchor=I['anchor'],clips=clips,records=records),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'));scene=bpy.context.scene
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
checks=0;wingchecks=0;maximum=0;angles={}
for k,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  scene.frame_set(500+k*40+i);bpy.context.view_layer.update()
  for n,Ls in lengths.items():
   for j,L in enumerate(Ls):
    o=bpy.data.objects[f'{n}-link-{j}'];a=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation;e=max((o.matrix_world@Vector((0,0,-L/2))-a).length,(o.matrix_world@Vector((0,0,L/2))-b).length);assert e<.0001,(clip,i,n,j,e);maximum=max(maximum,e);checks+=1
  if not chicken:
   for n,p in json.loads(scene['wingRoots']).items():
    o=bpy.data.objects[n];angles.setdefault(clip+':'+n,[]).append(o.rotation_euler.y);e=(o.matrix_world.translation-o.parent.matrix_world@Vector(p)).length;assert e<.0001;maximum=max(maximum,e);wingchecks+=1
ranges={n:max(v)-min(v) for n,v in angles.items()};assert all(v>.5 for n,v in ranges.items() if 'shoulder' in n or species=='bee'),ranges
O.mkdir(parents=True,exist_ok=True)
(O/'source-audit.json').write_text(json.dumps(dict(identity=f'{species}-behavior-v1',savedSourceIndependentlyChecked=True,meshGeometryUnchanged=geometry,fixedCamera=True,rootMotion=False,fixedLengthEndpointChecks=checks,wingRootChecks=wingchecks,wingStrokeRangesRadians=ranges,maxEndpointGapWorldUnits=maximum),indent=2)+'\n',encoding='utf8',newline='\n')
print('GARDEN_SOURCE_OK',species,len(records),checks,wingchecks,maximum)
