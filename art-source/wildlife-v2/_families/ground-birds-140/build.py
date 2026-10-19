"""Fresh ground birds with linked necks, planted biped legs and source feather fans."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=P['canvas'];ANCHOR=[W//2,W*3//4]
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-fixed-ground');pivot=node('MOTION-torso',root,(0,0,P['torso'][2]));body=node('BODY-rigid',pivot,(0,0,-P['torso'][2]));head=node('HEAD-rigid',root,P['head']);head_rest=head.location.copy();jaw=node('JAW',head,(0,.08,-.045))
mats={}
for k,color in P['palette'].items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*[v/255 for v in bytes.fromhex(color[1:])],1);m['paintKey']=k;mats[k]=m
def egg(n,loc,radii,key,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
def poly(n,vs,fs,key,parent,group):
 m=bpy.data.meshes.new(n);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(n,m);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
exec((FAMILY/'geometry.py').read_text(encoding='utf8'))

def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
legs={};OFF={'leg-1':0,'leg1':.5};STANCE=.65
for end in ['leg']:
 for side in [-1,1]:
  n=f'{end}{side}';rest=Vector(P[end+'Hip']);rest.x*=side;Ls=P[end+'Lengths'];radii=P['legRadii'];links=[egg(f'{n}-link-{j}',(0,0,0),(r,r,L/2),'M' if SPECIES=='red-panda' else 'B',root,'limb') for j,(r,L) in enumerate(zip(radii,Ls))];joints=[node(f'{n}-joint-{j}',root) for j in range(5)];bulbs=[egg(f'{n}-joint-volume-{j}',(0,0,0),(r,r,r),'B',root,'limb') for j,r in enumerate(P['legRadii'][1:],1)];foot=egg(f'{n}-foot',(0,0,0),(P['footWidth'],P['footLength'],.06),'M',root,'foot');legs[n]=dict(end=end,rest=rest,lengths=Ls,links=links,joints=joints,bulbs=bulbs,foot=foot)
for n,l in legs.items():
 counters={1:0,-1:0}
 for j,direction in enumerate(P['toeDirections']):
  total=P['toeDirections'].count(direction);k=counters[direction];counters[direction]+=1;x=(k-(total-1)/2)*.10;length=.24 if SPECIES=='ostrich' and j==0 else .23 if SPECIES=='cassowary' and j==0 else .14
  toe=egg(f'{n}-toe-{j}',(x,direction*.16,-.02),(.035,length,.035),'M',l['foot'],'digit');toe.rotation_euler.z=-direction*x*.8
neckLs=P['neckLengths'];neck=[egg(f'NECK-link-{i}',(0,0,0),(P['neckRadius'],P['neckRadius'],L/2),P['neckKey'],root,'neck') for i,L in enumerate(neckLs)];neckj=[node(f'NECK-joint-{i}',root) for i in range(3)]
tailRoot=node('TAIL-root',body,P['tailRoot']);feathers=[];N=P['tailFeathers']
for i in range(N):
 L=P['tailLength']*(1-.16*abs(2*i/max(1,N-1)-1));o=egg(f'TAIL-feather-{i}',(0,0,0),(P['tailWidth'],.045,L/2),'T' if SPECIES=='peacock' else 'C' if SPECIES=='ostrich' else 'H',tailRoot,'feather');feathers.append((o,L))
 if SPECIES=='peacock':
  for side in [-1,1]:
   for key,rx,rz,zoff in [('E',.10,.16,.22),('U',.065,.11,.23),('N',.035,.055,.24)]:egg(f'eyespot {i} {side} {key}',(0,side*.055,L*zoff),(rx,.02,rz),key,o,'eyespot')
 if SPECIES=='wild-turkey':
  for side in [-1,1]:egg(f'tail band {i} {side}',(0,side*.05,L*.3),(P['tailWidth']*1.03,.02,.07),'C',o,'feather')
def pose(t,clip):
 moving=clip=='walk';amount=math.sin(math.pi*t)**2 if clip=='feed' else 0;stride=P['walkSpeed']*32*P['walkMs']/1000/10 if moving else 0;z=P['torso'][2]
 pivot.location=(.012*math.sin(math.tau*t) if moving else 0,0,z+(.10*math.sin(4*math.pi*t) if moving else -.035*amount));pivot.rotation_euler=(.025*math.cos(4*math.pi*t) if moving else 0,.012*math.sin(math.tau*t) if moving else 0,0)
 head.location=head_rest+Vector((0,P['headReach']*amount,(-P['headDrop']*amount if clip=='feed' else .07*math.sin(4*math.pi*t) if moving else 0)));head.rotation_euler.x=(.12 if SPECIES in ['peacock','wild-turkey'] else -.42)*amount if clip=='feed' else .025*math.cos(4*math.pi*t) if moving else 0;jaw.rotation_euler.x=-.28*amount
 for side,o in zip([-1,1],wings):o.rotation_euler.y=side*(P['wingSpread']*amount+.03*math.sin(math.tau*t) if moving else P['wingSpread']*amount)
 bpy.context.view_layer.update();info={}
 for n,l in legs.items():
  phase=(t-OFF[n])%1 if moving else .3;planted=phase<STANCE if moving else True;q=0 if planted else (phase-STANCE)/(1-STANCE);y=stride*STANCE/2-stride*phase if moving and planted else (-stride*STANCE/2+stride*STANCE*q*q*(3-2*q) if moving else 0);foot=Vector((l['rest'].x,l['rest'].y+y,.06+P['lift']*math.sin(math.pi*q)**1.4));hip=pivot.matrix_local@body.matrix_local@l['rest'];L1,L2,L3,L4=l['lengths'];fetlock=foot+Vector((0,-.035,.10)).normalized()*L4;flex=.65+.65*math.sin(math.pi*q)**2;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=fetlock-hip;d=delta.length;u=delta.normalized();assert abs(L1-chord)<d<L1+chord,(SPECIES,clip,n,t,d,L1+chord);a=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a));delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,-1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a));ps=[hip,elbow,knee,fetlock,foot]
  for o,p,q in zip(l['links'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(l['joints'],ps):o.location=p
  for o,p in zip(l['bulbs'],ps[1:4]):o.location=p
  l['foot'].location=foot;info[n]=dict(phase=phase,planted=planted)
 a=pivot.matrix_local@body.matrix_local@Vector(P['neckRoot']);b=head.location.copy();delta=b-a;d=delta.length;u=delta.normalized();L1,L2=neckLs;assert abs(L1-L2)<d<L1+L2,(SPECIES,clip,t,'neck',d);v=Vector((0,u.z,-u.y)).normalized();c=(L1*L1-L2*L2+d*d)/(2*d);mid=a+u*c+v*math.sqrt(max(0,L1*L1-c*c));ps=[a,mid,b]
 for o,p,q in zip(neck,ps,ps[1:]):align(o,p,q)
 for o,p in zip(neckj,ps):o.location=p
 tailRoot.rotation_euler.z=.045*math.sin(math.tau*t) if moving else 0
 for i,(o,L) in enumerate(feathers):
  fraction=2*i/max(1,N-1)-1
  if SPECIES=='peacock':
   rest=Vector((math.sin(fraction*.20),-1,.08));display=Vector((math.sin(fraction*1.20),-.30,math.cos(fraction*1.20)));v=(rest*(1-amount)+display*amount).normalized()
  elif SPECIES=='wild-turkey':v=(Vector((fraction*.10,-.85,.38))*(1-amount)+Vector((math.sin(fraction*1.15),-.35,math.cos(fraction*1.15)))*amount).normalized()
  else:v=Vector((fraction*.2,-1,.08)).normalized()
  align(o,Vector((0,0,0)),v*L)
 bpy.context.view_layer.update();return info
animated=[pivot,head,jaw,tailRoot,*wings,*neck,*neckj]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['foot']]]+[o for o,L in feathers]
clips=[('idle',1,1,1),('walk',10,32,4),('feed',160,8,10)]
for clip,start,count,step in clips:
 for i in range(count*4+1):
  pose(i/(count*4),clip);frame=start+i*step/4
  for o in animated:o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=134
scene['motionIdentity']=f'{SPECIES}-roster-v2';scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()});scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()});scene['footfallOffsets']=json.dumps(OFF);scene['stanceFraction']=STANCE;scene['walkStrideWorldUnits']=P['walkSpeed']*32*P['walkMs']/1000/10;scene['neckLengths']=json.dumps(neckLs);scene['neckRoot']=json.dumps(P['neckRoot']);scene['tailFeathers']=json.dumps([L for o,L in feathers]);scene['tailRoot']=json.dumps(P['tailRoot']);scene['wingRoots']=json.dumps([list(o.location) for o in wings]);scene['toeCounts']=P['toes'];scene['toeForwardCount']=P['toeDirections'].count(1);scene['bodyAnchor']=json.dumps(P['torso']);scene.timeline_markers.new('WALK - planted feet',frame=10);scene.timeline_markers.new('FEED',frame=160);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
# The camera is orthographic and fixed across poses; cache its view transform.
bpy.context.view_layer.update();camera_inverse=cam.matrix_world.normalized().inverted();camera_frame=cam.data.view_frame(scene=scene);camera_bounds=(camera_frame[2].x,camera_frame[1].x,camera_frame[1].y,camera_frame[0].y);projection_probes=0
assert cam.data.type=='ORTHO'
def project(p):
 global projection_probes
 local=camera_inverse@p;x0,x1,y0,y1=camera_bounds;v=Vector(((local.x-x0)/(x1-x0),(local.y-y0)/(y1-y0),-local.z))
 if projection_probes<32:
  expected=world_to_camera_view(scene,cam,p);assert (v-expected).length<1e-6;projection_probes+=1
 return [v.x*W,(1-v.y)*W,v.z]

def hull(ps):
 points=sorted(set((round(p[0],5),round(p[1],5)) for p in ps));cross=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);lo=[];hi=[]
 for p in points:
  while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(points):
  while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
records=[];meshes=[o for o in scene.objects if o.type=='MESH']
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();volumes=[]
   for original in meshes:
    o=original.evaluated_get(dg);ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
    if o.get('surfacePaint'):
     view=(cam.matrix_world.translation-o.matrix_world.translation).normalized()
     for face in o.data.polygons:
      if (o.matrix_world.to_3x3()@face.normal).dot(view)<=0:continue
      fp=[ps[v] for v in face.vertices];volumes.append(dict(name=o.name,group=o.get('paintGroup'),key=o.data.materials[face.material_index]['paintKey'],depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,group=o.get('paintGroup'),key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   records.append(dict(facing=facing,clip=clip,index=i,body=project(body.evaluated_get(dg).matrix_world@Vector(P['torso'])),volumes=volumes))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v2',canvas=W,anchor=ANCHOR,palette=P['palette'],frameDurationMs=P['walkMs'],speed=P['walkSpeed'],strideWorldUnits=scene['walkStrideWorldUnits'],records=records),separators=(',',':')),encoding='utf8');print('GROUND_BIRD_SOURCE_OK',SPECIES,len(records))
