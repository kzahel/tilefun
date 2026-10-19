"""Independent saved-scene tail, fin attachment, rigid geometry and loop audit."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];SPECIES=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{SPECIES}/roster-v2';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{SPECIES}/roster-v2')))
bpy.ops.wm.open_mainfile(filepath=str(S/f'{SPECIES}.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-water'];body=bpy.data.objects['BODY-rigid'];meshes=[o for o in scene.objects if o.type=='MESH'];Ls=json.loads(scene['tailLengths']);clips=json.loads(scene['motionClips'])
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes};checks=attachments=0;gap=root_gap=loop_gap=rotation=0;motion={f:[] for f in ['down','up','left','right']};jaw_angles=[]
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in clips[1:]:
  initial={};last={}
  for i in range(count*4+1):
   frame=start+i*step/4;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   bm=obj('BODY-rigid').matrix_world;ps=[obj(f'TAIL-joint-{j}').matrix_world.translation.copy() for j in range(4)];error=(ps[0]-bm@Vector(json.loads(scene['tailRoot']))).length;root_gap=max(root_gap,error);assert error<.002
   for j,L in enumerate(Ls):
    link=obj(f'TAIL-link-{j}')
    for sign,k in [(-1,j),(1,j+1)]:
     error=(link.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.012,(facing,clip,i,j,error)
    if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;checks+=1
    q=link.matrix_world.to_quaternion()
    if link.name in last:
     angle=2*math.acos(min(1,abs(q.dot(last[link.name]))));rotation=max(rotation,angle);assert angle<math.radians(20)
    last[link.name]=q
   assert (obj('FLUKE').matrix_world.translation-ps[-1]).length<1e-5
   for name,p in zip(json.loads(scene['finNames']),json.loads(scene['finPivots'])):
    error=(obj(name).matrix_world.translation-bm@Vector(p)).length;assert error<1e-5;attachments+=1
   for o in meshes:assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*4:
    error=max(abs(o.matrix_world[a][c]-initial[o.name][a][c]) for o in meshes for a in range(4) for c in range(4));loop_gap=max(loop_gap,error);assert error<1e-5
   if clip=='swim':
    p=world_to_camera_view(scene,scene.camera,bm@Vector(json.loads(scene['bodyAnchor'])));motion[facing].append(p.y*scene.render.resolution_y)
   if clip=='feed':jaw_angles.append(obj('JAW').rotation_euler.x)
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity=f'{SPECIES}-roster-v2',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=sum(c[2] for c in clips)*4,continuousSwimSamplesPerFacing=129,continuousChaseSamplesPerFacing=129 if len(clips)>3 else 0,continuousFeedSamplesPerFacing=33,fixedLengthTailChecks=checks,finAttachmentChecks=attachments,maxContinuousEndpointGapWorldUnits=gap,maxTailRootGapWorldUnits=root_gap,maxLoopMatrixDelta=loop_gap,maxQuarterPoseRotationStepDegrees=math.degrees(rotation),bodyMotionRangePixels={f:max(v)-min(v) for f,v in motion.items()},feedingJawRangeRadians=max(jaw_angles)-min(jaw_angles),meshLocalGeometrySha256=hashes)
assert all(v>=1 for v in result['bodyMotionRangePixels'].values());assert result['feedingJawRangeRadians']>.19
(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('MARINE_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
