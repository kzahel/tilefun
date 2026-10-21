"""Retained fixed-geometry rigs: curl, attached quill flare and fox listening/pounce."""
import bpy,json,hashlib,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[2];a=sys.argv[sys.argv.index('--')+1];S=R/f'art-source/wildlife-v2/{a}/behavior-v1';O=R/f'public/demos/wildlife-v2/{a}/behavior-v1';I=json.loads((S/'inputs.json').read_text(encoding='utf8'));assert not (S/'receipt.json').exists()
for p,h in I['sha256'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p
O.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(R/I['blend']));bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.frame_set(1);scene.render.fps=100
fox=a=='fox';hedgehog=a=='hedgehog';root=bpy.data.objects['ROOT-fixed-ground'];root.rotation_euler=(0,0,0);body=bpy.data.objects['BODY-rigid'];head=bpy.data.objects['HEAD-fixed-orientation' if fox else 'HEAD-rigid'];cam=scene.camera;W=I['canvas'];anchor=Vector(json.loads(scene['bodyAnchor']));hips=json.loads(scene['hipRest']);lengths=json.loads(scene['limbLengths'])
for o in list(scene.objects):o.animation_data_clear()
def node(n,parent,p):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=p;return o
def reparent(o,parent):
 world=o.matrix_world.copy();o.parent=parent;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_world=world;bpy.context.view_layer.update()
control=node('BEHAVIOR-body-center',root,anchor);bpy.context.view_layer.update();reparent(body,control)
headRoot=Vector((0,.30,.68) if fox else (0,.40,.65) if hedgehog else (0,.50,.85));neck=node('BEHAVIOR-connected-neck',body,headRoot);bpy.context.view_layer.update();reparent(head,neck);headLocal=head.location.copy()
neckLink=None
if fox:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);neckLink=bpy.context.object;neckLink.name='BEHAVIOR-fixed-neck-volume';neckLink.scale=(.14,.14,headLocal.length/2);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);neckLink.parent=neck;neckLink.location=headLocal/2;neckLink.rotation_mode='QUATERNION';neckLink.rotation_quaternion=headLocal.to_track_quat('Z','Y');neckLink.data.materials.append(bpy.data.materials['russet dorsal fur'])
quills=[]
if not fox:
 for q in [o for o in scene.objects if o.name.startswith('quill ')]:
  vs=[v.co.copy() for v in q.data.vertices];base=sum(vs[:6],Vector())/6;tip=vs[6];hinge=node('BEHAVIOR-'+q.name,body,base);bpy.context.view_layer.update();reparent(q,hinge);quills.append((hinge,q,base,tip-base))
objects=[o for o in scene.objects if o!=root and o.type!='CAMERA'];meshes=[o for o in objects if o.type=='MESH'];rest={o.name:(o.location.copy(),o.rotation_euler.copy(),o.rotation_quaternion.copy()) for o in objects};scales={o.name:list(o.scale) for o in objects};geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
feet={n:bpy.data.objects[n+('-hoof' if fox else '-foot')].location.copy() for n in lengths};tailNames=[f'TAIL-guide-{i}' for i in range(5)] if fox else [f'tail-joint-{i}' for i in range(4)];tailRest=[bpy.data.objects[n].location.copy() for n in tailNames]
def align(o,p,q):o.location=(p+q)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(q-p).to_track_quat('Z','Y')
def solve(p,q,L1,L2,pole):
 d=(q-p).length;u=(q-p).normalized();assert abs(L1-L2)+1e-6<d<L1+L2-1e-6,(a,'reach',d,L1+L2);along=(L1*L1-L2*L2+d*d)/(2*d);v=(pole-u*pole.dot(u)).normalized();return p+u*along+v*math.sqrt(max(0,L1*L1-along*along))
clips=[('listen',14,75),('stalk',12,50),('pounce',12,60),('eat',16,100)] if fox else [('curl-in',14,50),('curled',16,100),('uncurl',14,50)] if hedgehog else [('quills',14,50),('rattle',16,100),('relax',14,50)]
def pose(clip,t):
 for o in objects:o.location,o.rotation_euler,o.rotation_quaternion=rest[o.name]
 smooth=t*t*(3-2*t);wave=math.sin(math.tau*t)
 amount=smooth if clip in ['curl-in','quills'] else 1-smooth if clip in ['uncurl','relax'] else 1
 if fox:
  crouch=math.sin(math.pi*t)**2 if clip=='pounce' else .6 if clip=='stalk' else .25 if clip=='eat' else 0
  control.location.z-=.06*crouch;control.rotation_euler.x=-.04*crouch
  neck.rotation_euler.x=-.30*math.sin(4*math.pi*t)**2 if clip=='eat' else -.22*crouch
  neck.rotation_euler.z=.16*wave if clip=='listen' else 0
  head.rotation_euler.x+=.10*wave if clip=='listen' else .12*wave if clip=='stalk' else 0
  if clip=='stalk':head.rotation_euler.z=.14*wave;control.location.z+=.018*wave
  for name in ['EAR--1-hinge','EAR-1-hinge']:
   bpy.data.objects[name].rotation_euler.x+=.20*wave*(1 if '-1-' in name else -1) if clip=='listen' else 0
 elif hedgehog:
  control.location.z-=.055*amount;control.location.z+=.008*wave if clip=='curled' else 0;control.rotation_euler.x=-.14*amount
  neck.rotation_euler.x=-2.05*amount
 else:
  control.location.x+=.016*wave*amount if clip=='rattle' else 0;control.location.z-=.025*amount;neck.rotation_euler.z=.10*wave*amount
  for hinge,q,base,v in quills:
   target=(v.normalized()+Vector((0,-.16,.65))*amount).normalized();hinge.rotation_mode='QUATERNION';hinge.rotation_quaternion=v.normalized().rotation_difference(target)
 bpy.context.view_layer.update()
 for n,Ls in lengths.items():
  hip=body.matrix_world.translation if False else (control.matrix_local@body.matrix_local@Vector(hips[n]));foot=feet[n].copy();fore=n.startswith('fore')
  if hedgehog and fore:
   foot.x*=1-.45*amount;foot.y=foot.y*(1-amount)+.14*amount;foot.z+=.13*amount+.05*math.sin(math.pi*t) if clip!='curled' else .13
  if fox and clip=='pounce':foot.y-=.10*math.sin(math.pi*t);foot.z+=.10*math.sin(math.pi*t)
  L1,L2,L3,L4=Ls;fetlock=foot+Vector((0,-.035,.10)).normalized()*L4;flex=.45 if fore else .72;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));elbow=solve(hip,fetlock,L1,chord,Vector((0,-1 if fore else 1,0)));knee=solve(elbow,fetlock,L2,L3,Vector((0,1 if fore else -1,0)));ps=[hip,elbow,knee,fetlock,foot]
  for j,(p,q) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'{n}-link-{j}'],p,q)
  for j,p in enumerate(ps):bpy.data.objects[f'{n}-joint-{j}'].location=p
  for j,p in enumerate(ps[1:4],1):bpy.data.objects[f'{n}-joint-volume-{j}'].location=p
  bpy.data.objects[n+('-hoof' if fox else '-foot')].location=foot
 # The tail root follows the same rigid body; retain each original tail link length.
 delta=control.matrix_local@body.matrix_local@tailRest[0]-tailRest[0];ps=[v+delta for v in tailRest]
 for j,p in enumerate(ps):bpy.data.objects[tailNames[j]].location=p
 for j,(p,q) in enumerate(zip(ps,ps[1:])):align(bpy.data.objects[f'tail-{j}-volume' if fox else f'tail-link-{j}'],p,q)
 bpy.context.view_layer.update()
starts={};cursor=500
for clip,count,ms in clips:
 starts[clip]=cursor
 for i in range((count-1)*2+1):
  t=i/(2*(count-1));pose(clip,t);f=cursor+i*ms/20
  for o in objects:
   if o.type=='LIGHT':continue
   o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
 cursor+=(count*ms)/10+20
for o in objects:
 if o.animation_data:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for k in fc.keyframe_points:k.interpolation='LINEAR'
def frame(f):scene.frame_set(math.floor(f),subframe=f-math.floor(f));bpy.context.view_layer.update()
def project(p):
 v=world_to_camera_view(scene,cam,p);return [round(v.x*W,5),round((1-v.y)*W,5),round(v.z,6)]
def at(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def basis(o,p,f):
 p=Vector(p);v=Vector((0,1,0) if f in ['left','right'] else (1,0,0));x=at(o,p);y=at(o,p+v);z=at(o,p+Vector((0,0,1)));return [[y[0]-x[0],z[0]-x[0]],[y[1]-x[1],z[1]-x[1]]]
records=[];camera=json.loads((R/'art-source/wildlife-v2/camera.json').read_text(encoding='utf8'))
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,count,ms in clips:
  for i in range(count):
   frame(starts[clip]+i*ms/10)
   r=dict(facing=facing,clip=clip,index=i,body=at(body,anchor),head=at(head),socket=at(head,(0,.30,-.08)))
   if fox:
    r['neckPoints']=[project(neckLink.matrix_world@v.co)[:2] for v in neckLink.data.vertices]
    r.update(bodyBasis=basis(body,anchor,facing),headBasis=basis(head,(0,0,0),facing),contacts={n:dict(screen=[at(bpy.data.objects[f'{n}-joint-{j}']) for j in range(5)]) for n in lengths},tail=[at(bpy.data.objects[n]) for n in tailNames])
   else:
    r['volumes']=[dict(name=o.name,key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co)[:2] for v in o.data.vertices],depth=at(o)[2]) for o in meshes]
   records.append(r)
root.rotation_euler=(0,0,0);frame(500);scene.frame_start=500;scene.frame_end=math.ceil(cursor);scene['behaviorClips']=json.dumps(dict(clips=clips,starts=starts));scene['behaviorIdentity']=a+'-behavior-v1';bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{a}.blend'))
references=json.loads((R/f'art-source/wildlife-v2/fox/motion-v2/projection.json').read_text(encoding='utf8'))['references'] if fox else {}
(S/'projection.json').write_text(json.dumps(dict(canvas=W,anchor=I['anchor'],clips=clips,records=records,references=references),separators=(',',':'))+'\n',encoding='utf8',newline='\n')
headName=head.name;quillInfo=[(h.name,base.copy()) for h,q,base,v in quills]
bpy.ops.wm.open_mainfile(filepath=str(S/f'{a}.blend'));scene=bpy.context.scene
assert geometry=={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in scene.objects if o.type=='MESH'};assert all(list(bpy.data.objects[n].scale)==v for n,v in scales.items())
checks=planted=hipChecks=neckChecks=quillChecks=0;maximum=0
for clip,count,ms in clips:
 for i in range((count-1)*2+1):
  frame(starts[clip]+i*ms/20);b=bpy.data.objects['BODY-rigid']
  for n,Ls in lengths.items():
   assert (b.matrix_world@Vector(hips[n])-bpy.data.objects[f'{n}-joint-0'].matrix_world.translation).length<.003;hipChecks+=1
   for k,L in enumerate(Ls):
    o=bpy.data.objects[f'{n}-link-{k}'];p=bpy.data.objects[f'{n}-joint-{k}'].matrix_world.translation;q=bpy.data.objects[f'{n}-joint-{k+1}'].matrix_world.translation;err=max((o.matrix_world@Vector((0,0,-L/2))-p).length,(o.matrix_world@Vector((0,0,L/2))-q).length);assert err<.003,(a,clip,i,n,k,err);maximum=max(maximum,err);checks+=1
   foot=bpy.data.objects[n+('-hoof' if fox else '-foot')].matrix_world.translation;assert foot.z>=.02
   if not(hedgehog and n.startswith('fore')) and not(fox and clip=='pounce'):assert (foot-feet[n]).length<.003;planted+=1
  neck=bpy.data.objects['BEHAVIOR-connected-neck'];assert (neck.matrix_world.translation-b.matrix_world@headRoot).length<.0001;assert (bpy.data.objects[headName].matrix_world.translation-neck.matrix_world@headLocal).length<.0001;neckChecks+=1
  if fox:
   o=bpy.data.objects['BEHAVIOR-fixed-neck-volume'];p=bpy.data.objects['BEHAVIOR-connected-neck'].matrix_world.translation;q=bpy.data.objects[headName].matrix_world.translation;assert max((o.matrix_world@Vector((0,0,-headLocal.length/2))-p).length,(o.matrix_world@Vector((0,0,headLocal.length/2))-q).length)<.0001
  for hingeName,base in quillInfo:
   hinge=bpy.data.objects[hingeName];assert (hinge.matrix_world.translation-b.matrix_world@base).length<.0001;quillChecks+=1
(O/'source-audit.json').write_text(json.dumps(dict(identity=a+'-behavior-v1',savedSourceIndependentlyChecked=True,fixedMeshGeometry=geometry,fixedScale=True,fixedCamera=True,rootMotion=False,physicalTimelineMilliseconds=True,fixedLengthEndpointChecks=checks,plantedFootChecks=planted,hipAttachmentChecks=hipChecks,neckAttachmentChecks=neckChecks,quillRootChecks=quillChecks,maxEndpointGapWorldUnits=maximum),indent=2)+'\n',encoding='utf8',newline='\n')
print('THREAT_SOURCE_OK',a,len(records),checks,planted,quillChecks)
