"""Fresh shark and orca scenes. Rigid bodies, fixed tail links and attached rotating fins."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v2')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=96;ANCHOR=[48,72];orca=SPECIES=='orca'
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-water');body=node('BODY-rigid',root);head=node('HEAD-rigid',body,(0,1.18,1.10));jaw=node('JAW',head,(0,.02,-.15));mats={}
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
rib=egg('fusiform rib cage',(0,-.05,1.08),(.61 if orca else .46,1.70 if orca else 1.53,.65 if orca else .46),'B')
rib['surfacePaint']=True
for key in ['W','H']:rib.data.materials.append(mats[key])
for face in rib.data.polygons:face.material_index=1 if face.center.z<-.12 else 2 if face.center.z>.31 else 0
egg('back plane',(0,-.20,1.48),(.43 if orca else .33,1.25,.23),'H')
egg('blunt skull' if orca else 'tapered shark snout',(0,.11,0),(.49 if orca else .37,.69 if orca else .63,.42 if orca else .31),'B',head)
egg('lower jaw',(0,.32,-.035),(.40 if orca else .30,.47,.10),'W',jaw)
egg('mouth lining',(0,.38,.06),(.33 if orca else .26,.33,.025),'M',jaw)
if SPECIES=='hammerhead-shark':
 egg('cephalofoil',(0,.54,.02),(1.02,.25,.17),'B',head)
 for side in [-1,1]:egg(f'wide hammer eye {side}',(side*.98,.58,.06),(.055,.065,.05),'E',head)
else:
 for side in [-1,1]:egg(f'eye {side}',(side*(.45 if orca else .33),.39,.10),(.045,.06,.045),'E',head)
for side in [-1,1]:
 if orca:
  patch=egg(f'white eye patch {side}',(side*.51,.03,.18),(.04,.30,.145),'W',head);patch.rotation_euler.x=.3
  egg(f'white flank saddle {side}',(side*.56,-.84,1.28),(.045,.28,.16),'G')
 else:
  for i in range(5):egg(f'gill slit {side} {i}',(side*.445,.63-i*.09,1.11),(.025,.027,.17),'M')
 for i in range(5):
  x=side*(.06+i*.048);fin(f'lower tooth {side} {i}',[(x,.56-i*.027,.06),(x+side*.035,.54-i*.027,.06),(x+side*.015,.55-i*.027,.15)],.025,'T',jaw,axis='y')
fin('dorsal fin',[(0,.14,1.40),(0,-.58,1.43),(0,-.75,1.54),(0,-.28,2.56 if orca else 2.18),(0,-.13,2.40 if orca else 2.05)],.10 if orca else .065,'B',body)
if not orca:fin('second dorsal fin',[(0,-1.23,1.32),(0,-1.62,1.22),(0,-1.41,1.65)],.045,'B',body)
fins=[]
for side in [-1,1]:
 pivot=node(f'PECTORAL-{side}',body,(side*.37,.61,1.00));outline=[(0,.13,.08),(side*1.10,-.72,-.25),(side*.79,-.94,-.26),(side*.19,-.43,-.13),(0,-.28,-.03)];fin(f'pectoral flipper {side}',outline,.065,'B',pivot,axis='z');fins.append(pivot)
 if not orca:fin(f'pelvic fin {side}',[(side*.27,-.89,.86),(side*.65,-1.48,.72),(side*.16,-1.34,.85)],.035,'B',body,axis='z')
tail_lengths=P['tailLengths'];tail=[];joints=[]
for i in range(4):joints.append(node(f'TAIL-joint-{i}',root))
def align(o,a,b):
 z=(b-a).normalized();x=Vector((1,0,0));x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q;o.location=(a+b)/2
for i,L in enumerate(tail_lengths):
 r0=(.33 if orca else .27)*(1-i*.27);r1=(.33 if orca else .27)*(1-(i+1)*.27);vs=[]
 for z,r in [(-L/2,r0),(L/2,r1)]:
  for k in range(12):vs.append((r*math.cos(k*math.tau/12),r*math.sin(k*math.tau/12),z))
 fs=[tuple(reversed(range(12))),tuple(range(12,24))]+[(k,(k+1)%12,(k+1)%12+12,k+12) for k in range(12)];o=poly(f'TAIL-link-{i}',vs,fs,'B',root);tail.append(o)
fluke=node('FLUKE',root)
if orca:
 for side in [-1,1]:fin(f'horizontal fluke {side}',[(0,.10,0),(side*1.05,-.30,.02),(side*.92,-.58,.02),(side*.20,-.42,0),(0,-.27,0)],.07,'B',fluke,axis='z')
else:
 fin('vertical heterocercal tail',[(0,.05,0),(0,-.66,1.01),(0,-.73,.90),(0,-.47,.09),(0,-.61,-.64),(0,-.44,-.62),(0,-.12,-.20)],.055,'B',fluke)
def pose(t,clip):
 moving=clip in ['swim','chase'];active=clip!='idle';amp=(.27 if clip=='chase' else .20) if moving else .11 if active else 0;phase=t*math.tau
 body.location.z=(.10 if moving else .045 if active else 0)*math.sin(phase);body.rotation_euler.x=.035*math.sin(phase+.5) if moving else 0;body.rotation_euler.z=.025*math.sin(phase) if moving and not orca else 0
 jaw.rotation_euler.x=-((.18+.20*(1-math.cos(phase))/2) if clip=='feed' else .34*(1-math.cos(phase))/2 if clip=='display' else 0)
 for side,o in zip([-1,1],fins):o.rotation_euler.y=side*.10*math.sin(phase+.8) if active else 0
 bpy.context.view_layer.update();ps=[body.matrix_local@Vector((0,-1.30,1.03))]
 for i,L in enumerate(tail_lengths):
  angle=amp*math.sin(phase-i*.65);v=Vector((0,-math.cos(angle),math.sin(angle))) if orca else Vector((math.sin(angle),-math.cos(angle),0));v=body.matrix_local.to_3x3()@v;ps.append(ps[-1]+v*L)
 for o,a,b in zip(tail,ps,ps[1:]):align(o,a,b)
 for o,p in zip(joints,ps):o.location=p
 fluke.location=ps[-1];v=ps[-1]-ps[-2];fluke.rotation_euler=(math.atan2(-v.z,-v.y),0,0) if orca else (0,0,math.atan2(v.x,-v.y));bpy.context.view_layer.update()
animated=[body,jaw,fluke,*tail,*joints,*fins];clips=[('idle',1,1,1),('swim',10,32,4),('feed',160,8,10),('display',260,8,10),('chase',360,32,4)]
for clip,start,count,step in clips:
 for i in range(count*2+1):
  pose(i/(count*2),clip);frame=start+i*step/2
  for o in animated:o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=134
scene['motionIdentity']=f'{SPECIES}-roster-v2';scene['tailLengths']=json.dumps(tail_lengths);scene['tailRoot']=json.dumps([0,-1.30,1.03]);scene['finPivots']=json.dumps([list(o.location) for o in fins]);scene['motionClips']=json.dumps(clips);scene['bodyMotion']='rigid body heave/pitch, fixed linked tail, attached rotating fins; no scaling';scene.timeline_markers.new('SWIM',frame=10);scene.timeline_markers.new('FEED',frame=160);scene.timeline_markers.new('DISPLAY',frame=260);scene.timeline_markers.new('CHASE',frame=360);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
def project(p):
 v=world_to_camera_view(scene,cam,p);return [v.x*W,(1-v.y)*W,v.z]
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
   scene.frame_set(start+i*step);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();volumes=[]
   for original in meshes:
    o=original.evaluated_get(dg);ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
    if o.get('surfacePaint'):
     view=(cam.matrix_world.translation-o.matrix_world.translation).normalized()
     for face in o.data.polygons:
      if (o.matrix_world.to_3x3()@face.normal).dot(view)<=0:continue
      fp=[ps[v] for v in face.vertices];volumes.append(dict(name=o.name,key=o.data.materials[face.material_index]['paintKey'],depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   records.append(dict(facing=facing,clip=clip,index=i,body=project(body.evaluated_get(dg).matrix_world@Vector((0,0,1.08))),volumes=volumes))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v2',canvas=W,anchor=ANCHOR,palette=P['palette'],frameDurationMs=P['swimMs'],chaseMs=P['chaseMs'],speed=P['speed'],records=records),separators=(',',':')),encoding='utf8');print('OCEAN_SOURCE_OK',len(records))
