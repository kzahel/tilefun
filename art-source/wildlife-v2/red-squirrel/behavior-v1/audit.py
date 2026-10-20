"""Independent saved-scene red-squirrel bound, feeding and fixed-tail audit."""
import bpy,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=R/'public/demos/wildlife-v2/red-squirrel/behavior-v1'
bpy.ops.wm.open_mainfile(filepath=str(S/'red-squirrel.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects[scene['bodyName']];cam=scene.camera
lengths=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);tail_lengths=json.loads(scene['tailLinkLengths']);meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes};checks=contacts=tail_checks=0;max_gap=max_rotation=0;ranges={}
for facing,yaw in json.loads((R/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);last={};initial={};centers=[]
 for clip,samples in [('bound',[10+i for i in range(65)]),('action',[100+i*5 for i in range(17)])]:
  last={}
  for j,frame in enumerate(samples):
   scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   def point(name):return bpy.data.objects[name].evaluated_get(dg).matrix_world.translation.copy()
   bm=body.evaluated_get(dg).matrix_world
   if clip=='bound':
    projected=world_to_camera_view(scene,cam,bm@Vector(json.loads(scene['bodyAnchor'])));centers.append((1-projected.y)*48)
   for name,Ls in lengths.items():
    ps=[point(f'{name}-joint-{i}') for i in range(5)]
    for i,L in enumerate(Ls):
     obj=bpy.data.objects[f'{name}-link-{i}'].evaluated_get(dg)
     for sign,k in [(-1,i),(1,i+1)]:
      gap=(obj.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;max_gap=max(max_gap,gap);assert gap<.03,(clip,j,name,gap)
     if j%2==0:assert abs((ps[i+1]-ps[i]).length-L)<1e-5;checks+=1
     q=obj.matrix_world.to_quaternion()
     if obj.name in last:
      step=2*math.acos(min(1,abs(q.dot(last[obj.name]))));max_rotation=max(max_rotation,step);assert step<math.radians(50),(clip,name,j,math.degrees(step))
     last[obj.name]=q
    if j%2==0:assert (ps[0]-bm@Vector(rests[name])).length<1e-5
    hoof=bpy.data.objects[f'{name}-hoof'].evaluated_get(dg);sole=min((hoof.matrix_world@v.co).z for v in hoof.data.vertices);assert sole>=-1e-6
    planted=(j/64<=.15625 or j/64>=.84375) if clip=='bound' else name.startswith('hind') or j in [0,16]
    if planted and j%2==0:assert abs(sole)<1e-6;contacts+=1
   for i,L in enumerate(tail_lengths):
    a,b=point(f'TAIL-joint-{i}'),point(f'TAIL-joint-{i+1}');obj=bpy.data.objects[f'TAIL-fur-{i}'].evaluated_get(dg)
    for sign,target in [(-1,a),(1,b)]:assert (obj.matrix_world@Vector((0,0,sign*L/2))-target).length<.006
    if j%2==0:assert abs((b-a).length-L)<1e-5;tail_checks+=1
   for obj in meshes:assert geometry(obj)==hashes[obj.name] and all(abs(s-1)<1e-6 for s in obj.scale)
   if j==0:initial={o.name:o.evaluated_get(dg).matrix_world.copy() for o in meshes}
   if j==len(samples)-1:
    for o in meshes:assert max(abs(o.evaluated_get(dg).matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5
  if clip=='bound':ranges[facing]=max(centers)-min(centers);assert ranges[facing]>1
 for clip,start,count,step in [('idle',1,1,1),('bound',10,32,2),('action',100,8,10)]:
  for i in range(count):
   scene.frame_set(start+i*step);assert bpy.data.objects['NUT-held'].hide_render
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
assert scene.render.fps==100 and scene['walkFrameStep']==2
report=dict(identity='red-squirrel-behavior-v1',allClipPoses=260,continuousSamplesPerFacing=65,feedingHalfPoseSamples=17,fixedLengthLinkChecks=checks,plantedGroundContacts=contacts,tailFixedLinkChecks=tail_checks,maxContinuousEndpointGapWorldUnits=max_gap,maxHalfPoseRotationStepDegrees=math.degrees(max_rotation),bodyRangePixels=ranges,meshLocalGeometrySha256=hashes,worldHeight='Shared .64s bound, push .10s, landing .54s, height 6px; source legs tuck and re-extend')

projection=json.loads((S/'projection.json').read_text(encoding='utf8'))
for rec in projection['records']:
 root.rotation_euler.z=math.radians(json.loads((S/'camera.json').read_text())['modelYawDegrees'][rec['facing']])
 frame=rec.get('frame')
 if frame is None:
  frame=next(start+rec['index']*step for name,start,count,step in clips if name==rec['clip'])
 scene.frame_set(int(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 assert len(rec['socket'])>=2 and all(math.isfinite(v) for v in rec['socket'])
 for mesh in meshes:
  assert geometry(mesh)==hashes[mesh.name]
  assert all(abs(v-1)<1e-6 for v in mesh.scale)
 if 'limbLengths' in scene:
  for n,Ls in json.loads(scene['limbLengths']).items():
   ps=[bpy.data.objects[f'{n}-joint-{j}'].evaluated_get(dg).matrix_world.translation for j in range(5)]
   for j,L in enumerate(Ls):assert abs((ps[j+1]-ps[j]).length-L)<1e-5,(rec['clip'],n,j)

(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('SQUIRREL_AUDIT_OK',json.dumps(report|{'meshLocalGeometrySha256':'omitted'}))
