"""Fresh forest specialists. Independent anatomy, rigid fixed links and planted travel."""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];FAMILY=Path(__file__).resolve().parent;P=json.loads((FAMILY/'profiles.json').read_text(encoding='utf8'))[SPECIES];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v3')))
assert not (S/'receipt.json').exists(),'Registered banks are immutable'
O.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.view_settings.view_transform='Standard';W=P['canvas'];ANCHOR=P['anchor']
def node(n,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(n,None);scene.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=node('ROOT-fixed-ground');pivot=node('MOTION-torso',root,(0,0,1.4));body=node('BODY-rigid',pivot,(0,0,-1.4));head=node('HEAD-rigid',root,P['head']);head_rest=head.location.copy();jaw=node('JAW',head,(0,.16,-.16))
mats={}
for k,color in P['palette'].items():
 m=bpy.data.materials.new(k);m.diffuse_color=(*[v/255 for v in bytes.fromhex(color[1:])],1);m['paintKey']=k;mats[k]=m
def egg(n,loc,radii,key,parent=body,group='body'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8);o=bpy.context.object;o.name=n;o.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=parent;o.location=loc;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
def poly(n,vs,fs,key,parent,group):
 m=bpy.data.meshes.new(n);m.from_pydata(vs,[],fs);m.update();o=bpy.data.objects.new(n,m);scene.collection.objects.link(o);o.parent=parent;o.data.materials.append(mats[key]);o['paintGroup']=group;return o
exec((FAMILY/'geometry.py').read_text(encoding='utf8'))

def align(o,a,b):
 o.location=(a+b)/2;z=(b-a).normalized();x=Vector((1,1,0)).normalized();x=(x-z*x.dot(z)).normalized();y=z.cross(x);q=Matrix((x,y,z)).transposed().to_quaternion();q.make_compatible(o.rotation_quaternion);o.rotation_mode='QUATERNION';o.rotation_quaternion=q
legs={};OFF={'leg-1':.93,'leg1':.43};STANCE=.64
for side in [-1,1]:
 n=f'leg{side}';rest=Vector(P['hip']);rest.x*=side;Ls=P['legLengths'];links=[egg(f'{n}-link-{j}',(0,0,0),(r,r,L/2),'B',root,'limb') for j,(r,L) in enumerate(zip(P['legRadii'],Ls))];joints=[node(f'{n}-joint-{j}',root) for j in range(5)];bulbs=[egg(f'{n}-joint-volume-{j}',(0,0,0),(r,r,r),'B',root,'limb') for j,r in enumerate(P['legRadii'][1:],1)];foot=egg(f'{n}-foot',(0,0,0),(P['footWidth'],P['footLength'],P['footHeight']),'M',root,'foot');legs[n]=dict(end='leg',rest=rest,lengths=Ls,links=links,joints=joints,bulbs=bulbs,foot=foot)
 for j in range(3 if SPECIES=='elephant-upright' else 2):egg(f'{n}-toe-{j}',((j-(1 if SPECIES=='elephant-upright' else .5))*.09,.16,-.015),(.04,.09,.035),'C' if SPECIES=='elephant-upright' else 'M',foot,'foot')
arms={};ear_pivots=[]
for side in [-1,1]:
 name=f'ARM-{side}';rest=Vector(P['shoulder']);rest.x*=side;Ls=P['armLengths'];parts=[egg(f'{name}-link-{j}',(0,0,0),(.10 if SPECIES=='elephant-upright' else .07,)*2+(L/2,),'B',root,'limb') for j,L in enumerate(Ls)];js=[node(f'{name}-joint-{j}',root) for j in range(4)];bulbs=[egg(f'{name}-joint-volume-{j}',(0,0,0),(.10 if SPECIES=='elephant-upright' else .075,)*3,'B',root,'limb') for j in [1,2]];arms[name]=dict(side=side,rest=rest,lengths=Ls,parts=parts,joints=js,bulbs=bulbs)
 egg(f'palm {side}',(0,0,Ls[-1]/2),(.13,.10,.12) if SPECIES=='elephant-upright' else (.09,.07,.10),'C',parts[-1],'limb')
neckL=P['neckLengths'];neck=[egg(f'NECK-link-{i}',(0,0,0),(.17-i*.015,.17-i*.015,L/2),'B',root,'neck') for i,L in enumerate(neckL)];neckj=[node(f'NECK-joint-{i}',root) for i in range(len(neckL)+1)];neckbulbs=[egg(f'NECK-overlap-{i}',(0,0,0),(.17-i*.015,)*3,'B',root,'neck') for i in range(len(neckL))]
trunkL=P['trunkLengths'];trunk=[egg(f'TRUNK-link-{i}',(0,0,0),(.14-i*.022,.14-i*.022,L/2),'B',root,'head') for i,L in enumerate(trunkL)];trunkj=[node(f'TRUNK-joint-{i}',root) for i in range(len(trunkL)+1)];trunkbulbs=[egg(f'TRUNK-overlap-{i}',(0,0,0),(.14-i*.022,)*3,'B',root,'head') for i in range(len(trunkL))]
decorate_chains(neck,trunk)
tailL=P['tailLengths'];tails=[egg(f'tail-link-{i}',(0,0,0),(P['tailRadius']*(1-i*.18)*(.65 if SPECIES=='giant-anteater' else 1),P['tailRadius']*(1-i*.18)*(1.4 if SPECIES=='giant-anteater' else 1),L/2),P['tailKey'],root,'tail') for i,L in enumerate(tailL)];tailj=[node(f'tail-joint-{i}',root) for i in range(4)]
tailbulbs=[egg(f'tail-overlap-{i}',(0,0,0),(P['tailRadius']*(1-i*.18),)*3,P['tailKey'],root,'tail') for i in range(3)]
decorate_tail(tails,tailL)
create_ears(ear_pivots)


def pose(t,clip):
 moving=clip in ['walk','chase'];stride=P['walkSpeed' if clip=='walk' else 'chaseSpeed']*32*P['walkMs' if clip=='walk' else 'chaseMs']/1000/10 if moving else 0;amount=math.sin(math.pi*t)**2 if clip in ['feed','display'] else 0
 weight_phase=(t+.07)%1;blend=max(0,min(1,(weight_phase if weight_phase<.5 else weight_phase-.5)/.14));blend=blend*blend*(3-2*blend);weight_x=.16*(1-2*blend) if weight_phase<.5 else .16*(-1+2*blend)
 pivot.location=(weight_x if moving else 0,0,1.4+(.11*math.sin(4*math.pi*t) if moving else -.04*amount if clip=='feed' else 0));pivot.rotation_euler=(.025*math.sin(4*math.pi*t) if moving else -.035*amount if clip=='feed' else 0,.012*math.sin(2*math.pi*t) if moving else 0,0)
 jaw.rotation_euler.x=-.12*amount;bpy.context.view_layer.update();rig=pivot.matrix_local@body.matrix_local;rotation=rig.to_3x3();info={}
 if neckL:
  ps=[rig@Vector(P['neckRoot'])]
  for i,L in enumerate(neckL):ps.append(ps[-1]+rotation@Vector((.012*math.sin(2*math.pi*t-i*.3) if moving else 0,.07+.25*amount,1)).normalized()*L)
  for o,a,b in zip(neck,ps,ps[1:]):align(o,a,b)
  for o,p in zip(neckj,ps):o.location=p
  for o,p in zip(neckbulbs,ps):o.location=p
  head.location=ps[-1]
 else:head.location=rig@head_rest
 head.rotation_euler=(pivot.rotation_euler.x-.12*amount,pivot.rotation_euler.y,0);bpy.context.view_layer.update()
 if trunkL:
  ps=[head.matrix_local@Vector(P['trunkRoot'])]
  for i,L in enumerate(trunkL):
   a=.12+i*.18+.8*amount+(.06*math.sin(2*math.pi*t-i*.4) if moving else 0);ps.append(ps[-1]+head.matrix_local.to_3x3()@Vector((.03*math.sin(2*math.pi*t-i*.3) if moving else 0,math.sin(a),-math.cos(a))).normalized()*L)
  for o,a,b in zip(trunk,ps,ps[1:]):align(o,a,b)
  for o,p in zip(trunkj,ps):o.location=p
  for o,p in zip(trunkbulbs,ps):o.location=p
 for name,a in arms.items():
  side=a['side'];ps=[rig@a['rest']];swing=.28*math.sin(2*math.pi*t+side*math.pi/2) if moving else 0
  directions=[Vector((side*.05,swing+.35*amount,-1+.30*amount)),Vector((side*.04,-swing*.3+.3*amount,-1+1.5*amount)),Vector((0,.1+.4*amount,-1+.3*amount))]
  for v,L in zip(directions,a['lengths']):ps.append(ps[-1]+rotation@v.normalized()*L)
  for o,p,q in zip(a['parts'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(a['joints'],ps):o.location=p
  for o,p in zip(a['bulbs'],ps[1:3]):o.location=p
 for side,o in ear_pivots:o.rotation_euler.z=side*(.04*math.sin(2*math.pi*t) if moving else .15*amount)
 for n,l in legs.items():
  phase=(t-OFF[n])%1 if moving else .3;planted=phase<STANCE if moving else True;q=0 if planted else (phase-STANCE)/(1-STANCE);y=stride*STANCE/2-stride*phase if moving and planted else (-stride*STANCE/2+stride*STANCE*q*q*(3-2*q) if moving else 0);foot=Vector((l['rest'].x,l['rest'].y+y,P['footHeight']+P['lift']*math.sin(math.pi*q)**1.4));hip=pivot.matrix_local@body.matrix_local@l['rest'];L1,L2,L3,L4=l['lengths'];fetlock=foot+Vector((0,-.035,.10)).normalized()*L4;flex=(.20 if l['end']=='fore' else .65)+.65*math.sin(math.pi*q)**2;chord=math.sqrt(L2*L2+L3*L3+2*L2*L3*math.cos(flex));delta=fetlock-hip;d=delta.length;u=delta.normalized();assert abs(L1-chord)<d<L1+chord,(SPECIES,clip,n,t,d,L1+chord);a=(L1*L1-chord*chord+d*d)/(2*d);pole=Vector((0,-1 if l['end']=='fore' else 1,0));pole=(pole-u*pole.dot(u)).normalized();elbow=hip+u*a+pole*math.sqrt(max(0,L1*L1-a*a));delta=fetlock-elbow;d=delta.length;u=delta.normalized();a=(L2*L2-L3*L3+d*d)/(2*d);pole=hip-elbow;pole=(pole-u*pole.dot(u)).normalized();knee=elbow+u*a+pole*math.sqrt(max(0,L2*L2-a*a));ps=[hip,elbow,knee,fetlock,foot]
  foot_swing=q
  for o,p,q in zip(l['links'],ps,ps[1:]):align(o,p,q)
  for o,p in zip(l['joints'],ps):o.location=p
  for o,p in zip(l['bulbs'],ps[1:4]):o.location=p
  l['foot'].location=foot;l['foot'].rotation_euler.x=.25*math.sin(math.pi*foot_swing)**1.4;info[n]=dict(phase=phase,planted=planted)
 base=pivot.matrix_local@body.matrix_local@Vector(P['tailRoot']);ps=[base]
 for i,L in enumerate(tailL):
  v=Vector((.14*math.sin(2*math.pi*t-i*.4) if moving else .06*amount,-math.cos(P['tailAngle']+i*.25),math.sin(P['tailAngle']+i*.25)));ps.append(ps[-1]+v.normalized()*L)
 for o,p,q in zip(tails,ps,ps[1:]):align(o,p,q)
 for o,p in zip(tailj,ps):o.location=p
 for o,p in zip(tailbulbs,ps):o.location=p
 bpy.context.view_layer.update();return info
animated=[o for a in arms.values() for o in a['parts']+a['joints']+a['bulbs']]+neck+neckj+neckbulbs+trunk+trunkj+trunkbulbs+[o for side,o in ear_pivots]+[pivot,head,jaw]+[o for l in legs.values() for o in l['links']+l['joints']+l['bulbs']+[l['foot']]]+tails+tailj+tailbulbs
clips=[('idle',1,1,1),('walk',10,32,4),('feed',160,8,10)]
if P['hunter']:clips += [('display',260,8,10),('chase',360,32,P['chaseMs']/10)]
for clip,start,count,step in clips:
 substeps=16 if clip=='feed' else 4;times={i/(count*substeps) for i in range(count*substeps+1)}
 if clip=='walk':times|={0,.07,.43,.57,.93,1}
 for t in sorted(times):
  pose(t,clip);f=start+t*count*step
  for o in animated:o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=f)

for o in animated:
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for fc in bag.fcurves:
     for k in fc.keyframe_points:k.interpolation='LINEAR'
camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=W/10;cam.data.shift_y=(ANCHOR[1]-W/2)/W;cam.location=camera['cameraLocationAtDistance10'];cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=scene.render.resolution_y=W;scene.render.resolution_percentage=100;scene.render.fps=100;scene.render.film_transparent=True;scene.frame_start=10;scene.frame_end=137
scene['arms']=json.dumps({n:dict(rest=list(a['rest']),lengths=a['lengths']) for n,a in arms.items()});scene['neckLengths']=json.dumps(neckL);scene['neckRoot']=json.dumps(P['neckRoot']);scene['trunkLengths']=json.dumps(trunkL);scene['trunkRoot']=json.dumps(P['trunkRoot']);scene['headRest']=json.dumps(P['head']);scene['earRoots']=json.dumps({o.name:dict(parent=o.parent.name,rest=list(o.location)) for side,o in ear_pivots});scene['isHunter']=P['hunter'];scene['chaseFrameStep']=P['chaseMs']/10;scene['motionIdentity']=f'{SPECIES}-roster-v3';scene['limbLengths']=json.dumps({n:l['lengths'] for n,l in legs.items()});scene['hipRest']=json.dumps({n:list(l['rest']) for n,l in legs.items()});scene['footfallOffsets']=json.dumps(OFF);scene['stanceFraction']=STANCE;scene['walkStrideWorldUnits']=P['walkSpeed']*32*P['walkMs']/1000/10;scene['chaseStrideWorldUnits']=P['chaseSpeed']*32*P['chaseMs']/1000/10;scene['tailLengths']=json.dumps(tailL);scene['bodyAnchor']=json.dumps(P['torso']);scene.timeline_markers.new('WALK - planted feet',frame=10);scene.timeline_markers.new('FEED',frame=160);scene.timeline_markers.new('DISPLAY',frame=260);scene.timeline_markers.new('CHASE - planted brisk gait',frame=360);scene.frame_set(1);pose(0,'idle');bpy.ops.wm.save_as_mainfile(filepath=str(S/f'{SPECIES}.blend'))
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
(S/'projection.json').write_text(json.dumps(dict(identity=f'{SPECIES}-roster-v3',canvas=W,anchor=ANCHOR,palette=P['palette'],frameDurationMs=P['walkMs'],chaseMs=P['chaseMs'],fauna=not P['hunter'],speed=P['walkSpeed'],strideWorldUnits=scene['walkStrideWorldUnits'],records=records),separators=(',',':')),encoding='utf8');print('SMALL_MAMMAL_SOURCE_OK',SPECIES,len(records))
