"""Fresh emperor penguin: tapered torso, rigid head, web feet, stiff flippers."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Quaternion
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/penguin/draft-v1';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True);C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=320;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard';sc.render.fps=6;meshes=[]
def mat(n,c):m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
black=mat('slate black feathers',(.12,.17,.19));white=mat('warm white belly',(.83,.82,.74));gray=mat('dorsal gray',(.22,.28,.30));gold=mat('emperor gold cheek neck',(.79,.62,.27));orange=mat('lower bill edge',(.60,.39,.21));feetmat=mat('dark webbed feet',(.27,.25,.19));eye=mat('small black eye',(.03,.08,.08))
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed-ground-water');body=empty('BODY-rigid-posture',root);head=empty('HEAD-rigid-fixed-volume',body,(0,.08,2.05))
def uv(n,loc,rad,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12);o=bpy.context.object;o.name=n;o.scale=rad;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def mesh(n,vs,fs,m,parent):
 d=bpy.data.meshes.new(n+'-geometry');d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
# Species tapered crown/neck/pear torso, not a recolored mammal.
uv('pear-torso',(0,0,1.08),(.48,.36,.88),gray,body);uv('white-ventral-oval',(0,.265,1.09),(.37,.13,.76),white,body);uv('neck',(0,.02,1.90),(.24,.24,.37),black,body);uv('upper-gold-chest',(0,.225,1.72),(.21,.055,.20),gold,body);uv('head-black-crown',(0,0,0),(.28,.27,.31),black,head)
for s in [-1,1]:
 uv('gold-ear-patch-'+str(s),(s*.235,-.012,-.105),(.050,.15,.14),gold,head);uv('eye-'+str(s),(s*.255,.115,.075),(.024,.032,.032),eye,head)
mesh('long-black-bill',[(-.09,.20,.01),(.09,.20,.01),(0,.54,-.08),(-.06,.20,-.09),(.06,.20,-.09)],[(0,1,2),(0,2,3),(1,4,2),(3,2,4),(0,3,4,1)],black,head);mesh('orange-lower-bill-edge',[(-.045,.23,-.081),(.045,.23,-.081),(0,.51,-.083)],[(0,1,2)],orange,head)
mesh('short-triangular-tail',[(-.16,-.22,.43),(.16,-.22,.43),(0,-.60,.19),(-.10,-.22,.33),(.10,-.22,.33)],[(0,1,2),(0,2,3),(1,4,2),(3,2,4),(0,3,4,1)],black,body)
def segment(n,L,r,m,parent):
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r,radius2=r*.8,depth=L);o=bpy.context.object;o.name=n;o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def place(o,a,b):a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
def ik(hip,end,L1,L2):
 hip,end=Vector(hip),Vector(end);d=end-hip;L=d.length;assert abs(L1-L2)<L<L1+L2,L;axis=d.normalized();bend=Vector((0,1,0));v=(bend-axis*bend.dot(axis)).normalized();along=(L1*L1-L2*L2+L*L)/(2*L);return hip+axis*along+v*math.sqrt(L1*L1-along*along)
legs={}
for s in [-1,1]:
 n='leg-'+str(s);foot=empty('WEB-foot-'+str(s),body);vs=[(0,0,0),(-.13,.23,0),(-.025,.29,0),(.13,.23,0),(.085,0,0),(-.085,0,0),(0,0,.065)]
 mesh('webbed-foot-'+str(s),vs,[(0,1,2,3),(0,3,4),(0,5,1),(1,5,6),(3,6,4),(1,6,3),(4,6,5)],feetmat,foot)
 for j,x in enumerate([-.11,0,.11]):mesh(f'toe-{s}-{j}',[(x-.022,.22,.015),(x+.022,.22,.015),(x,.29 if j==1 else .25,.015)],[(0,1,2)],black,foot)
 legs[s]={'hip':(s*.22,-.03,.43),'L1':.22,'L2':.30,'upper':segment(n+'-femur',.22,.07,gray,body),'lower':segment(n+'-tibia',.30,.055,feetmat,body),'foot':foot,'phase':0 if s==-1 else .5,'duty':.75}
# Each flipper has two rigid flattened tapered sections and a short hand tip.
def blade(n,L,w0,w1,parent):
 vs=[(-w0,0,-L/2),(w0,0,-L/2),(-w1,0,L/2),(w1,0,L/2),(-w0,.035,-L/2),(w0,.035,-L/2),(-w1,.035,L/2),(w1,.035,L/2)];return mesh(n,vs,[(0,2,3,1),(4,5,7,6),(0,4,6,2),(1,3,7,5),(2,6,7,3),(0,1,5,4)],black,parent)
wings={}
for s in [-1,1]:wings[s]={'shoulder':(s*.43,0,1.63),'lengths':[.44,.38,.22],'meshes':[blade('flipper-upper-'+str(s),.44,.12,.105,body),blade('flipper-fore-'+str(s),.38,.105,.065,body),blade('flipper-tip-'+str(s),.22,.065,0,body)]}
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=6.4;cam.data.shift_y=12/64;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def key(o,f):o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
stretch=[0,.25,.60,1,1,.60,.25,0];stroke=[-35,-15,15,40,45,20,-10,-30];V=.32
def pose(clip,i,frame):
 swim=clip=='swim';p=i/8 if clip=='walk' else 0;body.rotation_euler=(math.radians(-75) if swim else 0,0,0);body.location=(-.24*math.sin(2*math.pi*p) if clip=='walk' else 0,0,1.35 if swim else 0);head.rotation_euler.x=math.radians(75) if swim else 0;key(body,frame);key(head,frame);contacts={};wingnodes={}
 for s,l in legs.items():
  t=(p-l['phase'])%1;lift=0;dy=0
  if clip=='walk':
   half=V*l['duty']/2
   if t<l['duty']:dy=half-V*t
   else:q=(t-l['duty'])/(1-l['duty']);dy=-half+2*half*q*q*(3-2*q);lift=.15*math.sin(math.pi*q)
  foot=Vector((s*.22-body.location.x,-.02+dy,lift));ankle=foot+Vector((0,0,.065));hip=Vector(l['hip'])
  if swim:foot=Vector((s*.22,-.18,.26));ankle=foot+Vector((0,0,.065))
  knee=ik(hip,ankle,l['L1'],l['L2']);place(l['upper'],hip,knee);place(l['lower'],knee,ankle);l['foot'].location=foot;key(l['upper'],frame);key(l['lower'],frame);key(l['foot'],frame)
  contacts[str(s)]={'hip':list(hip),'knee':list(knee),'ankle':list(ankle),'footOrigin':list(foot),'ground':[foot.x+body.location.x,foot.y,foot.z],'lengths':[l['L1'],l['L2']],'planted':not swim and lift<1e-6,'phase':l['phase'],'duty':l['duty'],'stanceEpoch':math.floor(p-l['phase']) if clip=='walk' else None,'travelCompensated':[foot.x+body.location.x,foot.y+V*p,foot.z] if clip=='walk' and lift<1e-6 else None,'state':'floating rudder' if swim else 'planted' if lift<1e-6 else 'lift/apex'}
 for s,w in wings.items():
  nodes=[Vector(w['shoulder'])]
  for k,L in enumerate(w['lengths']):
   if swim:
    beta=math.radians(stroke[i]+[0,12,20][k]);v=Vector((s*math.cos(beta),math.sin(beta),-.25)).normalized()*L
   else:
    amount=stretch[i] if clip=='action' else 0;beta=math.radians(12+65*amount+(5*math.sin(2*math.pi*p+s) if clip=='walk' else 0));v=Vector((s*math.sin(beta),-.025-.40*amount,-math.cos(beta))).normalized()*L
   nodes.append(nodes[-1]+v)
  for k,o in enumerate(w['meshes']):
   place(o,nodes[k],nodes[k+1])
   if swim:o.rotation_quaternion=o.rotation_quaternion@Quaternion(Vector((0,0,1)),math.radians([-6,0,7,4,-5,-20,-25,-16][i]))
   key(o,frame)
  wingnodes[str(s)]={'nodes':[list(v) for v in nodes],'lengths':w['lengths'],'strokeDegrees':stroke[i] if swim else None}
 return {'clip':clip,'index':i,'frame':frame,'contacts':contacts,'wings':wingnodes,'bodyPitchDegrees':-75 if swim else 0,'headCounterPitchDegrees':75 if swim else 0,'bodyOffset':list(body.location),'swim':swim}
records=[]
for clip,start,count in [('idle',1,1),('walk',10,8),('swim',25,8),('action',40,8)]:
 for i in range(count):records.append(pose(clip,i,start+i))
pose('walk',0,18);pose('swim',0,33);pose('action',0,48);sc.frame_start=1;sc.frame_end=48
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'penguin.blend'))
def project(p):q=world_to_camera_view(sc,cam,p);return [round(q.x*64,5),round((1-q.y)*64,5),round(q.z,5)]
def hull(ps):
 ps=sorted(set(tuple(p) for p in ps));lo=[];hi=[]
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for target,seq in [(lo,ps),(hi,ps[::-1])]:
  for p in seq:
   while len(target)>1 and cross(target[-2],target[-1],p)<=0:target.pop()
   target.append(p)
 return lo[:-1]+hi[:-1]
G={'identity':'penguin-draft-v1-geometry-03','cameraContract':C,'canvas':[64,64],'anchor':[32,44],'orthoScale':6.4,'shiftY':12/64,'waterPlaneZ':3.0,'previewWalkWorldPerCycle':V,'previewSwimWorldPerCycle':.65,'projectionSource':'Actual saved full mesh hull/bounds/contact projection; no pixels read.','records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for f,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=f;rr['body']=project(body.matrix_world.translation);rr['head']=project(head.matrix_world.translation);rr['volumes']={}
  for c in rr['contacts'].values():c['screen']={k:project(body.matrix_world@Vector(c[k])) for k in ['hip','knee','ankle','footOrigin']};c['screenGround']=project(root.matrix_world@Vector(c['ground'])) if c['planted'] else None
  for w in rr['wings'].values():w['screenNodes']=[project(body.matrix_world@Vector(p)) for p in w['nodes']]
  for o in meshes:
   ws=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(v) for v in ws];rr['volumes'][o.name]={'hull':hull([p[:2] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'minWorldZ':min(v.z for v in ws),'maxWorldZ':max(v.z for v in ws),'vertexCount':len(ps)}
  G['records'].append(rr);sc.render.filepath=str(O/'guides'/f'{f}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'penguin.blend').read_bytes()).hexdigest()
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({k:G[k] for k in ['identity','cameraContract','canvas','anchor','orthoScale','shiftY','waterPlaneZ']},indent=2)+'\n',encoding='utf-8');print('PENGUIN_BUILD_OK',len(meshes),len(G['records']))
