"""Explicit append-only action authoring from retained editable animal anatomy."""
import bpy,hashlib,json,math,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[2];animal=sys.argv[sys.argv.index('--')+1]
S=R/f'art-source/wildlife-v2/{animal}/behavior-v1';O=R/f'public/demos/wildlife-v2/{animal}/behavior-v1'
I=json.loads((S/'inputs.json').read_text());assert not (S/'receipt.json').exists(),'Immutable registered bank'
for path,digest in I['sha256'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==digest,path
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.frame_set(1);root=bpy.data.objects['ROOT-fixed-ground'];root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
objs=[o for o in scene.objects if o!=root and o.type!='CAMERA'];meshes=[o for o in objs if o.type=='MESH']
rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objs}
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
for o in objs:o.animation_data_clear()
lengths=json.loads(scene['limbLengths']);hips=json.loads(scene['hipRest']);W=I['canvas'];anchor=I['anchor'];pivot=bpy.data.objects['MOTION-torso'];body=bpy.data.objects['BODY-rigid'];head=bpy.data.objects['HEAD-fixed-orientation' if animal=='cat' else 'HEAD-rigid']
clips=[('climb',12,100),('pickup',8,125),('eat',12,150),('sit',8,150)] if animal=='capuchin-monkey' else [('pickup',8,125),('eat',12,150)] if animal=='raccoon' else [('stalk',8,125),('pounce',8,80),('bat',8,90),('climb',12,100),('sit',8,150)]

def align(o,a,b):
 o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')

def pose(clip,t):
 for o in objs:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 amount=math.sin(math.pi*t)**2;climb=clip=='climb';sit=clip in ['sit','eat'] and animal!='raccoon'
 pivot.rotation_euler.x=1.05 if climb else .38 if sit else -.08*amount if clip in ['pickup','stalk'] else .10*amount if clip=='pounce' else .03*amount
 pivot.location.z=rest[pivot.name][0].z+(.025*math.sin(4*math.pi*t) if climb else -.10*amount if clip in ['pickup','stalk'] else -.06 if sit else .025*amount)
 if clip in ['eat','pickup']:
  head.location+=Vector((0,.04*amount,-(.06 if animal=='cat' else .15)*amount));head.rotation_euler.x=-.18*amount
  if 'JAW' in bpy.data.objects:bpy.data.objects['JAW'].rotation_euler.x=-.32*amount*(.5+.5*math.sin(8*math.pi*t)**2)
 if clip=='sit':head.rotation_euler.z=.25*math.sin(2*math.pi*t)
 bpy.context.view_layer.update()
 for n,Ls in lengths.items():
  end='fore' if n.startswith('fore') else 'hind';side=-1 if '-1' in n else 1;hip=pivot.matrix_local@body.matrix_local@Vector(hips[n]);foot=Vector(hips[n]);foot.z=.055 if animal=='cat' else .06
  if climb:
   phase=(t+(.5 if side<0 else 0)+(.5 if end=='hind' else 0))%1
   # Alternating hands/feet grip the bark; return stroke lifts away from it.
   foot=hip+Vector((0,.28 if animal=='cat' else .42,(.20 if animal=='cat' else .48) if end=='fore' else -.28))
   foot.z+=.10*math.sin(2*math.pi*phase);foot.y-=.06*max(0,math.sin(2*math.pi*phase))
  elif end=='fore' and sit:
   foot=hip+Vector((0,.30 if animal=='cat' else .40,-.12 if animal=='cat' else -.22))
   if clip=='eat':foot.z+=.04*math.sin(4*math.pi*t)
  elif end=='fore' and clip=='pickup':foot.y+=.18*amount;foot.z+=.06*amount
  elif end=='fore' and clip=='bat' and side==1:foot.y+=.33*amount;foot.z+=.11*amount
  elif clip=='pounce':foot.y+=(.20 if end=='fore' else -.10)*amount;foot.z+=.07*amount
  elif clip=='stalk':foot.y+=.035*math.sin(2*math.pi*t+(0 if side<0 else math.pi))
  L1,L2,L3,L4=Ls;fetlock=foot+Vector((0,-.025,.10)).normalized()*L4
  flex=.45;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=fetlock-hip;d=delta.length;u=delta.normalized()
  # Reach adjustment moves the contact target, never scales the limb meshes.
  reach=max(abs(L1-chord)+.015,min(L1+chord-.015,d))
  if abs(reach-d)>.00001:fetlock=hip+u*reach;foot=fetlock-Vector((0,-.025,.10)).normalized()*L4;d=reach
  a=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,-1 if end=='fore' else 1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a))
  delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,1 if end=='fore' else -1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a));ps=[hip,elbow,knee,fetlock,foot]
  for j,(a,b) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'{n}-link-{j}'],a,b)
  for j,p in enumerate(ps):bpy.data.objects[f'{n}-joint-{j}'].location=p
  for j,p in enumerate(ps[1:4],1):bpy.data.objects[f'{n}-joint-volume-{j}'].location=p
  bpy.data.objects[f'{n}-hoof' if animal=='cat' else f'{n}-foot'].location=foot
 # Keep the tail rooted in the moving pelvis using its original fixed segment lengths.
 if animal=='cat':
  base=pivot.matrix_local@body.matrix_local@Vector((0,-.61,.68));tailLs=[.18]*5;prefix='tail-';joint='TAIL-guide-'
 else:
  P=I['profile'];base=pivot.matrix_local@body.matrix_local@Vector((0,P['tailY'],P['torso'][2]+.03));tailLs=P['tailLengths'];prefix='tail-link-';joint='tail-joint-'
 bpy.data.objects[joint+'0'].location=base
 for j,L in enumerate(tailLs):
  direction=Vector(((.22 if clip=='sit' else .08)*math.sin(2*math.pi*t-j*.4),-.8,-.25 if climb else .3+j*.06)).normalized();nxt=base+direction*L;align(bpy.data.objects[prefix+str(j)],base,nxt);bpy.data.objects[joint+str(j+1)].location=nxt;base=nxt
 bpy.context.view_layer.update()

for c,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  frame=500+c*40+i;scene.frame_set(frame);pose(clip,i/(count if clip in ['climb','stalk','eat','sit'] else count-1))
  for o in objs:
   o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)

camera=scene.camera;contract=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());records=[]

def project(p):
 v=world_to_camera_view(scene,camera,p);return [round(v.x*W,5),round((1-v.y)*W,5),round(v.z,5)]
def hull(ps):
 ps=sorted(set(tuple(p[:2]) for p in ps));cross=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);lo=[];hi=[]
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
for facing,yaw in contract['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for c,(clip,count,ms) in enumerate(clips):
  for i in range(count):
   scene.frame_set(500+c*40+i);bpy.context.view_layer.update();volumes=[]
   for o in meshes:
    ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
    def color(mat):return mat.get('paintKey') or min(I['palette'],key=lambda k:sum((mat.diffuse_color[j]-int(I['palette'][k][1+j*2:3+j*2],16)/255)**2 for j in range(3)))
    if o.get('surfacePaint'):
     view=(camera.matrix_world.translation-o.matrix_world.translation).normalized()
     for face in o.data.polygons:
      if (o.matrix_world.to_3x3()@face.normal).dot(view)<=0:continue
      fp=[ps[v] for v in face.vertices];volumes.append(dict(name=o.name,key=color(o.data.materials[face.material_index]),depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,key=color(o.data.materials[0]),depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   socket=project(bpy.data.objects['fore1-foot'].matrix_world.translation) if animal=='capuchin-monkey' and clip=='eat' else project(head.matrix_world@Vector((0,.16,-.10)))
   records.append(dict(facing=facing,clip=clip,index=i,socket=socket,volumes=volumes))
root.rotation_euler=(0,0,0);scene.frame_set(500);scene['behaviorIdentity']=f'{animal}-behavior-v1';scene.frame_start=500;scene.frame_end=500+(len(clips)-1)*40+clips[-1][1]-1
bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{animal}.blend'))
(S/'projection.json').write_text(json.dumps(dict(records=records),separators=(',',':'))+'\n')
# Independently reopen the actual saved scene and check every retained action pose.
bpy.ops.wm.open_mainfile(filepath=str(S/f'{animal}.blend'));scene=bpy.context.scene;checks=0;maximum=0
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'}
for c,(clip,count,ms) in enumerate(clips):
 for i in range(count):
  scene.frame_set(500+c*40+i);bpy.context.view_layer.update()
  for n,Ls in lengths.items():
   for j,L in enumerate(Ls):
    link=bpy.data.objects[f'{n}-link-{j}'];a=bpy.data.objects[f'{n}-joint-{j}'].matrix_world.translation;b=bpy.data.objects[f'{n}-joint-{j+1}'].matrix_world.translation
    error=max((link.matrix_world@Vector((0,0,-L/2))-a).length,(link.matrix_world@Vector((0,0,L/2))-b).length)
    assert error<.0001,(n,clip,i,error);maximum=max(maximum,error);checks+=1
O.mkdir(parents=True,exist_ok=True)
(O/'source-audit.json').write_text(json.dumps(dict(identity=f'{animal}-behavior-v1',savedSourceIndependentlyChecked=True,meshGeometryUnchanged=geometry,rootMotion=False,fixedCamera=True,fixedLengthEndpointChecks=checks,maxEndpointGapWorldUnits=maximum),indent=2)+'\n')
print('WOODLAND_SOURCE_OK',animal,len(records),checks,maximum)

