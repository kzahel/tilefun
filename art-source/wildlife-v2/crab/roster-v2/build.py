"""Fresh crab source: eight articulated legs, sideways planted travel and claw display."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=ROOT/'public/demos/wildlife-v2/crab/roster-v2'
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard'
W=32;ANCHOR=[16,22];STRIDE=.64;STANCE=.66;OFF={};legs={};claws={}
def node(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-fixed-ground');body=node('BODY-rigid',root)
def mat(name,rgb,key):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m['paintKey']=key;return m
shell=mat('rust shell',(.65,.25,.13),'B');top=mat('warm upper shell',(.85,.45,.20),'H');dark=mat('deep joint shadow',(.30,.15,.12),'K');cream=mat('claw tips',(.97,.77,.43),'C');eye=mat('black eye',(.10,.12,.11),'E')
def egg(name,loc,radii,m,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);o['paintGroup']=group;return o
egg('wide flattened carapace',(0,0,.37),(.55,.36,.20),shell)
egg('upper shell plane',(0,-.04,.51),(.46,.28,.09),top)
for side in [-1,1]:
 egg(f'eye stalk {side}',(side*.22,.29,.57),(.035,.04,.14),shell)
 egg(f'black bead eye {side}',(side*.22,.30,.70),(.06,.055,.055),eye)
 egg(f'mouthpart {side}',(side*.06,.37,.29),(.05,.07,.05),dark)
def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((0,1,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x)
 q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
def link(name,L,r):return egg(name,(0,0,0),(r,r,L/2),shell,root,'limb')
for side in [-1,1]:
 for i in range(4):
  name=f'leg{side}-{i}';rest=Vector((side*.40,.27-i*.18,.34));Ls=[.16,.36,.42]
  joints=[node(f'{name}-joint-{j}',root) for j in range(4)];links=[link(f'{name}-link-{j}',L,r) for j,(L,r) in enumerate(zip(Ls,[.055,.045,.032]))]
  foot=egg(f'{name}-foot',(0,0,0),(.045,.045,.035),dark,root,'foot')
  legs[name]=dict(side=side,rest=rest,lengths=Ls,joints=joints,links=links,foot=foot);OFF[name]=0 if (i+(side>0))%2==0 else .5
for side in [-1,1]:
 name=f'claw{side}';Ls=[.35,.32];shoulder=Vector((side*.43,.22,.39));joints=[node(f'{name}-joint-{j}',root) for j in range(3)];links=[link(f'{name}-link-{j}',L,.075) for j,L in enumerate(Ls)]
 palm=egg(f'{name}-palm',(0,0,0),(.13,.17,.08),shell,root,'claw');fingers=[]
 for digit in [-1,1]:
  hinge=node(f'{name}-finger{digit}',palm,(digit*.12,.09,0))
  egg(f'{name}-digit{digit}',(0,.10,0),(.045,.14,.045),top,hinge,'claw')
  tip=egg(f'{name}-tip{digit}',(-digit*.015,.22,0),(.04,.06,.04),cream,hinge,'claw');fingers.append((digit,hinge))
 claws[name]=dict(side=side,rest=shoulder,lengths=Ls,joints=joints,links=links,palm=palm,fingers=fingers)
def solve(a,b,L1,L2):
 d=(b-a).length;assert abs(L1-L2)<d<L1+L2,(d,L1,L2);u=(b-a)/d;v=Vector((0,0,1));v=(v-u*v.dot(u)).normalized();along=(L1*L1-L2*L2+d*d)/(2*d)
 return a+along*u+v*math.sqrt(max(0,L1*L1-along*along))
def pose(t,clip):
 moving=clip=='walk';amount=math.sin(math.pi*t)**2 if clip=='action' else 0
 body.location=(0,0,.085*math.sin(4*math.pi*t) if moving else .025*amount);body.rotation_euler=(0,.025*math.cos(4*math.pi*t) if moving else 0,0);bpy.context.view_layer.update();info={}
 for name,l in legs.items():
  phase=(t-OFF[name])%1 if moving else .25;planted=phase<STANCE if moving else True;q=0 if planted else (phase-STANCE)/(1-STANCE)
  x=STRIDE*STANCE/2-STRIDE*phase if moving and planted else (-STRIDE*STANCE/2+STRIDE*STANCE*q*q*(3-2*q) if moving else 0)
  foot=Vector((l['side']*.92+x,l['rest'].y+(.10 if l['rest'].y>0 else -.12),.035+(.12*math.sin(math.pi*q)**1.4 if moving else 0)))
  hip=body.matrix_local@l['rest'];coxa=hip+Vector((l['side']*.16,0,0));knee=solve(coxa,foot,.36,.42);pts=[hip,coxa,knee,foot]
  for o,a,b in zip(l['links'],pts,pts[1:]):align(o,a,b)
  for o,p in zip(l['joints'],pts):o.location=p
  l['foot'].location=foot;info[name]=dict(phase=phase,planted=planted)
 for n,c in claws.items():
  a=body.matrix_local@c['rest'];b=body.matrix_local@Vector((c['side']*.70,.65,.43+.20*amount));elbow=solve(a,b,*c['lengths']);pts=[a,elbow,b]
  for o,p,q in zip(c['links'],pts,pts[1:]):align(o,p,q)
  for o,p in zip(c['joints'],pts):o.location=p
  c['palm'].location=b;c['palm'].rotation_euler.x=-.4*amount
  for digit,h in c['fingers']:h.rotation_euler.z=-digit*(.12+.55*amount)
 bpy.context.view_layer.update();return info
animated=[body]+[o for l in legs.values() for o in l['links']+l['joints']+[l['foot']]]+[o for c in claws.values() for o in c['links']+c['joints']+[c['palm']]+[h for d,h in c['fingers']]]
clips=[('idle',1,1,1),('walk',10,32,3),('action',120,8,10)]
for clip,start,count,step in clips:
 for i in range(count*2+1):
  pose(i/(count*2),clip)
  for o in animated:
   f=start+i*step/2;o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=103
scene['motionIdentity']='crab-roster-v2';scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()});scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()});scene['footfallOffsets']=json.dumps(OFF);scene['strideWorldUnits']=STRIDE;scene['stanceFraction']=STANCE;scene['movementAxis']='x'
scene.timeline_markers.new('SIDEWAYS - planted tetrapods',frame=10);scene.timeline_markers.new('CLAW DISPLAY',frame=120);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/'crab.blend'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def point(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def volumes(groups):
 return {o.name:dict(group=o['paintGroup'],key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co) for v in o.data.vertices],depth=point(o)[2]) for o in scene.objects if o.type=='MESH' and o.get('paintGroup') in groups}
def basis():
 a=point(body,(0,0,.37));v=Vector((0,1,0) if facing in ['left','right'] else (1,0,0));b=point(body,Vector((0,0,.37))+v);c=point(body,(0,0,1.37));return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
records=[];refs={}
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);scene.frame_set(1);pose(0,'idle');refs[facing]=dict(volumes=volumes(['body']),body=point(body,(0,0,.37)),bodyBasis=basis())
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);info=pose(i/count,clip);records.append(dict(facing=facing,clip=clip,index=i,body=point(body,(0,0,.37)),bodyBasis=basis(),contacts={n:info[n]|dict(screen=[point(o) for o in l['joints']]) for n,l in legs.items()},claws=volumes(['claw']),clawJoints={n:[point(o) for o in c['joints']] for n,c in claws.items()}))
(S/'projection.json').write_text(json.dumps(dict(identity='crab-roster-v2',canvas=W,anchor=ANCHOR,frameDurationMs=30,strideWorldUnits=STRIDE,stanceFraction=STANCE,footfallOffsets=OFF,references=refs,records=records),separators=(',',':')),encoding='utf8')
print('CRAB_SOURCE_OK',len(records))
