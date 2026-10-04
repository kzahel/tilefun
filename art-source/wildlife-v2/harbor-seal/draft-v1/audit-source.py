"""Fresh saved Blender process: fixed raw geometry/bones, evaluated skin, projection and contacts."""
from pathlib import Path
import bpy,json,math,hashlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/harbor-seal/draft-v1';G=json.loads((S/'projected-guides.json').read_text());scene=bpy.context.scene;cam=scene.camera;root=bpy.data.objects['ROOT-fixed'];head=bpy.data.objects['HEAD-rigid-fixed-orientation'];arm=bpy.data.objects['fixed-link-spine'];skin=bpy.data.objects['continuous-tapered-body'];meshes=[o for o in bpy.data.objects if o.type=='MESH']
assert bpy.data.filepath.endswith('harbor-seal.blend');assert hashlib.sha256((S/'harbor-seal.blend').read_bytes()).hexdigest()==G['blendSha256'];assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale-9.6)<1e-6 and abs(cam.data.shift_y-16/96)<1e-6
def hashes():
 for o in meshes:
  assert tuple(o.scale)==(1,1,1),o.name
  assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==G['meshLocalGeometrySha256'][o.name],o.name
  assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][o.name],o.name
hashes();error=0;links=0;foreLinks=0;plantedCompensation=0;floorChecks=0;heads=0;volume=[];support={};water=[]
for r in G['records']:
 root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);scene.frame_set(r['frame']);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
 for j,L in enumerate([.75,.85,.85]):
  pb=arm.pose.bones['spine-'+str(j)];assert abs((pb.tail-pb.head).length-L)<1e-6,(r['clip'],r['index'],j);assert max(abs(a-1) for a in pb.scale)<1e-6;links+=1
 assert max(abs(a) for a in head.rotation_euler)<1e-6;heads+=1
 for s,ps in r['foreWorld'].items():
  for j,L in enumerate([.45,.50]):assert abs((Vector(ps[j+1])-Vector(ps[j])).length-L)<1e-6;foreLinks+=1
  if r['forePlanted']:
   phase=r['index']/8 if r['index']!=7 else -.125;assert abs(ps[-1][1]+.20*phase-1.45)<1e-6 and abs(ps[-1][2])<1e-6;plantedCompensation+=1
 q=world_to_camera_view(scene,cam,head.matrix_world.translation);error=max(error,abs(q.x*96-r['head'][0]),abs((1-q.y)*96-r['head'][1]))
 for n,v in r['volumes'].items():
  o=bpy.data.objects[n];pts=[o.matrix_world@p.co for p in o.evaluated_get(deps).data.vertices];ps=[world_to_camera_view(scene,cam,p) for p in pts];bb=[min(p.x*96 for p in ps),min((1-p.y)*96 for p in ps),max(p.x*96 for p in ps),max((1-p.y)*96 for p in ps)];error=max(error,max(abs(a-b) for a,b in zip(bb,v['bbox'])))
  if r['swim']:water.extend(p.z for p in pts);assert min(p.z for p in pts)>.9 and max(p.z for p in pts)<3.4,(n,min(p.z for p in pts),max(p.z for p in pts))
 for n,contacts in r['contacts'].items():
  o=bpy.data.objects[n];pts=[o.matrix_world@p.co for p in o.evaluated_get(deps).data.vertices]
  if not r['swim']:
   assert min(p.z for p in pts)>-1e-5,(n,r['clip'],r['index']);floorChecks+=len(pts)
  for p in contacts:assert abs(p[2])<1e-5
 evaluated=skin.evaluated_get(deps).data;evaluated.calc_loop_triangles();V=abs(sum(evaluated.vertices[t.vertices[0]].co.dot(evaluated.vertices[t.vertices[1]].co.cross(evaluated.vertices[t.vertices[2]].co)) for t in evaluated.loop_triangles)/6);volume.append(V)
 if r['facing']=='down' and r['clip']=='haul':support[str(r['index'])]={n:len(v) for n,v in r['contacts'].items() if v}
hashes();assert error<.00002
report={'freshSavedSource':True,'allRawMeshGeometryHashAndUnitScale':len(meshes),'visibleMeshes':22,'poses':92,'fixedSpineLinks':links,'fixedForeLimbLinks':foreLinks,'actualPlantedTipTravelCompensation':plantedCompensation,'rigidHeadOrientations':heads,'actualFloorMeshVertexChecks':floorChecks,'actualHaulSupport':support,'evaluatedSkinVolumeRange': [min(volume),max(volume)],'evaluatedSkinRelativeVolumeRange':max(volume)/min(volume)-1,'bodyVolumeLimit':'Dual-quaternion fixed-length skin has residual volume change; never animated scale. Inspect silhouette rather than claiming exactly rigid torso.','swimAllMeshWorldZ':[min(water),max(water)],'projectionMaxErrorPixels':error};(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('HARBOR_SEAL_SOURCE_AUDIT_OK',report)
