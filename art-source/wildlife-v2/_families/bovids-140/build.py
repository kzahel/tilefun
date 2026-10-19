"""Fresh heavy bovids with fixed-volume limbs, articulated necks and planted travel."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=64;ANCHOR=[32,48]
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-fixed-ground');pivot=node('MOTION-torso',root,(0,0,1.4));body=node('BODY-rigid',pivot,(0,0,-1.4));head=node('HEAD-rigid',root,P['head']);head_rest=head.location.copy();jaw=node('JAW',head,(0,.16,-.16))
mats={}
for k,color in P['palette'].items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*[v/255 for v in bytes.fromhex(color[1:])],1);m['paintKey']=k;mats[k]=m
def egg(n,loc,radii,key,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
def poly(n,vs,fs,key,parent,group):
 m=bpy.data.meshes.new(n);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(n,m);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
egg('broad rib cage',P['torso'],P['radii'],'B');egg('chest',P['chest'],P['chestRadii'],'B');egg('upper coat plane',(0,-.10,P['torso'][2]+P['radii'][2]*.72),(P['radii'][0]*.85,P['radii'][1]*.9,.16),'H');egg('belly',(0,-.04,P['torso'][2]-.30),(P['radii'][0]*.80,P['radii'][1]*.80,.28),'C');egg('haunch',(0,P['hindHip'][1],P['hindHip'][2]+.16),(P['radii'][0]*.92,.44,P['radii'][2]),'B')
# Broad bovid faces and species-specific tapered swept horns.
egg('bovid skull',(0,0,0),P['skull'],'M' if SPECIES in ['american-bison','wildebeest'] else 'B',head,'head');egg('broad face bridge',(0,.22,-.12),(P['skull'][0]*.85,.30,.23),'B',head,'head');egg('broad muzzle',(0,.42,-.25),(P['skull'][0]*.88,.20,.15),'M',head,'head');egg('nose',(0,.56,-.21),(.14,.055,.065),'N',head,'head');egg('lower jaw',(0,.20,-.13),(P['skull'][0]*.80,.24,.08),'B',jaw,'jaw')
for side in [-1,1]:
 egg(f'eye {side}',(side*P['skull'][0]*.92,.13,.045),(.045,.05,.045),'E',head,'head')
 ear=egg(f'wide lateral ear {side}',(side*(P['skull'][0]+.14),-.10,.14),(.20,.09,.11),'B',head,'head');ear.rotation_euler.y=-side*.25
 egg(f'ear inset {side}',(side*(P['skull'][0]+.15),-.025,.15),(.13,.02,.065),'M',head,'head')
 points=[Vector((side*x,y,z)) for x,y,z in P['hornPath']]
 for j,(a,c) in enumerate(zip(points,points[1:])):
  v=c-a;basis=v.to_track_quat('Z','Y');vs=[];N=len(points)-1
  for t,radius in [(0,.11*(1-j/N)+.008),(1,.11*(1-(j+1)/N)+.005)]:
   for k in range(10):vs.append(tuple(a+v*t+basis@Vector((radius*math.cos(k*math.tau/10),radius*math.sin(k*math.tau/10),0))))
  fs=[tuple(reversed(range(10))),tuple(range(10,20))]+[(k,(k+1)%10,(k+1)%10+10,k+10) for k in range(10)];poly(f'swept horn {side} {j}',vs,fs,'C',head,'head')
if SPECIES=='american-bison':
 egg('high shoulder hump',(0,.29,2.48),(.62,.65,.59),'H');egg('bison shaggy forehead',(0,-.02,.19),(.38,.28,.27),'M',head,'head');egg('long dark beard',(0,.13,-.43),(.19,.22,.34),'M',head,'head')
 for side in [-1,1]:
  for j in range(4):egg(f'shoulder shag {side} {j}',(side*.64,.40-j*.16,1.80-j*.04),(.16,.20,.34),'M')
if SPECIES=='musk-ox':
 egg('broad horn boss',(0,-.13,.24),(.38,.14,.13),'C',head,'head')
 for side in [-1,1]:
  for j in range(7):egg(f'long skirt fur {side} {j}',(side*.56,-.81+j*.25,1.05),(.19,.22,.48),'M')
 egg('buff saddle',(0,-.16,2.22),(.57,.79,.21),'H')
if SPECIES=='wildebeest':
 egg('dark forehead tuft',(0,-.02,.22),(.24,.20,.16),'M',head,'head');egg('hanging beard',(0,.09,-.44),(.12,.17,.25),'M',head,'head')
if SPECIES=='water-buffalo':
 for side in [-1,1]:egg(f'nostril {side}',(side*.12,.60,-.19),(.05,.03,.04),'N',head,'head')

def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
legs={};OFF={'hind-1':0,'fore-1':.25,'hind1':.5,'fore1':.75};STANCE=.68
for end in ['fore','hind']:
 for side in [-1,1]:
  n=f'{end}{side}';rest=Vector(P[end+'Hip']);rest.x*=side;Ls=P[end+'Lengths'];radii=[.18,.12,.085,.07];links=[egg(f'{n}-link-{j}',(0,0,0),(r,r,L/2),'B',root,'limb') for j,(r,L) in enumerate(zip(radii,Ls))];joints=[node(f'{n}-joint-{j}',root) for j in range(5)];bulbs=[egg(f'{n}-joint-volume-{j}',(0,0,0),(r,r,r),'B',root,'limb') for j,r in enumerate([.11,.08,.065],1)];foot=egg(f'{n}-foot',(0,0,0),(.15,.22,.10),'M',root,'foot');legs[n]=dict(end=end,rest=rest,lengths=Ls,links=links,joints=joints,bulbs=bulbs,foot=foot)
tailL=P['tailLengths'];tails=[egg(f'tail-link-{i}',(0,0,0),((.14 if i==2 and not P['tailUp'] else P['tailRadius']*(1-i*.12)),(.14 if i==2 and not P['tailUp'] else P['tailRadius']*(1-i*.12)),L/2),'M' if i==2 else 'B',root,'tail') for i,L in enumerate(tailL)];tailj=[node(f'tail-joint-{i}',root) for i in range(4)]
if P['cloven']:
 for l in legs.values():
  foot=l['foot'];old=foot.data;vs=[v.co.copy() for v in old.vertices];fs=[list(f.vertices) for f in old.polygons];newvs=[];newfs=[]
  for side in [-1,1]:
   offset=len(newvs);newvs.extend([(v.x*.48+side*.07,v.y,v.z) for v in vs]);newfs.extend([[n+offset for n in face] for face in fs])
  m=bpy.data.meshes.new(foot.name+' paired toes');m.from_pydata(newvs,[],newfs);m.update();m.materials.append(mats['M']);foot.data=m
neckL=P['neckLengths'];neckjs=[node(f'neck-joint-{j}',root) for j in range(3)];necklinks=[egg(f'neck-link-{j}',(0,0,0),(P['neckRadius'],P['neckRadius'],L/2),'B',root,'neck') for j,L in enumerate(neckL)];manes=[]
neckbulbs=[egg(f'neck joint volume {j}',(0,0,0),(P['neckRadius'],P['neckRadius'],P['neckRadius']),'B',root,'neck') for j in range(3)]
for j,(link,L) in enumerate(zip(necklinks,neckL)):
 if P['mane']:
  r=P['neckRadius'];manes.append(poly(f'neck mane {j}',[(-.045,-r-.035,-L/2),(.045,-r-.035,-L/2),(.045,-r-.035,L/2),(-.045,-r-.035,L/2)],[(0,1,2,3)],'M',link,'mane'))
def pose(t,clip):
 moving=clip=='walk';stride=P['walkSpeed']*32*P['walkMs']/1000/10 if moving else 0;amount=math.sin(math.pi*t)**2 if clip=='action' else 0
 pivot.location=(.02*math.sin(2*math.pi*t) if moving else 0,0,1.4+(.085*math.sin(4*math.pi*t) if moving else -.04*amount if clip=='action' else 0));pivot.rotation_euler=(.035*math.cos(4*math.pi*t) if moving else -.035*amount if clip=='action' else 0,.012*math.sin(2*math.pi*t) if moving else 0,0)
 bpy.context.view_layer.update();bm=pivot.matrix_local@body.matrix_local
 head_target=bm@(head_rest.lerp(Vector(P['grazeHead']),amount));base=bm@Vector(P['neckBase']);delta=head_target-base;d=delta.length;u=delta.normalized();L1,L2=neckL;assert abs(L1-L2)<d<L1+L2,(SPECIES,clip,t,'neck',d,L1+L2);along=(L1*L1-L2*L2+d*d)/(2*d);pole=Vector((0,0,1));pole=(pole-u*pole.dot(u)).normalized();knee=base+along*u+pole*math.sqrt(max(0,L1*L1-along*along));ns=[base,knee,head_target]
 for o,p,q in zip(necklinks,ns,ns[1:]):align(o,p,q)
 for o,p in zip(neckjs,ns):o.location=p
 for o,p in zip(neckbulbs,ns):o.location=p
 head.location=head_target;head.rotation_euler.x=-.75*amount if clip=='action' else -.02*math.cos(4*math.pi*t) if moving else 0;jaw.rotation_euler.x=-.25*amount*(.55+.45*math.sin(3*math.pi*t)**2);bpy.context.view_layer.update();info={}
 for n,l in legs.items():
  phase=(t-OFF[n])%1 if moving else .3;planted=phase<STANCE if moving else True;q=0 if planted else (phase-STANCE)/(1-STANCE);y=stride*STANCE/2-stride*phase if moving and planted else (-stride*STANCE/2+stride*STANCE*q*q*(3-2*q) if moving else 0);foot=Vector((l['rest'].x,l['rest'].y+y,.10+.19*math.sin(math.pi*q)**1.4));hip=pivot.matrix_local@body.matrix_local@l['rest'];L1,L2,L3,L4=l['lengths'];fetlock=foot+Vector((0,-.035,.10)).normalized()*L4;flex=(.20 if l['end']=='fore' else .65)+.65*math.sin(math.pi*q)**2;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=fetlock-hip;d=delta.length;u=delta.normalized();assert abs(L1-chord)<d<L1+chord,(SPECIES,clip,n,t,d,L1+chord);a=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,-1 if l['end']=='fore' else 1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a));delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d);pole=Vector((0,1 if l['end']=='fore' else -1,0));pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a));ps=[hip,elbow,knee,fetlock,foot]
  for o,p,q in zip(l['links'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(l['joints'],ps):o.location=p
  for o,p in zip(l['bulbs'],ps[1:4]):o.location=p
  l['foot'].location=foot;info[n]=dict(phase=phase,planted=planted)
 base=pivot.matrix_local@body.matrix_local@Vector((0,-.08-P['radii'][1]*.84,P['torso'][2]+.06));ps=[base]
 for i,L in enumerate(tailL):
  v=Vector((.10*math.sin(2*math.pi*t-i*.4) if moving else .03*amount,-1 if P['tailUp'] else -.4,.30-i*.12 if P['tailUp'] else -1));ps.append(ps[-1]+v.normalized()*L)
 for o,p,q in zip(tails,ps,ps[1:]):align(o,p,q)
 for o,p in zip(tailj,ps):o.location=p
 bpy.context.view_layer.update();return info
animated=[pivot,head,jaw]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['foot']]]+tails+tailj+necklinks+neckjs+neckbulbs
clips=[('idle',1,1,1),('walk',10,32,P['walkMs']//10),('action',260,8,10)]
for clip,start,count,step in clips:
 substeps=4 if clip=='action' else 2
 for i in range(count*substeps+1):
  pose(i/(count*substeps),clip);f=start+i*step/substeps
  for o in animated:o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=int(10+31*P['walkMs']/10)
scene['motionIdentity']=f'{SPECIES}-roster-v2';scene['actionSubsteps']=4;scene['walkFrameStep']=P['walkMs']//10;scene['frameDurationMs']=P['walkMs'];scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()});scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()});scene['footfallOffsets']=json.dumps(OFF);scene['stanceFraction']=STANCE;scene['walkStrideWorldUnits']=P['walkSpeed']*32*P['walkMs']/1000/10;scene['neckLengths']=json.dumps(neckL);scene['neckBase']=json.dumps(P['neckBase']);scene['tailLengths']=json.dumps(tailL);scene['bodyAnchor']=json.dumps(P['torso']);scene.timeline_markers.new('WALK - planted feet',frame=10);scene.timeline_markers.new('GRAZE - articulated neck',frame=260);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def point(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def native_foot_hull(o):
 # Retain the exact rounded silhouette used by the palette finisher. Full
 # source mesh geometry stays in Blender and is independently audited.
 points=[project(o.matrix_world@v.co) for v in o.data.vertices];ps=sorted(set((math.floor(p[0]+.5),math.floor(p[1]+.5)) for p in points));lo=[];hi=[]
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def volumes():return {o.name:dict(group=o['paintGroup'],key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co) for v in o.data.vertices],depth=point(o)[2]) for o in scene.objects if o.type=='MESH' and o.get('paintGroup') in ['body','head','jaw']}
def basis(o,anchor):
 a=point(o,anchor);v=Vector((0,1,0) if facing in ['left','right'] else (1,0,0));b=point(o,Vector(anchor)+v);c=point(o,Vector(anchor)+Vector((0,0,1)));return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
records=[];refs={}
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);scene.frame_set(1);pose(0,'idle');refs[facing]=dict(volumes=volumes(),body=point(body,P['torso']),head=point(head),jaw=point(jaw),bodyBasis=basis(body,P['torso']),headBasis=basis(head,(0,0,0)),jawBasis=basis(jaw,(0,0,0)))
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);info=pose(i/count,clip);records.append(dict(facing=facing,clip=clip,index=i,body=point(body,P['torso']),head=point(head),jaw=point(jaw),bodyBasis=basis(body,P['torso']),headBasis=basis(head,(0,0,0)),jawBasis=basis(jaw,(0,0,0)),contacts={n:info[n]|dict(screen=[point(o) for o in l['joints']]) for n,l in legs.items()},nativeFootHulls={n:native_foot_hull(l['foot']) for n,l in legs.items()},hoofSplit={n:point(l['foot'],(0,.20,-.02)) for n,l in legs.items()},tail=[point(o) for o in tailj],neck=[point(o) for o in neckjs],mane=[dict(key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co) for v in o.data.vertices]) for o in manes]))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v2',canvas=W,anchor=ANCHOR,palette=P['palette'],walkFrameDurationMs=P['walkMs'],walkSpeed=P['walkSpeed'],strideWorldUnits=scene['walkStrideWorldUnits'],neckRadius=P['neckRadius'],cloven=P['cloven'],stanceFraction=STANCE,footfallOffsets=OFF,references=refs,records=records),separators=(',',':')),encoding='utf8');print('GRAZER_SOURCE_OK',SPECIES,len(records))
