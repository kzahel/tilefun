"""Independent saved crab rig audit; never import the builder."""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=ROOT/'public/demos/wildlife-v2/crab/roster-v2'
bpy.ops.wm.open_mainfile(filepath=str(S/'crab.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects['BODY-rigid'];camera=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text());Ls=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);offsets=json.loads(scene['footfallOffsets']);meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes};links=contacts=travel_pairs=claw_links=0;gap=rotation=slide=0;records=[]
for facing,yaw in camera['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);last={};previous={};initial={}
 for clip,start,count,step in [('walk',10,32,3),('action',120,8,10)]:
  samples=count*4+1
  for i in range(samples):
   t=i/(samples-1);frame=start+count*step*t;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
   def obj(name):return bpy.data.objects[name].evaluated_get(dg)
   def point(name):return obj(name).matrix_world.translation.copy()
   supports=0
   for name,lengths in Ls.items():
    ps=[point(f'{name}-joint-{j}') for j in range(4)]
    if i%2==0:assert (ps[0]-bm@Vector(rests[name])).length<1e-5
    for j,L in enumerate(lengths):
     mesh=obj(f'{name}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.02,(clip,i,name,j,error)
     if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;links+=1
     q=mesh.matrix_world.to_quaternion()
     if mesh.name in last:
      angle=2*math.acos(min(1,abs(q.dot(last[mesh.name]))));rotation=max(rotation,angle);assert angle<math.radians(40),(clip,i,name,j,angle)
     last[mesh.name]=q
    sole=min((obj(f'{name}-foot').matrix_world@v.co).z for v in bpy.data.objects[f'{name}-foot'].data.vertices);assert sole>=-1e-6
    phase=(t-offsets[name])%1;planted=phase<scene['stanceFraction'] if clip=='walk' else True
    if i%2==0 and planted:
     assert abs(sole)<1e-6;contacts+=1;supports+=1
     if clip=='walk':
      local=root.matrix_world.inverted()@ps[-1];ground=Vector((local.x+scene['strideWorldUnits']*t,local.y,0))
      if name in previous and phase>previous[name][0]:
       error=(ground-previous[name][1]).length;slide=max(slide,error);assert error<1e-5;travel_pairs+=1
      previous[name]=(phase,ground)
    elif i%2==0:previous.pop(name,None)
   if clip=='walk' and i%2==0:assert supports in [4,8]
   for side in [-1,1]:
    ps=[point(f'claw{side}-joint-{k}') for k in range(3)]
    for j,L in enumerate([.35,.32]):
     mesh=obj(f'claw{side}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:assert (mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length<.02
     if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;claw_links+=1
   for o in meshes:
    assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==samples-1:assert all(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5 for o in meshes)
   if clip=='walk':
    p=world_to_camera_view(scene,scene.camera,bm@Vector((0,0,.37)));records.append(dict(facing=facing,y=(1-p.y)*32))
  last={};previous={}
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity='crab-roster-v2',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=164,continuousSamplesPerFacing=129,fixedLengthLinkChecks=links,clawFixedLinkChecks=claw_links,plantedGroundContacts=contacts,plantedTravelPairs=travel_pairs,movementAxis='x',maxContinuousEndpointGapWorldUnits=gap,maxHalfPoseRotationStepDegrees=math.degrees(rotation),maxContactSlideWorldUnits=slide,meshLocalGeometrySha256=hashes,bodyRangePixels={f:max(r['y'] for r in records if r['facing']==f)-min(r['y'] for r in records if r['facing']==f) for f in camera['modelYawDegrees']})
assert all(v>=1 for v in result['bodyRangePixels'].values());(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('CRAB_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
