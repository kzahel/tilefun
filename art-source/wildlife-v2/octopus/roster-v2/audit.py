"""Independent octopus saved-source checks; no builder import."""
import os
import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/'public/demos/wildlife-v2/octopus/roster-v2')))
bpy.ops.wm.open_mainfile(filepath=str(S/'octopus.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-water'];body=bpy.data.objects['BODY-rigid'];lengths=json.loads(scene['armLengths']);rests=json.loads(scene['armRest']);meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes};checks=0;gap=rotation=0;records=[]
assert len(rests)==8 and len(lengths)==5
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in [('jet',10,32,3),('action',120,8,10)]:
  last={};initial={}
  for i in range(count*4+1):
   frame=start+i*step/4;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   for name,rest in rests.items():
    ps=[obj(f'{name}-joint-{j}').matrix_world.translation.copy() for j in range(6)]
    if i%2==0:assert (ps[0]-bm@Vector(rest)).length<1e-5
    for j,L in enumerate(lengths):
     mesh=obj(f'{name}-link-{j}')
     for sign,k in [(-1,j),(1,j+1)]:
      error=(mesh.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.02,(clip,i,name,j,error)
     if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;checks+=1
     q=mesh.matrix_world.to_quaternion()
     if mesh.name in last:
      angle=2*math.acos(min(1,abs(q.dot(last[mesh.name]))));rotation=max(rotation,angle);assert angle<math.radians(40),(clip,i,name,j,angle)
     last[mesh.name]=q
   for o in meshes:
    assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*4:assert all(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5 for o in meshes)
   if clip=='jet':
    p=world_to_camera_view(scene,scene.camera,bm@Vector((0,-.15,1.45)));records.append(dict(facing=facing,y=(1-p.y)*48))
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity='octopus-roster-v2',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=164,armCount=8,continuousJetSamplesPerFacing=129,continuousActionSamplesPerFacing=33,fixedLengthArmLinkChecks=checks,maxContinuousEndpointGapWorldUnits=gap,maxQuarterPoseRotationStepDegrees=math.degrees(rotation),meshLocalGeometrySha256=hashes,bodyRangePixels={f:max(r['y'] for r in records if r['facing']==f)-min(r['y'] for r in records if r['facing']==f) for f in ['down','up','left','right']})
assert all(v>=1 for v in result['bodyRangePixels'].values());(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('OCTOPUS_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
