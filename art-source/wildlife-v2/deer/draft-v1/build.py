"""Fresh white-tailed doe. Isolated bpy scene, rigid source geometry and contacts.
Camera angle is explicitly above ground; +Y anatomical forward, +Z up.
Projection/export plumbing follows the accepted fox, not rejected drawings.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4]
S=ROOT/'art-source/wildlife-v2/deer/draft-v1';O=ROOT/'public/demos/wildlife-v2/deer/draft-v1'
S.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(parents=True,exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
W=48;ANCHOR=[24,36]
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
tan=mat('summer tan',(.61,.39,.21));light=mat('dorsal warm light',(.78,.55,.31))
cream=mat('throat belly tail underside',(.91,.85,.68));dark=mat('nose hoof eye',(.18,.15,.13))
inner=mat('ear inner',(.50,.32,.26))
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc
 o.empty_display_type='PLAIN_AXES';o.empty_display_size=.10;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid',root);head=empty('HEAD-rigid',body,(0,1.10,2.64))
meshes=[]
def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
 o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def align(o,a,b):
 o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def link(name,length,rx,ry,material,parent):
 return egg(name,(0,0,0),(rx,ry,length/2),material,parent)
egg('torso',(0,-.04,1.79),(.38,.92,.43),tan,body)
egg('shoulder',(0,.48,1.86),(.33,.38,.46),light,body)
egg('rump',(0,-.67,1.77),(.40,.36,.45),tan,body)
egg('belly-white',(0,-.06,1.43),(.27,.72,.12),cream,body)
a=Vector((0,.59,1.87));b=Vector((0,.95,2.50));neck=link('neck', (b-a).length,.24,.22,tan,body);align(neck,a,b)
egg('throat',(0,.93,2.14),(.19,.14,.38),cream,body)
egg('skull',(0,0,0),(.25,.32,.24),light,head)
egg('muzzle',(0,.29,-.13),(.16,.27,.13),tan,head)
egg('muzzle-white',(0,.44,-.16),(.15,.12,.10),cream,head)
egg('nose',(0,.53,-.13),(.12,.065,.085),dark,head)
for side in [-1,1]:
 egg('eye-'+str(side),(side*.222,.155,.06),(.028,.043,.034),dark,head)
 e=empty('EAR-'+str(side),head,(side*.23,-.12,.16));e.rotation_euler.y=side*.38
 egg('ear-'+str(side),(0,0,.23),(.13,.085,.29),tan,e)
 egg('ear-inner-'+str(side),(0,.064,.24),(.080,.026,.21),cream,e)
legs={}
for end,y,h,L1,L2 in [('fore',.56,1.48,.67,.80),('hind',-.67,1.51,.70,.81)]:
 for side in [-1,1]:
  n=f'{end}{side}';ctl=empty('LEG-'+n,root)
  upper=link(n+'-upper',L1,.085 if end=='fore' else .13,.085 if end=='fore' else .12,tan,ctl)
  lower=link(n+'-cannon',L2,.047,.048,tan,ctl)
  hoof=egg(n+'-hoof',(0,0,0),(.072,.13,.065),dark,ctl)
  legs[n]=dict(upper=upper,lower=lower,hoof=hoof,hip=Vector((side*.27,y,h)),lengths=[L1,L2],end=end)
tail=empty('TAIL-hinge',body,(0,-.99,1.87))
egg('tail-brown',(0,-.17,-.17),(.15,.24,.12),tan,tail)
egg('tail-white',(0,-.16,-.23),(.13,.22,.070),cream,tail)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed'
cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
OFF={'hind-1':0,'fore1':1,'hind1':6,'fore-1':7}
def pose(clip,i,frame):
 body.location=(0,0,0);key(body,frame)
 contacts={}
 for n,l in legs.items():
  hip=l['hip'];foot=Vector((hip.x,hip.y,.065));planted=True;p=0
  if clip=='walk':
   p=(i-OFF[n])%12
   if p<=8:foot.y+=.28-.07*p
   else:
    t=(p-8)/4;foot.y+=-.28+.56*(.5-.5*math.cos(math.pi*t));foot.z+=.20*math.sin(math.pi*t);planted=False
  delta=foot-hip;dist=delta.length;L1,L2=l['lengths']
  if dist>L1+L2+1e-7:raise RuntimeError('Unreachable fixed deer leg '+n)
  unit=delta.normalized();along=(L1*L1-L2*L2+dist*dist)/(2*dist)
  perp=Vector((0,1,0));perp=(perp-unit*perp.dot(unit)).normalized()
  knee=hip+unit*along+perp*math.sqrt(max(0,L1*L1-along*along))*(1 if l['end']=='hind' else -1)
  align(l['upper'],hip,knee);align(l['lower'],knee,foot);l['hoof'].location=foot
  for o in [l['upper'],l['lower'],l['hoof']]:key(o,frame)
  contacts[n]=dict(hip=list(hip),knee=list(knee),foot=list(foot),ground=[foot.x,foot.y,0],planted=planted,lengths=[(knee-hip).length,(foot-knee).length],phase=p)
 # Flagging rotates the fixed tail rather than scaling or replacing it.
 angle=[0,.28,.75,1.30,1.65,1.30,.60,0][i] if clip=='action' else 0
 tail.rotation_euler.x=-angle;key(tail,frame)
 for side in [-1,1]:
  ear=bpy.data.objects['EAR-'+str(side)];ear.rotation_euler.y=side*.38;key(ear,frame)
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
CLIPS=[('idle',1,1),('walk',12,10),('action',8,30)]
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
scene.frame_start=1;scene.frame_end=38
for clip,count,start in CLIPS:scene.timeline_markers.new(clip+' '+str(count)+' poses',frame=start)
records=[]
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,count,start in CLIPS:
  for i in range(count):
   scene.frame_set(start+i);contacts=pose(clip,i,start+i);bpy.context.view_layer.update()
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i,anchor=project((0,0,0)),body=project((0,-.04,1.79)),head=project((0,1.10,2.64)),neck=project((0,.77,2.18)),tail=project_world(tail.matrix_world.translation),tailTip=project_world(tail.matrix_world@Vector((0,-.36,-.23))),contacts={n:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','foot','ground']}} for n,c in contacts.items()},volumes={o.name:volume(o) for o in meshes}))
   scene.render.filepath=str(O/'guides'/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
hashes={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
G=dict(identity='deer-draft-v1-geometry-02',species='Odocoileus virginianus adult doe',blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=C['elevationAboveGroundDegrees'],polarAngleFromVertical=C['polarAngleFromVerticalDegrees'],cameraLocation=list(cam.location),cameraEuler=list(cam.rotation_euler),orthoScale=cam.data.ortho_scale,shiftY=cam.data.shift_y,canvas=[W,W],anchor=ANCHOR,pixelsPerWorldUnit=10,facings=C['modelYawDegrees'],guideSchema='bpy-projected-convex-hull-v2',meshLocalGeometrySha256=hashes,meshTopologyCounts={o.name:len(o.data.polygons) for o in meshes},limbLengths={n:l['lengths'] for n,l in legs.items()},gait='slow diagonal-overlap walk, contralateral pair separated one pose, no flight',footfallOffsets=OFF,geometryScaleAnimation=False,records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
for p in [S/'projected-guides.json',O/'projected-guides.json']:p.write_text(json.dumps(G,separators=(',',':')),encoding='utf8')
scene.frame_set(1);root.rotation_euler.z=math.radians(260);bpy.context.view_layer.update()
scene['anatomy']='Adult white-tailed doe, no antlers. Long ears/neck, narrow cloven hooves, white tail underside.'
scene['cameraContract']='wildlife-v2-camera-01, 40 degrees ABOVE GROUND, 10 world pixels/unit'
bpy.ops.wm.save_as_mainfile(filepath=str(S/'deer.blend'))
print('DEER_BUILD_OK',len(meshes),len(records))
