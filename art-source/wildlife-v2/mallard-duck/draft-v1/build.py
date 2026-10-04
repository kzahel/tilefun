"""Fresh drake mallard: rigid anatomy, jointed wings/webbed feet, no art inputs."""
import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/mallard-duck/draft-v1'
O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());W=48;ANCHOR=[24,34]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL'
sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True
sc.render.resolution_x=sc.render.resolution_y=W*6;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.fps=6;sc.view_settings.view_transform='Standard'
def mat(n,c):m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
gray=mat('gray mantle',(.52,.54,.51));green=mat('green head',(.12,.39,.29));white=mat('collar and wing bars',(.86,.86,.74));brown=mat('chestnut breast',(.40,.23,.17));yellow=mat('bill',(.79,.62,.20));orange=mat('webbed feet',(.70,.35,.12));dark=mat('flight feathers',(.20,.24,.23));blue=mat('speculum',(.19,.29,.51));black=mat('eyes and curled tail',(.10,.14,.12))
meshes=[]
def empty(n,p=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=p;o.location=loc;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-media-posture',root);head=empty('HEAD-fixed-volume',body,(0,.59,1.09))
def mesh(n,vs,fs,m,p):
 d=bpy.data.meshes.new(n+'-mesh');d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def uv(n,loc,r,m,p):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10);o=bpy.context.object;o.name=n;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=p;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def segment(n,length,r,m,p):
 bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=length);o=bpy.context.object;o.name=n;o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def place(o,a,b):a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
uv('torso-volume',(0,-.10,.56),(.34,.65,.32),gray,body)
uv('breast-volume',(0,.35,.64),(.28,.28,.32),brown,body)
uv('neck-volume',(0,.52,.88),(.16,.18,.25),green,body)
uv('collar-volume',(0,.47,.80),(.18,.20,.08),white,body)
uv('skull-volume',(0,0,0),(.22,.25,.24),green,head)
for s in [-1,1]:uv('eye-'+str(s),(s*.205,.10,.04),(.029,.035,.035),black,head)
uv('upper-bill-volume',(0,.33,-.06),(.18,.24,.065),yellow,head)
jaw=empty('JAW-quack',head,(0,.15,-.12))
uv('lower-bill-volume',(0,.18,0),(.16,.22,.035),yellow,jaw)
tailctl=empty('TAIL-shiver',body,(0,-.65,.61))
mesh('tail-volume',[(-.23,0,0),(.23,0,0),(.16,-.34,.07),(0,-.42,.10),(-.16,-.34,.07),(-.23,0,.05),(.23,0,.05),(0,-.42,.15)],[(0,1,2,3,4),(5,7,6),(0,5,6,1),(1,6,7,3,2),(0,4,3,7,5)],white,tailctl)
uv('tail-curl-volume',(0,-.30,.14),(.07,.13,.09),black,tailctl)
legs={};wings={}
for s in [-1,1]:
 n=str(s);hip=Vector((s*.23,-.12,.48))
 footctl=empty('FOOT-'+n,root)
 vs=[(0,-.035,0),(-.16,.13,0),(-.08,.23,0),(0,.21,0),(.10,.22,0),(.17,.12,0),(0,-.035,.035)]
 foot=mesh('web-'+n+'-volume',vs,[(0,1,2,3,4,5),(0,6,1),(1,6,2),(2,6,3),(3,6,4),(4,6,5),(5,6,0)],orange,footctl)
 legs[s]={'hip':hip,'lengths':[.23,.28],'upper':segment('leg-'+n+'-upper-volume',.23,.045,orange,root),'lower':segment('leg-'+n+'-lower-volume',.28,.035,orange,root),'ctl':footctl}
 shoulder=empty('WING-'+n,body,(s*.25,.30,.65));elbow=empty('ELBOW-'+n,shoulder,(s*.40,-.16,0))
 # Broad closed secondary fan and a separate tapered primary fan, fixed geometry.
 vs=[(0,0,0),(s*.42,.03,0),(s*.50,-.30,0),(s*.12,-.46,0),(0,-.28,0)]
 vs+= [(x,y,z+.03) for x,y,z in vs]
 mesh('secondary-'+n+'-volume',vs,[tuple(range(5)),tuple(range(5,10))]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],gray,shoulder)
 vs=[(0,0,0),(s*.64,.04,0),(s*.94,-.16,0),(s*.80,-.39,0),(s*.34,-.49,0),(0,-.20,0)]
 vs+=[(x,y,z+.025) for x,y,z in vs]
 mesh('primary-'+n+'-volume',vs,[tuple(range(6)),tuple(range(6,12))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)],dark,elbow)
 mesh('speculum-'+n+'-volume',[(s*.04,-.23,.04),(s*.39,-.17,.04),(s*.42,-.33,.04),(s*.13,-.41,.04)],[(0,1,2,3)],blue,shoulder)
 wings[s]={'shoulder':shoulder,'elbow':elbow}
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def key(o,f):o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
def pose(clip,i,f):
 p=i/8;cs={}
 body.location=(.055*math.sin(math.tau*p) if clip=='waddle' else 0,0,-.12 if clip=='swim' else .70 if clip=='flap' else 0);key(body,f)
 head.location=(0,.59+( .16 if clip=='flap' else 0),1.09-(.12 if clip=='flap' else 0));key(head,f)
 for s,l in legs.items():
  hip=l['hip']+body.location;t=(p+(0 if s==-1 else .5))%1
  if clip=='waddle':
   if t<.625:dy=.14-.28*t/.625;z=0;state='stance'
   else:q=(t-.625)/.375;dy=-.14+.28*(q*q*(3-2*q));z=.13*math.sin(math.pi*q);state='swing'
  elif clip=='swim':
   dy=.18*math.cos(math.tau*t);z=.01+.035*math.sin(math.tau*t);state='power' if t<.5 else 'recovery'
  elif clip=='flap':dy=-.23;z=.90;state='tucked'
  else:dy=0;z=0;state='stance'
  foot=Vector((l['hip'].x,l['hip'].y+dy,z));delta=foot-hip;dist=delta.length;a,b=l['lengths'];assert abs(a-b)<dist<a+b,(clip,i,s,dist)
  axis=delta.normalized();along=(a*a-b*b+dist*dist)/(2*dist);pole=Vector((0,-1,0));pole=(pole-axis*pole.dot(axis)).normalized()
  joint=hip+axis*along+pole*math.sqrt(max(0,a*a-along*along));place(l['upper'],hip,joint);place(l['lower'],joint,foot)
  l['ctl'].location=foot;l['ctl'].rotation_euler.x=math.radians(-35 if clip=='swim' and state=='recovery' else 15 if clip=='swim' else 0)
  for o in [l['upper'],l['lower'],l['ctl']]:key(o,f)
  cs[str(s)]={'hip':list(hip),'joint':list(joint),'foot':list(foot),'ground':[foot.x,foot.y,0],'planted':clip not in ['swim','flap'] and z<1e-7,'state':state,'media':'water' if clip=='swim' else 'air' if clip=='flap' else 'ground'}
 for s,w in wings.items():
  if clip=='flap':
   angle=[-60,-25,15,55,65,30,-10,-48][i];fold=[10,0,0,10,38,65,55,25][i]
   w['shoulder'].rotation_euler=(0,math.radians(s*angle),math.radians(s*(-8)))
   w['elbow'].rotation_euler=(0,math.radians(s*fold),math.radians(s*(-10)))
  else:
   # Fold articulated fans back against torso, not hidden generic ellipses.
   w['shoulder'].rotation_euler=(0,math.radians(s*8),math.radians(-s*80));w['elbow'].rotation_euler=(0,math.radians(s*5),math.radians(-s*10))
  key(w['shoulder'],f);key(w['elbow'],f)
 amount=[0,.2,.65,1,.45,0][i] if clip=='action' else 0
 jaw.rotation_euler.x=math.radians(-amount*24);key(jaw,f)
 tailctl.rotation_euler.z=math.radians([0,10,-10,12,-6,0][i]) if clip=='action' else 0;key(tailctl,f)
 return cs
base=[]
for clip,start,count in [('idle',1,1),('waddle',10,8),('swim',30,8),('flap',50,8),('action',70,6)]:
 for i in range(count):base.append({'clip':clip,'index':i,'frame':start+i,'contacts':pose(clip,i,start+i)})
for clip,f in [('waddle',18),('swim',38),('flap',58),('action',76)]:pose(clip,0,f)
sc.frame_start=1;sc.frame_end=76
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'mallard-duck.blend'))
def project(p):q=world_to_camera_view(sc,cam,p);return [round(q.x*W,4),round((1-q.y)*W,4),round(q.z,5)]
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
G={'identity':'mallard-duck-draft-v1-geometry-02','cameraContract':C,'canvas':[W,W],'anchor':ANCHOR,'orthoScale':W/10,'shiftY':cam.data.shift_y,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in base:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=facing;rr['body']=project(body.matrix_world.translation);rr['head']=project(head.matrix_world.translation)
  rr['landmarks']={n:project(bpy.data.objects[n].matrix_world.translation) for n in ['skull-volume','upper-bill-volume','lower-bill-volume','tail-volume','tail-curl-volume']}
  rr['wings']={str(s):{n:project(o.matrix_world.translation) for n,o in w.items()} for s,w in wings.items()}
  for c in rr['contacts'].values():c['screen']={k:project(root.matrix_world@Vector(c[k])) for k in ['hip','joint','foot','ground']}
  rr['volumes']={}
  for o in meshes:
   ps=[project(o.matrix_world@v.co) for v in o.data.vertices];rr['volumes'][o.name]={'hull':hull([[round(p[0],2),round(p[1],2)] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
  G['records'].append(rr)
  if '--probe' not in sys.argv or (r['clip']=='idle' or r['clip']=='flap' and r['index'] in [0,2,4]):sc.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'mallard-duck.blend').read_bytes()).hexdigest();G['projectionSource']='Real independently projected bpy mesh vertices/hulls; no pixel masters read.'
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('MALLARD_BUILD_OK',len(meshes),len(G['records']))
