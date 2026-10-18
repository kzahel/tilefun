"""Fresh octopus: mantle, paired eyes, siphon and eight independently chained arms."""
import os
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/'public/demos/wildlife-v2/octopus/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard'
def node(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
def mat(name,color,key):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m['paintKey']=key;return m
red=mat('rust red mantle',(.65,.27,.22),'B');light=mat('mantle upper planes',(.84,.47,.32),'H');dark=mat('deep arm shadow',(.37,.16,.17),'K');cream=mat('sucker skin',(.97,.71,.45),'C');white=mat('eye gold',(.92,.76,.44),'E');black=mat('slit pupils',(.10,.16,.15),'P')
root=node('ROOT-water');body=node('BODY-rigid',root);arms={};W=48;ANCHOR=[24,35]
def egg(name,loc,radii,m,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=name;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(m);o['paintGroup']=group;return o
egg('rounded mantle',(0,-.15,1.45),(.48,.58,.68),red);egg('mantle upper plane',(-.08,-.19,1.68),(.38,.47,.35),light);egg('arm crown',(0,.15,.90),(.45,.40,.30),red)
for side in [-1,1]:
 egg(f'eye bulge {side}',(side*.39,.31,1.18),(.13,.18,.14),light);egg(f'golden eye {side}',(side*.46,.37,1.18),(.065,.12,.09),white);egg(f'slit pupil {side}',(side*.49,.415,1.18),(.026,.066,.022),black)
egg('siphon',(0,.47,.94),(.10,.18,.09),dark)
def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((0,0,1));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
Ls=[.30,.28,.25,.22,.19]
for i in range(8):
 angle=i*math.pi/4;rest=Vector((math.sin(angle)*.27,math.cos(angle)*.27+.12,.86));name=f'arm{i}';joints=[node(f'{name}-joint-{j}',root) for j in range(6)];links=[];suckers=[]
 for j,L in enumerate(Ls):
  radius=.11-j*.018;o=egg(f'{name}-link-{j}',(0,0,0),(radius,radius,L/2),red,root,'limb');links.append(o)
  sucker=egg(f'{name}-sucker-{j}',(0,-radius*.8,0),(.045,.035,.045),cream,o,'sucker');suckers.append(sucker)
 arms[name]=dict(angle=angle,rest=rest,joints=joints,links=links,suckers=suckers)
def pose(t,clip):
 moving=clip=='jet';action=clip=='action';a=math.sin(math.pi*t)**2 if action else 0
 body.location=(.025*math.sin(2*math.pi*t) if moving else 0,.045*math.cos(2*math.pi*t) if moving else 0,.18*math.sin(2*math.pi*t) if moving else .04*a)
 body.rotation_euler.x=(.07*math.sin(2*math.pi*t) if moving else -.08*a);bpy.context.view_layer.update()
 for i,(name,arm) in enumerate(arms.items()):
  phase=2*math.pi*t+i*.55;theta=arm['angle'];pts=[body.matrix_local@arm['rest']]
  for j,L in enumerate(Ls):
   bend=.42+.14*j+(.18*math.sin(phase-j*.7) if moving else .05*math.sin(phase-j*.7)*a)+.35*a*j/4
   azimuth=theta+(.13*math.sin(phase-j*.4) if moving else .20*a*j/4)
   d=Vector((math.sin(azimuth)*math.cos(bend),math.cos(azimuth)*math.cos(bend),-math.sin(bend)))
   pts.append(pts[-1]+d*L)
  for o,p,q in zip(arm['links'],pts,pts[1:]):align(o,p,q)
  for o,p in zip(arm['joints'],pts):o.location=p
 bpy.context.view_layer.update()
animated=[body]+[o for a in arms.values() for o in a['joints']+a['links']]
clips=[('idle',1,1,1),('jet',10,32,3),('action',120,8,10)]
for clip,start,count,step in clips:
 for i in range(count*2+1):
  pose(i/(count*2),clip)
  for o in animated:
   f=start+i*step/2;o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=103
scene['motionIdentity']='octopus-roster-v2';scene['armLengths']=json.dumps(Ls);scene['armRest']=json.dumps({n:list(a['rest']) for n,a in arms.items()});scene.timeline_markers.new('JET - eight flowing arms',frame=10);scene.timeline_markers.new('CURL - feeding posture',frame=120);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/'octopus.blend'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
def point(o,p=(0,0,0)):return project(o.matrix_world@Vector(p))
def volumes(groups):
 return {o.name:dict(group=o['paintGroup'],key=o.data.materials[0]['paintKey'],points=[project(o.matrix_world@v.co) for v in o.data.vertices],depth=point(o)[2]) for o in scene.objects if o.type=='MESH' and o.get('paintGroup') in groups}
def basis():
 anchor=Vector((0,-.15,1.45));a=point(body,anchor);v=Vector((0,1,0) if facing in ['left','right'] else (1,0,0));b=point(body,anchor+v);c=point(body,anchor+Vector((0,0,1)));return [[b[0]-a[0],c[0]-a[0]],[b[1]-a[1],c[1]-a[1]]]
records=[];refs={}
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);scene.frame_set(1);pose(0,'idle');refs[facing]=dict(volumes=volumes(['body']),body=point(body,(0,-.15,1.45)),bodyBasis=basis())
 for clip,start,count,step in clips:
  for i in range(count):
   scene.frame_set(start+i*step);pose(i/count,clip);records.append(dict(facing=facing,clip=clip,index=i,body=point(body,(0,-.15,1.45)),bodyBasis=basis(),arms={n:[point(o) for o in a['joints']] for n,a in arms.items()},suckers={n:[point(o) for o in a['suckers']] for n,a in arms.items()}))
(S/'projection.json').write_text(json.dumps(dict(identity='octopus-roster-v2',canvas=W,anchor=ANCHOR,frameDurationMs=30,references=refs,records=records),separators=(',',':')),encoding='utf8');print('OCTOPUS_SOURCE_OK',len(records))
