"""Single-tailed pond goldfish: fresh fixed-volume axial chain and articulated fins."""
import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/fish/draft-v2';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=48;ANCHOR=[24,34]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True;sc.render.resolution_x=sc.render.resolution_y=W*6;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='Standard';sc.render.fps=8
def material(n,c):m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
gold=material('ochre orange common goldfish',(.75,.43,.13));belly=material('pale gold belly',(.85,.67,.32));finmat=material('ochre fin membranes',(.66,.32,.09));eye=material('dark eyes',(.11,.17,.15));gillmat=material('operculum',(.63,.31,.12));meshes=[]
def pivot(n,p=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=p;o.location=loc;return o
root=pivot('ROOT-fixed-pond-anchor');torso=pivot('TORSO-stable-volume',root,(0,0,.48));head=pivot('HEAD-fixed-volume',torso,(0,.45,.015));spine1=pivot('SPINE1-posterior',torso,(0,-.16,0));spine2=pivot('SPINE2-peduncle',spine1,(0,-.30,0));caudal=pivot('CAUDAL-fork',spine2,(0,-.28,0))
def ellipsoid(n,p,loc,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12);o=bpy.context.object;o.name=n;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=p;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def mesh(n,p,vs,fs,m):
 d=bpy.data.meshes.new(n+'-mesh');d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def fan(n,p,outline,m,axis='x'):
 # Closed thin fin membrane; thickness belongs to mesh, never animated scale.
 off=Vector((.025,0,0) if axis=='x' else (0,0,.025));vs=[list(Vector(v)-off) for v in outline]+[list(Vector(v)+off) for v in outline];k=len(outline);return mesh(n,p,vs,[tuple(range(k)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)],m)
ellipsoid('torso-volume',torso,(0,.03,0),(.27,.44,.33),gold)
ellipsoid('belly-volume',torso,(0,.06,-.23),(.22,.35,.10),belly)
ellipsoid('skull-volume',head,(0,0,0),(.24,.245,.245),gold)
for s in [-1,1]:ellipsoid('eye-'+str(s),head,(s*.225,.10,.06),(.038,.043,.045),eye)
mouth=pivot('MOUTH-gulp',head,(0,-.02,-.01))
ellipsoid('upper-lip-volume',head,(0,.24,-.045),(.09,.075,.035),belly)
ellipsoid('lower-lip-volume',mouth,(0,.28,-.06),(.085,.06,.024),belly)
ellipsoid('posterior-volume',spine1,(0,-.12,0),(.20,.245,.245),gold)
ellipsoid('peduncle-volume',spine2,(0,-.12,0),(.10,.19,.115),gold)
fan('caudal-volume',caudal,[(0,0,-.085),(0,-.43,-.32),(0,-.16,0),(0,-.43,.32),(0,0,.085)],finmat)
fan('dorsal-volume',torso,[(0,.23,.27),(0,.11,.57),(0,-.19,.55),(0,-.36,.27)],finmat)
fan('anal-volume',spine1,[(0,.02,-.21),(0,-.11,-.43),(0,-.24,-.30)],finmat)
fins={};gills={}
for s in [-1,1]:
 n=str(s);pect=pivot('PECTORAL-'+n,torso,(s*.235,.27,-.07));pelv=pivot('PELVIC-'+n,torso,(s*.13,-.05,-.27));op=pivot('OPERCULUM-'+n,head,(s*.21,-.10,0))
 fan('pectoral-'+n+'-volume',pect,[(0,0,0),(s*.30,-.18,-.04),(s*.25,-.30,-.10),(s*.05,-.22,-.09)],finmat,'z')
 fan('pelvic-'+n+'-volume',pelv,[(0,0,0),(s*.17,-.19,-.04),(s*.03,-.20,-.05)],finmat,'z')
 ellipsoid('gill-'+n+'-volume',op,(0,0,0),(.035,.11,.18),gillmat)
 fins[s]={'pectoral':pect,'pelvic':pelv};gills[s]=op
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-fixed-contract';cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def key(o,f):o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
def pose(clip,i,f):
 p=i/8;wave=math.sin(math.tau*p) if clip=='swim' else 0
 spine1.rotation_euler.z=math.radians(wave*7);spine2.rotation_euler.z=math.radians(math.sin(math.tau*(p-.125))*13 if clip=='swim' else 0);caudal.rotation_euler.z=math.radians(math.sin(math.tau*(p-.25))*17 if clip=='swim' else 0)
 for o in [spine1,spine2,caudal]:key(o,f)
 amount=[0,.25,.75,1,.45,0][i] if clip=='action' else 0
 mouth.rotation_euler.x=math.radians(-amount*50);key(mouth,f)
 for s,fs in fins.items():
  a=(18+22*math.sin(math.tau*(p+(0 if s==-1 else .5)))) if clip=='swim' else 18+amount*30
  fs['pectoral'].rotation_euler.z=math.radians(s*a);fs['pectoral'].rotation_euler.y=math.radians(-s*(10+amount*18));fs['pelvic'].rotation_euler.z=math.radians(s*(8+10*wave));key(fs['pectoral'],f);key(fs['pelvic'],f)
  gills[s].rotation_euler.z=math.radians(s*amount*16);key(gills[s],f)
 key(torso,f);key(head,f)
base=[]
for clip,start,count in [('idle',1,1),('swim',10,8),('action',30,6)]:
 for i in range(count):pose(clip,i,start+i);base.append({'clip':clip,'index':i,'frame':start+i,'contacts':{},'media':{'kind':'water','waterSurfaceZ':1.2,'support':'buoyancy, no planted ground contacts','bodyCenterZ':.48}})
for clip,f in [('swim',18),('action',36)]:pose(clip,0,f)
sc.frame_start=1;sc.frame_end=36
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'fish.blend'))
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
G={'identity':'fish-draft-v2-geometry-03','species':'Carassius auratus, single-tailed common goldfish','cameraContract':C,'canvas':[W,W],'anchor':ANCHOR,'orthoScale':W/10,'shiftY':cam.data.shift_y,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in base:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=facing;rr['body']=project(torso.matrix_world.translation);rr['head']=project(head.matrix_world.translation)
  rr['spine']={o.name:{'world':list(o.matrix_world.translation),'screen':project(o.matrix_world.translation),'rotationZ':o.rotation_euler.z} for o in [torso,spine1,spine2,caudal]}
  rr['landmarks']={n:project(bpy.data.objects[n].matrix_world.translation) for n in ['upper-lip-volume','lower-lip-volume','PECTORAL--1','PECTORAL-1','PELVIC--1','PELVIC-1','OPERCULUM--1','OPERCULUM-1']}
  rr['volumes']={}
  rr['finContours']={}
  for o in meshes:
   ps=[project(o.matrix_world@v.co) for v in o.data.vertices];rr['volumes'][o.name]={'hull':hull([[round(p[0],2),round(p[1],2)] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
   if o.name in ['caudal-volume','dorsal-volume','anal-volume'] or o.name.startswith(('pectoral-','pelvic-')):
    k=len(o.data.vertices)//2;rr['finContours'][o.name]=[project(o.matrix_world@((o.data.vertices[j].co+o.data.vertices[j+k].co)/2)) for j in range(k)]
  G['records'].append(rr)
  if '--probe' not in sys.argv or r['clip']=='idle' or r['clip']=='swim' and r['index'] in [2,6]:sc.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'fish.blend').read_bytes()).hexdigest();G['projectionSource']='Real independently projected bpy geometry; no animal drawings read.'
for p in [S,O]:(p/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('FISH_BUILD_OK',len(meshes),len(G['records']))
