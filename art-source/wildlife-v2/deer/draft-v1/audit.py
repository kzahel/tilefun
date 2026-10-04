"""Read-only fresh saved Blender audit. Integrity is separate from art review."""
from pathlib import Path
import bpy,json,hashlib,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).resolve().parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/deer/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());scene=bpy.context.scene;cam=scene.camera;root=bpy.data.objects['ROOT-fixed-ground'];meshes=[o for o in bpy.data.objects if o.type=='MESH']
def geo(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
assert {o.name:geo(o) for o in meshes}==G['meshLocalGeometrySha256']
assert abs(cam.data.ortho_scale-4.8)<1e-6 and abs(cam.data.shift_y-.25)<1e-6
assert abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-6
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
def project(v):
 p=world_to_camera_view(scene,cam,v);return [p.x*48,(1-p.y)*48,p.z]
max_error=0;seq={};segment_checks=0;floor_checks=0;stance=[]
for r in G['records']:
 scene.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['facings'][r['facing']]);bpy.context.view_layer.update()
 assert tuple(root.location)==(0,0,0) and tuple(bpy.data.objects['BODY-rigid'].location)==(0,0,0)
 assert tuple(bpy.data.objects['HEAD-rigid'].rotation_euler)==(0,0,0)
 for o in meshes:
  assert all(abs(v-1)<1e-6 for v in o.scale);assert geo(o)==G['meshLocalGeometrySha256'][o.name]
  ps=[project(o.matrix_world@v.co) for v in o.data.vertices];bbox=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
  err=max(abs(a-b) for a,b in zip(bbox,r['volumes'][o.name]['bbox']));max_error=max(max_error,err);assert err<.001,(o.name,r['frame'],err)
 for n,c in r['contacts'].items():
  a,k,f=[Vector(c[q]) for q in ['hip','knee','foot']]
  hoof=bpy.data.objects[n+'-hoof'];actual=hoof.matrix_world.translation
  assert (actual-root.matrix_world@f).length<1e-5
  for part,p,q,L in [('upper',a,k,c['lengths'][0]),('cannon',k,f,c['lengths'][1])]:
   o=bpy.data.objects[n+'-'+part];assert (o.matrix_world.translation-root.matrix_world@((p+q)/2)).length<1e-5
   direction=(o.matrix_world.to_3x3()@Vector((0,0,1))).normalized();assert abs(abs(direction.dot((root.matrix_world.to_3x3()@(q-p)).normalized()))-1)<1e-5
   assert abs(o.dimensions.z-L)<1e-5;assert abs((q-p).length-L)<1e-5;segment_checks+=1
  floor=min((hoof.matrix_world@v.co).z for v in hoof.data.vertices)
  actual_contact=abs(floor)<1e-6;assert actual_contact==c['planted'];floor_checks+=1
  if r['facing']=='down' and r['clip']=='walk':
   seq.setdefault(n,[]).append(actual_contact)
   if c['planted']:stance.append((n,r['index'],c['foot'][1]))
landings={n:[i for i in range(12) if v[i] and not v[(i-1)%12]] for n,v in seq.items()}
assert landings=={'fore-1':[7],'fore1':[1],'hind-1':[0],'hind1':[6]},landings
support=[sum(v[i] for v in seq.values()) for i in range(12)];assert min(support)>=2
# Stance y velocity plus separate preview travel .07/unit/pose cancels exactly.
for n,seqn in seq.items():
 rs=[r for r in G['records'] if r['facing']=='down' and r['clip']=='walk']
 for i in range(12):
  j=(i+1)%12
  if seqn[i] and seqn[j]:assert abs(rs[j]['contacts'][n]['foot'][1]-rs[i]['contacts'][n]['foot'][1]+.07)<1e-6
for clip,start,end in [('walk',10,22),('action',30,38)]:
 state=[]
 for frame in [start,end]:
  scene.frame_set(frame);bpy.context.view_layer.update();state.append({o.name:[list(row) for row in o.matrix_world] for o in meshes})
 assert state[0]==state[1],clip
report=dict(status='source integrity passed; no artistic acceptance',blendSha256=hashlib.sha256((S/'deer.blend').read_bytes()).hexdigest(),meshCount=len(meshes),poseCount=len(G['records']),geometryHashes=G['meshLocalGeometrySha256'],topologyHashes={o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes},fixedSegmentChecks=segment_checks,actualMeshFloorChecks=floor_checks,maxProjectedBoundsErrorPixels=max_error,actualContactSequences=seq,actualLandingIndices=landings,actualSupportCounts=support,stanceVelocityWorldUnitsPerPose=-.07,previewTravelWorldUnitsPerPose=.07,rootFixed=True,bodyHeadGeometryAndOrientationFixed=True,noScaleKeys=True,closedLoops=True,cameraElevationAboveGroundDegrees=40,density=10,gaitDesign='Contralateral overlaps, one-pose hind/front offset, 9/12 stance, no flight. Stylized slow walk informed by Murray State diagonal-walk tracks, not measured live timing.')
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('DEER_SOURCE_AUDIT_OK',segment_checks,floor_checks,landings,support)
