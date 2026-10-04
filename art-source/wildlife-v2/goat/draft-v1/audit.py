"""Fresh saved Blender mesh/three-link/contact/tracking audit, no art approval."""
from pathlib import Path
import bpy,json,hashlib,math
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).resolve().parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/goat/draft-v1';G=json.loads((S/'projected-guides.json').read_text());scene=bpy.context.scene;cam=scene.camera;root=bpy.data.objects['ROOT-fixed-ground'];meshes=[o for o in bpy.data.objects if o.type=='MESH']
def geo(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
assert {o.name:geo(o) for o in meshes}==G['meshLocalGeometrySha256'];assert abs(cam.data.ortho_scale-4.8)<1e-6
assert abs(cam.data.shift_y-11/48)<1e-6 and abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-6
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
def project(v):
 p=world_to_camera_view(scene,cam,v);return [p.x*48,(1-p.y)*48,p.z]
max_error=0;seq={};segments=0;floors=0;tailchecks=0;velocity=.10
for r in G['records']:
 scene.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['facings'][r['facing']]);bpy.context.view_layer.update()
 assert tuple(root.location)==(0,0,0);assert tuple(bpy.data.objects['HEAD-rigid'].rotation_euler)==(0,0,0)
 for o in meshes:
  assert all(abs(v-1)<1e-6 for v in o.scale);assert geo(o)==G['meshLocalGeometrySha256'][o.name]
  ps=[project(o.matrix_world@v.co) for v in o.data.vertices];b=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
  error=max(abs(a-b) for a,b in zip(b,r['volumes'][o.name]['bbox']));max_error=max(max_error,error);assert error<.001
 for n,c in r['contacts'].items():
  a,k,ank,f=[Vector(c[t]) for t in ['hip','knee','ankle','foot']];hoof=bpy.data.objects[n+'-hoof']
  assert (hoof.matrix_world.translation-root.matrix_world@f).length<1e-5
  for part,p,q,L in [('upper',a,k,c['lengths'][0]),('middle',k,ank,c['lengths'][1]),('cannon',ank,f,c['lengths'][2])]:
   o=bpy.data.objects[n+'-'+part];assert (o.matrix_world.translation-root.matrix_world@((p+q)/2)).length<1e-5
   d=(o.matrix_world.to_3x3()@Vector((0,0,1))).normalized();assert abs(abs(d.dot((root.matrix_world.to_3x3()@(q-p)).normalized()))-1)<1e-5
   assert abs(o.dimensions.z-L)<1e-5 and abs((q-p).length-L)<1e-5;segments+=1
  for toe in [-1,1]:
   obj=bpy.data.objects[n+'-toe'+str(toe)];floor=min((obj.matrix_world@v.co).z for v in obj.data.vertices)
   actual=abs(floor)<1e-6;assert actual==c['planted'];floors+=1
  if r['facing']=='down' and r['clip']=='walk':seq.setdefault(n,[]).append(actual)
 for side in [-1,1]:
  ear=bpy.data.objects['ear-'+str(side)];assert all(abs(s-1)<1e-6 for s in ear.scale);tailchecks+=1
 tail=bpy.data.objects['tail-upright-volume'];assert abs(tail.dimensions.z-.24)<1e-5
rs=[r for r in G['records'] if r['facing']=='down' and r['clip']=='walk'];landings={n:[i for i in range(16) if s[i] and not s[(i-1)%16]] for n,s in seq.items()}
assert landings=={'fore-1':[4],'fore1':[12],'hind-1':[0],'hind1':[8]};support=[sum(s[i] for s in seq.values()) for i in range(16)];assert support==[3,3,3,2]*4
for n,s in seq.items():
 for i in range(16):
  j=(i+1)%16
  if s[i] and s[j]:assert abs(rs[j]['contacts'][n]['foot'][1]-rs[i]['contacts'][n]['foot'][1]+velocity)<1e-6
tracking={}
for side in [-1,1]:
 fore='fore'+str(side);hind='hind'+str(side);fi=landings[fore][0];hi=landings[hind][0]
 while hi<fi:hi+=16
 front=rs[fi]['contacts'][fore]['foot'][1]+fi*velocity;back=rs[hi%16]['contacts'][hind]['foot'][1]+hi*velocity
 tracking[str(side)]=back-front;assert abs(back-front-.02)<1e-6
 # Fore hoof has already lifted when the following hind foot replaces it.
 assert not rs[hi%16]['contacts'][fore]['planted']
for clip,start,end in [('walk',10,26),('action',35,43)]:
 states=[]
 for f in [start,end]:
  scene.frame_set(f);bpy.context.view_layer.update();states.append({o.name:[list(row) for row in o.matrix_world] for o in meshes})
 assert states[0]==states[1],clip
report=dict(status='source integrity passed; artistic gate separate',blendSha256=hashlib.sha256((S/'goat.blend').read_bytes()).hexdigest(),meshCount=len(meshes),poseCount=len(G['records']),geometryHashes=G['meshLocalGeometrySha256'],topologyHashes={o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes},fixedSegmentChecks=segments,actualPairedToeFloorChecks=floors,rigidEarScaleChecks=tailchecks,maxProjectedBoundsErrorPixels=max_error,actualContactSequences=seq,actualLandingIndices=landings,actualSupportCounts=support,stanceVelocityWorldUnitsPerPose=-velocity,previewTravelWorldUnitsPerPose=velocity,computedHindFrontTrackingWorldUnits=tracking,precedingForeLiftedAtHindLanding=True,rootFixed=True,headGeometryAndOrientationFixed=True,noScaleKeys=True,closedLoops=True,cameraElevationAboveGroundDegrees=40,density=10)
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print('GOAT_SOURCE_AUDIT_OK',segments,floors,tailchecks,landings,tracking)
