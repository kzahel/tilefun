"""Fresh-process complete mesh invariance, real fixed lengths/projection/contacts."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/kangaroo/draft-v1';G=json.loads((S/'projected-guides.json').read_text());C=json.loads((R/'art-source/wildlife-v2/camera.json').read_text())
assert G['blendSha256']==hashlib.sha256((S/'kangaroo.blend').read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(S/'kangaroo.blend'));sc=bpy.context.scene;cam=sc.camera;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects['BODY-fixed-volume'];head=bpy.data.objects['HEAD-fixed-volume']
assert G['cameraContract']==C and cam.data.type=='ORTHO' and abs(cam.data.ortho_scale-9.6)<1e-6 and abs(cam.data.shift_y-20/96)<1e-6
assert (cam.location-Vector(C['cameraLocationAtDistance10'])).length<1e-6
meshes=[bpy.data.objects[n] for n in G['meshLocalGeometrySha256']];segments=tails=heads=contacts=0;maxError=0;minimum=1e9;contactRange=[1e9,-1e9];locked={}
for o in meshes:
 assert not o.data.shape_keys
 assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==G['meshLocalGeometrySha256'][o.name]
 assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][o.name]
for r in G['records']:
 root.rotation_euler.z=math.radians(C['modelYawDegrees'][r['facing']]);sc.frame_set(r['frame']);bpy.context.view_layer.update()
 assert (head.location-Vector((0,.64,3.70))).length<1e-6 and Vector(head.rotation_euler).length<1e-6;heads+=1
 assert (body.location-Vector(r['bodyDelta'])).length<1e-6
 for o in meshes+[body,head,root]:assert (o.scale-Vector((1,1,1))).length<1e-6
 for n,c in r['contacts'].items():
  lengths=[.85,1.10] if n.startswith('hind') else [.48,.45]
  for part,L,a,b in [('upper',lengths[0],'hip','joint'),('lower',lengths[1],'joint','distal')]:
   o=bpy.data.objects[n+'-'+part];aa=o.matrix_world@Vector((0,0,-L/2));bb=o.matrix_world@Vector((0,0,L/2));expected=[root.matrix_world@Vector(c[k]) for k in [a,b]];assert abs((bb-aa).length-L)<1e-6
   assert min((aa-expected[0]).length+(bb-expected[1]).length,(bb-expected[0]).length+(aa-expected[1]).length)<2e-6;segments+=1
  if n.startswith('hind'):
   for name in ['heel-'+n,'toe-'+n+'-4']:
    o=bpy.data.objects[name];z=min((o.matrix_world@v.co).z for v in o.data.vertices)
    if c['planted']:assert abs(z)<1e-6,(r['clip'],r['index'],name,z);contacts+=1;contactRange=[min(contactRange[0],z),max(contactRange[1],z)]
    else:assert z>.005,(r['clip'],r['index'],name,z)
   if r['clip']=='hop' and c['planted']:
    k=(r['facing'],n,c['stanceEpoch']);v=c['travelCompensatedGround']
    if k in locked:assert math.dist(v,locked[k])<1e-6
    else:locked[k]=v
 for j in range(5):
  o=bpy.data.objects['tail-link-'+str(j)];aa=o.matrix_world@Vector((0,0,-.55/2));bb=o.matrix_world@Vector((0,0,.55/2));ns=[root.matrix_world@Vector(r['tailNodes'][k]) for k in [j,j+1]];assert abs((bb-aa).length-.55)<1e-6 and (aa-ns[0]).length+(bb-ns[1]).length<2e-6;tails+=1
 for o in meshes:
  ws=[o.matrix_world@v.co for v in o.data.vertices];z=min(p.z for p in ws);minimum=min(minimum,z);assert z>=-1e-6,(r['clip'],r['index'],o.name,z)
  ps=[]
  for p in ws:q=world_to_camera_view(sc,cam,p);ps.append([q.x*96,(1-q.y)*96])
  bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)];err=max(abs(a-b) for a,b in zip(bb,r['volumes'][o.name]['bbox']));maxError=max(maxError,err);assert err<1e-4
hop=[r for r in G['records'] if r['facing']=='down' and r['clip']=='hop'];support=[sum(c['planted'] for c in r['contacts'].values()) for r in hop];assert support==[2,2,2,0,0,0,0,0,0,2]
landings=[{'pose':r['index'],'limbs':[n for n,c in r['contacts'].items() if c['planted'] and not hop[(r['index']-1)%10]['contacts'][n]['planted']]} for r in hop];landings=[e for e in landings if e['limbs']];assert landings==[{'pose':9,'limbs':['hind:-1','hind:1']}]
report={'status':'passed','meshes':len(meshes),'poses':len(G['records']),'fixedLimbChecks':segments,'fixedTailChecks':tails,'rigidHeadChecks':heads,'actualHeelFourthToeContacts':contacts,'actualContactRangeWorldZ':contactRange,'minimumWorldZ':minimum,'maxProjectionErrorPixels':maxError,'actualSupportSequence':support,'actualLandings':landings,'travelCompensatedLockedStanceGroups':len(locked),'limits':'Stylized40percent-duty vertical in-place hop; no force/tendon simulation or measured individual trajectories. Full fixed meshes remain in blend.'};(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('KANGAROO_SOURCE_AUDIT_OK',segments,tails,contacts,landings)
