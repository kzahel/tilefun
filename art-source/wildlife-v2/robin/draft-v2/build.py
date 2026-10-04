"""Fresh robin source: paired hop, articulated feather fans, bill/tail song action."""
import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/robin/draft-v2'
O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=32;ANCHOR=[16,25]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_shadows=False;sc.display.shading.show_cavity=True;sc.render.film_transparent=True
sc.render.resolution_x=sc.render.resolution_y=W*6;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.fps=8;sc.view_settings.view_transform='Standard'
def material(name,rgb):m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);return m
back=material('olive brown back',(.43,.40,.28));orange=material('orange face breast',(.72,.36,.14));belly=material('cream belly',(.78,.78,.66));black=material('fine bill eyes',(.12,.15,.13));feather=material('brown flight feathers',(.31,.33,.24));light=material('warm wing bars',(.61,.58,.42));legmat=material('brown grasping toes',(.37,.27,.18))
meshes=[]
def pivot(n,p=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);sc.collection.objects.link(o);o.parent=p;o.location=loc;return o
root=pivot('ROOT-ground-fixed');body=pivot('BODY-hop-flight',root);head=pivot('HEAD-rigid-skull',body,(0,.20,.66))
def ellipsoid(n,p,loc,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10);o=bpy.context.object;o.name=n;o.scale=r;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=p;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def closed(n,p,vs,fs,m):
 d=bpy.data.meshes.new(n+'-mesh');d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(n,d);sc.collection.objects.link(o);o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def rod(n,p,length,r,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=length);o=bpy.context.object;o.name=n;o.parent=p;o.data.materials.append(m);meshes.append(o);return o
def between(o,a,b):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
ellipsoid('torso-volume',body,(0,0,.40),(.245,.30,.275),back)
ellipsoid('orange-breast-volume',body,(0,.19,.43),(.21,.14,.23),orange)
ellipsoid('cream-belly-volume',body,(0,.10,.25),(.20,.20,.105),belly)
ellipsoid('skull-volume',head,(0,0,0),(.19,.205,.185),back)
ellipsoid('orange-face-volume',head,(0,.145,-.015),(.16,.09,.13),orange)
for s in [-1,1]:ellipsoid('eye-'+str(s),head,(s*.175,.095,.035),(.028,.033,.030),black)
# Slim closed tapered bill, with independently hinged lower triangle.
closed('upper-bill-volume',head,[(-.045,.19,-.025),(.045,.19,-.025),(0,.35,-.06),(-.04,.19,.025),(.04,.19,.025)],[(0,2,1),(0,3,2),(1,2,4),(3,4,2),(0,1,4,3)],black)
jaw=pivot('JAW-song',head,(0,.19,-.045))
closed('lower-bill-volume',jaw,[(-.034,0,0),(.034,0,0),(0,.155,-.015),(0,0,.024)],[(0,1,2),(0,2,3),(1,3,2),(0,3,1)],black)
tail=pivot('TAIL-cock',body,(0,-.23,.40))
closed('tail-volume',tail,[(-.09,0,0),(.09,0,0),(.115,-.39,.11),(-.115,-.39,.11),(-.09,0,.04),(.09,0,.04),(.115,-.39,.15),(-.115,-.39,.15)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],feather)
legs={};wings={}
for s in [-1,1]:
 n=str(s);hip=Vector((s*.13,.015,.22));foot=pivot('FOOT-'+n,root)
 # Three forward grasping toes and a short rear hallux; solid, no web membrane.
 for j,(tx,ty) in enumerate([(-.075,.11),(0,.145),(.07,.10),(0,-.065)]):
  half=.014;closed(f'toe-{n}-{j}-volume',foot,[(-half,0,0),(half,0,0),(tx+half,ty,0),(tx-half,ty,0),(-half,0,.025),(half,0,.025),(tx+half,ty,.025),(tx-half,ty,.025)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],legmat)
 legs[s]={'hip':hip,'lengths':[.12,.15,.13],'ctl':foot,'femur':rod('leg-'+n+'-femur-volume',root,.12,.025,legmat),'tibia':rod('leg-'+n+'-tibia-volume',root,.15,.02,legmat),'tarsus':rod('leg-'+n+'-tarsus-volume',root,.13,.015,legmat)}
 sh=pivot('SHOULDER-'+n,body,(s*.19,.10,.48));el=pivot('ELBOW-'+n,sh,(s*.22,-.08,0))
 vs=[(0,0,0),(s*.25,.02,0),(s*.31,-.16,0),(s*.22,-.23,0),(s*.06,-.27,0),(0,-.15,0)]
 vs+=[(x,y,z+.025) for x,y,z in vs]
 closed('secondary-'+n+'-volume',sh,vs,[tuple(range(6)),tuple(range(6,12))]+[(j,(j+1)%6,(j+1)%6+6,j+6) for j in range(6)],back)
 vs=[(0,0,0),(s*.42,.03,0),(s*.55,-.09,0),(s*.49,-.15,0),(s*.45,-.24,0),(s*.33,-.30,0),(s*.20,-.32,0),(0,-.19,0)]
 vs+=[(x,y,z+.02) for x,y,z in vs]
 closed('primary-'+n+'-volume',el,vs,[tuple(range(8)),tuple(range(8,16))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)],feather)
 closed('bar-'+n+'-volume',sh,[(s*.03,-.13,.04),(s*.24,-.11,.04),(s*.25,-.155,.04),(s*.06,-.18,.04)],[(0,1,2,3)],light)
 wings[s]={'shoulder':sh,'elbow':el}
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed';cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
def pose(clip,i,f):
 bz=[-.07,0,.17,.29,.18,.045,-.055,0][i] if clip=='hop' else .42 if clip=='flap' else 0
 fz=[0,0,.25,.37,.21,0,0,0][i] if clip=='hop' else .48 if clip=='flap' else 0
 dy=[0,-.03,-.04,-.015,.045,.055,.025,0][i] if clip=='hop' else -.10 if clip=='flap' else 0
 body.location=(0,0,bz);key(body,f)
 head.location=(0,.20+(.08 if clip=='flap' else 0),.66-(.08 if clip=='flap' else 0));key(head,f)
 contacts={}
 for s,l in legs.items():
  hip=l['hip']+body.location;ground=Vector((l['hip'].x,dy,0));ankle=ground+Vector((0,0,fz+.025))
  hock=ankle+Vector((0,-.28,.96))*.13;delta=hock-hip;dist=delta.length;a,b=l['lengths'][:2];assert abs(a-b)<dist<a+b,(clip,i,s,dist)
  axis=delta.normalized();along=(a*a-b*b+dist*dist)/(2*dist);pole=Vector((0,1,0));pole=(pole-axis*pole.dot(axis)).normalized();knee=hip+axis*along+pole*math.sqrt(max(0,a*a-along*along))
  between(l['femur'],hip,knee);between(l['tibia'],knee,hock);between(l['tarsus'],hock,ankle);l['ctl'].location=ground+Vector((0,0,fz))
  for o in [l['femur'],l['tibia'],l['tarsus'],l['ctl']]:key(o,f)
  state=['gather','push','flight-rise','apex','flight-descend','landing','absorb','recover'][i] if clip=='hop' else 'tucked' if clip=='flap' else 'stance'
  contacts[str(s)]={'hip':list(hip),'knee':list(knee),'hock':list(hock),'ankle':list(ankle),'ground':list(ground),'foot':list(l['ctl'].location),'planted':fz==0,'state':state}
 for s,w in wings.items():
  if clip=='flap':
   shoulder=[-65,-25,15,55,65,25,-15,-52][i];fold=[10,0,0,15,42,65,50,20][i]
   w['shoulder'].rotation_euler=(0,math.radians(s*shoulder),math.radians(-s*5));w['elbow'].rotation_euler=(0,math.radians(s*fold),math.radians(-s*10))
  else:
   w['shoulder'].rotation_euler=(0,math.radians(s*5),math.radians(-s*82));w['elbow'].rotation_euler=(0,math.radians(s*8),math.radians(-s*9))
  key(w['shoulder'],f);key(w['elbow'],f)
 amount=[0,.4,1,.35,.8,0][i] if clip=='action' else 0
 jaw.rotation_euler.x=math.radians(-amount*32);key(jaw,f)
 tail.rotation_euler.x=math.radians([0,-8,-22,-14,-25,0][i]) if clip=='action' else math.radians([0,5,-5,-8,-3,4,5,0][i]) if clip=='hop' else 0;key(tail,f)
 return contacts
base=[]
for clip,start,count in [('idle',1,1),('hop',10,8),('flap',30,8),('action',50,6)]:
 for i in range(count):base.append({'clip':clip,'index':i,'frame':start+i,'contacts':pose(clip,i,start+i)})
for clip,f in [('hop',18),('flap',38),('action',56)]:pose(clip,0,f)
sc.frame_start=1;sc.frame_end=56
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
sc.frame_set(1);bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'robin.blend'))
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
G={'identity':'robin-draft-v2-geometry-01','cameraContract':C,'canvas':[W,W],'anchor':ANCHOR,'orthoScale':W/10,'shiftY':cam.data.shift_y,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}}
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in base:
  sc.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=facing;rr['body']=project(body.matrix_world.translation);rr['head']=project(head.matrix_world.translation)
  rr['landmarks']={n:project(bpy.data.objects[n].matrix_world.translation) for n in ['upper-bill-volume','lower-bill-volume','TAIL-cock']}
  rr['landmarks']['bill-tip']=project(bpy.data.objects['upper-bill-volume'].matrix_world@bpy.data.objects['upper-bill-volume'].data.vertices[2].co)
  rr['landmarks']['lower-bill-tip']=project(bpy.data.objects['lower-bill-volume'].matrix_world@bpy.data.objects['lower-bill-volume'].data.vertices[2].co)
  rr['landmarks']['tail-tip']=project(sum((bpy.data.objects['tail-volume'].matrix_world@bpy.data.objects['tail-volume'].data.vertices[j].co for j in [2,3,6,7]),Vector())/4)
  rr['wings']={str(s):{n:project(o.matrix_world.translation) for n,o in w.items()} for s,w in wings.items()}
  for c in rr['contacts'].values():c['screen']={k:project(root.matrix_world@Vector(c[k])) for k in ['hip','knee','hock','ankle','foot','ground']}
  rr['volumes']={}
  for o in meshes:
   ps=[project(o.matrix_world@v.co) for v in o.data.vertices];rr['volumes'][o.name]={'hull':hull([[round(p[0],2),round(p[1],2)] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)],'vertexCount':len(ps)}
  G['records'].append(rr)
  if '--probe' not in sys.argv or r['clip']=='idle' or r['clip']=='hop' and r['index']==3 or r['clip']=='flap' and r['index'] in [0,2,4]:sc.render.filepath=str(O/'guides'/f'{facing}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'robin.blend').read_bytes()).hexdigest();G['projectionSource']='Independent bpy mesh projection; no drawing input or repeated full vertices.'
for p in [S,O]:(p/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n')
print('ROBIN_BUILD_OK',len(meshes),len(G['records']))
