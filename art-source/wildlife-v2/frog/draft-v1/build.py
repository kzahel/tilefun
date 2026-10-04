"""Fresh common frog anatomy, fixed limbs, grounded hop and aquatic kick.
Standalone isolated bpy source; no other animal geometry/pixel masters read.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/frog/draft-v1'
O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO'
sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True
sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=192
sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard';sc.render.fps=7
meshes=[]
def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);return m
brown=mat('warm brown back',(.48,.36,.22));cream=mat('cream underside',(.74,.65,.43));dark=mat('dark temporal mask',(.25,.21,.16));gold=mat('golden iris',(.74,.57,.22));black=mat('horizontal pupil',(.08,.10,.08))
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-fixed-volume',root,(0,0,.31));head=empty('HEAD-fixed-volume',body,(0,.34,.18))
def uv(n,loc,radii,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10);o=bpy.context.object;o.name=n;o.scale=radii
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def mesh(n,vs,fs,m,parent=root):
 data=bpy.data.meshes.new(n+'-geometry');data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new(n,data);sc.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
uv('torso',(0,-.10,0),(.37,.46,.23),brown,body)
uv('belly',(0,-.04,-.11),(.31,.40,.12),cream,body)
# Wedge-like broad tapered snout, full fixed skull with ridges.
uv('skull',(0,0,0),(.31,.31,.16),brown,head)
uv('snout',(0,.20,-.04),(.26,.22,.10),brown,head)
uv('jaw',(0,.12,-.12),(.29,.26,.04),cream,head)
eyes={}
for side in [-1,1]:
 uv('temporal-mask-'+str(side),(side*.25,-.03,.015),(.07,.20,.105),dark,head)
 eye=empty('EYE-rigid-'+str(side),head,(side*.21,.075,.145));eyes[side]=eye
 uv('eye-bulb-'+str(side),(0,0,0),(.10,.13,.10),brown,eye)
 uv('iris-'+str(side),(side*.035,.10,.015),(.058,.031,.058),gold,eye)
 uv('pupil-'+str(side),(side*.038,.125,.015),(.041,.015,.015),black,eye)
def segment(n,L,r1,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=r1,radius2=r2 if r2 is not None else r1,depth=L)
 o=bpy.context.object;o.name=n;o.parent=root;o.data.materials.append(brown);meshes.append(o);return o
def place(o,a,b):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
limbs={}
for kind,hipY,L1,L2,rad in [('fore',.28,.25,.25,.045),('hind',-.30,.35,.37,.085)]:
 for side in [-1,1]:
  name=f'{kind}:{side}';hip=(side*(.22 if kind=='fore' else .27),hipY,0)
  ctl=empty('FOOT-'+name,root)
  if kind=='hind':
   # Five toes plus true web panel, all in a rigid foot group; ankle -> heel .20.
   uv('ankle-joint-'+name,(0,0,0),(.055,.06,.035),brown,ctl)
   tarsus=segment(name+'-tarsus',math.sqrt(.20**2+.02**2),.034,.023)
   toeends=[(-.12,.30),(-.065,.37),(0,.43),(.075,.37),(.14,.28)]
   vs=[(0,.19,-.015)]+[(x,y,-.045) for x,y in toeends]
   mesh('web-'+name,vs,[(0,i,i+1) for i in range(1,5)],brown,ctl)
  else:toeends=[(-.09,.11),(-.035,.15),(.04,.16),(.10,.12)];tarsus=None
  for j,(x,y) in enumerate(toeends):
   start=(0,.20,-.02) if kind=='hind' else (0,0,0)
   # Fixed tiny toe capsules authored as complete geometry in foot-local coordinates.
   a,b=Vector(start),Vector((x,y,-.038 if kind=='hind' else -.018));L=(b-a).length
   bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.012,radius2=.007,depth=L)
   o=bpy.context.object;o.name=f'toe-{name}-{j}';o.parent=ctl;o.data.materials.append(brown);meshes.append(o);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
  limbs[name]={'kind':kind,'side':side,'hip':hip,'L1':L1,'L2':L2,'upper':segment(name+'-upper',L1,rad,rad*.82),'lower':segment(name+'-lower',L2,rad*.60,rad*.38),'tarsus':tarsus,'foot':ctl}
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO'
cam.data.ortho_scale=4.8;cam.data.shift_y=10/48;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def key(o,frame):
 o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
H=[.31,.25,.48,.80,.58,.42,.32,.31]
HF=[(.55,-.18,.025),(.50,-.12,.025),(.52,-.48,.025),(.47,-.38,.63),(.48,-.37,.35),(.51,-.20,.20),(.55,-.18,.025),(.55,-.18,.025)]
FF=[(.40,.53,.025),(.38,.50,.025),(.36,.60,.23),(.33,.57,.58),(.37,.55,.20),(.40,.52,.025),(.40,.53,.025),(.40,.53,.025)]
SF=[(.54,-.18,.78),(.46,-.13,.80),(.60,-.40,.78),(.55,-.65,.78),(.46,-.76,.78),(.36,-.55,.80),(.44,-.28,.80),(.54,-.18,.78)]
def pose(clip,i,frame):
 z=H[i] if clip=='hop' else .97 if clip=='swim' else .31
 body.location=(0,0,z);key(body,frame);contacts={}
 for n,l in limbs.items():
  s=l['side'];kind=l['kind'];hip=Vector(l['hip'])+Vector((0,0,z))
  if clip=='hop':x,y,footz=(HF if kind=='hind' else FF)[i]
  elif clip=='swim':x,y,footz=SF[i] if kind=='hind' else (.34,.43,.79)
  else:x,y,footz=(HF if kind=='hind' else FF)[0]
  foot=Vector((s*x,y,footz));ankle=foot-Vector((0,.20,-.02)) if kind=='hind' else foot
  delta=ankle-hip;D=delta.length;L1=l['L1'];L2=l['L2'];assert abs(L1-L2)<D<L1+L2,(clip,i,n,D)
  axis=delta.normalized();bend=Vector((s*.40,1,0)) if kind=='hind' else Vector((s*.45,-1,0))
  bend=(bend-axis*bend.dot(axis)).normalized();along=(L1*L1-L2*L2+D*D)/(2*D)
  knee=hip+axis*along+bend*math.sqrt(L1*L1-along*along)
  assert abs((knee-hip).length-L1)<1e-6 and abs((ankle-knee).length-L2)<1e-6
  place(l['upper'],hip,knee);place(l['lower'],knee,ankle)
  l['foot'].location=ankle;l['foot'].rotation_euler=(0,0,0)
  if l['tarsus']:place(l['tarsus'],ankle,foot);key(l['tarsus'],frame)
  for o in [l['upper'],l['lower'],l['foot']]:key(o,frame)
  contact=clip!='swim' and footz<.026
  contacts[n]={'hip':list(hip),'knee':list(knee),'ankle':list(ankle),'foot':list(foot),'ground':[foot.x,foot.y,0],
   'planted':contact,'state':'aquatic kick/recovery' if clip=='swim' else 'planted' if contact else 'airborne'}
 amount=[0,.4,1,1,.4,0][i] if clip=='action' else 0
 for s,e in eyes.items():e.location=(s*.21,.075,.145-.12*amount);key(e,frame)
 return {'clip':clip,'index':i,'frame':frame,'bodyZ':z,'contacts':contacts,'blinkAmount':amount,'media':'water' if clip=='swim' else 'ground','waterPlaneZ':.80 if clip=='swim' else None}
records=[]
for clip,start,count in [('idle',1,1),('hop',10,8),('swim',30,8),('action',50,6)]:
 for i in range(count):records.append(pose(clip,i,start+i))
pose('hop',0,18);pose('swim',0,38);pose('action',0,56);sc.frame_start=1;sc.frame_end=56
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'frog.blend'))
def project(p):
 q=world_to_camera_view(sc,cam,p);return [round(q.x*48,5),round((1-q.y)*48,5),round(q.z,5)]
def hull(ps):
 ps=sorted(set(tuple(p) for p in ps))
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 lo=[];hi=[]
 for target,seq in [(lo,ps),(hi,ps[::-1])]:
  for p in seq:
   while len(target)>1 and cross(target[-2],target[-1],p)<=0:target.pop()
   target.append(p)
 return lo[:-1]+hi[:-1]
G={'identity':'frog-draft-v1-geometry-02','cameraContract':C,'canvas':[48,48],'anchor':[24,34],'orthoScale':4.8,'shiftY':10/48,'records':[],
 'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},
 'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for f,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=f
  rr['head']=project(head.matrix_world.translation);rr['body']=project(body.matrix_world.translation)
  rr['eyes']={str(s):project(e.matrix_world.translation) for s,e in eyes.items()};rr['volumes']={}
  for c in rr['contacts'].values():c['screen']={k:project(root.matrix_world@Vector(c[k])) for k in ['hip','knee','ankle','foot','ground']}
  for o in meshes:
   ws=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(v) for v in ws]
   rr['volumes'][o.name]={'hull':hull([p[:2] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps),'minWorldZ':min(v.z for v in ws)}
  G['records'].append(rr);sc.render.filepath=str(O/'guides'/f'{f}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'frog.blend').read_bytes()).hexdigest();G['projectionSource']='Actual saved meshes projected independently in bpy; no drawings read.'
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({k:G[k] for k in ['identity','cameraContract','canvas','anchor','orthoScale','shiftY']},indent=2)+'\n',encoding='utf-8')
print('FROG_BUILD_OK',len(meshes),len(G['records']))
