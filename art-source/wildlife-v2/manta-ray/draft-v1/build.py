"""Fresh giant manta, fixed disc/skull, independent articulated oscillatory wings and cephalic lobes."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/manta-ray/draft-v1';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True);C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=144
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True;scene.render.film_transparent=True;scene.render.resolution_x=scene.render.resolution_y=432;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
def mat(n,c):m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
black=mat('dark manta dorsal',(.14,.23,.24));white=mat('white shoulder ventral',(.82,.83,.75));edge=mat('slate fin edge',(.26,.36,.35));eye=mat('lateral eye',(.06,.10,.12));meshes=[]
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed');body=empty('BODY-fixed',root,(0,0,1.7));head=empty('HEAD-fixed',body,(0,1.14,0))
def uv(n,loc,rad,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16);o=bpy.context.object;o.name=n;o.scale=rad;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def mesh(n,vs,fs,m,parent):
 data=bpy.data.meshes.new(n+'-mesh');data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new(n,data);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def segment(n,L,r,m,parent):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r*.85,depth=L);o=bpy.context.object;o.name=n;o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def place(o,a,b):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
uv('central-disc',(0,0,0),(.70,1.24,.21),black,body);uv('ventral-body',(0,.02,-.14),(.58,1.04,.08),white,body);uv('broad-terminal-head',(0,0,0),(.62,.38,.18),black,head)
uv('terminal-mouth',(0,.31,-.085),(.43,.052,.055),eye,head)
for s in [-1,1]:
 uv('eye-'+str(s),(s*.58,.10,.035),(.045,.045,.045),eye,head)
 mesh('shoulder-white-'+str(s),[(s*.15,.88,.208),(s*.52,.60,.21),(s*.48,-.05,.20),(s*.22,.18,.22)],[(0,1,2,3)],white,body)
mesh('small-dorsal-fin',[(0,-.88,.16),(0,-1.05,.38),(0,-1.30,.12),(.06,-1.0,.16)],[(0,1,2),(0,3,1),(1,3,2),(0,2,3)],edge,body)
wings={};winglength=1.40
for s in [-1,1]:
 panels=[]
 for j in range(2):
  # LocalX runs rigid span; broad proximal chord narrows to pointed distal tip.
  outline=[(0,.90),(1.4,.40),(1.4,-.90),(0,-1.20)] if j==0 else [(0,.40),(1.40,-.25),(0,-.90)]
  vs=[(s*x,y,-.07) for x,y in outline]+[(s*x,y,.07) for x,y in outline];n=len(outline);fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)];fs=[tuple(reversed(face)) for face in fs] if s==-1 else fs;panels.append(mesh(f'pectoral-{s}-{j}',vs,fs,black,body))
 wings[s]=panels
cephalic={}
for s in [-1,1]:cephalic[s]=[segment(f'cephalic-{s}-{j}',L,.10-j*.018,edge,body) for j,L in enumerate([.24,.20,.15])]
tail=[segment('tail-'+str(j),.40,.045-j*.007,edge,body) for j in range(5)]
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=14.4;cam.data.shift_y=18/144;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,frame):o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
def pose(c,i,fr):
 p=i/12 if c=='swim' else 0;alpha=math.radians(25*math.sin(math.tau*p));beta=alpha+math.radians(25*math.sin(math.tau*p-math.pi/2));amount=[0,.2,.55,.85,1,.65,.25,0][i] if c=='action' else 0;wingnodes={};hornnodes={};tailnodes=[]
 for s,panels in wings.items():
  start=Vector((s*.35,0,0));nodes=[start.copy()]
  for j,(o,a) in enumerate(zip(panels,[alpha,beta])):
   axis=Vector((s*math.cos(a),0,math.sin(a)));xaxis=Vector((math.cos(a),0,s*math.sin(a)));yaxis=Vector((0,1,0));zaxis=xaxis.cross(yaxis);o.location=start;o.rotation_mode='QUATERNION';o.rotation_quaternion=Matrix((xaxis,yaxis,zaxis)).transposed().to_quaternion();start=start+axis*1.4;nodes.append(start.copy());key(o,fr)
  wingnodes[str(s)]=[list(v+body.location) for v in nodes]
 for s,chain in cephalic.items():
  start=Vector((s*.42,1.42,-.03));nodes=[start.copy()]
  for j,(o,L) in enumerate(zip(chain,[.24,.20,.15])):
   # Rolled inward lobes open forward into a symmetric feeding funnel, never change lengths.
   yaw=math.radians([20,85,150][j]*(1-amount)+s*0);v=Vector((s*math.sin(yaw)*(.6+.4*amount),math.cos(yaw),-.12)).normalized()*L;end=start+v;place(o,start,end);key(o,fr);start=end;nodes.append(start.copy())
  hornnodes[str(s)]=[list(v+body.location) for v in nodes]
 start=Vector((0,-1.15,.03));tailnodes=[start.copy()]
 for j,o in enumerate(tail):
  a=math.radians(8*math.sin(math.tau*p-j*.35)) if c=='swim' else 0;end=start+Vector((math.sin(a),-math.cos(a),-.015)).normalized()*.4;place(o,start,end);key(o,fr);start=end;tailnodes.append(start.copy())
 return {'clip':c,'index':i,'frame':fr,'wingAnglesDegrees':[math.degrees(alpha),math.degrees(beta)],'wingWorld':wingnodes,'cephalicWorld':hornnodes,'tailWorld':[list(v+body.location) for v in tailnodes],'contacts':{},'actionAmount':amount}
records=[]
for c,start,count in [('idle',1,1),('swim',10,12),('action',30,8)]:
 for i in range(count):records.append(pose(c,i,start+i))
pose('swim',0,22);pose('action',0,38);scene.frame_start=1;scene.frame_end=38
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'manta-ray.blend'))
def project(p):
 q=world_to_camera_view(scene,cam,p);return [round(q.x*W,5),round((1-q.y)*W,5),round(q.z,5)]
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
G={'identity':'manta-ray-draft-v1-geometry-01','cameraContract':C,'canvas':[144,144],'anchor':[72,90],'orthoScale':14.4,'shiftY':18/144,'waterPlaneZ':4.3,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for f,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  scene.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=f;rr['head']=project(head.matrix_world.translation);rr['body']=project(body.matrix_world.translation);rr['wings']={n:[project(root.matrix_world@Vector(p)) for p in ps] for n,ps in r['wingWorld'].items()};rr['cephalic']={n:[project(root.matrix_world@Vector(p)) for p in ps] for n,ps in r['cephalicWorld'].items()};rr['tail']=[project(root.matrix_world@Vector(p)) for p in r['tailWorld']];rr['volumes']={}
  for o in meshes:
   ps=[project(o.matrix_world@v.co) for v in o.data.vertices];pts=[o.matrix_world@v.co for v in o.data.vertices];normal=(o.matrix_world.to_3x3()@Vector((0,0,1))).normalized();view=(cam.location-o.matrix_world.translation).normalized();rr['volumes'][o.name]={'hull':hull([[p[0],p[1]] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'worldZ':[min(p.z for p in pts),max(p.z for p in pts)],'dorsalFacesCamera':normal.dot(view)>0}
  G['records'].append(rr);scene.render.filepath=str(O/'guides'/f'{f}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'manta-ray.blend').read_bytes()).hexdigest()
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({'angleAboveGround':40,'worldPixelsPerUnit':10,'canvas':[144,144],'anchor':[72,90],'orthoScale':14.4,'shiftY':18/144,'waterPlaneZ':4.3,'geometryIdentity':G['identity']},indent=2)+'\n',encoding='utf-8')
print('MANTA_RAY_BUILD_OK',len(meshes),len(G['records']))
