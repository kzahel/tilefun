"""Independent saved-scene closed-volume, attachment, fixed-chain and loop audits."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];species=globals()['SPECIES'];S=ROOT/f'art-source/wildlife-v2/{species}/roster-v3';O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/f'public/demos/wildlife-v2/{species}/roster-v3')))
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-legless'];body=bpy.data.objects['BODY-rigid'];Ls=json.loads(scene['chainLengths']);clips=json.loads(scene['motionClips']);meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
for o in meshes:
 edges={}
 for f in o.data.polygons:
  for a,b in zip(f.vertices,list(f.vertices[1:])+[f.vertices[0]]):e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
 assert all(n==2 for n in edges.values()),o.name
 o.data.calc_loop_triangles();volume=abs(sum(o.data.vertices[t.vertices[0]].co.dot(o.data.vertices[t.vertices[1]].co.cross(o.data.vertices[t.vertices[2]].co)) for t in o.data.loop_triangles)/6);assert volume>1e-7,(o.name,volume)
hashes={o.name:geometry(o) for o in meshes};checks=attachments=0;gap=rotation=loop=0;ranges={};ground_clearances=[]
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);ys=[]
 for clip,start,count,step in clips[1:]:
  last={};initial={}
  for i in range(count*4+1):
   frame=start+i*step/4;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   ps=[obj(f'chain-joint-{j}').matrix_world.translation.copy() for j in range(len(Ls)+1)]
   error=(ps[0]-obj('BODY-rigid').matrix_world@Vector((0,-.12,0))).length;gap=max(gap,error);assert error<1e-5;attachments+=1
   for j,L in enumerate(Ls):
    o=obj(f'chain-link-{j}')
    for sign,k in [(-1,j),(1,j+1)]:
     error=(o.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.002,(species,clip,i,j,error)
    if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;checks+=1
    q=o.matrix_world.to_quaternion()
    if j in last:
     angle=2*math.acos(min(1,abs(q.dot(last[j]))));rotation=max(rotation,angle);assert angle<math.radians(10)
    last[j]=q
   for o in meshes:assert geometry(o)==hashes[o.name];assert all(abs(v-1)<1e-6 for v in o.scale)
   if scene['ground']:
    clearance=min((obj(o.name).matrix_world@v.co).z for o in meshes for v in o.data.vertices);ground_clearances.append(clearance);assert -1e-6<=clearance<.03,(species,clip,i,clearance)
   if clip=='walk':
    p=world_to_camera_view(scene,scene.camera,obj('BODY-rigid').matrix_world.translation);ys.append((1-p.y)*scene.render.resolution_y)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
   if i==count*4:
    delta=max(max(abs(o.matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4)) for o in meshes);loop=max(loop,delta);assert delta<1e-5
 ranges[facing]=max(ys)-min(ys);assert ranges[facing]>=1
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity=f'{species}-roster-v3',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=sum(c[2] for c in clips)*4,closedMeshVolumes=len(meshes),chainSegments=len(Ls),groundClearanceWorldUnits=([min(ground_clearances),max(ground_clearances)] if ground_clearances else None),fixedLengthChainChecks=checks,chainRootAttachmentChecks=attachments,maxContinuousEndpointGapWorldUnits=gap,maxQuarterPoseRotationStepDegrees=math.degrees(rotation),maxLoopMatrixDelta=loop,bodyMotionRangePixels=ranges,meshLocalGeometrySha256=hashes)
(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('LEGLESS_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
