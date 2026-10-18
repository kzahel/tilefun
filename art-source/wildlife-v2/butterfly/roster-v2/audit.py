"""Independent saved-butterfly mechanics, continuous wing/root and ground-rest audit."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=R/'public/demos/wildlife-v2/butterfly/roster-v2'
bpy.ops.wm.open_mainfile(filepath=str(S/'butterfly.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];cam=scene.camera
meshes=[o for o in scene.objects if o.type=='MESH'];rigs=[bpy.data.objects[n] for n in json.loads(scene['wingRigNames'])]
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes};link_checks=contacts=0;tip_ranges={}
for facing,yaw in json.loads((R/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw);initial={};ranges={o.name:[] for o in rigs};last={}
 for i in range(65):
  scene.frame_set(10+i);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
  for o in meshes:
   assert geometry(o)==hashes[o.name];assert all(abs(v-1)<1e-6 for v in o.scale)
  for rig in rigs:
   e=rig.evaluated_get(dg);tip=e.matrix_world@Vector((.6*int(rig['side']),.25,0));hinge=e.matrix_world.translation
   assert abs((tip-hinge).length-.65)<1e-5;link_checks+=1
   q=e.matrix_world.to_quaternion()
   if rig.name in last:assert 2*math.acos(min(1,abs(q.dot(last[rig.name]))))<math.radians(15)
   last[rig.name]=q;p=world_to_camera_view(scene,cam,tip);ranges[rig.name].append((p.x*32,(1-p.y)*32))
  if i==0:initial={o.name:o.evaluated_get(dg).matrix_world.copy() for o in meshes}
  if i==64:
   for o in meshes:assert max(abs(o.evaluated_get(dg).matrix_world[a][b]-initial[o.name][a][b]) for a in range(4) for b in range(4))<1e-5
 tip_ranges[facing]=max(max(p[1] for p in ps)-min(p[1] for p in ps) for ps in ranges.values());assert tip_ranges[facing]>2
 scene.frame_set(1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
 for o in meshes:
  if not o.name.startswith('foot '):continue
  e=o.evaluated_get(dg);sole=min((e.matrix_world@v.co).z for v in e.data.vertices);assert abs(sole)<1e-6;contacts+=1
 for clip,start,count,step in [('idle',1,1,1),('flutter',10,32,2),('action',100,8,10)]:
  for i in range(count):
   scene.frame_set(start+i*step)
   for o in meshes:assert geometry(o)==hashes[o.name] and all(abs(v-1)<1e-6 for v in o.scale)
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
assert scene.render.fps==100 and scene.render.fps_base==1
report=dict(identity='butterfly-roster-v2',allClipPoses=164,continuousSamplesPerFacing=65,wingRigidLinkChecks=link_checks,restingFootContacts=contacts,projectedWingTipRangePixels=tip_ranges,meshLocalGeometrySha256=hashes,worldHeight='Shared bounded airborne travel arc, with grounded landings; source keeps folded rest feet on ground')
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('BUTTERFLY_AUDIT_OK',json.dumps(report|{'meshLocalGeometrySha256':'omitted'}))
