"""Fresh Holstein cow. Isolated bpy scene, rigid source geometry and contacts.
Camera angle is explicitly above ground; +Y anatomical forward, +Z up.
Projection/export plumbing follows the accepted fox, not rejected drawings.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4]
S=ROOT/'art-source/wildlife-v2/cow/draft-v1';O=ROOT/'public/demos/wildlife-v2/cow/draft-v1'
S.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(parents=True,exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
W=64;ANCHOR=[32,46]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False
scene.display.shading.show_cavity=True;scene.render.film_transparent=True
scene.render.resolution_x=scene.render.resolution_y=256;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=10
scene.view_settings.view_transform='Standard'
def mat(name,rgb):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);return m
white=mat('ivory coat',(.87,.85,.75));light=mat('upper ivory',(.97,.94,.84))
black=mat('Holstein black',(.12,.15,.15));shadow=mat('coat shadow',(.56,.61,.57))
pink=mat('muzzle udder ear',(.75,.46,.43));dark=mat('hoof nostril eye',(.12,.13,.12))
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc
 o.empty_display_type='PLAIN_AXES';o.empty_display_size=.10;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid',root);head=empty('HEAD-rigid',body,(0,1.31,1.83))
meshes=[]
def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
 o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def align(o,a,b):
 o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def link(name,length,rx,ry,material,parent):return egg(name,(0,0,0),(rx,ry,length/2),material,parent)
egg('torso',(0,-.07,1.54),(.58,1.16,.64),white,body)
egg('shoulder',(0,.69,1.61),(.49,.47,.63),white,body)
egg('rump',(0,-.94,1.53),(.55,.43,.58),white,body)
egg('back-black',(0,-.17,2.115),(.41,.57,.082),black,body)
for side in [-1,1]:
 egg('flank-black-'+str(side),(side*.545,-.21,1.54),(.060,.48,.43),black,body)
 egg('shoulder-black-'+str(side),(side*.457,.65,1.54),(.055,.30,.38),black,body)
a=Vector((0,.84,1.62));b=Vector((0,1.19,1.85));neck=link('neck',(b-a).length,.34,.34,white,body);align(neck,a,b)
egg('skull',(0,0,0),(.34,.38,.38),white,head)
egg('face-black-left',(-.28,.05,.08),(.090,.29,.30),black,head)
egg('muzzle',(0,.39,-.23),(.35,.25,.22),pink,head)
for side in [-1,1]:
 egg('nostril-'+str(side),(side*.22,.60,-.20),(.048,.032,.041),dark,head)
 egg('eye-'+str(side),(side*.302,.21,.12),(.035,.044,.044),dark,head)
 e=empty('EAR-'+str(side),head,(side*.33,-.03,.22))
 egg('ear-'+str(side),(side*.17,0,0),(.24,.10,.12),black,e)
 egg('ear-inner-'+str(side),(side*.17,.078,0),(.17,.030,.075),pink,e)
egg('udder',(0,-.66,.91),(.33,.36,.23),pink,body)
for x in [-.13,.13]:
 for y in [-.81,-.51]:egg(f'teat-{x}-{y}',(x,y,.65),(.041,.050,.10),pink,body)
legs={}
for end,y,h,L1,L2 in [('fore',.78,1.27,.46,.48),('hind',-.95,1.23,.47,.48)]:
 for side in [-1,1]:
  n=f'{end}{side}';ctl=empty('LEG-'+n,root)
  upper=link(n+'-upper',L1,.14 if end=='fore' else .18,.14 if end=='fore' else .15,white,ctl)
  middle=link(n+'-middle',L2,.10,.10,white,ctl)
  lower=link(n+'-cannon',.68 if end=='fore' else .66,.075,.075,white,ctl)
  hoof=empty(n+'-hoof',ctl)
  for toe in [-1,1]:egg(n+'-toe'+str(toe),(toe*.070,.035,0),(.067,.19,.10),dark,hoof)
  legs[n]=dict(upper=upper,middle=middle,lower=lower,hoof=hoof,hip=Vector((side*.40,y,h)),lengths=[L1,L2,.68 if end=='fore' else .66],end=end)
tail=empty('TAIL-hinge',body,(0,-1.31,1.77));tails=[];tail_lengths=[.38,.40,.30]
for i,length in enumerate(tail_lengths):tails.append(link('tail-'+str(i),length,.050 if i<2 else .11,.050 if i<2 else .12,white if i<2 else black,root))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed'
cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
OFF={'hind-1':0,'fore-1':4,'hind1':8,'fore1':12}
def pose(clip,i,frame):
 body.location=(.025*math.sin(i*math.tau/16) if clip=='walk' else 0,0,0);key(body,frame)
 contacts={}
 for n,l in legs.items():
  hip=l['hip']+Vector(body.location);foot=Vector((l['hip'].x,l['hip'].y,.10));planted=True;p=0
  if clip=='walk':
   p=(i-OFF[n])%16
   if p<=11:foot.y+=.865-(1.73/12)*p
   else:
    q=(p-11)/5;foot.y+=-.865+1.73*(.5-.5*math.cos(math.pi*q));foot.z+=.22*math.sin(math.pi*q);planted=False
  L1,L2,L3=l['lengths']
  cannon_direction=Vector((0,(hip.y-foot.y)*.45,1)).normalized()
  ankle=foot+cannon_direction*L3
  delta=ankle-hip;dist=delta.length
  if dist>L1+L2+1e-7:raise RuntimeError('Unreachable fixed cow leg '+n)
  unit=delta.normalized();along=(L1*L1-L2*L2+dist*dist)/(2*dist)
  perp=Vector((0,1,0));perp=(perp-unit*perp.dot(unit)).normalized()
  knee=hip+unit*along+perp*math.sqrt(max(0,L1*L1-along*along))*(1 if l['end']=='hind' else -1)
  align(l['upper'],hip,knee);align(l['middle'],knee,ankle);align(l['lower'],ankle,foot);l['hoof'].location=foot
  for o in [l['upper'],l['middle'],l['lower'],l['hoof']]:key(o,frame)
  contacts[n]=dict(hip=list(hip),knee=list(knee),ankle=list(ankle),foot=list(foot),ground=[foot.x,foot.y,0],planted=planted,lengths=[(knee-hip).length,(ankle-knee).length,(foot-ankle).length],phase=p)
 flick=[0,-.28,-.72,-.30,.52,.76,.32,0][i] if clip=='action' else 0
 base=Vector((body.location.x,-1.31,1.77));points=[base]
 for j,o in enumerate(tails):
  direction=Vector((flick*(.7+j*.25),-.18,-1)).normalized();nxt=base+direction*tail_lengths[j]
  align(o,base,nxt);key(o,frame);points.append(nxt);base=nxt
 for side in [-1,1]:
  e=bpy.data.objects['EAR-'+str(side)];e.rotation_euler=(0,0,0);key(e,frame)
 return contacts,points
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
   scene.frame_set(start+i);contacts,tail_points=pose(clip,i,start+i);bpy.context.view_layer.update()
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i,anchor=project((0,0,0)),body=project((body.location.x,-.07,1.54)),head=project((body.location.x,1.31,1.83)),neck=project((body.location.x,1.02,1.73)),udder=project((body.location.x,-.66,.91)),tail=[project(p) for p in tail_points],contacts={n:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','ankle','foot','ground']}} for n,c in contacts.items()},volumes={o.name:volume(o) for o in meshes}))
   scene.render.filepath=str(O/'guides'/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
hashes={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
G=dict(identity='cow-draft-v1-geometry-03',species='Bos taurus Holstein adult cow',blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=C['elevationAboveGroundDegrees'],polarAngleFromVertical=C['polarAngleFromVerticalDegrees'],cameraLocation=list(cam.location),cameraEuler=list(cam.rotation_euler),orthoScale=cam.data.ortho_scale,shiftY=cam.data.shift_y,canvas=[W,W],anchor=ANCHOR,pixelsPerWorldUnit=10,facings=C['modelYawDegrees'],guideSchema='bpy-projected-convex-hull-v2',meshLocalGeometrySha256=hashes,meshTopologyCounts={o.name:len(o.data.polygons) for o in meshes},limbLengths={n:l['lengths'] for n,l in legs.items()},tailLengths=tail_lengths,gait='slow lateral four-beat walk, 12/16 stance samples, three supports, no flight',footfallOffsets=OFF,geometryScaleAnimation=False,records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
for p in [S/'projected-guides.json',O/'projected-guides.json']:p.write_text(json.dumps(G,separators=(',',':')),encoding='utf8')
scene.frame_set(1);root.rotation_euler.z=math.radians(260);bpy.context.view_layer.update()
scene['anatomy']='Adult Holstein cow, polled. Broad pink muzzle, lateral ears, fixed black/ivory markings, actual paired hoof toes, udder and thin tufted articulated tail.'
scene['cameraContract']='wildlife-v2-camera-01, 40 degrees ABOVE GROUND, 10 world pixels/unit'
bpy.ops.wm.save_as_mainfile(filepath=str(S/'cow.blend'))
print('COW_BUILD_OK',len(meshes),len(records))
