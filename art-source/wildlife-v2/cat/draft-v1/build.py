"""Fresh natural tuxedo domestic cat; no inherited animal geometry or gait builder."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/cat/draft-v1';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True);C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=48
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=192;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard'
def material(n,c):m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
dark=material('charcoal tuxedo',(.18,.22,.27));light=material('cream bib paws',(.89,.88,.81));pink=material('nose ear pink',(.72,.43,.48));green=material('green eye',(.53,.65,.33));meshes=[]
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed');body=empty('BODY-fixed',root);head=empty('HEAD-fixed',body,(0,.66,.82))
def uv(n,loc,r,m,parent=body):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=14);o=bpy.context.object;o.name=n;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def mesh(n,vs,fs,m,parent):
 d=bpy.data.meshes.new(n+'-mesh');d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def segment(n,L,r,m=dark,parent=body):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r*.85,depth=L);o=bpy.context.object;o.name=n;o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def key(o,fr):o.keyframe_insert('location',frame=fr);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=fr)
def place(o,a,b,fr):o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');key(o,fr)
uv('torso',(0,-.02,.60),(.28,.53,.25),dark);uv('shoulder',(0,.26,.64),(.26,.27,.23),dark);uv('pelvis',(0,-.32,.57),(.28,.25,.27),dark);uv('white-bib',(0,.49,.59),(.15,.07,.19),light);uv('skull',(0,0,0),(.32,.30,.30),dark,head)
uv('muzzle-left',(-.09,.245,-.065),(.115,.075,.09),light,head);uv('muzzle-right',(.09,.245,-.065),(.115,.075,.09),light,head);uv('nose',(0,.315,-.035),(.045,.03,.032),pink,head)
for s in [-1,1]:uv('eye-'+str(s),(s*.21,.205,.065),(.046,.034,.042),green,head)
ears={}
for s in [-1,1]:
 e=empty('ear-rig-'+str(s),head,(s*.22,.0,.22));mesh('ear-'+str(s),[(-.11,-.065,0),(.11,-.065,0),(s*.045,.015,.40),(-.10,.07,0),(.10,.07,0)],[(0,1,2),(3,2,4),(0,2,3),(1,4,2),(0,3,4,1)],dark,e);mesh('ear-pink-'+str(s),[(-.055,.072,.045),(.055,.072,.045),(s*.027,.026,.32)],[(0,1,2)],pink,e);ears[s]=e
tail=[segment('tail-'+str(j),.18,.065-j*.008) for j in range(5)];hips={'HL':[-.22,-.35,.48],'FL':[-.24,.40,.48],'HR':[.22,-.35,.48],'FR':[.24,.40,.48]};lands={'HL':0,'FL':3,'HR':6,'FR':9};legs={};paws={};Ls={}
for n in hips:
 Ls[n]=[.26,.27,.10] if n[0]=='H' else [.25,.25,.10];legs[n]=[segment(n+'-'+str(j),L,.055 if j<2 else .033) for j,L in enumerate(Ls[n])];paws[n]=uv(n+'-paw',(0,0,0),(.09,.14,.055),light)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=4.8;cam.data.shift_y=10/48;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def solve(a,b,L1,L2,n):
 axis=b-a;D=axis.length;assert abs(L1-L2)<D<L1+L2,(n,D);u=axis/D;t=(L1*L1-L2*L2+D*D)/(2*D);height=math.sqrt(max(0,L1*L1-t*t));hint=Vector((0,1 if n[0]=='H' else -1,0));v=(hint-u*hint.dot(u)).normalized();return a+u*t+v*height
def pose(clip,i,fr):
 p=i/12 if clip=='walk' else 0;nodes={};contacts={};phases={};amount=[0,.25,.75,1,.65,.35,.1,0][i] if clip=='action' else 0
 for n,hip in hips.items():
  q=(p-lands[n]/12)%1 if clip=='walk' else .375;planted=q<=.75;lift=.11*math.sin(math.pi*(q-.75)/.25) if not planted else 0;fore=.15-.4*q if planted else -.15+.30*(q-.75)/.25;foot=Vector((hip[0],hip[1]+fore,.055+lift));ankle=foot+Vector((0,-.05,math.sqrt(.1*.1-.05*.05)));a=Vector(hip);L1,L2,L3=Ls[n];knee=solve(a,ankle,L1,L2,n);ps=[a,knee,ankle,foot];
  for o,b,c in zip(legs[n],ps,ps[1:]):place(o,b,c,fr)
  paws[n].location=foot;key(paws[n],fr);nodes[n]=[list(v) for v in ps];contacts[n]={'world':[foot.x,foot.y,foot.z-.055],'planted':planted,'phase':q};phases[n]=q
 for s,e in ears.items():e.rotation_euler.y=s*math.radians(32*amount);e.rotation_euler.z=s*math.radians(15*amount);key(e,fr)
 start=Vector((0,-.61,.68));tailnodes=[start.copy()]
 for j,o in enumerate(tail):
  a=math.radians(25+j*15+amount*j*8);yaw=math.radians(12*math.sin(math.tau*p-j*.30) if clip=='walk' else amount*25);v=Vector((math.sin(yaw)*math.cos(a),-math.cos(yaw)*math.cos(a),math.sin(a)))*.18;end=start+v;place(o,start,end,fr);start=end;tailnodes.append(start.copy())
 return {'clip':clip,'index':i,'frame':fr,'limbsWorld':nodes,'limbLengths':Ls,'tailWorld':[list(v) for v in tailnodes],'contacts':contacts,'phases':phases,'actionAmount':amount}
records=[]
for clip,start,count in [('idle',1,1),('walk',10,12),('action',30,8)]:
 for i in range(count):records.append(pose(clip,i,start+i))
pose('walk',0,22);pose('action',0,38);sc.frame_start=1;sc.frame_end=38
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'cat.blend'))
def project(p):q=world_to_camera_view(sc,cam,p);return [round(q.x*48,5),round((1-q.y)*48,5),round(q.z,5)]
def hull(ps):
 ps=sorted(set(tuple(p) for p in ps));lo=[];hi=[]
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in ps[::-1]:
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
G={'identity':'cat-draft-v1-geometry-01','cameraContract':C,'canvas':[48,48],'anchor':[24,34],'orthoScale':4.8,'shiftY':10/48,'rootTravelUnitsPerCycle':.4,'footfallLandPose':lands,'stanceFraction':.75,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=facing;rr['head']=project(head.matrix_world.translation);rr['limbs']={n:[project(root.matrix_world@Vector(p)) for p in ps] for n,ps in r['limbsWorld'].items()};rr['tail']=[project(root.matrix_world@Vector(p)) for p in r['tailWorld']];rr['projectedContacts']={n:project(root.matrix_world@Vector(v['world'])) for n,v in r['contacts'].items()};rr['volumes']={}
  for o in meshes:
   pts=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(p) for p in pts];rr['volumes'][o.name]={'hull':hull([[p[0],p[1]] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'worldZ':[min(p.z for p in pts),max(p.z for p in pts)]}
  G['records'].append(rr);sc.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'cat.blend').read_bytes()).hexdigest()
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({'angleAboveGround':40,'worldPixelsPerUnit':10,'canvas':[48,48],'anchor':[24,34],'orthoScale':4.8,'shiftY':10/48},indent=2)+'\n',encoding='utf-8');print('CAT_BUILD_OK',len(meshes),len(G['records']))
