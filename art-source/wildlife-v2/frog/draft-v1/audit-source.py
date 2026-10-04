"""Fresh Blender source invariance, anatomy, actual IK/contact and projection audit."""
import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/frog/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(S/'frog.blend'))
sc=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];cam=sc.camera
assert hashlib.sha256((S/'frog.blend').read_bytes()).hexdigest()==G['blendSha256']
assert abs(cam.data.ortho_scale-4.8)<1e-6 and abs(cam.data.shift_y-10/48)<1e-7
assert abs(math.degrees(math.atan2(cam.location.z,math.hypot(cam.location.x,cam.location.y)))-40)<1e-5
meshes=[bpy.data.objects[n] for n in G['meshLocalGeometrySha256']]
for o in meshes:
 assert list(o.scale)==[1,1,1] and not o.data.shape_keys
 assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==G['meshLocalGeometrySha256'][o.name]
 assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][o.name]
segments=contacts=water=0;maxError=0;minz=100
for r in G['records']:
 root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);sc.frame_set(r['frame']);bpy.context.view_layer.update()
 body=bpy.data.objects['BODY-fixed-volume'];head=bpy.data.objects['HEAD-fixed-volume']
 assert list(root.location)==[0,0,0] and list(body.scale)==list(head.scale)==[1,1,1]
 assert Vector(body.rotation_euler).length==Vector(head.rotation_euler).length==0
 assert (head.location-Vector((0,.34,.18))).length<1e-7
 assert abs(body.location.z-r['bodyZ'])<1e-6
 for n,c in r['contacts'].items():
  kind=n.split(':')[0];L1,L2=(.25,.25) if kind=='fore' else (.35,.37)
  assert abs(math.dist(c['hip'],c['knee'])-L1)<1e-6 and abs(math.dist(c['knee'],c['ankle'])-L2)<1e-6
  pairs=[('upper',c['hip'],c['knee'],L1),('lower',c['knee'],c['ankle'],L2)]
  if kind=='hind':pairs.append(('tarsus',c['ankle'],c['foot'],math.sqrt(.20**2+.02**2)))
  for part,a,b,L in pairs:
   o=bpy.data.objects[n+'-'+part];aa=o.matrix_world@Vector((0,0,-L/2));bb=o.matrix_world@Vector((0,0,L/2))
   assert abs((bb-aa).length-L)<1e-6
   assert (aa-root.matrix_world@Vector(a)).length<1e-6 and (bb-root.matrix_world@Vector(b)).length<1e-6;segments+=1
  footNames=[p for p in r['volumes'] if p.startswith('toe-'+n+'-') or p=='web-'+n]
  actualMin=min((bpy.data.objects[p].matrix_world@v.co).z for p in footNames for v in bpy.data.objects[p].data.vertices)
  assert abs(actualMin-min(r['volumes'][p]['minWorldZ'] for p in footNames))<1e-6
  if c['planted']:assert 0<=actualMin<.001;contacts+=1
  elif r['clip']!='swim':assert actualMin>.05
  if r['clip']=='swim':assert .70<actualMin<r['waterPlaneZ'];water+=1
 for o in meshes:
  ws=[o.matrix_world@v.co for v in o.data.vertices];minz=min(minz,min(p.z for p in ws));assert min(p.z for p in ws)>=-1e-6
  ps=[]
  for p in ws:
   q=world_to_camera_view(sc,cam,p);ps.append([q.x*48,(1-q.y)*48])
  bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
  err=max(abs(a-b) for a,b in zip(bb,r['volumes'][o.name]['bbox']));maxError=max(maxError,err);assert err<1e-4
sequence=[]
for r in G['records']:
 if r['facing']=='down' and r['clip']=='hop':sequence.append({'pose':r['index'],'bodyZ':r['bodyZ'],'planted':sorted(n for n,c in r['contacts'].items() if c['planted'])})
assert [len(e['planted']) for e in sequence]==[4,4,2,0,0,2,4,4]
assert all(n.startswith('hind') for n in sequence[2]['planted']) and all(n.startswith('fore') for n in sequence[5]['planted'])
report={'status':'passed','meshes':len(meshes),'poses':len(G['records']),'fixedSegmentChecks':segments,'plantedToeChecks':contacts,'aquaticFootChecks':water,'minActualMeshWorldZ':minz,'maxProjectionErrorPixels':maxError,'actualHopSupportSequence':sequence,'headBodyScale':[1,1,1],'limits':'Stylized vertical in-place hop; no horizontal root travel, force or fluid simulation. Related Rana locomotion references do not measure this particular common frog.'}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('FROG_SOURCE_AUDIT_OK',segments,contacts,water,maxError)
