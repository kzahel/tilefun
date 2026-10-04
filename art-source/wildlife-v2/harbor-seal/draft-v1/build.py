"""Fresh Phoca vitulina; fixed-volume articulated spine, earless skull, paired hindflippers."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/harbor-seal/draft-v1';O.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(exist_ok=True)
C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text());W=96
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False;scene.display.shading.show_cavity=True;scene.render.film_transparent=True;scene.render.resolution_x=scene.render.resolution_y=384;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard'
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
skin=mat('silver spotted seal',(.57,.60,.57));light=mat('pale muzzle belly',(.77,.77,.67));dark=mat('nose eyes spots',(.23,.29,.28));finmat=mat('flipper skin',(.42,.49,.47));meshes=[]
def empty(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed');body=empty('BODY-ground-clearance',root);head=empty('HEAD-rigid-fixed-orientation',body)
def uv(n,loc,rad,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16);o=bpy.context.object;o.name=n;o.scale=rad;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);meshes.append(o);return o
def mesh(n,vs,fs,m,parent):
 data=bpy.data.meshes.new(n+'-mesh');data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new(n,data);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);meshes.append(o);return o
def place(o,a,b):
 a,b=Vector(a),Vector(b);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
# Three overlapping fixed-volume spine sections, varying natural taper; no per-pose scale.
lengths=[.75,.85,.85];radii=[(.36,.37),(.58,.56),(.57,.58)];trunk=[];marks=[]
for j,(L,(rx,ry)) in enumerate(zip(lengths,radii)):
 o=uv('body-section-'+str(j),(0,0,0),(rx,ry,L*.77),skin,body);trunk.append(o)
 for k,(x,y,z) in enumerate([(-.4,.65,.20),(.55,.50,-.15),(-.65,.35,-.25),(.3,.7,-.35)]):
  ctl=empty(f'spot-anchor-{j}-{k}',o,(x*rx,y*ry,z*L));marks.append(ctl)
# Continuous natural tapered skin. Hidden rigid controls remain independent landmarks.
restnodes=[Vector((0,-1.35,.38))]
for j,L in enumerate(lengths):
 a=math.radians([12,8,6][j]);restnodes.append(restnodes[-1]+Vector((0,math.cos(a),math.sin(a)))*L)
armdata=bpy.data.armatures.new('fixed-link-spine-data');arm=bpy.data.objects.new('fixed-link-spine',armdata);scene.collection.objects.link(arm);arm.parent=body;bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for j in range(3):
 b=armdata.edit_bones.new('spine-'+str(j));b.head=restnodes[j];b.tail=restnodes[j+1]
bpy.ops.object.mode_set(mode='OBJECT');arm.select_set(False)
ringdata=[(0,-.2,.12,.15),(0,0,.25,.25),(0,.4,.43,.42),(0,.95,.55,.52),(1,.4,.60,.57),(1,.9,.57,.54),(2,.45,.47,.47),(2,.95,.24,.30),(2,1.1,.12,.15)]
vs=[];fs=[]
for j,t,rx,rz in ringdata:
 axis=(restnodes[j+1]-restnodes[j]).normalized();center=restnodes[j]+axis*(lengths[j]*t);up=Vector((0,-axis.z,axis.y))
 for k in range(24):
  a=math.tau*k/24;vs.append(list(center+Vector((rx*math.cos(a),0,0))+up*(rz*math.sin(a))))
fs.append(tuple(reversed(range(24))))
for j in range(len(ringdata)-1):
 for k in range(24):fs.append((j*24+k,j*24+(k+1)%24,(j+1)*24+(k+1)%24,(j+1)*24+k))
fs.append(tuple(range((len(ringdata)-1)*24,len(ringdata)*24)))
fs=[tuple(reversed(face)) for face in fs] # Outward loft normals: ring tangent cross +Y had pointed inward.
skinbody=mesh('continuous-tapered-body',vs,fs,skin,body)
groups=[skinbody.vertex_groups.new(name='spine-'+str(j)) for j in range(3)]
for ring,(j,t,rx,rz) in enumerate(ringdata):
 # Smooth dual-quaternion blend across joints; fixed bone lengths, no animated scales.
 weights={j:1.0}
 if t>.65 and j<2:amount=(t-.65)/.7;weights={j:1-amount,j+1:amount}
 elif t<.35 and j>0:amount=(.35-t)/.7;weights={j:1-amount,j-1:amount}
 for b,w in weights.items():groups[b].add(list(range(ring*24,(ring+1)*24)),w,'REPLACE')
modifier=skinbody.modifiers.new('volume-preserving-spine','ARMATURE');modifier.object=arm;modifier.use_deform_preserve_volume=True
for o in trunk:o.hide_render=True;meshes.remove(o)
uv('skull',(0,0,0),(.36,.37,.33),skin,head);uv('jaw',(0,.17,-.16),(.29,.28,.17),light,head)
for s in [-1,1]:
 uv('muzzle-'+str(s),(s*.14,.31,-.08),(.17,.20,.13),light,head)
 uv('eye-'+str(s),(s*.25,.245,.12),(.035,.038,.04),dark,head)
uv('nose',(0,.46,.01),(.11,.075,.065),dark,head)
bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.24,radius2=.22,depth=math.sqrt(.24**2+.42**2));neck=bpy.context.object;neck.name='short-thick-neck';neck.parent=body;neck.data.materials.append(skin);meshes.append(neck)
# Short foreflippers with anatomical pointed digits, long backward paired hind webs.
fore={};foreupper={};hind={};whiskers={}
def blade(n,L,width,m,parent,forefoot=False):
 outline=[(-width*.22,0),(width*.22,0),(width*.7,L*.28),(width,L*.75),(width*.65,L),(-width*.5,L*.93),(-width*.85,L*.65),(-width*.65,L*.22)]
 vs=[(x,0 if forefoot else -.045,z) for x,z in outline]+[(x,.045,z) for x,z in outline];fs=[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
 return mesh(n,vs,fs,m,parent)
for s in [-1,1]:
 fore[s]=blade('foreflipper-'+str(s),.50,.16,finmat,body,True)
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.11,depth=.45);o=bpy.context.object;o.name='foreupper-'+str(s);o.parent=body;o.data.materials.append(skin);meshes.append(o);foreupper[s]=o
 hind[s]=blade('hindflipper-'+str(s),.80,.24,finmat,body)
 for k in range(3):
  L=[.28,.36,.30][k];bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.008,depth=L);o=bpy.context.object;o.name=f'whisker-{s}-{k}';o.parent=head;o.data.materials.append(light);meshes.append(o);whiskers[s,k]=(o,L)
tail=uv('short-tail',(0,0,0),(.075,.18,.07),finmat,body)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-contract';cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=16/96;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,frame):
 o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
records=[]
def pose(clip,i,frame):
 p=i/8;body.location=(0,0,0);swim=clip=='swim';amount=[0,.35,.85,1,.5,0][i] if clip=='action' else 0
 base=Vector((0,-1.35,.38));nodes=[base.copy()]
 for j,L in enumerate(lengths):
  if clip=='haul':a=math.radians([12,8,6][j]+[18,20,20][j]*math.sin(math.tau*p-j*.85));v=Vector((0,math.cos(a),math.sin(a)))
  elif swim:a=math.radians([24,12,3][j]*math.sin(math.tau*p-j*.45));v=Vector((math.sin(a),math.cos(a),0))
  else:v=Vector((0,math.cos(math.radians([12,8,6][j])),math.sin(math.radians([12,8,6][j]))))
  end=nodes[-1]+v*L;place(trunk[j],nodes[-1],end);nodes.append(end)
  pb=arm.pose.bones['spine-'+str(j)];pb.matrix=Matrix.LocRotScale(nodes[-2],v.to_track_quat('Y','Z'),Vector((1,1,1)));pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame)
 head.location=nodes[-1]+Vector((0,.24,.42));head.rotation_euler=(0,0,0)
 place(neck,nodes[-1],head.location)
 # Skull attached to shoulder by a fixed local neck volume, partially overlapping thorax.
 forepoints={};hindpoints={}
 for s in [-1,1]:
  shoulder=nodes[-1]+Vector((s*.43,-.30,-.12));a=math.radians(-20+45*math.sin(math.tau*p)) if clip=='haul' else math.radians(5) if swim else math.radians(-15)
  v=Vector((s*.55,math.sin(a),-.55 if clip=='haul' else -.08)).normalized()*.68;tip=shoulder+v;fore[s].location=shoulder;fore[s].rotation_mode='QUATERNION';fore[s].rotation_quaternion=v.to_track_quat('Z','Y');forepoints[str(s)]=[list(shoulder),list(tip)]
  hip=nodes[0]+Vector((s*.12,-.05,.03));a=math.radians(28*math.sin(math.tau*p)) if swim else math.radians(s*12)
  v=Vector((math.sin(a)+s*.16,-math.cos(a),.03+.65*amount)).normalized()*.8;hind[s].location=hip;hind[s].rotation_mode='QUATERNION';hind[s].rotation_quaternion=v.to_track_quat('Z','Y');hindpoints[str(s)]=[list(hip),list(hip+v)]
 tail.location=nodes[0]+Vector((0,-.12,0))
 whiskerpoints={}
 for (s,k),(o,L) in whiskers.items():
  start=Vector((s*.20,.39,-.065+k*.045));angle=math.radians([-20,0,20][k]*(1+amount*.9));end=start+Vector((s*math.cos(angle),.25,math.sin(angle))).normalized()*L;place(o,start,end);whiskerpoints[f'{s}-{k}']=[list(start),list(end)]
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();floor=min((o.matrix_world@v.co).z for o in meshes if o.name.startswith(('continuous','hindflipper','short-tail')) for v in o.evaluated_get(deps).data.vertices)
 body.location.z=(1.0 if swim else 0)-floor;bpy.context.view_layer.update()
 # Fixed-length actual forelimb IK. Phases7,0,1 pull on planted paddle tip; body support slides naturally.
 forepoints={}
 for s in [-1,1]:
  shoulder=nodes[-1]+Vector((s*.43,-.30,-.12))+body.location
  planted=clip=='haul' and i in [7,0,1]
  phase=i/8 if i!=7 else -.125
  if planted:tip=Vector((s*.65,1.45-.20*phase,0))
  else:tip=Vector((s*.72,shoulder.y-.25,max(.15 if not swim else 1.05,shoulder.z-.65)))
  delta=tip-shoulder;distance=delta.length;A=.45;B=.50;assert abs(A-B)<distance<A+B,(clip,i,s,distance)
  axis=delta.normalized();along=(A*A-B*B+distance*distance)/(2*distance);perp=Vector((s,0,0));perp=(perp-axis*perp.dot(axis)).normalized();elbow=shoulder+axis*along+perp*math.sqrt(A*A-along*along)
  place(foreupper[s],shoulder-body.location,elbow-body.location);v=(tip-elbow).normalized();xaxis=Vector((0,0,1)).cross(v).normalized();yaxis=v.cross(xaxis);fore[s].location=elbow-body.location;fore[s].rotation_mode='QUATERNION';fore[s].rotation_quaternion=Matrix((xaxis,yaxis,v)).transposed().to_quaternion();forepoints[str(s)]=[list(shoulder),list(elbow),list(tip)]
 bpy.context.view_layer.update()
 for o in [body,head,neck,*trunk,*fore.values(),*foreupper.values(),*hind.values(),tail,*[a[0] for a in whiskers.values()]]:key(o,frame)
 localnodes=[list(n+body.location) for n in nodes];bounds={};contacts={}
 for o in [skinbody,*fore.values(),*hind.values(),tail]:
  pts=[o.matrix_world@v.co for v in o.evaluated_get(deps).data.vertices];minimum=min(p.z for p in pts);bounds[o.name]=[minimum,max(p.z for p in pts)];contacts[o.name]=[list(root.matrix_world.inverted()@p) for p in pts if p.z<1e-5] if not swim else []
 return {'clip':clip,'index':i,'frame':frame,'swim':swim,'spineWorld':localnodes,'foreWorld':forepoints,'forePlanted':clip=='haul' and i in [7,0,1],'hindWorld':{k:[[x,y,z+body.location.z] for x,y,z in v] for k,v in hindpoints.items()},'meshWorldZ':bounds,'contacts':contacts,'whiskerLocal':whiskerpoints,'actionAmount':amount}
for clip,start,count in [('idle',1,1),('haul',10,8),('swim',25,8),('action',40,6)]:
 for i in range(count):records.append(pose(clip,i,start+i))
pose('haul',0,18);pose('swim',0,33);pose('action',0,46);scene.frame_start=1;scene.frame_end=46
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      for kp in fc.keyframe_points:kp.interpolation='LINEAR'
scene.frame_set(1);root.rotation_euler.z=0;bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(S/'harbor-seal.blend'))
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
G={'identity':'harbor-seal-draft-v1-geometry-03','cameraContract':C,'canvas':[W,W],'anchor':[48,64],'orthoScale':9.6,'shiftY':16/96,'records':[],'meshLocalGeometrySha256':{o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in bpy.data.objects if o.type=='MESH'},'meshTopologySha256':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in bpy.data.objects if o.type=='MESH'}}
for f,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for r in records:
  scene.frame_set(r['frame']);bpy.context.view_layer.update();rr=json.loads(json.dumps(r));rr['facing']=f;rr['head']=project(head.matrix_world.translation);rr['spine']=[project(root.matrix_world@Vector(p)) for p in r['spineWorld']];rr['landmarks']={};rr['volumes']={}
  evaluated=skinbody.evaluated_get(bpy.context.evaluated_depsgraph_get());view=(cam.location-skinbody.matrix_world.translation).normalized()
  for ring in [1,3,4,5,6]:
   for k in {1:[3,8],3:[2,6,10],4:[4,8],5:[2,7,10],6:[4,8]}[ring]:
    index=ring*24+k;v=evaluated.data.vertices[index];normal=(skinbody.matrix_world.to_3x3()@v.normal).normalized()
    if normal.dot(view)>.15:rr['landmarks'][f'skin-spot-{ring}-{k}']=project(skinbody.matrix_world@v.co)
  rr['contactScreen']={n:[project(root.matrix_world@Vector(p)) for p in ps] for n,ps in r['contacts'].items()}
  rr['whiskers']={n:[project(head.matrix_world@Vector(p)) for p in ps] for n,ps in r['whiskerLocal'].items()}
  for o in meshes:
   ps=[project(o.matrix_world@v.co) for v in o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices];rr['volumes'][o.name]={'hull':hull([[p[0],p[1]] for p in ps]),'bbox':[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],'depthRange':[min(p[2] for p in ps),max(p[2] for p in ps)]}
  G['records'].append(rr);scene.render.filepath=str(O/'guides'/f'{f}-{r["clip"]}-{r["index"]:02}.png');bpy.ops.render.render(write_still=True)
G['blendSha256']=hashlib.sha256((S/'harbor-seal.blend').read_bytes()).hexdigest()
for d in [S,O]:(d/'projected-guides.json').write_text(json.dumps(G,separators=(',',':'))+'\n',encoding='utf-8')
(O/'camera-inspection.json').write_text(json.dumps({'angleAboveGround':40,'worldPixelsPerUnit':10,'canvas':[96,96],'anchor':[48,64],'orthoScale':9.6,'shiftY':16/96,'geometryIdentity':G['identity']},indent=2)+'\n',encoding='utf-8')
print('HARBOR_SEAL_BUILD_OK',len(meshes),len(G['records']))
