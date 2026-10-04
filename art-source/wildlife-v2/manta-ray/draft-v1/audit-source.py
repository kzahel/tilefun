from pathlib import Path
import bpy,json,math,hashlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/manta-ray/draft-v1';G=json.loads((S/'projected-guides.json').read_text());scene=bpy.context.scene;cam=scene.camera;root=bpy.data.objects['ROOT-fixed'];head=bpy.data.objects['HEAD-fixed'];body=bpy.data.objects['BODY-fixed'];meshes=[o for o in bpy.data.objects if o.type=='MESH'];assert bpy.data.filepath.endswith('manta-ray.blend');assert hashlib.sha256((S/'manta-ray.blend').read_bytes()).hexdigest()==G['blendSha256'];assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale-14.4)<1e-6 and abs(cam.data.shift_y-18/144)<1e-6
def hashes():
 for o in meshes:
  assert tuple(o.scale)==(1,1,1);assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==G['meshLocalGeometrySha256'][o.name];assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][o.name]
hashes();error=0;links=0;water=[];tipZ=[];primaryZ=[];heads=0
for r in G['records']:
 root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);scene.frame_set(r['frame']);bpy.context.view_layer.update();assert tuple(body.location)==(0,0,bpy.data.objects['BODY-fixed'].location.z);assert abs(body.location.z-1.7)<1e-6 and max(abs(a) for a in body.rotation_euler)<1e-6 and max(abs(a) for a in head.rotation_euler)<1e-6;heads+=1
 for n,ps in r['wingWorld'].items():
  for j in range(2):assert abs((Vector(ps[j+1])-Vector(ps[j])).length-1.4)<1e-6;links+=1
  for j in range(2):
   o=bpy.data.objects[f'pectoral-{n}-{j}'];s=int(n);start=o.matrix_world@Vector((0,0,0));end=o.matrix_world@Vector((s*1.4,0,0));expected=[root.matrix_world@Vector(ps[j]),root.matrix_world@Vector(ps[j+1])];assert max((a-b).length for a,b in zip([start,end],expected))<1e-6
 for n,ps in r['cephalicWorld'].items():
  for j,L in enumerate([.24,.20,.15]):assert abs((Vector(ps[j+1])-Vector(ps[j])).length-L)<1e-6;links+=1
 for j in range(5):assert abs((Vector(r['tailWorld'][j+1])-Vector(r['tailWorld'][j])).length-.4)<1e-6;links+=1
 assert r['contacts']=={}
 for n,v in r['volumes'].items():
  o=bpy.data.objects[n];pts=[o.matrix_world@p.co for p in o.data.vertices];water.extend(p.z for p in pts);assert min(p.z for p in pts)>0 and max(p.z for p in pts)<4.3;ps=[world_to_camera_view(scene,cam,p) for p in pts];bb=[min(p.x*144 for p in ps),min((1-p.y)*144 for p in ps),max(p.x*144 for p in ps),max((1-p.y)*144 for p in ps)];error=max(error,max(abs(a-b) for a,b in zip(bb,v['bbox'])))
 if r['facing']=='down' and r['clip']=='swim':primaryZ.append(r['wingWorld']['1'][1][2]);tipZ.append(r['wingWorld']['1'][2][2])
hashes();assert error<.00002;primaryApex=max(range(12),key=lambda i:primaryZ[i]);tipApex=max(range(12),key=lambda i:tipZ[i]);assert primaryApex==3 and tipApex==4,(primaryApex,tipApex)
report={'freshSavedSource':True,'allMeshGeometryHashAndUnitScale':len(meshes),'poses':84,'fixedWingCephalicTailLinks':links,'fixedHeadAndDiscPoses':heads,'actualComputedPrimaryApex':primaryApex,'actualComputedDistalTipApex':tipApex,'tipZSequence':tipZ,'primaryJointZSequence':primaryZ,'contactSequence':'Floating, no ground contacts in all84 poses.','allMeshWorldZ':[min(water),max(water)],'projectionMaxErrorPixels':error,'gait':'12-pose symmetric oscillatory pectoral beat, proximal apex3 precedes actual distal tip apex4; fixed disc/skull.'};(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('MANTA_RAY_SOURCE_AUDIT_OK',report)
