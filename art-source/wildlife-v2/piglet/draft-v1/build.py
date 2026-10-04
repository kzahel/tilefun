"""Fresh domestic pig. Isolated bpy scene, rigid source geometry and contacts.
Camera angle is explicitly above ground; +Y anatomical forward, +Z up.
Projection/export plumbing follows the accepted fox, not rejected drawings.
"""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4]
S=ROOT/'art-source/wildlife-v2/piglet/draft-v1';O=ROOT/'public/demos/wildlife-v2/piglet/draft-v1'
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
pink=mat('pale domestic pig skin',(.91,.68,.60));light=mat('upper pink planes',(.98,.80,.69));rose=mat('snout ear interior',(.78,.44,.40));dark=mat('eyes nostrils hooves',(.17,.20,.17))
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;o.empty_display_type='PLAIN_AXES';o.empty_display_size=.08;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-rigid',root);head=empty('HEAD-rigid',body,(0,.94,1.17));meshes=[]
def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.parent=parent;o.location=loc;o.data.materials.append(material);meshes.append(o);return o
def align(o,a,b):o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
def link(name,L,rx,ry,material,parent):return egg(name,(0,0,0),(rx,ry,L/2),material,parent)
egg('torso',(0,-.07,1.10),(.52,.92,.47),pink,body)
egg('shoulder',(0,.55,1.12),(.44,.36,.42),pink,body)
egg('rump',(0,-.78,1.10),(.51,.35,.45),pink,body)
egg('neck',(0,.74,1.11),(.31,.25,.31),pink,body)
egg('skull',(0,0,0),(.35,.36,.32),pink,head)
egg('long-snout',(0,.33,-.10),(.26,.30,.22),pink,head)
egg('snout-disc',(0,.58,-.105),(.25,.06,.19),rose,head)
for side in [-1,1]:
 egg('eye-'+str(side),(side*.312,.175,.115),(.027,.035,.030),dark,head)
 egg('nostril-'+str(side),(side*.10,.634,-.07),(.028,.012,.026),dark,head)
ears={}
for side in [-1,1]:
 e=empty('EAR-'+str(side),head,(side*.245,-.045,.235));ears[side]=e
 # A broad fleshy triangle, with an attached tip and a deliberate rounded edge.
 vs=[(0,0,0),(side*.10,.05,0),(side*.24,-.015,.27),(side*.15,-.09,.10),(0,-.085,.02),(0,.04,.045),(side*.10,.085,.035),(side*.24,.02,.27)]
 fs=[(0,1,2,3,4),(5,6,7),(0,5,6,1),(1,6,7,2),(2,7,5,4,3),(4,5,0)]
 me=bpy.data.meshes.new('pig-ear-mesh-'+str(side));me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('ear-'+str(side),me);scene.collection.objects.link(o);o.parent=e;o.data.materials.append(pink);meshes.append(o)
 egg('ear-inner-'+str(side),(side*.105,.054,.10),(.065,.019,.08),rose,e)
legs={}
for end,y,h,L1,L2,L3 in [('fore',.62,.80,.28,.32,.32),('hind',-.64,.78,.30,.33,.30)]:
 for side in [-1,1]:
  n=f'{end}{side}';ctl=empty('LEG-'+n,root)
  upper=link(n+'-upper',L1,.115,.115,pink,ctl);middle=link(n+'-middle',L2,.080,.080,pink,ctl);lower=link(n+'-cannon',L3,.055,.055,pink,ctl)
  hoof=empty(n+'-hoof',ctl)
  for toe in [-1,1]:egg(n+'-toe'+str(toe),(toe*.043,.025,0),(.040,.105,.08),dark,hoof)
  # Small dewclaws above the primary weight-bearing pair, never treated as planted toes.
  for toe in [-1,1]:egg(n+'-dewclaw'+str(toe),(toe*.057,-.045,.13),(.025,.028,.032),dark,hoof)
  legs[n]=dict(upper=upper,middle=middle,lower=lower,hoof=hoof,hip=Vector((side*.34,y,h)),lengths=[L1,L2,L3],end=end)
tailctl=empty('TAIL-rigid-curl',body,(0,-1.10,1.35))
curve=bpy.data.curves.new('curly-tail-full-volume','CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=.032;curve.bevel_resolution=2
tail_points=[Vector((0,0,0)),Vector((0,-.14,0))]
for j in range(1,17):
 theta=2*math.pi*j/16;r=.14*(1-.40*j/16)
 tail_points.append(Vector((r*math.sin(theta),-.14-.02*theta,r*math.cos(theta)-.14)))
sp=curve.splines.new('POLY');sp.points.add(len(tail_points)-1)
for p,v in zip(sp.points,tail_points):p.co=(*v,1)
tail=bpy.data.objects.new('curly-tail',curve);scene.collection.objects.link(tail);tail.parent=tailctl;tail.data.materials.append(pink)
bpy.context.view_layer.objects.active=tail;tail.select_set(True);bpy.ops.object.convert(target='MESH');tail.select_set(False);meshes.append(tail)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='CAMERA-wildlife-v2-fixed'
cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W
cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
def key(o,f):
 o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
OFF={'hind-1':0,'fore-1':3,'hind1':6,'fore1':9}
def pose(clip,i,frame):
 body.location=(0,0,0);key(body,frame);contacts={}
 for n,l in legs.items():
  hip=l['hip'];foot=Vector((hip.x,hip.y,.08));planted=True;p=0
  if clip=='walk':
   p=(i-OFF[n])%12
   if p<=7:foot.y+=.36-.09*p
   else:
    q=(p-7)/5;foot.y+=-.36+.72*(.5-.5*math.cos(math.pi*q));foot.z+=.16*math.sin(math.pi*q);planted=False
  L1,L2,L3=l['lengths'];ankle=foot+Vector((0,(hip.y-foot.y)*.40,1)).normalized()*L3
  delta=ankle-hip;dist=delta.length
  if dist>L1+L2+1e-7:raise RuntimeError('Unreachable fixed pig leg '+n)
  unit=delta.normalized();along=(L1*L1-L2*L2+dist*dist)/(2*dist)
  perp=Vector((0,1,0));perp=(perp-unit*perp.dot(unit)).normalized()
  knee=hip+unit*along+perp*math.sqrt(max(0,L1*L1-along*along))*(1 if l['end']=='hind' else -1)
  align(l['upper'],hip,knee);align(l['middle'],knee,ankle);align(l['lower'],ankle,foot);l['hoof'].location=foot
  for o in [l['upper'],l['middle'],l['lower'],l['hoof']]:key(o,frame)
  contacts[n]=dict(hip=list(hip),knee=list(knee),ankle=list(ankle),foot=list(foot),ground=[foot.x,foot.y,0],planted=planted,lengths=[(knee-hip).length,(ankle-knee).length,(foot-ankle).length],phase=p)
 turn=[0,-.35,-.85,-.42,.42,.85,.35,0][i] if clip=='action' else 0
 for side,e in ears.items():e.rotation_euler=(turn*.25,side*turn,side*turn*.15);key(e,frame)
 tailctl.rotation_euler=(0,turn*.50,turn*.6);key(tailctl,frame)
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
CLIPS=[('idle',1,1),('walk',12,10),('action',8,35)]
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
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i,anchor=project((0,0,0)),body=project((0,-.07,1.10)),head=project((0,.94,1.17)),neck=project((0,.74,1.11)),tail=[project_world(tailctl.matrix_world@p) for p in tail_points],ears={str(side):{'base':project_world(e.matrix_world.translation),'tip':project_world(e.matrix_world@Vector((side*.24,0,.27)))} for side,e in ears.items()},contacts={n:{**c,'screen':{k:project(c[k]) for k in ['hip','knee','ankle','foot','ground']}} for n,c in contacts.items()},volumes={o.name:volume(o) for o in meshes}))
   scene.render.filepath=str(O/'guides'/f'{facing}-{clip}-{i:02}.png');bpy.ops.render.render(write_still=True)
hashes={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
G=dict(identity='piglet-draft-v1-geometry-01',species='Sus scrofa domesticus pale domestic pig',blender=bpy.app.version_string,renderer=scene.render.engine,elevationAboveGround=C['elevationAboveGroundDegrees'],polarAngleFromVertical=C['polarAngleFromVerticalDegrees'],cameraLocation=list(cam.location),cameraEuler=list(cam.rotation_euler),orthoScale=cam.data.ortho_scale,shiftY=cam.data.shift_y,canvas=[W,W],anchor=ANCHOR,pixelsPerWorldUnit=10,facings=C['modelYawDegrees'],guideSchema='bpy-projected-convex-hull-v2',meshLocalGeometrySha256=hashes,meshTopologyCounts={o.name:len(o.data.polygons) for o in meshes},limbLengths={n:l['lengths'] for n,l in legs.items()},gait='lateral four-beat pig walk, 8/12 stance samples, supports3,3,2 repeated; short stride undertracks front prints',footfallOffsets=OFF,geometryScaleAnimation=False,records=records,builderSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
for p in [S/'projected-guides.json',O/'projected-guides.json']:p.write_text(json.dumps(G,separators=(',',':')),encoding='utf8')
scene.frame_set(1);root.rotation_euler.z=math.radians(260);bpy.context.view_layer.update()
scene['anatomy']='Own stocky pale pig, long snout with nostril disc, fleshy rigid triangular ears, paired bearing toes/dewclaws, true mesh curled tail; three fixed links per short leg.'
scene['cameraContract']='wildlife-v2-camera-01, 40 degrees ABOVE GROUND, 10 world pixels/unit'
bpy.ops.wm.save_as_mainfile(filepath=str(S/'piglet.blend'))
print('PIG_BUILD_OK',len(meshes),len(records))
