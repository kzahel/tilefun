"""Independent saved-scene limb, wing, rest-contact and physical-hop checks."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];species=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{species}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{species}/roster-v2')))
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-ground'];body=bpy.data.objects['BODY-flight'];meshes=[o for o in scene.objects if o.type=='MESH'];clips=json.loads(scene['motionClips']);legs=json.loads(scene['legLengths']);antennae=json.loads(scene['antennaLengths']);hips=json.loads(scene['hipRest']);wing_roots=json.loads(scene['wingRoots']);wing_lengths=json.loads(scene['wingLengths']);tailLs=json.loads(scene['tailLengths'])
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes};assert len(legs)==6
for o in meshes:
 if not o.name.startswith('closed flight panel'):continue
 edges={}
 for f in o.data.polygons:
  for a,b in zip(f.vertices,list(f.vertices[1:])+[f.vertices[0]]):e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
 assert all(n==2 for n in edges.values()),o.name
links=antenna_checks=tail_checks=wing_checks=hip_checks=contacts=0;gap=attachment=rotation=0;tip_ranges={}
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);ranges={n:[] for n in wing_roots}
 for clip,start,count,step in clips[1:]:
  initial={};last={}
  for i in range(count*4+1):
   frame=start+i*step/4;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   def point(n):return obj(n).matrix_world.translation.copy()
   bm=obj('BODY-flight').matrix_world
   for n,Ls in list(legs.items())+list(antennae.items())+([('TAIL',tailLs)] if tailLs else []):
    ps=[point(f'{n}-joint-{j}') for j in range(len(Ls)+1)]
    for j,L in enumerate(Ls):
     mesh=obj(f'{n}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.012,(species,clip,i,n,j,error)
     if i%2==0:
      assert abs((ps[j+1]-ps[j]).length-L)<1e-5
      if n in legs:links+=1
      elif n in antennae:antenna_checks+=1
      else:tail_checks+=1
    if n in legs:
     error=(ps[0]-bm@Vector(hips[n])).length;attachment=max(attachment,error);assert error<.002
     if i%2==0:
      core=obj('thorax core');local=core.matrix_world.inverted()@ps[0];rs=[max(abs(v.co[k]) for v in core.data.vertices) for k in range(3)];assert sum((local[k]/rs[k])**2 for k in range(3))<1.1;hip_checks+=1
    elif n in antennae:
     error=(ps[0]-obj('HEAD-rigid').matrix_world@Vector(json.loads(scene['antennaRoots'])[n])).length;attachment=max(attachment,error);assert error<.002
   for n,rest in wing_roots.items():
    o=obj(n);error=(o.matrix_world.translation-bm@Vector(rest)).length;attachment=max(attachment,error);assert error<1e-5;wing_checks+=1
    q=o.matrix_world.to_quaternion()
    if n in last:
     angle=2*math.acos(min(1,abs(q.dot(last[n]))));rotation=max(rotation,angle);assert angle<math.radians(30)
    last[n]=q
    if clip==clips[1][0]:
     p=world_to_camera_view(scene,scene.camera,o.matrix_world@Vector((o['side']*wing_lengths[n]*1.05,-.035,0)));ranges[n].append((p.x*scene.render.resolution_x,p.y*scene.render.resolution_y))
   for o in meshes:assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*4:assert all(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5 for o in meshes)
 tip_ranges[facing]=max(max(p[k] for p in ps)-min(p[k] for p in ps) for ps in ranges.values() for k in [0,1]);assert tip_ranges[facing]>2
 scene.frame_set(1);bpy.context.view_layer.update()
 for n in legs:
  o=bpy.data.objects[f'{n}-foot'];sole=min((o.matrix_world@v.co).z for v in o.data.vertices);assert abs(sole)<1e-6;contacts+=1
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
hop=json.loads(scene['worldHop']);assert hop['duration']==clips[1][2]*clips[1][3]/scene.render.fps;assert hop['height']>=4
report=dict(identity=f'{species}-roster-v2',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=164,continuousSamplesPerFacing=129,sixLegs=True,fixedLengthLegChecks=links,hipRootChecks=hip_checks,antennaFixedLengthChecks=antenna_checks,tailFixedLengthChecks=tail_checks,wingAttachmentChecks=wing_checks,restingFootContacts=contacts,maxContinuousEndpointGapWorldUnits=gap,maxAttachmentGapWorldUnits=attachment,maxQuarterPoseWingRotationStepDegrees=math.degrees(rotation),projectedWingTipRangePixels=tip_ranges,physicalHop=hop,meshLocalGeometrySha256=hashes)
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('INSECT_AUDIT_OK',json.dumps(report|{'meshLocalGeometrySha256':'omitted'}))
