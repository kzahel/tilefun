"""Fresh red wood-ant worker; isolated source, +Y forward, +Z up."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/ant/draft-v2';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=32;ANCHOR=[16,25]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH';sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=256;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard';sc.render.fps=7
sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
red=mat('rust mesosoma',(.56,.22,.10));dark=mat('dark gaster head cap',(.18,.15,.13));ochre=mat('ant legs antennae',(.40,.22,.12));eye=mat('compound eyes',(.055,.065,.060))
def empty(n,loc=(0,0,0),par=None):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=par;o.location=loc;return o
def ell(n,loc,radii,m,par):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=par;o.location=loc;o.data.materials.append(m);return o
def rod(n,a,b,r,m,par):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=r,depth=(b-a).length);o=bpy.context.object;o.name=n;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.parent=par;o.location=(a+b)/2;o.data.materials.append(m);return o
root=empty('ROOT-ground-fixed');torso=empty('MESOSOMA-rigid',(0,0,.15),root);head=empty('HEAD-rigid',(0,.43,.05),torso)
ell('mesosoma',(0,.035,0),(.105,.23,.105),red,torso);ell('petiole-scale',(0,-.235,-.005),(.055,.055,.085),red,torso);ell('gaster',(0,-.47,.045),(.17,.25,.145),dark,torso);ell('skull',(0,0,0),(.155,.165,.105),red,head);ell('dark-head-cap',(0,-.055,.06),(.145,.105,.052),dark,head)
for side in [-1,1]:
 ell(f'eye-{side}',(side*.13,.04,.025),(.035,.047,.045),eye,head)
 rod(f'mandible-{side}',(side*.06,.12,-.04),(side*.09,.22,-.035),.025,ochre,head)
ants={}
for side in [-1,1]:
 a=empty(f'ANTENNA-SCAPE-{side}',(side*.07,.105,.075),head);b=empty(f'ANTENNA-FUNICULUS-{side}',(side*.12,.16,.035),a);ants[side]=(a,b)
 rod(f'antenna-scape-{side}',(0,0,0),(side*.12,.16,.035),.012,ochre,a);rod(f'antenna-funiculus-{side}',(0,0,0),(-side*.06,.20,-.015),.010,ochre,b)
legs={};FL=.19;TL=.24;TOE=Vector((0,.055,-.025));COXA=.055
for side in [-1,1]:
 for label,y,footy in [('fore',.21,.30),('middle',.045,.045),('hind',-.11,-.28)]:
  start=Vector((side*.065,y,.155));hip=start+Vector((side*COXA,0,0));coxa=rod(f'{label}-{side}-coxa',start,hip,.012,ochre,root)
  parts=[rod(f'{label}-{side}-{n}',(0,0,0),(0,0,L),.012,ochre,root) for n,L in [('femur',FL),('tibia',TL),('tarsus',TOE.length)]]
  phase=0 if (side==-1 and label in ['fore','hind']) or (side==1 and label=='middle') else 4
  legs[label,side]={'hip':hip,'parts':parts,'phase':phase,'footY':footy,'coxa':coxa}
def segment(o,a,b,fr):
 o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.keyframe_insert('location',frame=fr);o.keyframe_insert('rotation_euler',frame=fr)
def legpose(k,foot,fr):
 h=legs[k]['hip'];a=Vector(foot)-TOE;v=a-h;D=v.length;assert abs(FL-TL)<D<FL+TL,(k,D)
 u=v.normalized();along=(FL*FL-TL*TL+D*D)/(2*D);height=math.sqrt(FL*FL-along*along);bend=u.cross(Vector((0,0,1))).normalized()*k[1];knee=h+along*u+height*bend
 js=[h,knee,a,Vector(foot)]
 for i,o in enumerate(legs[k]['parts']):segment(o,js[i],js[i+1],fr)
 return js
bpy.ops.object.camera_add(location=C['cameraLocationAtDistance10']);cam=bpy.context.object;cam.name='Accepted-wildlife-camera';cam.rotation_euler=(Vector(C['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;sc.camera=cam
meshes=sorted([o for o in sc.objects if o.type=='MESH'],key=lambda o:o.name)
G={'identity':'ant-draft-v2-geometry-01','species':'Formica rufa worker','cameraContract':C,'canvas':[W,W],'anchor':ANCHOR,'orthoScale':W/10,'shiftY':cam.data.shift_y,'fixedLegLengths':[FL,TL,TOE.length],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes},'records':[]}
def project(v):
 p=world_to_camera_view(sc,cam,Vector(v));return [round(p.x*W,5),round((1-p.y)*W,5)]
def hull(ps):
 pts=sorted(set(tuple(p) for p in ps));lo=[];hi=[];cross=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 for p in pts:
  while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in pts[::-1]:
  while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def sample(f,k,p,fr):
 root.rotation_euler.z=math.radians(C['modelYawDegrees'][f]);root.keyframe_insert('rotation_euler',frame=fr);joints={};contacts=[]
 for key,d in legs.items():
  side=key[1];dy=z=0
  if k=='crawl':
   u=((p-d['phase'])%8)/8
   # Duty .625 gives a true double-support transfer and no airborne whole ant.
   if u<.625:dy=.11-.22*u/.625
   else:dy=-.11+.22*(u-.625)/.375;z=.14*math.sin(math.pi*(u-.625)/.375)
  foot=(side*.33,d['footY']+dy,z);joints[f'{key[0]}:{side}']=legpose(key,foot,fr)
  if z<1e-7:contacts.append(f'{key[0]}:{side}')
 for side,(a,b) in ants.items():
  sweep=[0,12,30,35,15,0][p] if k=='action' else 0;a.rotation_euler.z=math.radians(side*sweep);b.rotation_euler.z=math.radians(-side*sweep*.6);a.keyframe_insert('rotation_euler',frame=fr);b.keyframe_insert('rotation_euler',frame=fr)
 sc.frame_set(fr);bpy.context.view_layer.update();rec={'frame':fr,'facing':f,'clip':k,'pose':p,'head':project(head.matrix_world.translation),'thorax':project(torso.matrix_world@Vector((0,.035,0))),'gaster':project(torso.matrix_world@Vector((0,-.47,.045))),'petiole':project(torso.matrix_world@Vector((0,-.235,-.005))),'legs':{},'contacts':contacts,'antennae':{},'mandibles':{},'meshes':{}}
 for key,js in joints.items():rec['legs'][key]={'world':[list(root.matrix_world@v) for v in js],'screen':[project(root.matrix_world@v) for v in js]}
 for side,(a,b) in ants.items():rec['antennae'][str(side)]=[project(a.matrix_world.translation),project(b.matrix_world.translation),project(b.matrix_world@Vector((-side*.06,.20,-.015)))]
 for side in [-1,1]:rec['mandibles'][str(side)]=[project(head.matrix_world@Vector((side*.06,.12,-.04))),project(head.matrix_world@Vector((side*.09,.22,-.035)))]
 for o in meshes:
  vs=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(v) for v in vs];rec['meshes'][o.name]={'hull':hull(ps),'bounds':[min(v[0] for v in ps),min(v[1] for v in ps),max(v[0] for v in ps),max(v[1] for v in ps)],'center':project(o.matrix_world.translation),'depth':(o.matrix_world.translation-cam.location).length}
 G['records'].append(rec);sc.render.filepath=str(O/'guides'/f'{f}-{k}-{p:02}.png');bpy.ops.render.render(write_still=True)
fr=1
for f in ['down','up','left','right']:
 for k,n in [('idle',1),('crawl',8),('action',6)]:
  for p in range(n):sample(f,k,p,fr);fr+=1
sc.frame_start=1;sc.frame_end=fr-1;sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(S/'ant.blend'))
for target in [S/'projected-guides.json',O/'projected-guides.json']:target.write_text(json.dumps(G,separators=(',',':')),encoding='utf-8')
print('ANT_SOURCE_OK',len(meshes),len(G['records']))
