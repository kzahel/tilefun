"""Independent saved-scene biped, neck and feather invariants; no builder or recipe imports."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];species=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{species}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{species}/roster-v3')))
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects['BODY-rigid'];Ls=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);offsets=json.loads(scene['footfallOffsets']);anchor=Vector(json.loads(scene['bodyAnchor']));meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
toe_counts={n:len([o for o in meshes if o.name.startswith(n+'-toe-')]) for n in Ls};assert all(n==scene['toeCounts'] for n in toe_counts.values())
forward_counts={n:len([o for o in meshes if o.name.startswith(n+'-toe-') and o.location.y>0]) for n in Ls};assert all(n==scene['toeForwardCount'] for n in forward_counts.values())
hashes={o.name:geometry(o) for o in meshes};links=contacts=travel_pairs=tail_checks=attachment_checks=neck_checks=wing_checks=0;gap=rotation=slide=neck_gap=0;records=[]
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in json.loads(scene['motionClips'])[1:]:
  stride=scene['chaseStrideWorldUnits'] if clip=='chase' else scene['walkStrideWorldUnits'] if clip=='walk' else 0
  last={};previous={};initial={};moving=clip in ['walk','chase']
  for i in range(count*8+1):
   t=i/(count*8);frame=start+i*step/8;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   def point(n):return obj(n).matrix_world.translation.copy()
   supports=0
   for n,lengths in Ls.items():
    ps=[point(f'{n}-joint-{j}') for j in range(5)]
    if i%2==0:
     assert (ps[0]-bm@Vector(rests[n])).length<1e-5
     rib=obj('bird rib cage');local=rib.matrix_world.inverted()@ps[0];radii=[max(abs(v.co[k]) for v in rib.data.vertices) for k in range(3)];envelope=sum((local[k]/radii[k])**2 for k in range(3));assert envelope<1.08,(species,n,envelope);attachment_checks+=1
    for j,L in enumerate(lengths):
     mesh=obj(f'{n}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.02,(species,clip,i,n,j,error)
     if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;links+=1
     q=mesh.matrix_world.to_quaternion()
     if mesh.name in last:
      angle=2*math.acos(min(1,abs(q.dot(last[mesh.name]))));rotation=max(rotation,angle);assert angle<math.radians(40),(species,clip,i,n,j,angle)
     last[mesh.name]=q
    foot=obj(f'{n}-foot');sole=min((foot.matrix_world@v.co).z for v in bpy.data.objects[f'{n}-foot'].data.vertices);assert sole>=-1e-6
    phase=(t-offsets[n])%1;planted=phase<scene['stanceFraction'] if moving else True
    if i%2==0 and planted:
     assert abs(sole)<1e-6;supports+=1;contacts+=1
     if moving:
      p=root.matrix_world.inverted()@ps[-1];ground=Vector((p.x,p.y+stride*t,0))
      if n in previous and phase>previous[n][0]:
       error=(ground-previous[n][1]).length;slide=max(slide,error);assert error<1e-5;travel_pairs+=1
      previous[n]=(phase,ground)
    elif i%2==0:previous.pop(n,None)
   if i%2==0:assert supports in ([1,2] if moving else [2]),(species,clip,i,supports)
   neck_ps=[point(f'NECK-joint-{j}') for j in range(len(json.loads(scene['neckLengths']))+1)]
   for j,L in enumerate(json.loads(scene['neckLengths'])):
    mesh=obj(f'NECK-link-{j}')
    for sign,k in [(-1,j),(1,j+1)]:
     error=(mesh.matrix_world@Vector((0,0,sign*L/2))-neck_ps[k]).length;neck_gap=max(neck_gap,error);assert error<.02,(species,clip,i,j,error)
    if i%2==0:assert abs((neck_ps[j+1]-neck_ps[j]).length-L)<1e-5;neck_checks+=1
   assert (neck_ps[0]-bm@Vector(json.loads(scene['neckRoot']))).length<.002
   assert (neck_ps[-1]-point('HEAD-rigid')).length<.002
   tail=obj('TAIL-root');tail_base=tail.matrix_world.translation
   assert (tail_base-bm@Vector(json.loads(scene['tailRoot']))).length<1e-5
   for j,L in enumerate(json.loads(scene['tailFeathers'])):
    mesh=obj(f'TAIL-feather-{j}');assert (mesh.matrix_world@Vector((0,0,-L/2))-tail_base).length<.02
    if i%2==0:tail_checks+=1
   for side,rest in zip([-1,1],json.loads(scene['wingRoots'])):
    assert (point(f'WING-{side}')-bm@Vector(rest)).length<1e-5;wing_checks+=1
   for o in meshes:
    assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*8:assert all(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5 for o in meshes)
   if moving:
    p=world_to_camera_view(scene,scene.camera,bm@anchor);records.append(dict(facing=facing,clip=clip,y=(1-p.y)*scene.render.resolution_y))
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity=f'{species}-roster-v3',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=sum(c[2] for c in json.loads(scene['motionClips']))*4,toeMeshesPerFoot=toe_counts,forwardToesPerFoot=forward_counts,continuousSamplesPerFacing=257,continuousActionSamplesPerFacing=65,fixedLengthLinkChecks=links,buriedHipRootChecks=attachment_checks,tailFeatherAttachmentChecks=tail_checks,neckFixedLengthChecks=neck_checks,wingAttachmentChecks=wing_checks,plantedGroundContacts=contacts,plantedTravelPairs=travel_pairs,maxContinuousEndpointGapWorldUnits=gap,maxNeckEndpointGapWorldUnits=neck_gap,maxEighthPoseRotationStepDegrees=math.degrees(rotation),maxContactSlideWorldUnits=slide,meshLocalGeometrySha256=hashes,bodyRangePixels={clip:{f:max(r['y'] for r in records if r['facing']==f and r['clip']==clip)-min(r['y'] for r in records if r['facing']==f and r['clip']==clip) for f in ['down','up','left','right']} for clip in ['walk']})
assert all(v>=1 for values in result['bodyRangePixels'].values() for v in values.values());(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('GROUND_BIRD_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
