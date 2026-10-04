"""Fresh red kangaroo: synchronous hind hop, fixed skull/limbs, balancing tail.
Geometry is independent of drawings. Isolated Blender scene, no live UI changes.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/kangaroo/draft-v1';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True
sc.render.resolution_x=sc.render.resolution_y=320;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard';sc.render.fps=7;meshes=[]
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
rust=mat('male russet fur',(.57,.32,.19));cream=mat('pale belly cheek stripe',(.78,.70,.54));dark=mat('nose eye dark cheek',(.14,.13,.10));inner=mat('ear interior',(.45,.29,.23))
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-fixed-volume',root);head=empty('HEAD-fixed-volume',body,(0,.64,3.70))
def uv(n,loc,rad,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12);o=bpy.context.object;o.name=n;o.scale=rad;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def link(n,L,r,m,parent=root):
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r,radius2=r*.76,depth=L);o=bpy.context.object;o.name=n;o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def place(o,a,b):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
uv('upper-torso',(0,.08,2.58),(.42,.45,.74),rust,body);uv('abdomen',(0,-.12,1.96),(.49,.43,.62),rust,body)
uv('neck',(0,.40,3.22),(.21,.23,.43),rust,body);uv('cream-chest',(0,.425,2.45),(.28,.085,.63),cream,body)
uv('skull',(0,0,0),(.23,.26,.32),rust,head);uv('tapered-muzzle',(0,.32,-.11),(.18,.32,.15),rust,head);uv('lower-jaw',(0,.28,-.20),(.16,.27,.07),cream,head);uv('nose',(0,.59,-.08),(.10,.07,.075),dark,head)
ears={}
for s in [-1,1]:
 uv('eye-'+str(s),(s*.20,.14,.035),(.038,.045,.037),dark,head)
 uv('pale-cheek-'+str(s),(s*.20,.16,-.10),(.035,.22,.09),cream,head);uv('dark-cheek-'+str(s),(s*.215,.12,-.02),(.026,.14,.036),dark,head)
 e=empty('EAR-'+str(s),head,(s*.16,-.08,.22));e.rotation_euler.y=math.radians(s*13);ears[s]=e
 uv('ear-shell-'+str(s),(0,0,.42),(.10,.08,.46),rust,e);uv('ear-inner-'+str(s),(0,.072,.42),(.059,.018,.34),inner,e)
limbs={}
for kind,hip,L1,L2,r in [('hind',(.34,-.15,1.65),.85,1.10,.23),('fore',(.30,.27,2.88),.48,.45,.10)]:
 for s in [-1,1]:
  n=f'{kind}:{s}';ctl=empty('DISTAL-'+n,root);upper=link(n+'-upper',L1,r,rust);lower=link(n+'-lower',L2,.13 if kind=='hind' else .075,rust)
  if kind=='hind':
   thigh=uv('muscular-thigh-'+n,(0,0,0),(.26,.29,.47),rust,root)
   uv('heel-'+n,(0,-.08,0),(.14,.20,.12),rust,ctl);uv('long-metatarsus-'+n,(0,.36,0),(.105,.47,.09),rust,ctl)
   # Enlarged fourth toe, smaller fifth, two small syndactylous grooming toes.
   for j,x,y,ry in [(4,0,.86,.27),(5,s*.13,.71,.16),(2,-s*.11,.62,.14),(3,-s*.075,.63,.14)]:
    uv(f'toe-{n}-{j}',(x,y,-.015),(.07 if j==4 else .04,ry,.105 if j==4 else .055),rust,ctl)
    uv(f'claw-{n}-{j}',(x,y+ry-.015,-.015),(.04 if j==4 else .022,.07,.03),dark,ctl)
  else:
   thigh=None;uv('hand-'+n,(0,.015,-.035),(.10,.075,.11),rust,ctl)
   for j,x in enumerate([-.07,-.035,0,.035,.07]):uv(f'finger-{n}-{j}',(x,.06,-.095),(.018,.08,.027),dark,ctl)
  limbs[n]={'kind':kind,'side':s,'hip':(s*hip[0],hip[1],hip[2]),'L1':L1,'L2':L2,'upper':upper,'lower':lower,'thigh':thigh,'distal':ctl}
tail=[];tailJoints=[];tailL=.55
for j,r in enumerate([.24,.19,.13,.073,.022]):tail.append(link('tail-link-'+str(j),tailL,r,rust))
for j,r in enumerate([.19,.13,.073,.022]):tailJoints.append(uv('tail-joint-'+str(j),(0,0,0),(r,r,r),rust,root))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=9.6;cam.data.shift_y=20/96;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def key(o,f):o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
bodyRise=[0,-.15,.20,.75,1.10,1.0,.75,.50,.25,0]
ankleZ=[.12,.12,.12,.65,1.30,1.05,.70,.40,.22,.12]
ankleY=[.38,.23,.08,-.12,.20,.40,.45,.60,.65,.53]
footPitch=[0,0,0,-15,-30,-15,-5,0,0,0]
earAction=[0,.65,1,.35,-.8,-.35,0,0]
def pose(clip,i,frame):
 rise=bodyRise[i] if clip=='hop' else 0;delta=Vector((0,0,rise));body.location=delta;key(body,frame);contacts={}
 for s,e in ears.items():
  a=earAction[i] if clip=='action' else 0;e.rotation_euler=(math.radians((18 if s==-1 else -10)*a),math.radians(s*13),math.radians((28 if s==-1 else -24)*a));key(e,frame)
 for n,l in limbs.items():
  s=l['side'];hind=l['kind']=='hind';hip=Vector(l['hip'])+delta
  target=Vector((s*.38,ankleY[i],ankleZ[i])) if hind and clip=='hop' else Vector((s*.38,.38,.12)) if hind else Vector((s*.30,.65,2.12))+delta
  if not hind and clip=='hop':target.y-=.08*math.sin(math.pi*i/9)
  d=target-hip;D=d.length;a,b=l['L1'],l['L2'];assert abs(a-b)<D<a+b,(clip,i,n,D)
  axis=d.normalized();bend=Vector((s*.12,1,.10)) if hind else Vector((s*.5,.35,0));bend=(bend-axis*bend.dot(axis)).normalized();along=(a*a-b*b+D*D)/(2*D);joint=hip+axis*along+bend*math.sqrt(a*a-along*along)
  place(l['upper'],hip,joint);place(l['lower'],joint,target);ctl=l['distal'];ctl.location=target;ctl.rotation_euler=(math.radians(footPitch[i]) if hind and clip=='hop' else 0,0,0)
  for o in [l['upper'],l['lower'],ctl]:key(o,frame)
  if l['thigh']:
   l['thigh'].location=(hip+joint)/2;l['thigh'].rotation_mode='QUATERNION';l['thigh'].rotation_quaternion=(joint-hip).to_track_quat('Z','Y');key(l['thigh'],frame)
  planted=hind and (clip!='hop' or i in [0,1,2,9])
  contacts[n]={'hip':list(hip),'joint':list(joint),'distal':list(target),'ground':[target.x,target.y,0],'planted':planted,'state':'hind push' if clip=='hop' and i==2 and hind else 'landing' if clip=='hop' and i==9 and hind else 'flight/gather' if hind and not planted else 'planted' if planted else 'tucked forepaw','lengths':[a,b],'stanceEpoch':1 if clip=='hop' and i==9 else 0,'travelCompensatedGround':[target.x,target.y+1.50*i/10,0] if clip=='hop' and planted else None}
 p=Vector((0,-.40,1.29))+delta;nodes=[list(p)];idleAngles=[-48,-42,-34,-15,0]
 amount=(.28+.45*math.sin(math.pi*i/9)) if clip=='hop' else 0
 for j,o in enumerate(tail):
  angle=math.radians(idleAngles[j]+amount*(25+j*4));q=p+Vector((0,-tailL*math.cos(angle),tailL*math.sin(angle)));place(o,p,q);key(o,frame);nodes.append(list(q));p=q
  if j<4:tailJoints[j].location=q;key(tailJoints[j],frame)
 return {'clip':clip,'index':i,'frame':frame,'bodyDelta':list(delta),'contacts':contacts,'tailNodes':nodes,'earAction':earAction[i] if clip=='action' else 0}
records=[]
for clip,start,count in [('idle',1,1),('hop',10,10),('action',40,8)]:
 for i in range(count):records.append(pose(clip,i,start+i))
pose('hop',0,20);pose('action',0,48);sc.frame_start=1;sc.frame_end=48
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'kangaroo.blend'))
def project(p):
 q=world_to_camera_view(sc,cam,p);return [round(q.x*96,5),round((1-q.y)*96,5),round(q.z,5)]
def hull(ps):
 ps=sorted(set(tuple(p) for p in ps));lo=[];hi=[]
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for target,seq in [(lo,ps),(hi,ps[::-1])]:
  for p in seq:
   while len(target)>1 and cross(target[-2],target[-1],p)<=0:target.pop()
   target.append(p)
 return lo[:-1]+hi[:-1]
G={'identity':'kangaroo-draft-v1-geometry-02','cameraContract':C,'canvas':[96,96],'anchor':[48,68],'orthoScale':9.6,'shiftY':20/96,'previewTravelWorldPerCycle':1.50,'records':[],
 'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for f,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=f;rr['head']=project(head.matrix_world.translation);rr['body']=project(body.matrix_world.translation);rr['tailScreen']=[project(root.matrix_world@Vector(p)) for p in r['tailNodes']];rr['volumes']={}
  for n,c in rr['contacts'].items():c['screen']={k:project(root.matrix_world@Vector(c[k])) for k in ['hip','joint','distal','ground']}
  for o in meshes:
   ws=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(v) for v in ws];rr['volumes'][o.name]={'hull':hull([p[:2] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'minWorldZ':min(v.z for v in ws),'vertexCount':len(ps)}
  G['records'].append(rr);sc.render.filepath=str(O/'guides'/f'{f}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'kangaroo.blend').read_bytes()).hexdigest();G['projectionSource']='Independent actual saved mesh projection; builder never reads drawn pixels.'
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({k:G[k] for k in ['identity','cameraContract','canvas','anchor','orthoScale','shiftY']},indent=2)+'\n',encoding='utf-8');print('KANGAROO_BUILD_OK',len(meshes),len(G['records']))
