import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/dog/draft-v1';G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;root=bpy.data.objects['ROOT-fixed'];head=bpy.data.objects['HEAD-fixed'];cam=sc.camera;links=0;floor=0;compensated=0;error=0
for n,h in G['meshLocalGeometrySha256'].items():
 o=bpy.data.objects[n];assert tuple(o.scale)==(1,1,1);assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==h;assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][n]
def project(p):q=world_to_camera_view(sc,cam,p);return [q.x*64,(1-q.y)*64,q.z]
for r in G['records']:
 root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);sc.frame_set(r['frame']);bpy.context.view_layer.update();assert tuple(head.rotation_euler)==(0,0,0);assert abs(head.location.y-.82)<1e-6 and abs(head.location.z-1.23)<1e-6
 for n,ps in r['limbsWorld'].items():
  for j,L in enumerate(r['limbLengths'][n]):
   a,b=Vector(ps[j]),Vector(ps[j+1]);assert abs((b-a).length-L)<1e-6;o=bpy.data.objects[n+'-'+str(j)];assert (o.matrix_world@Vector((0,0,L/2))-root.matrix_world@b).length<2e-6;links+=1
  foot=bpy.data.objects[n+'-paw'];v=r['contacts'][n];actual=foot.matrix_world@Vector((0,0,-.07));assert (actual-root.matrix_world@Vector(v['world'])).length<2e-6
  if v['planted']:assert abs(actual.z)<1e-6;floor+=1
  else:assert actual.z>0
  if r['clip']=='walk' and v['planted']:assert abs(v['world'][1]+.60*v['phase']-(ps[0][1]+.225))<1e-6;compensated+=1
 for j,(a,b) in enumerate(zip(r['tailWorld'],r['tailWorld'][1:])):
  a,b=Vector(a),Vector(b);assert abs((b-a).length-.16)<1e-6;o=bpy.data.objects['tail-'+str(j)];assert (o.matrix_world@Vector((0,0,.08))-root.matrix_world@b).length<2e-6;links+=1
 for n,v in r['volumes'].items():
  o=bpy.data.objects[n];pts=[o.matrix_world@p.co for p in o.data.vertices];assert min(p.z for p in pts)>-1e-6;ps=[project(p) for p in pts];bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)];error=max(error,max(abs(a-b) for a,b in zip(bb,v['bbox'])));assert error<6e-6
for f in G['cameraContract']['modelYawDegrees']:
 rows=[r for r in G['records'] if r['facing']==f]
 for n in ['skull','torso','shoulder','pelvis','neck','black-saddle','white-chest','nose','muzzle','blaze']:assert all(r['volumes'][n]==rows[0]['volumes'][n] for r in rows)
walk=[r for r in G['records'] if r['facing']=='down' and r['clip']=='walk'];sequence=[]
for n in G['footfallLandPose']:
 land=next(r['index'] for r in walk if abs(r['phases'][n])<1e-8);sequence.append([n,land]);assert land==G['footfallLandPose'][n]
sequence.sort(key=lambda p:p[1]);support=[sum(v['planted'] for v in r['contacts'].values()) for r in walk];assert [n for n,p in sequence]==['HL','FL','HR','FR'];report={'meshes':len(G['meshLocalGeometrySha256']),'poses':100,'geometryAndTopologyHashesUnitScale':True,'fixedArticulatedLinks':links,'actualPlantedPawContacts':floor,'stanceTravelCompensationChecks':compensated,'maxProjectionError':error,'fixedFullHeadAndBodyAllPoses':True,'actualLandSequence':sequence,'actualGroundSupportCounts':support,'artAcceptance':'Integrity only; independent visual gate.'};(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('DOG_SOURCE_AUDIT_OK',report)
