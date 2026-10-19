"""Fresh short-flight bats. Two planted/tucking legs and articulated membrane wings."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v3')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=P['canvas'];ANCHOR=P.get('anchor',[W//2,W*3//4])
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-ground');body=node('BODY-flight',root);head=node('HEAD-rigid',body,(0,P['headY'],P['headZ']));jaw=node('JAW',head,(0,.08,-.04));mats={}
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
def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,1,0)).normalized();x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
legs={}
for side in [-1,1]:
 for i,y in enumerate([P['hipY']]):
  n=f'LEG-{side}-{i}';Ls=P['hindLengths'] if i==2 else P['legLengths'];rest=Vector((side*P['hipX'],y,P['bodyZ']-.20));links=[egg(f'{n}-link-{j}',(0,0,0),(.035,.035,L/2),'K',root) for j,L in enumerate(Ls)];joints=[node(f'{n}-joint-{j}',root) for j in range(4)];foot=egg(f'{n}-foot',(0,0,0),(.045,.10,.025),'K',root);legs[n]=dict(side=side,index=i,rest=rest,lengths=Ls,links=links,joints=joints,foot=foot)
antennae={}
for n,l in legs.items():
 for j in range(5):egg(f'{n}-toe-{j}',((j-2)*.025,.09,-.005),(.022,.075,.02),'T',l['foot'])

 if P['webbedFeet']:fin(f'{n}-webbed-foot',[(-.09,.04,-.005),(.09,.04,-.005),(.12,.19,-.005),(-.12,.19,-.005)],.025,'T',l['foot'],axis='z')

tailLs=[.16,.16,.16,.16,.16] if SPECIES=='dragonfly' else [];tail=[egg(f'TAIL-link-{i}',(0,0,0),(.050-i*.006,.050-i*.006,L/2),'B' if i%2==0 else 'H',root) for i,L in enumerate(tailLs)];tailj=[node(f'TAIL-joint-{i}',root) for i in range(len(tailLs)+1)] if tailLs else []
def pose(t,clip):
 moving=clip==P['motionClip'];amount=math.sin(math.pi*t)**2 if clip=='action' else 0;elapsed=t*P['hop']['duration'];air=max(0,min(1,(elapsed-P['hop']['push'])/(P['hop']['land']-P['hop']['push'])));fold=math.sin(math.pi*air)**.6 if moving and 0<air<1 else 0;phase=math.tau*t
 body.location.z=(-.025*math.sin(math.pi*elapsed/P['hop']['push']) if elapsed<P['hop']['push'] else .025*math.sin(2*phase)*fold) if moving else -.015*amount;body.rotation_euler=(.03*math.sin(phase)*fold if moving else 0,.018*math.sin(phase)*fold if moving else 0,0);head.rotation_euler.x=-.25*amount;jaw.rotation_euler.x=-.28*amount
 for pivot,L,rest in wings:
  side=pivot['side'];pair=pivot['pair'];stroke=.20+.70*math.sin(phase*P["flapCycles"]);pivot.rotation_euler=(0,-side*fold*stroke if pair==0 else 0,-side*.90*(1-fold))
 for pivot in covers:pivot.rotation_euler.y=-pivot['side']*1.15*fold
 for pivot in mandibles:pivot.rotation_euler.z=-pivot['side']*.48*amount
 bpy.context.view_layer.update()
 for n,l in legs.items():
  side=l['side'];i=l['index'];hip=body.matrix_local@l['rest'];rest=Vector((side*(P['hindFootX'] if i==2 else P['footX']),l['rest'].y,.025));air=body.matrix_local@Vector((l['rest'].x+side*.10,l['rest'].y-.025,P['bodyZ']-.09));foot=rest.lerp(air,fold);L1,L2,L3=l['lengths'];flex=.55+1.65*fold;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=foot-hip;d=delta.length;u=delta.normalized();assert abs(L1-chord)<d<L1+chord,(SPECIES,clip,t,n,d,L1+chord);a=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a));v=foot-elbow;d=v.length;u=v.normalized();a=(L2*L2-L3*L3+d*d)/(2*d);pole=hip-elbow;pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a));ps=[hip,elbow,knee,foot]
  for o,a,b in zip(l['links'],ps,ps[1:]):align(o,a,b)
  for o,v in zip(l['joints'],ps):o.location=v
  l['foot'].location=foot
 for n,l in antennae.items():
  side=l['side'];ps=[head.matrix_world.translation.copy()];ps[0]=body.matrix_local@head.matrix_local@Vector((side*P['headRadii'][0]*.55,.05,.06))
  for j,L in enumerate(l['lengths']):
   angle=side*(.30+.18*math.sin(phase+j*.4)*amount);direction=Vector((math.sin(angle),.70,.45-j*.1)).normalized();ps.append(ps[-1]+direction*L)
  for o,a,b in zip(l['links'],ps,ps[1:]):align(o,a,b)
  for o,v in zip(l['joints'],ps):o.location=v
 if tailLs:
  ps=[body.matrix_local@Vector((0,-.24,P['bodyZ']))]
  for i,L in enumerate(tailLs):v=Vector((.06*math.sin(phase-i*.4) if moving else 0,-1,0)).normalized();ps.append(ps[-1]+v*L)
  for o,a,b in zip(tail,ps,ps[1:]):align(o,a,b)
  for o,v in zip(tailj,ps):o.location=v
 bpy.context.view_layer.update()
animated=[body,head,jaw]+[w for w,L,r in wings]+covers+mandibles+[o for l in legs.values() for o in l['links']+l['joints']+[l['foot']]]+[o for l in antennae.values() for o in l['links']+l['joints']]+tail+tailj
clips=[('idle',1,1,1),(P['motionClip'],10,32,P['motionMs']/10),('action',120,8,10)]
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
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=134
scene.frame_end=round(10+32*P['motionMs']/10)-1;scene['antennaRoots']=json.dumps({n:[l['side']*P['headRadii'][0]*.55,.05,.06] for n,l in antennae.items()});scene.timeline_markers.new('FLIGHT OR HOP',frame=10);scene.timeline_markers.new('ACTION',frame=120);scene['motionIdentity']=f'{SPECIES}-roster-v3';scene['motionClips']=json.dumps(clips);scene['legLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()});scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()});scene['antennaLengths']=json.dumps({n:l['lengths'] for n,l in antennae.items()});scene['wingRoots']=json.dumps({w.name:list(r) for w,L,r in wings});scene['wingParents']=json.dumps({w.name:w.parent.name for w,L,r in wings});scene['wingLengths']=json.dumps({w.name:L for w,L,r in wings});scene['tailLengths']=json.dumps(tailLs);scene['bodyAnchor']=json.dumps([0,0,P['bodyZ']]);scene['worldHop']=json.dumps(P['hop']);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
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
   frame=start+i*step;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();volumes=[]
   for original in meshes:
    o=original.evaluated_get(dg);ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
    if o.get('surfacePaint'):
     view=(cam.matrix_world.translation-o.matrix_world.translation).normalized()
     for face in o.data.polygons:
      if (o.matrix_world.to_3x3()@face.normal).dot(view)<=0:continue
      fp=[ps[v] for v in face.vertices];volumes.append(dict(name=o.name,key=o.data.materials[face.material_index]['paintKey'],depth=sum(p[2] for p in fp)/len(fp),points=[p[:2] for p in fp]))
    else:volumes.append(dict(name=o.name,key=o.data.materials[0]['paintKey'],depth=sum(p[2] for p in ps)/len(ps),points=hull(ps)))
   records.append(dict(facing=facing,clip=clip,index=i,body=project(body.evaluated_get(dg).matrix_world@Vector((0,0,P['bodyZ']))),volumes=volumes))
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v3',canvas=W,anchor=ANCHOR,palette=P['palette'],frameDurationMs=P['motionMs'],motionClip=P['motionClip'],hop=P['hop'],exampleDistance=P['exampleDistance'],speed=P['speed'],records=records),separators=(',',':')),encoding='utf8');print('INSECT_SOURCE_OK',len(records))
