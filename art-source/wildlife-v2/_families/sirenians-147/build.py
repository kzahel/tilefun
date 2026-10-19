"""Fresh marine scenes. Rigid bodies, fixed tail links and attached rotating flippers."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v3')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=P['canvas'];ANCHOR=P.get('anchor',[W//2,W*3//4]);orca=P['tailPlane']=='horizontal'
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-water');body=node('BODY-rigid',root);head=node('HEAD-rigid',body,P['headPosition']);jaw=node('JAW',head,(0,.02,-.15));mats={}
for k,c in P['palette'].items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*[v/255 for v in bytes.fromhex(c[1:])],1);m['paintKey']=k;mats[k]=m
def egg(n,loc,radii,key,parent=body):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);return o
def poly(n,vs,fs,key,parent):
 centre=sum((Vector(v) for v in vs),Vector())/len(vs);m=bpy.data.meshes.new(n);m.from_pydata([tuple(Vector(v)-centre) for v in vs],[],fs);m.update();o=bpy.data.objects.new(n,m);scene.collection.objects.link(o);o.parent=parent;o.location=centre;o.data.materials.append(mats[key]);return o
def fin(n,outline,thickness,key,parent,axis='x'):
 vs=[]
 for sign in [-1,1]:
  for p in outline:
   v=Vector(p);v['xyz'.index(axis)]+=sign*thickness/2;vs.append(tuple(v))
 N=len(outline);fs=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)];return poly(n,vs,fs,key,parent)
exec((FAMILY/'geometry.py').read_text(encoding='utf8'))
tail_lengths=P['tailLengths'];tail=[];joints=[]
for i in range(4):joints.append(node(f'TAIL-joint-{i}',root))
def align(o,a,b):
 z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q;o.location=(a+b)/2
for i,L in enumerate(tail_lengths):
 r0=P['tailRadius']*(1-i*.27);r1=P['tailRadius']*(1-(i+1)*.27);vs=[]
 for z,r in [(-L/2,r0),(L/2,r1)]:
  for k in range(12):vs.append((r*math.cos(k*math.tau/12),r*math.sin(k*math.tau/12),z))
 fs=[tuple(reversed(range(12))),tuple(range(12,24))]+[(k,(k+1)%12,(k+1)%12+12,k+12) for k in range(12)];o=poly(f'TAIL-link-{i}',vs,fs,'B',root);tail.append(o)
fluke=node('FLUKE',root)
if P['tailShape']=='paddle':
 egg('rounded paddle tail',(0,-.37,0),(.55,.55,.075),'B',fluke)
elif orca:
 for side in [-1,1]:fin(f'horizontal fluke {side}',[(0,.10,0),(side*P['flukeWidth'],-.30,.02),(side*P['flukeWidth']*.87,-.58,.02),(side*.20,-.42,0),(0,-.27,0)],.07,'B',fluke,axis='z')
elif P['tailPlane']=='vertical':
 fin('vertical heterocercal tail',[(0,.05,0),(0,-.66,1.14),(0,-.76,1.03),(0,-.47,.09),(0,-.61,-.74),(0,-.44,-.72),(0,-.12,-.20)],.055,'B',fluke)
else:fin('short turtle tail',[(0,.02,0),(-.06,-.05,0),(0,-.18,0),(.06,-.05,0)],.035,'B',fluke,axis='z')

def pose(t,clip):
 moving=clip in ['swim','chase'];active=clip!='idle';amp=(.27 if clip=='chase' else .20) if moving else .11 if active else 0;phase=t*math.tau
 body.location.z=(P.get('heave',.10) if moving else .045 if active else 0)*math.sin(phase);body.rotation_euler.x=.035*math.sin(phase+.5) if moving else 0;body.rotation_euler.z=.025*math.sin(phase) if moving and not orca else 0
 jaw.rotation_euler.x=-((.18+.20*(1-math.cos(phase))/2) if clip=='feed' else .34*(1-math.cos(phase))/2 if clip=='display' else 0)
 for i,o in enumerate(fins):o.rotation_euler.y=o['side']*(.42 if SPECIES=='sea-turtle' else .16)*math.sin(phase+.8+i*.4) if active else 0
 bpy.context.view_layer.update();ps=[body.matrix_local@Vector(P['tailRoot'])]
 for i,L in enumerate(tail_lengths):
  angle=amp*math.sin(phase-i*.65);v=Vector((0,-math.cos(angle),math.sin(angle))) if orca else Vector((math.sin(angle),-math.cos(angle),0));v=body.matrix_local.to_3x3()@v;ps.append(ps[-1]+v*L)
 for o,a,b in zip(tail,ps,ps[1:]):align(o,a,b)
 for o,p in zip(joints,ps):o.location=p
 fluke.location=ps[-1];v=ps[-1]-ps[-2];fluke.rotation_euler=(math.atan2(-v.z,-v.y),0,0) if orca else (0,0,math.atan2(v.x,-v.y));bpy.context.view_layer.update()
animated=[body,jaw,fluke,*tail,*joints,*fins];clips=[('idle',1,1,1),('swim',10,32,P['swimMs']/10),('feed',240,8,10)]+([] if P['fauna'] else [('display',340,8,10),('chase',440,32,P['chaseMs']/10)])
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
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=int(10+32*P['swimMs']/10-1)
scene['motionIdentity']=f'{SPECIES}-roster-v3';scene['tailLengths']=json.dumps(tail_lengths);scene['tailRoot']=json.dumps(P['tailRoot']);scene['bodyAnchor']=json.dumps(P['bodyCenter']);scene['finNames']=json.dumps([o.name for o in fins]);scene['finPivots']=json.dumps([list(o.location) for o in fins]);scene['motionClips']=json.dumps(clips);scene['bodyMotion']='rigid body heave/pitch, fixed linked tail, attached rotating fins; no scaling';scene.timeline_markers.new('SWIM',frame=10);scene.timeline_markers.new('FEED',frame=240);scene.timeline_markers.new('DISPLAY',frame=340);scene.timeline_markers.new('CHASE',frame=440);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
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
      fp=[ps[v] for v in face.vertices];volumes.append(dict(name=o.name,key=o.data.materials[face.material_index]['paintKey'],depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   records.append(dict(facing=facing,clip=clip,index=i,body=project(body.evaluated_get(dg).matrix_world@Vector(P['bodyCenter'])),volumes=volumes))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v3',canvas=W,anchor=ANCHOR,palette=P['palette'],frameDurationMs=P['swimMs'],chaseMs=P['chaseMs'],speed=P['speed'],fauna=P['fauna'],records=records),separators=(',',':')),encoding='utf8');print('MARINE_SOURCE_OK',len(records))
