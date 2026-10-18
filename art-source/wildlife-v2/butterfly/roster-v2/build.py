"""Fresh monarch-like butterfly: fixed wing panels and editable painted mesh patches.
No previous butterfly sources or pixels are read. Camera is the shared 40-degree contract.
"""
import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=ROOT/'public/demos/wildlife-v2/butterfly/roster-v2';O.mkdir(parents=True,exist_ok=True)
assert not (S/'receipt.json').exists(),'Registered bank is immutable'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.display.shading.light='STUDIO';scene.display.shading.show_shadows=False;scene.view_settings.view_transform='Standard';scene.render.film_transparent=True
W=32;ANCHOR=[16,24];C=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())
def mat(name,color,key):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m['paintKey']=key;return m
ink=mat('dark wing borders veins body',(.16,.16,.13),'K');orange=mat('orange wing cells',(.83,.43,.12),'O');light=mat('warm dorsal cells',(.96,.66,.27),'H');cream=mat('cream marginal spots',(.91,.85,.65),'C')
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('ROOT-fixed-ground');body=empty('BODY-flight',root,(0,0,.14))
def mesh(name,vertices,faces,material,parent):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(material);return o

def egg(name,loc,radii,material,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(material);return o

def segment(name,a,b,radius,parent):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=radius,depth=(b-a).length);o=bpy.context.object;o.name=name;o.parent=parent;o.location=(a+b)/2;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(ink);return o

egg('slim abdomen',(0,-.095,0),(.04,.17,.04),ink,body);egg('thorax',(0,.09,.015),(.055,.085,.055),ink,body);egg('small head',(0,.20,.025),(.055,.05,.045),ink,body)
leg_rigs=[]
for side in [-1,1]:
 segment(f'antenna {side} stem',(side*.025,.22,.05),(side*.075,.32,.13),.009,body);egg(f'antenna {side} club',(side*.075,.32,.13),(.016,.019,.016),ink,body)
 for j,y in enumerate([-.075,.025,.115]):
  rig=empty(f'LEG-{side}-{j}',body,(side*.025,y,-.015));rig['side']=side;leg_rigs.append(rig)
  segment(f'foldable leg {side} {j}',(0,0,0),(side*.085,.025,-.115),.009,rig)
  egg(f'foot {side} {j}',(side*.085,.025,-.115),(.016,.02,.01),ink,rig)
wing_rigs=[]
fore=[(.025,.09),(.14,.35),(.35,.48),(.52,.42),(.60,.25),(.48,.07),(.20,-.02)]
fore_orange=[(.10,.10),(.19,.30),(.35,.40),(.46,.35),(.50,.24),(.41,.11),(.22,.04)]
hind=[(.02,.04),(.16,.08),(.37,-.02),(.41,-.16),(.28,-.32),(.09,-.29),(.02,-.12)]
hind_orange=[(.07,-.03),(.16,.02),(.30,-.05),(.33,-.15),(.24,-.24),(.12,-.22)]
def patch(name,points,side,z,material,parent):
 verts=[(side*x,y,z) for x,y in points];o=mesh(name,verts,[tuple(range(len(verts)))],material,parent);o['wing']=parent.name;o['surface']=1 if z>0 else -1;o['layer']=4 if 'spot' in name else 3 if 'vein' in name else 2 if 'warm upper' in name else 1 if 'orange' in name else 0;return o
for side in [-1,1]:
 for label,outline,inset in [('fore',fore,fore_orange),('hind',hind,hind_orange)]:
  rig=empty(f'WING-{label}-{side}',body);rig['side']=side;wing_rigs.append(rig)
  for surface in [-1,1]:
   patch(f'{label} {side} border {surface}',outline,side,surface*.001,ink,rig)
   patch(f'{label} {side} orange {surface}',inset,side,surface*.003,orange,rig)
   # The underside keeps the same monarch-like orange/cream identity.
   if label=='fore':
    patch(f'{label} {side} warm upper cell {surface}',[(.20,.29),(.34,.38),(.40,.32),(.28,.22)],side,surface*.004,light,rig)
    spots=[(.33,.435),(.475,.36),(.54,.25)]
    for j,target in enumerate([(.22,.36),(.43,.32),(.47,.20)]):
     a=Vector((.095,.09));b=Vector(target);n=Vector((-(b-a).y,(b-a).x)).normalized()*.007
     patch(f'{label} {side} vein {surface} {j}',[a-n,a+n,b+n,b-n],side,surface*.006,ink,rig)
   else:spots=[(.28,-.26),(.36,-.15)]
   for j,(x,y) in enumerate(spots):
    ps=[(x+.022*math.cos(k*math.tau/8),y+.022*math.sin(k*math.tau/8)) for k in range(8)]
    patch(f'{label} {side} cream spot {surface} {j}',ps,side,surface*.007,cream,rig)
proboscis=empty('PROBOSCIS',body,(0,.235,-.015))
proboscis_links=[segment(f'proboscis {j}',(0,j*.035,0),(0,(j+1)*.035,0),.008,proboscis) for j in range(3)]
def pose(t,clip):
 moving=clip=='flutter';body.location=(0,0,.14+.025*math.sin(4*math.pi*t) if moving else .14);body.rotation_euler=(.06*math.sin(4*math.pi*t) if moving else 0,0,0)
 for rig in wing_rigs:
  angle=.78+.52*math.cos(4*math.pi*t+math.acos(-.03/.52)) if moving else .75+(.18*math.sin(2*math.pi*t) if clip=='action' else 0)
  if 'hind' in rig.name:angle+=.08*math.sin(4*math.pi*t-.30) if moving else 0
  rig.rotation_euler=(0,-int(rig['side'])*angle,0)
 for rig in leg_rigs:rig.rotation_euler.y=-int(rig['side'])*(.9*math.sin(math.pi*t)**.4 if moving and 0<t<1 else 0)
 amount=math.sin(math.pi*t)**2 if clip=='action' else 0;start=Vector((0,0,0))
 for j,obj in enumerate(proboscis_links):
  angle=math.radians((-70-j*90)*(1-amount)+(-20-j*20)*amount)
  end=start+Vector((0,math.cos(angle),math.sin(angle)))*.035
  obj.location=(start+end)/2;obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler();start=end
 bpy.context.view_layer.update()
def key(obj,frame):obj.keyframe_insert('location',frame=frame);obj.keyframe_insert('rotation_euler',frame=frame)
animated=[body,proboscis]+wing_rigs+leg_rigs+proboscis_links
clips=[('idle',1,1,1),('flutter',10,32,2),('action',100,8,10)]
for clip,start,count,step in clips:
 for i in range(count+1):
  pose(i/count,clip)
  for obj in animated:key(obj,start+i*step)
for obj in animated:
 for layer in obj.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for kp in fc.keyframe_points:kp.interpolation='LINEAR'
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=C['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.fps_base=1;scene.frame_start=10;scene.frame_end=72
scene['motionIdentity']='butterfly-roster-v2';scene['wingRigNames']=json.dumps([o.name for o in wing_rigs]);scene['paintContract']='Independently editable fixed colored wing cells, veins and marginal spots; no render quantization';scene['worldMotion']='Shared bounded airborne arc, push .04s, landing .60s, height 6px, total .64s'
scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/'butterfly.blend'))
meshes=[o for o in scene.objects if o.type=='MESH']
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def hull(ps):
 ps=sorted(set((p[0],p[1]) for p in ps));lo=[];hi=[]
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 for p in ps:
  while len(lo)>1 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(ps):
  while len(hi)>1 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
records=[]
for facing,yaw in C['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);pose(i/count,clip);dg=bpy.context.evaluated_depsgraph_get();volumes={}
   for obj in meshes:
    e=obj.evaluated_get(dg);points=[project(e.matrix_world@v.co) for v in obj.data.vertices];volumes[obj.name]=dict(points=hull(points),key=obj.data.materials[0]['paintKey'],depth=sum(p[2] for p in points)/len(points),wing=obj.get('wing'),surface=obj.get('surface'),layer=obj.get('layer'))
   wingFront={rig.name:1 if project(rig.matrix_world@Vector((0,0,.01)))[2]<project(rig.matrix_world@Vector((0,0,-.01)))[2] else -1 for rig in wing_rigs}
   wingDepth={rig.name:project(rig.matrix_world@Vector((.3*int(rig['side']),.23 if 'fore' in rig.name else -.12,0)))[2] for rig in wing_rigs}
   records.append(dict(facing=facing,clip=clip,index=i,frame=start+i*step,volumes=volumes,wingFront=wingFront,wingDepth=wingDepth))
(S/'projection.json').write_text(json.dumps(dict(identity='butterfly-roster-v2',canvas=W,anchor=ANCHOR,frameDurationMs=20,records=records),separators=(',',':')),encoding='utf8')
print('BUTTERFLY_SOURCE_OK',len(records),len(meshes))
