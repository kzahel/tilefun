"""Independent saved-scene ground hunter invariants; no builder or recipe imports."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];species=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{species}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{species}/roster-v3')))
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects['BODY-rigid'];Ls=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);offsets=json.loads(scene['footfallOffsets']);anchor=Vector(json.loads(scene['bodyAnchor']));tail_lengths=json.loads(scene['tailLengths']);meshes=[o for o in scene.objects if o.type=='MESH'];arms=json.loads(scene['arms']);neckLs=json.loads(scene['neckLengths']);trunkLs=json.loads(scene['trunkLengths']);ears=json.loads(scene['earRoots'])
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
quills=[o for o in meshes if o.name.startswith(('quill ',))]
for o in meshes:
 assert not o.modifiers and not o.data.shape_keys and not o.data.animation_data,o.name
 edges={}
 for face in o.data.polygons:
  for a,b in zip(face.vertices,list(face.vertices[1:])+[face.vertices[0]]):
   e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
 assert all(n==2 for n in edges.values()),o.name
 o.data.calc_loop_triangles();volume=abs(sum(o.data.vertices[t.vertices[0]].co.dot(o.data.vertices[t.vertices[1]].co.cross(o.data.vertices[t.vertices[2]].co)) for t in o.data.loop_triangles)/6);assert volume>1e-6,o.name
hashes={o.name:geometry(o) for o in meshes};links=contacts=travel_pairs=tail_checks=attachment_checks=0;gap=rotation=quarter_rotation=slide=0;records=[];arm_checks=neck_checks=trunk_checks=ear_checks=support_checks=0
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 motion=[('walk',10,32,4,scene['walkStrideWorldUnits']),('feed',160,8,10,0)]
 if scene['isHunter']:motion += [('chase',360,32,scene['chaseFrameStep'],scene['chaseStrideWorldUnits']),('display',260,8,10,0)]
 for clip,start,count,step,stride in motion:
  last={};last_quarter={};previous={};initial={};moving=clip in ['walk','chase']
  divisions=32 if clip=='feed' else 8
  for i in range(count*divisions+1):
   t=i/(count*divisions);frame=start+i*step/divisions;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   def point(n):return obj(n).matrix_world.translation.copy()
   supports=0;soles=[]
   for n,lengths in Ls.items():
    ps=[point(f'{n}-joint-{j}') for j in range(5)]
    if i%2==0:
     assert (ps[0]-bm@Vector(rests[n])).length<1e-5
     rib=obj('compact rib cage');local=rib.matrix_world.inverted()@ps[0];radii=[max(abs(v.co[k]) for v in rib.data.vertices) for k in range(3)];envelope=sum((local[k]/radii[k])**2 for k in range(3));assert envelope<1.08,(species,n,envelope);attachment_checks+=1
    for j,L in enumerate(lengths):
     mesh=obj(f'{n}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.02,(species,clip,i,n,j,error)
     if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;links+=1
     q=mesh.matrix_world.to_quaternion()
     if mesh.name in last:
      angle=2*math.acos(min(1,abs(q.dot(last[mesh.name]))));rotation=max(rotation,angle);assert angle<math.radians(40),(species,clip,i,n,j,angle)
     last[mesh.name]=q
     if i%(divisions//4)==0:
      if mesh.name in last_quarter:quarter_rotation=max(quarter_rotation,2*math.acos(min(1,abs(q.dot(last_quarter[mesh.name])))))
      last_quarter[mesh.name]=q
    foot=obj(f'{n}-foot');sole=min((foot.matrix_world@v.co).z for v in bpy.data.objects[f'{n}-foot'].data.vertices);assert sole>=-1e-6
    phase=(t-offsets[n])%1;planted=phase<scene['stanceFraction'] if moving else True
    if i%2==0 and planted:
     assert abs(sole)<1e-6;supports+=1;contacts+=1;soles.extend(root.matrix_world.inverted()@foot.matrix_world@v.co for v in bpy.data.objects[f'{n}-foot'].data.vertices)
     if moving:
      p=root.matrix_world.inverted()@ps[-1];ground=Vector((p.x,p.y+stride*t,0))
      if n in previous and phase>previous[n][0]:
       error=(ground-previous[n][1]).length;slide=max(slide,error);assert error<1e-5;travel_pairs+=1
      previous[n]=(phase,ground)
    elif i%2==0:previous.pop(n,None)
   if i%2==0:assert supports in ([1,2] if moving else [2]),(species,clip,i,supports)
   if i%2==0:
    cg=root.matrix_world.inverted()@bm@anchor;assert min(v.x for v in soles)-.04<=cg.x<=max(v.x for v in soles)+.04,(species,clip,i,'lateral support',cg.x);assert min(v.y for v in soles)-.04<=cg.y<=max(v.y for v in soles)+.04,(species,clip,i,'forward support',cg.y);support_checks+=1
   for name,a in arms.items():
    ps=[point(f'{name}-joint-{j}') for j in range(4)];error=(ps[0]-bm@Vector(a['rest'])).length;gap=max(gap,error);assert error<.0001
    for j,L in enumerate(a['lengths']):
     o=obj(f'{name}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(o.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.002,(species,clip,i,name,j,error)
     if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;arm_checks+=1
   for prefix,Ls2 in [('NECK',neckLs),('TRUNK',trunkLs)]:
    if not Ls2:continue
    ps=[point(f'{prefix}-joint-{j}') for j in range(len(Ls2)+1)]
    target=bm@Vector(json.loads(scene['neckRoot'])) if prefix=='NECK' else obj('HEAD-rigid').matrix_world@Vector(json.loads(scene['trunkRoot']))
    error=(ps[0]-target).length;gap=max(gap,error);assert error<.0001
    if prefix=='NECK':assert (ps[-1]-obj('HEAD-rigid').matrix_world.translation).length<1e-5
    for j,L in enumerate(Ls2):
     o=obj(f'{prefix}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(o.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.002,(species,clip,i,prefix,j,error)
     if i%2==0:
      assert abs((ps[j+1]-ps[j]).length-L)<1e-5
      if prefix=='NECK':neck_checks+=1
      else:trunk_checks+=1
   for name,a in ears.items():assert (obj(name).matrix_world.translation-obj(a['parent']).matrix_world@Vector(a['rest'])).length<1e-5;ear_checks+=1
   ps=[point(f'tail-joint-{j}') for j in range(4)]
   for j,L in enumerate(tail_lengths):
    mesh=obj(f'tail-link-{j}')
    for sign,k in [(-1,j),(1,j+1)]:assert (mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length<.02
    if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;tail_checks+=1
   for o in meshes:
    assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*divisions:assert all(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5 for o in meshes)
   if moving:
    p=world_to_camera_view(scene,scene.camera,bm@anchor);records.append(dict(facing=facing,clip=clip,y=(1-p.y)*scene.render.resolution_y))
assert all(geometry(o)==hashes[o.name] for o in meshes)
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity=f'{species}-roster-v3',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=324 if scene['isHunter'] else 164,closedQuillVolumes=len(quills),continuousSamplesPerFacing=257,continuousActionSamplesPerFacing=257,walkingLegs=2,torsoSupportBoundsChecks=support_checks,fixedArmLinkChecks=arm_checks,neckFixedLengthChecks=neck_checks,trunkFixedLengthChecks=trunk_checks,earAttachmentChecks=ear_checks,fixedLengthLinkChecks=links,buriedHipRootChecks=attachment_checks,tailFixedLengthChecks=tail_checks,plantedGroundContacts=contacts,plantedTravelPairs=travel_pairs,maxContinuousEndpointGapWorldUnits=gap,maxQuarterPoseRotationStepDegrees=math.degrees(quarter_rotation),maxSubsampleLegRotationStepDegrees=math.degrees(rotation),maxContactSlideWorldUnits=slide,meshLocalGeometrySha256=hashes,bodyRangePixels={clip:{f:max(r['y'] for r in records if r['facing']==f and r['clip']==clip)-min(r['y'] for r in records if r['facing']==f and r['clip']==clip) for f in ['down','up','left','right']} for clip in (['walk','chase'] if scene['isHunter'] else ['walk'])})
assert all(v>=1 for values in result['bodyRangePixels'].values() for v in values.values());(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('GROUND_HUNTER_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
