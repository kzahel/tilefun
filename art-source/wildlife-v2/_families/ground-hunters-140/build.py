"""Fresh ground hunters. Independent species anatomy, fixed-volume links and planted travel."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=64;ANCHOR=[32,48]
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-fixed-ground');pivot=node('MOTION-torso',root,(0,0,1.4));body=node('BODY-rigid',pivot,(0,0,-1.4));head=node('HEAD-rigid',body,P['head']);head_rest=head.location.copy();jaw=node('JAW',head,(0,.16,-.16))
mats={}
for k,color in P['palette'].items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*[v/255 for v in bytes.fromhex(color[1:])],1);m['paintKey']=k;mats[k]=m
def egg(n,loc,radii,key,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
def poly(n,vs,fs,key,parent,group):
 m=bpy.data.meshes.new(n);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(n,m);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
egg('long rib cage',P['torso'],P['radii'],'B');egg('raised shoulder chest',P['chest'],P['chestRadii'],'B');egg('upper back plane',(0,-.12,P['torso'][2]+P['radii'][2]*.74),(.34,P['radii'][1]*.88,.13),'H');egg('belly pale fur',(0,-.05,P['torso'][2]-.27),(.34,.61,.21),'C');egg('hind haunch',(0,-.66,P['hindHip'][2]+.10),(.40,.39,.40),'B');egg('thick neck',(0,.77,P['head'][2]-.19),(.32,.37,.41),'B');egg('throat ruff',(0,.92,P['head'][2]-.30),(.31,.28,.32),'C')
egg('skull',(0,0,0),(.29,.36,.31),'B',head,'head');egg('cheek ruff',(0,.03,-.13),(.35,.27,.20),'H',head,'head');egg('tapering upper muzzle',(0,.28,-.08),(.18,P['muzzle']*.70,.15),'C',head,'head');egg('black nose',(0,.28+P['muzzle']*.62,-.05),(.12,.075,.08),'N',head,'head');egg('mouth cavity',(0,.29,-.15),(.16,.23,.095),'N',head,'head');egg('lower jaw',(0,.13,-.01),(.15,P['muzzle']*.67,.075),'C',jaw,'jaw')
for side in [-1,1]:
 egg(f'eye {side}',(side*.255,.20,.075),(.044,.053,.04),'E',head,'head');egg(f'pupil {side}',(side*.275,.232,.075),(.023,.025,.025),'N',head,'head')
 if P['ears']=='round':egg(f'round ear {side}',(side*.25,-.10,.28),(.15,.09,.19),'B',head,'head');egg(f'ear interior {side}',(side*.25,-.035,.30),(.085,.03,.11),'M',head,'head')
 else:
  x=side*.23;h=P['earHeight'];poly(f'pointed ear {side}',[(x-.13,-.16,.14),(x+.13,-.16,.14),(x+side*.03,-.13,.14+h),(x-.11,-.04,.14),(x+.11,-.04,.14),(x+side*.03,-.04,.14+h*.88)],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'B',head,'head');poly(f'ear inner {side}',[(x-.075,-.035,.20),(x+.075,-.035,.20),(x+side*.02,-.035,.14+h*.70)],[(0,1,2)],'M',head,'head')
if SPECIES=='spotted-hyena':
 for side in [-1,1]:
  for j in range(10):
   y=-.65+(j%5)*.26;z=P['torso'][2]+(.10 if j<5 else -.13);egg(f'coat spot {side} {j}',(side*.455,y,z),(.035,.065,.06),'M')
 for j in range(6):egg(f'short dark mane {j}',(0,-.45+j*.19,1.83+j*.025),(.095,.13,.12),'M')
def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
legs={};OFF={'hind-1':0,'fore-1':.25,'hind1':.5,'fore1':.75};STANCE=.68
for end in ['fore','hind']:
 for side in [-1,1]:
  n=f'{end}{side}';rest=Vector(P[end+'Hip']);rest.x*=side;Ls=P[end+'Lengths'];radii=[.14,.105,.075,.065];links=[egg(f'{n}-link-{j}',(0,0,0),(r,r,L/2),'B',root,'limb') for j,(r,L) in enumerate(zip(radii,Ls))];joints=[node(f'{n}-joint-{j}',root) for j in range(5)];bulbs=[egg(f'{n}-joint-volume-{j}',(0,0,0),(r,r,r),'B',root,'limb') for j,r in enumerate([.11,.08,.065],1)];foot=egg(f'{n}-foot',(0,0,0),(.12,.21,.10),'M',root,'foot');legs[n]=dict(end=end,rest=rest,lengths=Ls,links=links,joints=joints,bulbs=bulbs,foot=foot)
tailL=[.39,.36,.32];tails=[egg(f'tail-link-{i}',(0,0,0),(P['tailRadius']*(1-i*.18),P['tailRadius']*(1-i*.18),L/2),'M' if i==2 else 'B',root,'tail') for i,L in enumerate(tailL)];tailj=[node(f'tail-joint-{i}',root) for i in range(4)]
def pose(t,clip):
 moving=clip in ['walk','chase'];stride=P['walkSpeed' if clip=='walk' else 'chaseSpeed']*32*P['walkMs' if clip=='walk' else 'chaseMs']/1000/10 if moving else 0;amount=math.sin(math.pi*t)**2 if clip in ['feed','display'] else 0
 pivot.location=(.02*math.sin(2*math.pi*t) if moving else 0,0,1.4+(.085*math.sin(4*math.pi*t) if moving else -.04*amount if clip=='feed' else 0));pivot.rotation_euler=(.035*math.cos(4*math.pi*t) if moving else -.035*amount if clip=='feed' else 0,.012*math.sin(2*math.pi*t) if moving else 0,0)
 head.location=head_rest+Vector((0,.05*amount,-.32*amount if clip=='feed' else .06*amount if clip=='display' else 0));head.rotation_euler.x=-.60*amount if clip=='feed' else .34*amount if clip=='display' else -.02*math.cos(4*math.pi*t) if moving else 0;jaw.rotation_euler.x=-.24*amount*(.5+.5*math.sin(8*math.pi*t)**2) if clip=='feed' else -.24*amount if clip=='display' else 0;bpy.context.view_layer.update();info={}
 for n,l in legs.items():
  phase=(t-OFF[n])%1 if moving else .3;planted=phase<STANCE if moving else True;q=0 if planted else (phase-STANCE)/(1-STANCE);y=stride*STANCE/2-stride*phase if moving and planted else (-stride*STANCE/2+stride*STANCE*q*q*(3-2*q) if moving else 0);foot=Vector((l['rest'].x,l['rest'].y+y,.10+.19*math.sin(math.pi*q)**1.4));hip=pivot.matrix_local@body.matrix_local@l['rest'];L1,L2,L3,L4=l['lengths'];fetlock=foot+Vector((0,-.035,.10)).normalized()*L4;flex=(.20 if l['end']=='fore' else .65)+.65*math.sin(math.pi*q)**2;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=fetlock-hip;d=delta.length;u=delta.normalized();assert abs(L1-chord)<d<L1+chord,(SPECIES,clip,n,t,d,L1+chord);a=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,-1 if l['end']=='fore' else 1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a));delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,1 if l['end']=='fore' else -1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a));ps=[hip,elbow,knee,fetlock,foot]
  for o,p,q in zip(l['links'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(l['joints'],ps):o.location=p
  for o,p in zip(l['bulbs'],ps[1:4]):o.location=p
  l['foot'].location=foot;info[n]=dict(phase=phase,planted=planted)
 base=pivot.matrix_local@body.matrix_local@Vector((0,-.90,P['torso'][2]+.06));ps=[base]
 for i,L in enumerate(tailL):
  v=Vector((.14*math.sin(2*math.pi*t-i*.4) if moving else .06*amount,-1,-.45-i*.18));ps.append(ps[-1]+v.normalized()*L)
 for o,p,q in zip(tails,ps,ps[1:]):align(o,p,q)
 for o,p in zip(tailj,ps):o.location=p
 bpy.context.view_layer.update();return info
animated=[pivot,head,jaw]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['foot']]]+tails+tailj
clips=[('idle',1,1,1),('walk',10,32,4),('feed',160,8,10),('display',260,8,10),('chase',360,32,2)]
for clip,start,count,step in clips:
 for i in range(count*2+1):
  pose(i/(count*2),clip);f=start+i*step/2
  for o in animated:o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=134
scene['motionIdentity']=f'{SPECIES}-roster-v2';scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()});scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()});scene['footfallOffsets']=json.dumps(OFF);scene['stanceFraction']=STANCE;scene['walkStrideWorldUnits']=P['walkSpeed']*32*P['walkMs']/1000/10;scene['chaseStrideWorldUnits']=P['chaseSpeed']*32*P['chaseMs']/1000/10;scene['tailLengths']=json.dumps(tailL);scene['bodyAnchor']=json.dumps(P['torso']);scene.timeline_markers.new('WALK - planted feet',frame=10);scene.timeline_markers.new('FEED',frame=160);scene.timeline_markers.new('DISPLAY',frame=260);scene.timeline_markers.new('CHASE - planted brisk gait',frame=360);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def point(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def volumes():return {o.name:dict(group=o['paintGroup'],key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co) for v in o.data.vertices],depth=point(o)[2]) for o in scene.objects if o.type=='MESH' and o.get('paintGroup') in ['body','head','jaw']}
def basis(o,anchor):
 a=point(o,anchor);v=Vector((0,1,0) if facing in ['left','right'] else (1,0,0));b=point(o,Vector(anchor)+v);c=point(o,Vector(anchor)+Vector((0,0,1)));return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
records=[];refs={}
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);scene.frame_set(1);pose(0,'idle');refs[facing]=dict(volumes=volumes(),body=point(body,P['torso']),head=point(head),jaw=point(jaw),bodyBasis=basis(body,P['torso']),headBasis=basis(head,(0,0,0)),jawBasis=basis(jaw,(0,0,0)))
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);info=pose(i/count,clip);records.append(dict(facing=facing,clip=clip,index=i,body=point(body,P['torso']),head=point(head),jaw=point(jaw),bodyBasis=basis(body,P['torso']),headBasis=basis(head,(0,0,0)),jawBasis=basis(jaw,(0,0,0)),contacts={n:info[n]|dict(screen=[point(o) for o in l['joints']]) for n,l in legs.items()},feet={n:[project(l['foot'].matrix_world@v.co) for v in l['foot'].data.vertices] for n,l in legs.items()},tail=[point(o) for o in tailj]))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v2',canvas=W,anchor=ANCHOR,palette=P['palette'],walkFrameDurationMs=P['walkMs'],chaseFrameDurationMs=P['chaseMs'],walkSpeed=P['walkSpeed'],chaseSpeed=P['chaseSpeed'],strideWorldUnits=scene['walkStrideWorldUnits'],chaseStrideWorldUnits=scene['chaseStrideWorldUnits'],stanceFraction=STANCE,footfallOffsets=OFF,references=refs,records=records),separators=(',',':')),encoding='utf8');print('GROUND_HUNTER_SOURCE_OK',SPECIES,len(records))
