"""Independent saved-scene low-bodied lizard invariants; no builder or recipe imports."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];species=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{species}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{species}/roster-v2')))
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects['BODY-rigid'];Ls=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);offsets=json.loads(scene['footfallOffsets']);anchor=Vector(json.loads(scene['bodyAnchor']));tail_lengths=json.loads(scene['tailLengths']);meshes=[o for o in scene.objects if o.type=='MESH'];assert len([o for o in meshes if '-toe-' in o.name and 'pad' not in o.name])==(20 if species=='frilled-neck-lizard' else 18)
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
quills=[o for o in meshes if o.name.startswith(('gill branch','dorsal crest','frill panel','shell scute'))]
for o in quills:
 edges={}
 for face in o.data.polygons:
  for a,b in zip(face.vertices,list(face.vertices[1:])+[face.vertices[0]]):
   e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
 assert all(n==2 for n in edges.values()),o.name
 o.data.calc_loop_triangles();volume=abs(sum(o.data.vertices[t.vertices[0]].co.dot(o.data.vertices[t.vertices[1]].co.cross(o.data.vertices[t.vertices[2]].co)) for t in o.data.loop_triangles)/6);assert volume>1e-6,o.name
hashes={o.name:geometry(o) for o in meshes};links=contacts=travel_pairs=tail_checks=attachment_checks=0;gap=rotation=slide=0;records=[]
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step,stride in [('walk',10,32,scene['walkStep'],scene['walkStrideWorldUnits']),('feed',160,8,10,0)]:
  last={};previous={};initial={};moving=clip in ['walk','chase']
  for i in range(count*4+1):
   t=i/(count*4);frame=start+i*step/4;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   def point(n):return obj(n).matrix_world.translation.copy()
   supports=0
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
   if i%2==0:assert supports in ([2,4] if moving else [4]),(species,clip,i,supports)
   ps=[point(f'tail-joint-{j}') for j in range(len(tail_lengths)+1)]
   for j,L in enumerate(tail_lengths):
    mesh=obj(f'tail-link-{j}')
    for sign,k in [(-1,j),(1,j+1)]:assert (mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length<.02
    if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;tail_checks+=1
   for o in meshes:
    if o.name.startswith('frill panel'):assert min((o.matrix_world@v.co).z for v in o.data.vertices)>-1e-5
    assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*4:assert all(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5 for o in meshes)
   if moving:
    p=world_to_camera_view(scene,scene.camera,bm@anchor);records.append(dict(facing=facing,clip=clip,y=(1-p.y)*scene.render.resolution_y))
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity=f'{species}-roster-v2',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=164,closedSpeciesVolumes=len(quills),continuousSamplesPerFacing=129,continuousActionSamplesPerFacing=33,fixedLengthLinkChecks=links,buriedHipRootChecks=attachment_checks,tailFixedLengthChecks=tail_checks,plantedGroundContacts=contacts,plantedTravelPairs=travel_pairs,maxContinuousEndpointGapWorldUnits=gap,maxQuarterPoseRotationStepDegrees=math.degrees(rotation),maxContactSlideWorldUnits=slide,meshLocalGeometrySha256=hashes,bodyRangePixels={clip:{f:max(r['y'] for r in records if r['facing']==f and r['clip']==clip)-min(r['y'] for r in records if r['facing']==f and r['clip']==clip) for f in ['down','up','left','right']} for clip in ['walk']})
assert all(v>=1 for values in result['bodyRangePixels'].values() for v in values.values());(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('GROUND_HUNTER_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
