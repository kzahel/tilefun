import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/ant/draft-v2';G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;cam=sc.camera;W=32;meshes=sorted([o for o in sc.objects if o.type=='MESH'],key=lambda o:o.name);head=bpy.data.objects['HEAD-rigid'];torso=bpy.data.objects['MESOSOMA-rigid'];headRest=list(head.location);error=0;segments=contacts=0;table=[]
assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale-W/10)<1e-6 and abs(cam.data.shift_y-G['shiftY'])<1e-6
for o in meshes:
 assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==G['meshLocalGeometrySha256'][o.name]
 assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][o.name];assert not o.data.shape_keys
def project(v):
 p=world_to_camera_view(sc,cam,v);return [p.x*W,(1-p.y)*W]
for r in G['records']:
 sc.frame_set(r['frame']);bpy.context.view_layer.update();actual=[];assert list(head.location)==headRest and Vector(head.rotation_euler).length<1e-7 and Vector(torso.rotation_euler).length<1e-7
 for o in sc.objects:assert all(abs(x-1)<1e-7 for x in o.scale)
 for o in meshes:
  ps=[project(o.matrix_world@v.co) for v in o.data.vertices];b=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)];error=max(error,max(abs(a-c) for a,c in zip(b,r['meshes'][o.name]['bounds'])))
 for label in ['fore','middle','hind']:
  for side in [-1,1]:
   key=f'{label}:{side}';js=[Vector(v) for v in r['legs'][key]['world']]
   for i,(name,L) in enumerate(zip(['femur','tibia','tarsus'],G['fixedLegLengths'])):
    o=bpy.data.objects[f'{label}-{side}-{name}'];a=o.matrix_world@Vector((0,0,-L/2));b=o.matrix_world@Vector((0,0,L/2));assert (a-js[i]).length<1e-6 and (b-js[i+1]).length<1e-6;assert abs((b-a).length-L)<1e-6;segments+=1
   co=bpy.data.objects[f'{label}-{side}-coxa'];a=co.matrix_world@Vector((0,0,-.055/2));b=co.matrix_world@Vector((0,0,.055/2));assert min((a-js[0]).length,(b-js[0]).length)<1e-6
   if abs(js[-1].z)<1e-6:actual.append(key);contacts+=1
 assert sorted(actual)==sorted(r['contacts'])
 assert len(actual)>=3,'whole ant became airborne'
 if r['facing']=='down' and r['clip']=='crawl':table.append({'pose':r['pose'],'actualContacts':actual,'lifted':{k:round(v['world'][-1][2],6) for k,v in r['legs'].items() if k not in actual}})
assert error<.0001,error
landings=[{'pose':i,'leg':k} for i in range(8) for k in table[i]['actualContacts'] if k not in table[(i-1)%8]['actualContacts']]
assert {(v['pose'],v['leg']) for v in landings}=={(0,'fore:-1'),(0,'hind:-1'),(0,'middle:1'),(4,'fore:1'),(4,'hind:1'),(4,'middle:-1')}
(O/'source-audit.json').write_text(json.dumps({'status':'source integrity passed; visual review separate','blender':bpy.app.version_string,'blendSha256':hashlib.sha256((S/'ant.blend').read_bytes()).hexdigest(),'meshes':len(meshes),'poses':len(G['records']),'fixedMeshScales':True,'fixedGeometryAndHeadVolume':True,'fixedLegLengths':G['fixedLegLengths'],'actualSegmentChecks':segments,'actualGroundContacts':contacts,'actualContactTable':table,'actualLandings':landings,'doubleSupportPoses':[r['pose'] for r in table if len(r['actualContacts'])==6],'noWholeAnimalFlight':True,'maxFreshProjectionErrorPixels':error},indent=2)+'\n',encoding='utf-8');print('ANT_SOURCE_AUDIT_OK',segments,contacts,error,landings)
