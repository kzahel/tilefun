"""Fresh bay horse. Isolated bpy scene, rigid source geometry and contacts.
Camera angle is explicitly above ground; +Y anatomical forward, +Z up.
Projection/export plumbing follows the accepted fox, not rejected drawings.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4]
S=ROOT/'art-source/wildlife-v2/horse/draft-v1';O=ROOT/'public/demos/wildlife-v2/horse/draft-v1'
S.mkdir(parents=True,exist_ok=True);(O/'guides').mkdir(parents=True,exist_ok=True)
C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
W=80;ANCHOR=[40,61]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;bpy.context.preferences.filepaths.save_version=0
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=False
scene.display.shading.show_cavity=True;scene.render.film_transparent=True
scene.render.resolution_x=scene.render.resolution_y=320;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.fps=10
scene.view_settings.view_transform='Standard'
def mat(name,rgb):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);return m
coat=mat('bay coat',(.55,.28,.12));light=mat('upper bay coat',(.70,.39,.18));black=mat('black mane tail legs',(.16,.17,.15));white=mat('small ivory forehead blaze',(.95,.91,.80));dark=mat('eyes and solid hooves',(.09,.13,.12))
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;o.empty_display_type='PLAIN_AXES';o.empty_display_size=.08;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid',root);head=empty('HEAD-rigid',body,(0,1.58,3.50));meshes=[]
def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def align(o,a,b):o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def link(name,L,rx,ry,material,parent):return egg(name,(0,0,0),(rx,ry,L/2),material,parent)
egg('torso',(0,-.10,2.24),(.53,1.25,.64),coat,body)
egg('shoulder',(0,.84,2.26),(.49,.46,.67),coat,body)
egg('rump',(0,-1.04,2.28),(.57,.48,.67),coat,body)
egg('withers',(0,.55,2.74),(.29,.34,.25),light,body)
neck=link('neck',(Vector((0,1.48,3.47))-Vector((0,.82,2.55))).length,.31,.34,coat,body);align(neck,Vector((0,.82,2.55)),Vector((0,1.48,3.47)))
egg('skull',(0,0,0),(.28,.34,.37),coat,head)
face=link('long-face',.60,.20,.22,coat,head);align(face,Vector((0,.18,-.06)),Vector((0,.59,-.50)))
egg('muzzle',(0,.59,-.49),(.23,.20,.19),coat,head)
egg('nose',(0,.74,-.49),(.205,.07,.12),dark,head)
egg('blaze',(0,.302,.015),(.065,.047,.25),white,head)
for side in [-1,1]:
 egg('eye-'+str(side),(side*.258,.15,.10),(.030,.032,.030),dark,head)
 bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.115,radius2=.015,depth=.40);e=bpy.context.object;e.name='ear-'+str(side);e.parent=head;e.location=(side*.18,-.16,.45);e.rotation_euler.y=side*.12;e.data.materials.append(coat);meshes.append(e)
 egg('ear-inner-'+str(side),(side*.18,-.105,.43),(.036,.023,.135),black,head)
egg('forelock',(0,-.09,.25),(.23,.22,.12),black,head)
# Fixed-volume crest follows the rear of the neck; it is not a fox back stripe.
for j in range(5):
 q=j/4;egg('mane-'+str(j),(.015,.61+q*.58,2.65+q*.88),(.14,.19,.23),black,body)
legs={}
for end,y,h,L1,L2,L3,L4 in [('fore',1.03,2.02,.69,.70,.70,.23),('hind',-1.14,1.98,.66,.71,.70,.23)]:
 for side in [-1,1]:
  n=f'{end}{side}';ctl=empty('LEG-'+n,root)
  upper=link(n+'-upper',L1,.12 if end=='fore' else .21,.12 if end=='fore' else .18,coat,ctl)
  middle=link(n+'-middle',L2,.095,.095,coat,ctl);cannon=link(n+'-cannon',L3,.058,.060,black,ctl);pastern=link(n+'-pastern',L4,.068,.068,black,ctl)
  hoof=egg(n+'-hoof',(0,0,0),(.15 if end=='fore' else .12,.19,.11),dark,ctl)
  legs[n]=dict(upper=upper,middle=middle,lower=cannon,pastern=pastern,hoof=hoof,hip=Vector((side*.36,y,h)),lengths=[L1,L2,L3,L4],end=end)
tail_lengths=[.32,.36,.40,.42,.36];tails=[link('tail-'+str(j),L,.105+j*.012,.09+j*.008,black,body) for j,L in enumerate(tail_lengths)]
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed'
cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
OFF={'hind-1':0,'fore-1':4,'hind1':8,'fore1':12}
def pose(clip,i,frame):
 body.location=(0,0,0);key(body,frame);contacts={}
 for n,l in legs.items():
  hip=l['hip'];foot=Vector((hip.x,hip.y,.11));planted=True;p=0
  if clip=='walk':
   p=(i-OFF[n])%16
   if p<=9:foot.y+=.9041666667-(2.17/12)*p
   else:
    q=(p-9)/7;foot.y+=-.9041666667+1.8083333334*(.5-.5*math.cos(math.pi*q));foot.z+=.30*math.sin(math.pi*q);planted=False
  L1,L2,L3,L4=l['lengths']
  fetlock=foot+Vector((0,(hip.y-foot.y)*.30-.25,1)).normalized()*L4
  ankle=fetlock+Vector((0,(hip.y-foot.y)*.40,1)).normalized()*L3
  delta=ankle-hip;dist=delta.length
  if dist>L1+L2+1e-7:raise RuntimeError('Unreachable fixed horse leg '+n)
  unit=delta.normalized();along=(L1*L1-L2*L2+dist*dist)/(2*dist)
  perp=Vector((0,1,0));perp=(perp-unit*perp.dot(unit)).normalized()
  knee=hip+unit*along+perp*math.sqrt(max(0,L1*L1-along*along))*(1 if l['end']=='hind' else -1)
  align(l['upper'],hip,knee);align(l['middle'],knee,ankle);align(l['lower'],ankle,fetlock);align(l['pastern'],fetlock,foot);l['hoof'].location=foot
  for o in [l['upper'],l['middle'],l['lower'],l['pastern'],l['hoof']]:key(o,frame)
  contacts[n]=dict(hip=list(hip),knee=list(knee),ankle=list(ankle),fetlock=list(fetlock),foot=list(foot),ground=[foot.x,foot.y,0],planted=planted,lengths=[(knee-hip).length,(ankle-knee).length,(fetlock-ankle).length,(foot-fetlock).length],phase=p)
 flick=[0,-.28,-.74,-.30,.45,.82,.35,0][i] if clip=='action' else 0
 base=Vector((0,-1.47,2.58));points=[base]
 for j,o in enumerate(tails):
  direction=Vector((flick*(.70+j*.28),-.30,-1)).normalized();nxt=base+direction*tail_lengths[j]
  align(o,base,nxt);key(o,frame);points.append(nxt);base=nxt
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
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i,anchor=project((0,0,0)),body=project((0,-.10,2.24)),head=project((0,1.58,3.50)),neck=project((0,1.13,3.01)),tail=[project(p) for p in tail_points],contacts={n:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','ankle','fetlock','foot','ground']}} for n,c in contacts.items()},volumes={o.name:volume(o) for o in meshes}))
   scene.render.filepath=str(O/'guides'/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
hashes={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
G=dict(identity='horse-draft-v1-geometry-01',species='Equus caballus adult bay horse',blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=C['elevationAboveGroundDegrees'],polarAngleFromVertical=C['polarAngleFromVerticalDegrees'],cameraLocation=list(cam.location),cameraEuler=list(cam.rotation_euler),orthoScale=cam.data.ortho_scale,shiftY=cam.data.shift_y,canvas=[W,W],anchor=ANCHOR,pixelsPerWorldUnit=10,facings=C['modelYawDegrees'],guideSchema='bpy-projected-convex-hull-v2',meshLocalGeometrySha256=hashes,meshTopologyCounts={o.name:len(o.data.polygons) for o in meshes},limbLengths={n:l['lengths'] for n,l in legs.items()},tailLengths=tail_lengths,gait='lateral four-beat walk, 10/16 stance samples, alternating two/three supports, no flight',footfallOffsets=OFF,geometryScaleAnimation=False,records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
for p in [S/'projected-guides.json',O/'projected-guides.json']:p.write_text(json.dumps(G,separators=(',',':')),encoding='utf8')
scene.frame_set(1);root.rotation_euler.z=math.radians(260);bpy.context.view_layer.update()
scene['anatomy']='Bay horse: own raised neck, long face, pointed ears, fixed mane/blaze, four fixed leg segments including pastern, solid fore/hind hooves, five-link hair tail.'
scene['cameraContract']='wildlife-v2-camera-01, 40 degrees ABOVE GROUND, 10 world pixels/unit'
bpy.ops.wm.save_as_mainfile(filepath=str(S/'horse.blend'))
print('HORSE_BUILD_OK',len(meshes),len(records))
