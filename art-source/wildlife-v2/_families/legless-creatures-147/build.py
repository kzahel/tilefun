"""Original rigid segment chains; editable closed anatomy and saved source clocks."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text())[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v3')))
assert not (S/'receipt.json').exists()
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=P['canvas'];ANCHOR=P['anchor']
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-legless');rest=Vector(P['head']);rest.z=P['radius']*1.12 if P['ground'] else rest.z;body=node('BODY-rigid',root,rest);head=node('HEAD-rigid',body);jaw=node('JAW',head,(0,.10,-.02 if SPECIES=='gaboon-viper' else -.06));mats={}
for k,color in P['palette'].items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*[v/255 for v in bytes.fromhex(color[1:])],1);m['paintKey']=k;mats[k]=m
def egg(n,loc,radii,key,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
def poly(n,vs,fs,key,parent=body,group='body'):
 m=bpy.data.meshes.new(n);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(n,m);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
def rod(n,a,b,r,key,parent=body,group='body'):
 a,b=Vector(a),Vector(b);L=(b-a).length;o=egg(n,(a+b)/2,(r,r,L/2),key,parent,group);o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return o
parts=[];joints=[node(f'chain-joint-{i}',root) for i in range(P['count']+1)];bulbs=[];Ls=[P['length']]*P['count'];radii=[]
for i,L in enumerate(Ls):
 r=P['radius']*(1-.72*(i/(P['count']-1))**3);radii.append(r);parts.append(egg(f'chain-link-{i}',(0,0,0),(r,r,L/2),'B',root,'body'));bulbs.append(egg(f'chain-overlap-{i}',(0,0,0),(r,r,r),'B',root,'body'))
exec((FAMILY/'geometry.py').read_text(encoding='utf8'))
def align(o,a,b):
 z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q;o.location=(a+b)/2
def pose(t,clip):
 moving=clip in ['walk','chase'];phase=math.tau*t;amount=math.sin(math.pi*t)**2 if clip in ['feed','display'] else 0
 body.location=rest+Vector((.24*math.cos(phase) if moving else .03*amount,.24*math.sin(phase) if moving else -.05*amount,.10*math.sin(phase) if moving and not P['ground'] else 0));head.rotation_euler.x=(.12 if SPECIES=='gaboon-viper' else -.18)*amount if clip=='feed' else .12*amount if clip=='display' else 0;jaw.rotation_euler.x=(-.40 if SPECIES=='gaboon-viper' else -.55)*amount if P['hunter'] else -.18*amount
 bpy.context.view_layer.update();ps=[body.matrix_local@Vector((0,-.12,0))]
 for i,L in enumerate(Ls):
  a=.38*math.sin(phase-i*.43) if moving else .10*math.sin(i*.43)+.12*amount*math.sin(i*.35);v=Vector((math.sin(a),-math.cos(a),.06*math.sin(phase-i*.40) if moving and not P['ground'] else 0)).normalized();ps.append(ps[-1]+v*L)
 for o,a,b in zip(parts,ps,ps[1:]):align(o,a,b)
 for o,p in zip(joints,ps):o.location=p
 for o,p in zip(bulbs,ps):o.location=p
 for i,o in enumerate(stalks):o.rotation_euler.y=(1 if i%2 else -1)*.15*amount
 bpy.context.view_layer.update()
animated=[body,head,jaw]+parts+joints+bulbs+stalks
clips=[('idle',1,1,1),('walk',10,32,P['walkMs']/10),('feed',240,8,10)]
if P['hunter']:clips += [('display',340,8,10),('chase',440,32,P['chaseMs']/10)]
for clip,start,count,step in clips:
 for i in range(count*4+1):
  pose(i/(count*4),clip);frame=start+i*step/4
  for o in animated:o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=round(10+32*P['walkMs']/10)-1
scene['motionClips']=json.dumps(clips);scene['chainLengths']=json.dumps(Ls);scene['ground']=P['ground'];scene['sourceSpeed']=P['speed'];scene['sourceChaseSpeed']=P['chaseSpeed'];scene['bodyRoot']=json.dumps(list(rest));scene['sourceMotionName']=P['motion'];scene['motionIdentity']=f'{SPECIES}-roster-v3';scene.timeline_markers.new(P['motion'].upper(),frame=10);scene.timeline_markers.new('FEED',frame=240)
if P['hunter']:scene.timeline_markers.new('DISPLAY',frame=340);scene.timeline_markers.new('CHASE',frame=440)
scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
# The camera is orthographic and fixed across poses; cache its view transform.
bpy.context.view_layer.update();camera_inverse=cam.matrix_world.normalized().inverted();camera_frame=cam.data.view_frame(scene=scene);camera_bounds=(camera_frame[2].x,camera_frame[1].x,camera_frame[1].y,camera_frame[0].y);projection_probes=0
assert cam.data.type=='ORTHO'
def project(p):
 global projection_probes
 local=camera_inverse@p;x0,x1,y0,y1=camera_bounds;v=Vector(((local.x-x0)/(x1-x0),(local.y-y0)/(y1-y0),-local.z))
 if projection_probes<32:
  expected=world_to_camera_view(scene,cam,p);assert (v-expected).length<1e-6;projection_probes+=1
 return [v.x*W,(1-v.y)*W,v.z]

def hull(ps):
 points=sorted(set((round(p[0],5),round(p[1],5)) for p in ps));cross=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);lo=[];hi=[]
 for p in points:
  while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 for p in reversed(points):
  while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
records=[];meshes=[o for o in scene.objects if o.type=='MESH']
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in clips:
  for i in range(count):
   sample=start+i*step;scene.frame_set(math.floor(sample),subframe=sample%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();volumes=[]
   for original in meshes:
    o=original.evaluated_get(dg);ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
    if o.get('surfacePaint'):
     view=(cam.matrix_world.translation-o.matrix_world.translation).normalized()
     for face in o.data.polygons:
      if (o.matrix_world.to_3x3()@face.normal).dot(view)<=0:continue
      fp=[ps[v] for v in face.vertices];volumes.append(dict(name=o.name,group=o.get('paintGroup'),key=o.data.materials[face.material_index]['paintKey'],depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,group=o.get('paintGroup'),key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   records.append(dict(facing=facing,clip=clip,index=i,body=project(body.evaluated_get(dg).matrix_world@Vector(P['torso'])),volumes=volumes))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v3',canvas=W,anchor=ANCHOR,palette=P['palette'],frameDurationMs=P['walkMs'],chaseMs=P['chaseMs'],fauna=not P['hunter'],motionClip=P['motion'],speed=P['speed'],chaseSpeed=P['chaseSpeed'],strideWorldUnits=P['speed']*32*P['walkMs']/1000/10,records=records),separators=(',',':')),encoding='utf8');print('SMALL_MAMMAL_SOURCE_OK',SPECIES,len(records))
