"""Fresh Suffolk ewe. Isolated bpy scene, rigid source geometry and contacts.
Camera angle is explicitly above ground; +Y anatomical forward, +Z up.
Projection/export plumbing follows the accepted fox, not rejected drawings.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4]
S=ROOT/'art-source/wildlife-v2/sheep/draft-v1';O=ROOT/'public/demos/wildlife-v2/sheep/draft-v1'
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
white=mat('ivory Suffolk fleece',(.90,.88,.75));light=mat('upper fleece',(.98,.94,.83))
black=mat('Suffolk black face and legs',(.16,.17,.16));pink=mat('dark ear interior',(.37,.29,.27));dark=mat('nose eyes hooves',(.08,.09,.085))
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;o.empty_display_type='PLAIN_AXES';o.empty_display_size=.08;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid',root);head=empty('HEAD-rigid',body,(0,.80,1.15))
meshes=[]
def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def align(o,a,b):o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def link(name,length,rx,ry,material,parent):return egg(name,(0,0,0),(rx,ry,length/2),material,parent)
egg('torso',(0,-.03,1.08),(.44,.76,.50),white,body)
egg('shoulder',(0,.45,1.09),(.37,.32,.43),white,body)
egg('rump',(0,-.59,1.06),(.43,.34,.47),white,body)
# Real fleece volume scallops, not a decoration sampled from final pixels.
for j,(x,y,z,rx,ry,rz) in enumerate([(-.27,-.50,1.42,.20,.20,.17),(.25,-.48,1.43,.21,.22,.17),(-.29,.06,1.43,.20,.24,.18),(.28,.05,1.43,.21,.23,.18),(-.20,.44,1.42,.18,.18,.17),(.19,.44,1.41,.18,.18,.17),(-.38,-.31,1.15,.15,.21,.20),(.38,-.31,1.15,.15,.21,.20),(-.35,.27,1.16,.15,.20,.19),(.35,.27,1.16,.15,.20,.19)]):egg('fleece-clump-'+str(j),(x,y,z),(rx,ry,rz),light if j<6 else white,body)
egg('neck',(0,.63,1.03),(.22,.24,.24),black,body)
egg('skull',(0,0,0),(.23,.30,.30),black,head)
egg('muzzle',(0,.27,-.17),(.18,.19,.15),black,head)
egg('nose',(0,.43,-.15),(.14,.055,.085),dark,head)
ears={}
for side in [-1,1]:
 egg('eye-'+str(side),(side*.206,.17,.085),(.025,.029,.029),dark,head)
 e=empty('EAR-'+str(side),head,(side*.205,-.025,.12));ears[side]=e
 egg('ear-'+str(side),(side*.15,.035,-.06),(.20,.075,.105),black,e)
 egg('ear-inner-'+str(side),(side*.155,.095,-.06),(.13,.022,.050),pink,e)
legs={}
for end,y,h,L1,L2,L3 in [('fore',.46,.86,.29,.31,.40),('hind',-.54,.80,.30,.32,.38)]:
 for side in [-1,1]:
  n=f'{end}{side}';ctl=empty('LEG-'+n,root)
  upper=link(n+'-upper',L1,.09 if end=='fore' else .13,.09 if end=='fore' else .12,black,ctl)
  middle=link(n+'-middle',L2,.070,.070,black,ctl);lower=link(n+'-cannon',L3,.048,.048,black,ctl)
  hoof=empty(n+'-hoof',ctl)
  for toe in [-1,1]:egg(n+'-toe'+str(toe),(toe*.037,.020,0),(.034,.10,.07),dark,hoof)
  legs[n]=dict(upper=upper,middle=middle,lower=lower,hoof=hoof,hip=Vector((side*.28,y,h)),lengths=[L1,L2,L3],end=end)
tail=link('tail-short-volume',.32,.10,.095,white,body);align(tail,Vector((0,-.87,1.10)),Vector((0,-.98,.80)))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed'
cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
OFF={'hind-1':0,'fore-1':4,'hind1':8,'fore1':12}
def pose(clip,i,frame):
 body.location=(0,0,0);key(body,frame);contacts={}
 for n,l in legs.items():
  hip=l['hip'];foot=Vector((hip.x,hip.y,.07));planted=True;p=0
  if clip=='walk':
   p=(i-OFF[n])%16
   if p<=11:foot.y+=.50-(1/12)*p
   else:
    q=(p-11)/5;foot.y+=-.50+( .5-.5*math.cos(math.pi*q));foot.z+=.18*math.sin(math.pi*q);planted=False
  L1,L2,L3=l['lengths'];direction=Vector((0,(hip.y-foot.y)*.45,1)).normalized();ankle=foot+direction*L3
  delta=ankle-hip;dist=delta.length
  if dist>L1+L2+1e-7:raise RuntimeError('Unreachable fixed sheep leg '+n)
  unit=delta.normalized();along=(L1*L1-L2*L2+dist*dist)/(2*dist)
  perp=Vector((0,1,0));perp=(perp-unit*perp.dot(unit)).normalized()
  knee=hip+unit*along+perp*math.sqrt(max(0,L1*L1-along*along))*(1 if l['end']=='hind' else -1)
  align(l['upper'],hip,knee);align(l['middle'],knee,ankle);align(l['lower'],ankle,foot);l['hoof'].location=foot
  for o in [l['upper'],l['middle'],l['lower'],l['hoof']]:key(o,frame)
  contacts[n]=dict(hip=list(hip),knee=list(knee),ankle=list(ankle),foot=list(foot),ground=[foot.x,foot.y,0],planted=planted,lengths=[(knee-hip).length,(ankle-knee).length,(foot-ankle).length],phase=p)
 ear_turn=[0,-.42,-1.05,-.50,.50,1.05,.42,0][i] if clip=='action' else 0
 for side,e in ears.items():
  e.rotation_euler=(0,side*ear_turn,side*ear_turn*.15);key(e,frame)
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
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i,anchor=project((0,0,0)),body=project((0,-.03,1.08)),head=project((0,.80,1.15)),neck=project((0,.63,1.03)),tail=project((0,-.92,.95)),ears={str(side):{'base':project_world(e.matrix_world.translation),'tip':project_world(e.matrix_world@Vector((side*.33,.035,-.06)))} for side,e in ears.items()},contacts={n:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','ankle','foot','ground']}} for n,c in contacts.items()},volumes={o.name:volume(o) for o in meshes}))
   scene.render.filepath=str(O/'guides'/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
hashes={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
G=dict(identity='sheep-draft-v1-geometry-02',species='Ovis aries Suffolk ewe',blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=C['elevationAboveGroundDegrees'],polarAngleFromVertical=C['polarAngleFromVerticalDegrees'],cameraLocation=list(cam.location),cameraEuler=list(cam.rotation_euler),orthoScale=cam.data.ortho_scale,shiftY=cam.data.shift_y,canvas=[W,W],anchor=ANCHOR,pixelsPerWorldUnit=10,facings=C['modelYawDegrees'],guideSchema='bpy-projected-convex-hull-v2',meshLocalGeometrySha256=hashes,meshTopologyCounts={o.name:len(o.data.polygons) for o in meshes},limbLengths={n:l['lengths'] for n,l in legs.items()},gait='slow lateral four-beat walk, 12/16 stance samples, three supports, no flight',footfallOffsets=OFF,geometryScaleAnimation=False,records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
for p in [S/'projected-guides.json',O/'projected-guides.json']:p.write_text(json.dumps(G,separators=(',',':')),encoding='utf8')
scene.frame_set(1);root.rotation_euler.z=math.radians(260);bpy.context.view_layer.update()
scene['anatomy']='Hornless Suffolk ewe. Dense white fleece with genuine clump volumes, long black face, black legs, lateral drooping articulated ears, paired cloven hoof toes and short fixed tail.'
scene['cameraContract']='wildlife-v2-camera-01, 40 degrees ABOVE GROUND, 10 world pixels/unit'
bpy.ops.wm.save_as_mainfile(filepath=str(S/'sheep.blend'))
print('SHEEP_BUILD_OK',len(meshes),len(records))
