"""Fresh giraffe, +Y forward/+Z up. Retained rigid volumes, 3-link legs.
No drawings or previous animal geometry are read. Background isolated scene.
"""
import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent; ROOT=S.parents[3]; O=ROOT/'public/demos/wildlife-v2/giraffe/draft-v1'
O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
W=144; ANCHOR=[72,120]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL'
sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True
sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=W*3
sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.fps=5
sc.view_settings.view_transform='Standard'
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
tan=mat('ochre hide',(.69,.48,.24));cream=mat('cream spaces',(.87,.74,.48));brown=mat('mane and hoof',(.29,.20,.15));black=mat('eye',(.12,.12,.11))
meshes=[]
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-weight-transfer',root)
head=empty('HEAD-fixed-volume',body,(0,2.40,8.40))
def mesh(n,vs,fs,m,p):
 d=bpy.data.meshes.new(n+'-mesh');d.from_pydata(vs,[],fs);d.update()
 o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def uv(n,loc,r,m,p):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10)
 o=bpy.context.object;o.name=n;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.parent=p;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def segment(n,length,r1,r2,m,p):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r1,radius2=r2,depth=length)
 o=bpy.context.object;o.name=n;o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def place(o,a,b):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
def rings(n,rs,p,m):
 vs=[]
 for y,rx,z,rz in rs:
  for i in range(16):
   t=i*math.tau/16;vs.append((rx*math.cos(t),y,z+rz*math.sin(t)))
 fs=[tuple(reversed(range(16)))]
 for j in range(len(rs)-1):
  for i in range(16):fs.append((j*16+i,j*16+(i+1)%16,(j+1)*16+(i+1)%16,(j+1)*16+i))
 fs.append(tuple(range((len(rs)-1)*16,len(rs)*16)))
 return mesh(n,vs,fs,m,p)
rings('torso-volume',[(-1.85,.26,3.75,.40),(-1.40,.62,3.78,.72),(-.55,.70,3.90,.84),(.40,.66,4.05,.89),(1.03,.50,4.25,.85),(1.40,.30,4.33,.58)],body,tan)
# Sloping withers, long tapered neck, narrow jaw. Neck joins deep inside shoulders.
neck=segment('neck-volume',math.hypot(1.46,3.94),.51,.27,tan,body);place(neck,(0,.94,4.28),(0,2.40,8.22))
uv('throat-volume',(0,2.42,8.11),(.27,.36,.36),cream,body)
uv('skull-volume',(0,0,0),(.38,.48,.40),tan,head)
uv('muzzle-volume',(0,.64,-.23),(.32,.46,.25),cream,head)
uv('jaw-volume',(0,.35,-.35),(.29,.48,.18),tan,head)
ears={}
for s in [-1,1]:
 ctl=empty('EAR-'+str(s),head,(s*.30,-.18,.12));ears[s]=ctl
 vs=[(0,0,0),(s*.36,-.06,.25),(s*.73,-.08,.14),(s*.64,-.06,-.08),(s*.19,0,-.10)]
 vs += [(x,y+.06,z) for x,y,z in vs]
 mesh('ear-'+str(s)+'-volume',vs,[tuple(range(5)),tuple(range(5,10))]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],cream,ctl)
 horn=segment('ossicone-'+str(s)+'-volume',.49,.075,.055,tan,head);place(horn,(s*.22,-.12,.28),(s*.24,-.14,.77))
 uv('ossicone-'+str(s)+'-tuft',(s*.24,-.14,.77),(.11,.10,.10),brown,head)
 uv('eye-'+str(s),(s*.34,.19,.05),(.052,.075,.065),black,head)
# Mane is a real slim posterior ridge, not a front-facing decoration.
mesh('mane-volume',[(-.075,.63,4.55),(.075,.63,4.55),(-.065,2.04,8.47),(.065,2.04,8.47),(-.075,.79,4.46),(.075,.79,4.46),(-.065,2.21,8.43),(.065,2.21,8.43)],[(0,1,3,2),(4,6,7,5),(0,2,6,4),(1,5,7,3),(2,3,7,6),(0,4,5,1)],brown,body)
legs={}
for end,y,z in [('fore',1.05,3.78),('hind',-1.30,3.47)]:
 for s in [-1,1]:
  n=f'{end}-{s}'
  lens=[1.15,1.20,1.40] if end=='fore' else [.85,1.12,1.52]
  legs[n]={'hip':Vector((s*(.44 if end=='fore' else .60),y,z)),'end':end,'side':s,'lengths':lens,
           'landing':{('hind',-1):0,('fore',-1):.125,('hind',1):.5,('fore',1):.625}[end,s],
           'segments':[segment(n+'-'+str(i)+'-volume',lens[i],r,r*.88,tan,root) for i,r in enumerate([.19,.13,.105])],
           'hoof':uv(n+'-hoof-volume',(0,0,0),(.16,.24,.16),brown,root)}
tail=[segment('tail-'+str(i)+'-volume',l,.05,.045,tan,body) for i,l in enumerate([.60,.58,.54])]
tuft=uv('tail-tuft',(0,0,0),(.11,.12,.27),brown,body)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO'
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;sc.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
def pose(clip,i,f):
 p=i/16
 body.location=(.055*math.sin(math.tau*p) if clip=='walk' else 0,0,.025*math.sin(2*math.tau*p) if clip=='walk' else 0);key(body,f)
 contacts={}
 for n,l in legs.items():
  phase=(p-l['landing'])%1
  if clip!='walk':dy=0;lift=0;state='stance'
  elif phase<.6875:dy=.58-1.16*phase/.6875;lift=0;state='stance'
  else:
   q=(phase-.6875)/.3125;dy=-.58+1.16*(q*q*(3-2*q));lift=.32*math.sin(math.pi*q)
   state='lift' if q<.4 else 'passing' if q<.8 else 'landing'
  hip=l['hip']+body.location
  a,b,c=l['lengths'];theta=math.radians((-5+10*dy/.66) if l['end']=='fore' else (14+18*dy/.66))
  # Shoulder-elbow and hip-stifle length preserved; distal hock folds backward.
  proximal=hip+Vector((0,a*math.sin(theta),-a*math.cos(theta)))
  foot=Vector((l['hip'].x,l['hip'].y+dy,.16+lift))
  delta=foot-proximal;d=delta.length;axis=delta.normalized();along=(b*b-c*c+d*d)/(2*d)
  assert d<b+c and d>abs(b-c),(n,i,d,b+c)
  pole=Vector((0,1 if l['end']=='fore' else -1,0));pole=(pole-axis*pole.dot(axis)).normalized()
  joint=proximal+axis*along+pole*math.sqrt(max(0,b*b-along*along))
  points=[hip,proximal,joint,foot]
  for seg,x,y in zip(l['segments'],points,points[1:]):place(seg,x,y);key(seg,f)
  l['hoof'].location=foot;key(l['hoof'],f)
  contacts[n]={'hip':list(hip),'proximal':list(proximal),'joint':list(joint),'foot':list(foot),'ground':[foot.x,foot.y,lift],'planted':lift<1e-7,'state':state,'lengths':l['lengths']}
 amount=[0,.16,.55,1,.80,.43,.10,0][i] if clip=='action' else 0
 # Characteristic fly-flick: three fixed tail segments, ear flick, skull untouched.
 start=Vector((0,-1.76,3.93));tailpoints=[list(start+body.location)]
 for j,(o,length) in enumerate(zip(tail,[.60,.58,.54])):
  swing=[0,.2,.7,1,.8,.3,-.25,0][i] if clip=='action' else .035*math.sin(math.tau*p)
  lateral=swing*[.18,.60,1.12][j]
  end=start+Vector((lateral,-.13,-1)).normalized()*length
  place(o,start,end);key(o,f);start=end;tailpoints.append(list(end+body.location))
 tuft.location=start;key(tuft,f)
 for s,o in ears.items():o.rotation_euler.y=math.radians(s*amount*18);key(o,f)
 return contacts,tailpoints
base=[]
for clip,start,count in [('idle',1,1),('walk',10,16),('action',40,8)]:
 for i in range(count):
  cs,ts=pose(clip,i,start+i);base.append({'clip':clip,'index':i,'frame':start+i,'contacts':cs,'tailWorld':ts})
pose('walk',0,26);pose('action',0,48)
sc.frame_start=1;sc.frame_end=48
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for k in fc.keyframe_points:k.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'giraffe.blend'))
def project(p):
 q=world_to_camera_view(sc,cam,p);return [round(q.x*W,4),round((1-q.y)*W,4),round(q.z,5)]
def hull(ps):
 ps=sorted(set(tuple(p) for p in ps))
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 lo=[];hi=[]
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in ps[::-1]:
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
G={'identity':'giraffe-draft-v1-geometry-02','cameraContract':C,'canvas':[W,W],'anchor':ANCHOR,'orthoScale':W/10,'shiftY':cam.data.shift_y,'records':[],
 'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},
 'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
probe='--probe' in sys.argv
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in base:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=facing
  rr['body']=project(body.matrix_world.translation);rr['head']=project(head.matrix_world.translation)
  rr['tail']=[project(root.matrix_world@Vector(p)) for p in r['tailWorld']]
  rr['landmarks']={n:project(bpy.data.objects[n].matrix_world.translation) for n in ['skull-volume','muzzle-volume','eye--1','eye-1','tail-tuft']}
  for c in rr['contacts'].values():c['screen']={k:project(root.matrix_world@Vector(c[k])) for k in ['hip','proximal','joint','foot','ground']}
  rr['volumes']={}
  for o in meshes:
   ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
   rr['volumes'][o.name]={'hull':hull([[round(p[0],2),round(p[1],2)] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
  G['records'].append(rr)
  if not probe or r['clip']=='idle':
   sc.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'giraffe.blend').read_bytes()).hexdigest();G['projectionSource']='Actual bpy projected mesh vertices; no drawing inputs. Convex hulls are guides, not art acceptance.'
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('GIRAFFE_BUILD_OK',len(meshes),len(G['records']))
