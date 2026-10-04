"""Independent beagle-shaped domestic dog: longer muzzle, pendent ears, broad chest and fixed-length gait."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/dog/draft-v1';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True);C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=64
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=256;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard'
def material(n,c):m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
tan=material('beagle tan',(.66,.44,.26));dark=material('black saddle nose',(.15,.19,.20));cream=material('white blaze chest paws',(.89,.88,.80));earmat=material('low brown ears',(.47,.29,.17));meshes=[]
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed');body=empty('BODY-fixed',root);head=empty('HEAD-fixed',body,(0,.82,1.23))
def uv(n,loc,r,m,parent=body):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16);o=bpy.context.object;o.name=n;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def segment(n,L,r,m,parent=body):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r,radius2=r*.85,depth=L);o=bpy.context.object;o.name=n;o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def key(o,fr):o.keyframe_insert('location',frame=fr);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=fr)
def place(o,a,b,fr):o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');key(o,fr)
uv('torso',(0,-.05,.78),(.34,.65,.33),tan);uv('shoulder',(0,.30,.85),(.33,.33,.29),tan);uv('pelvis',(0,-.48,.75),(.34,.30,.31),tan);uv('neck',(0,.56,1.01),(.25,.23,.36),tan);uv('black-saddle',(0,-.13,1.055),(.30,.54,.085),dark);uv('white-chest',(0,.62,.84),(.20,.11,.27),cream);uv('skull',(0,0,0),(.36,.34,.33),tan,head);uv('muzzle',(0,.32,-.08),(.21,.30,.18),cream,head);uv('nose',(0,.59,-.035),(.13,.055,.085),dark,head);uv('blaze',(0,.275,.13),(.07,.055,.20),cream,head)
for s in [-1,1]:uv('eye-'+str(s),(s*.23,.25,.10),(.045,.036,.045),dark,head)
ears={}
for s in [-1,1]:
 rig=empty('ear-rig-'+str(s),head,(s*.31,-.06,.16));uv('pendent-ear-'+str(s),(s*.07,.05,-.25),(.095,.155,.29),earmat,rig);ears[s]=rig
hips={'HL':[-.28,-.46,.66],'FL':[-.30,.46,.70],'HR':[.28,-.46,.66],'FR':[.30,.46,.70]};lands={'HL':0,'FL':4,'HR':8,'FR':12};Ls={n:([.34,.36,.12] if n[0]=='H' else [.32,.34,.12]) for n in hips};legs={};paws={}
for n in hips:legs[n]=[segment(n+'-'+str(j),L,.075 if j<2 else .045,tan) for j,L in enumerate(Ls[n])];paws[n]=uv(n+'-paw',(0,0,0),(.11,.17,.07),cream)
tail=[segment('tail-'+str(j),.16,.07-j*.009,cream if j>=4 else tan) for j in range(6)]
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=6.4;cam.data.shift_y=12/64;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def solve(a,b,L1,L2,n):
 delta=b-a;D=delta.length;assert abs(L1-L2)<D<L1+L2,(n,D);axis=delta/D;t=(L1*L1-L2*L2+D*D)/(2*D);h=math.sqrt(max(0,L1*L1-t*t));hint=Vector((0,1 if n[0]=='H' else -1,0));side=(hint-axis*hint.dot(axis)).normalized();return a+axis*t+side*h
def pose(clip,i,fr):
 p=i/16 if clip=='walk' else 0;wag=[0,.65,1,.35,-.65,-1,-.35,0][i] if clip=='action' else 0;nodes={};contacts={};phases={}
 for n,hip in hips.items():
  q=(p-lands[n]/16)%1 if clip=='walk' else .375;planted=q<=.75;lift=.15*math.sin(math.pi*(q-.75)/.25) if not planted else 0;y=.225-.60*q if planted else -.225+.45*(q-.75)/.25;foot=Vector((hip[0],hip[1]+y,.07+lift));ankle=foot+Vector((0,-.055,math.sqrt(.12*.12-.055*.055)));a=Vector(hip);knee=solve(a,ankle,*Ls[n][:2],n);ps=[a,knee,ankle,foot]
  for o,b,c in zip(legs[n],ps,ps[1:]):place(o,b,c,fr)
  paws[n].location=foot;key(paws[n],fr);nodes[n]=[list(v) for v in ps];contacts[n]={'world':[foot.x,foot.y,foot.z-.07],'planted':planted,'phase':q};phases[n]=q
 for s,e in ears.items():e.rotation_euler.x=math.radians(12*wag);e.rotation_euler.z=s*math.radians(9*wag);key(e,fr)
 start=Vector((0,-.83,.91));tn=[start.copy()]
 for j,o in enumerate(tail):
  a=math.radians(45-j*8);yaw=math.radians((6*math.sin(math.tau*p-j*.35) if clip=='walk' else 0)+wag*(24+j*3));v=Vector((math.sin(yaw)*math.cos(a),-math.cos(yaw)*math.cos(a),math.sin(a)))*.16;end=start+v;place(o,start,end,fr);start=end;tn.append(start.copy())
 return {'clip':clip,'index':i,'frame':fr,'limbsWorld':nodes,'limbLengths':Ls,'tailWorld':[list(v) for v in tn],'contacts':contacts,'phases':phases,'wag':wag}
records=[]
for clip,start,count in [('idle',1,1),('walk',10,16),('action',40,8)]:
 for i in range(count):records.append(pose(clip,i,start+i))
pose('walk',0,26);pose('action',0,48);sc.frame_start=1;sc.frame_end=48
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'dog.blend'))
def project(p):q=world_to_camera_view(sc,cam,p);return [round(q.x*64,5),round((1-q.y)*64,5),round(q.z,5)]
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
G={'identity':'dog-draft-v1-geometry-01','cameraContract':C,'canvas':[64,64],'anchor':[32,44],'orthoScale':6.4,'shiftY':12/64,'rootTravelUnitsPerCycle':.60,'footfallLandPose':lands,'stanceFraction':.75,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=facing;rr['head']=project(head.matrix_world.translation);rr['limbs']={n:[project(root.matrix_world@Vector(p)) for p in ps] for n,ps in r['limbsWorld'].items()};rr['tail']=[project(root.matrix_world@Vector(p)) for p in r['tailWorld']];rr['projectedContacts']={n:project(root.matrix_world@Vector(v['world'])) for n,v in r['contacts'].items()};rr['volumes']={}
  for o in meshes:
   pts=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(p) for p in pts];rr['volumes'][o.name]={'hull':hull([[p[0],p[1]] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'worldZ':[min(p.z for p in pts),max(p.z for p in pts)]}
  G['records'].append(rr);sc.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'dog.blend').read_bytes()).hexdigest()
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({'angleAboveGround':40,'worldPixelsPerUnit':10,'canvas':[64,64],'anchor':[32,44],'orthoScale':6.4,'shiftY':12/64},indent=2)+'\n',encoding='utf-8');print('DOG_BUILD_OK',len(meshes),len(G['records']))
