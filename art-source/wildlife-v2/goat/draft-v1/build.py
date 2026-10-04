"""Fresh horned domestic goat. Isolated bpy scene, rigid source geometry and contacts.
Camera angle is explicitly above ground; +Y anatomical forward, +Z up.
Projection/export plumbing follows the accepted fox, not rejected drawings.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4]
S=ROOT/'art-source/wildlife-v2/goat/draft-v1';O=ROOT/'public/demos/wildlife-v2/goat/draft-v1'
S.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(parents=True,exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
W=48;ANCHOR=[24,35]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False
scene.display.shading.show_cavity=True;scene.render.film_transparent=True
scene.render.resolution_x=scene.render.resolution_y=192;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=10
scene.view_settings.view_transform='Standard'
def mat(name,rgb):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);return m
tan=mat('warm goat coat',(.57,.38,.23));light=mat('upper tawny coat',(.73,.54,.33));cream=mat('cheek and belly',(.86,.77,.57));dark=mat('mane beard feet nose',(.16,.13,.11));hornmat=mat('horn keratin',(.61,.59,.44));pink=mat('ear inner',(.53,.35,.29))
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;o.empty_display_type='PLAIN_AXES';o.empty_display_size=.08;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid',root);head=empty('HEAD-rigid',body,(0,.96,1.99));meshes=[]
def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def align(o,a,b):o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def link(name,length,rx,ry,material,parent):return egg(name,(0,0,0),(rx,ry,length/2),material,parent)
def taper(name,a,b,base,tip,material,parent):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=base,radius2=tip,depth=(b-a).length);o=bpy.context.object;o.name=name;o.parent=parent;align(o,a,b);o.data.materials.append(material);meshes.append(o);return o
egg('torso',(0,-.05,1.28),(.38,.77,.40),tan,body)
egg('shoulder',(0,.49,1.34),(.33,.30,.42),tan,body)
egg('rump',(0,-.60,1.27),(.37,.30,.40),tan,body)
egg('belly',(0,-.04,1.05),(.31,.53,.17),cream,body)
neck=link('neck',.60,.20,.22,tan,body);align(neck,Vector((0,.57,1.42)),Vector((0,.85,1.95)))
egg('dorsal-mane',(0,-.12,1.65),(.085,.64,.055),dark,body)
egg('skull',(0,0,0),(.23,.27,.28),tan,head)
egg('muzzle',(0,.25,-.145),(.17,.20,.16),cream,head)
egg('nose',(0,.40,-.125),(.14,.055,.085),dark,head)
taper('beard',(0,.22,-.25),(0,.20,-.48),.105,.015,dark,head)
ears={};horns={}
for side in [-1,1]:
 egg('eye-'+str(side),(side*.21,.145,.105),(.028,.031,.025),dark,head)
 egg('cheek-stripe-'+str(side),(side*.194,.045,.005),(.039,.16,.135),cream,head)
 e=empty('EAR-'+str(side),head,(side*.195,-.025,.15));ears[side]=e
 egg('ear-'+str(side),(side*.15,-.005,.035),(.20,.070,.09),tan,e)
 egg('ear-inner-'+str(side),(side*.15,.050,.035),(.13,.016,.045),pink,e)
 hp=[(side*.145,-.085,.21),(side*.21,-.29,.53),(side*.235,-.48,.55)];horns[side]=hp
 for j in range(2):taper('horn-'+str(side)+'-'+str(j),hp[j],hp[j+1],.075 if j==0 else .045,.045 if j==0 else .008,hornmat,head)
legs={}
for end,y,h,L1,L2,L3 in [('fore',.57,1.03,.34,.38,.42),('hind',-.61,1.00,.35,.39,.40)]:
 for side in [-1,1]:
  n=f'{end}{side}';ctl=empty('LEG-'+n,root)
  upper=link(n+'-upper',L1,.075 if end=='fore' else .11,.08 if end=='fore' else .10,tan,ctl)
  middle=link(n+'-middle',L2,.060,.060,tan,ctl);lower=link(n+'-cannon',L3,.038,.038,dark,ctl);hoof=empty(n+'-hoof',ctl)
  for toe in [-1,1]:egg(n+'-toe'+str(toe),(toe*.037,.020,0),(.034,.11,.075),dark,hoof)
  legs[n]=dict(upper=upper,middle=middle,lower=lower,hoof=hoof,hip=Vector((side*.27,y,h)),lengths=[L1,L2,L3],end=end)
tailctl=empty('TAIL-upright-rigid',body,(0,-.89,1.41));tail=link('tail-upright-volume',.24,.07,.065,tan,tailctl);align(tail,Vector((0,0,0)),Vector((0,-.12,.21)))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed'
cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
OFF={'hind-1':0,'fore-1':4,'hind1':8,'fore1':12}
def pose(clip,i,frame):
 body.location=(0,0,0);key(body,frame);contacts={}
 for n,l in legs.items():
  hip=l['hip'];foot=Vector((hip.x,hip.y,.075));planted=True;p=0
  if clip=='walk':
   p=(i-OFF[n])%16
   if p<=10:foot.y+=.50-.10*p
   else:
    q=(p-10)/6;foot.y+=-.50+(.5-.5*math.cos(math.pi*q));foot.z+=.22*math.sin(math.pi*q);planted=False
  L1,L2,L3=l['lengths'];direction=Vector((0,(hip.y-foot.y)*.42,1)).normalized();ankle=foot+direction*L3
  delta=ankle-hip;dist=delta.length
  if dist>L1+L2+1e-7:raise RuntimeError('Unreachable fixed goat leg '+n)
  unit=delta.normalized();along=(L1*L1-L2*L2+dist*dist)/(2*dist);perp=Vector((0,1,0));perp=(perp-unit*perp.dot(unit)).normalized()
  knee=hip+unit*along+perp*math.sqrt(max(0,L1*L1-along*along))*(1 if l['end']=='hind' else -1)
  align(l['upper'],hip,knee);align(l['middle'],knee,ankle);align(l['lower'],ankle,foot);l['hoof'].location=foot
  for o in [l['upper'],l['middle'],l['lower'],l['hoof']]:key(o,frame)
  contacts[n]=dict(hip=list(hip),knee=list(knee),ankle=list(ankle),foot=list(foot),ground=[foot.x,foot.y,0],planted=planted,lengths=[(knee-hip).length,(ankle-knee).length,(foot-ankle).length],phase=p)
 turn=[0,-.35,-.80,-.40,.40,.80,.35,0][i] if clip=='action' else 0
 for side,e in ears.items():e.rotation_euler=(0,side*turn,side*turn*.18);key(e,frame)
 tailctl.rotation_euler=(turn*.45,0,turn*.65);key(tailctl,frame)
 return contacts
def project(v):
 p=world_to_camera_view(scene,cam,root.matrix_world@Vector(v));return [round(p.x*W,5),round((1-p.y)*W,5),round(p.z,5)]
def project_world(v):
 p=world_to_camera_view(scene,cam,v);return [round(p.x*W,5),round((1-p.y)*W,5),round(p.z,5)]
def hull(points):
 pts=sorted(set(tuple(p) for p in points));lo=[];hi=[]
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for p in pts:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(pts):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def volume(o):
 e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());ps=[project_world(e.matrix_world@v.co) for v in e.data.vertices]
 return dict(hull=hull([p[:2] for p in ps]),bbox=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)],depthRange=[min(p[2] for p in ps),max(p[2] for p in ps)],vertexCount=len(ps))
CLIPS=[('idle',1,1),('walk',16,10),('action',8,35)]
for clip,count,start in CLIPS:
 for i in range(count+1):pose(clip,i%count,start+i)
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for fc in bag.fcurves:
      assert fc.data_path!='scale'
      for k in fc.keyframe_points:k.interpolation='LINEAR'
scene.frame_start=1;scene.frame_end=43
for clip,count,start in CLIPS:scene.timeline_markers.new(clip+' '+str(count)+' poses',frame=start)
records=[]
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,count,start in CLIPS:
  for i in range(count):
   scene.frame_set(start+i);contacts=pose(clip,i,start+i);bpy.context.view_layer.update()
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i,anchor=project((0,0,0)),body=project((0,-.05,1.28)),head=project((0,.96,1.99)),neck=project((0,.72,1.72)),tail=[project_world(tailctl.matrix_world@Vector(p)) for p in [(0,0,0),(0,-.12,.21)]],horns={str(side):[project_world(head.matrix_world@Vector(p)) for p in hp] for side,hp in horns.items()},beard=[project_world(head.matrix_world@Vector(p)) for p in [(0,.22,-.25),(0,.20,-.48)]],ears={str(side):{'base':project_world(e.matrix_world.translation),'tip':project_world(e.matrix_world@Vector((side*.33,-.005,.035)))} for side,e in ears.items()},contacts={n:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','ankle','foot','ground']}} for n,c in contacts.items()},volumes={o.name:volume(o) for o in meshes}))
   scene.render.filepath=str(O/'guides'/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
hashes={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
G=dict(identity='goat-draft-v1-geometry-02',species='Capra hircus horned domestic buck',blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=C['elevationAboveGroundDegrees'],polarAngleFromVertical=C['polarAngleFromVerticalDegrees'],cameraLocation=list(cam.location),cameraEuler=list(cam.rotation_euler),orthoScale=cam.data.ortho_scale,shiftY=cam.data.shift_y,canvas=[W,W],anchor=ANCHOR,pixelsPerWorldUnit=10,facings=C['modelYawDegrees'],guideSchema='bpy-projected-convex-hull-v2',meshLocalGeometrySha256=hashes,meshTopologyCounts={o.name:len(o.data.polygons) for o in meshes},limbLengths={n:l['lengths'] for n,l in legs.items()},gait='slow lateral four-beat walk, 11/16 stance samples, two or three supports, no flight',footfallOffsets=OFF,geometryScaleAnimation=False,records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
for p in [S/'projected-guides.json',O/'projected-guides.json']:p.write_text(json.dumps(G,separators=(',',':')),encoding='utf8')
scene.frame_set(1);root.rotation_euler.z=math.radians(260);bpy.context.view_layer.update()
scene['anatomy']='Lean horned domestic goat. Raised neck, short tawny coat with fixed cheek stripes and dorsal mane, beard, backward-curving paired horns, mobile lateral ears, paired cloven toes and short upright articulated tail.'
scene['cameraContract']='wildlife-v2-camera-01, 40 degrees ABOVE GROUND, 10 world pixels/unit'
bpy.ops.wm.save_as_mainfile(filepath=str(S/'goat.blend'))
print('GOAT_BUILD_OK',len(meshes),len(records))
