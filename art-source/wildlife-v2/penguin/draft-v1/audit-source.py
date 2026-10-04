"""Fresh .blend process: mesh volume/scale, actual foot contacts and wing links."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/penguin/draft-v1';G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;cam=sc.camera;root=bpy.data.objects['ROOT-fixed-ground-water'];body=bpy.data.objects['BODY-rigid-posture'];head=bpy.data.objects['HEAD-rigid-fixed-volume'];meshes=[o for o in bpy.data.objects if o.type=='MESH']
def digest(o,top=False):return hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons] if top else [list(v.co) for v in o.data.vertices]).encode()).hexdigest()
assert {o.name:digest(o) for o in meshes}==G['meshLocalGeometrySha256'];assert {o.name:digest(o,True) for o in meshes}==G['meshTopologySha256'];assert hashlib.sha256((S/'penguin.blend').read_bytes()).hexdigest()==G['blendSha256']
assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale-6.4)<1e-6 and abs(cam.data.shift_y-12/64)<1e-6;assert abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-5
worst=0;legs=wings=contacts=water=heads=weightTransfers=0;fixedHead={};locks={};support={};swimBounds=[10,-10];tipStroke={}
def project(p):q=world_to_camera_view(sc,cam,p);return [q.x*64,(1-q.y)*64,q.z]
for r in G['records']:
 sc.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);bpy.context.view_layer.update();assert root.location.length==0
 rot=tuple(round(v,5) for row in head.matrix_world.to_3x3() for v in row);fixedHead.setdefault(r['facing'],set()).add(rot);heads+=1
 for o in meshes:
  assert all(abs(v-1)<1e-6 for v in o.scale);assert digest(o)==G['meshLocalGeometrySha256'][o.name]
  ws=[o.matrix_world@v.co for v in o.data.vertices];ps=[project(v) for v in ws];bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)];worst=max(worst,max(abs(a-b) for a,b in zip(bb,r['volumes'][o.name]['bbox'])))
  if r['swim']:assert min(v.z for v in ws)>0 and max(v.z for v in ws)<3;water+=1;swimBounds[0]=min(swimBounds[0],min(v.z for v in ws));swimBounds[1]=max(swimBounds[1],max(v.z for v in ws))
 for s,c in r['contacts'].items():
  a,b,d=[Vector(c[k]) for k in ['hip','knee','ankle']]
  for x,y,L,name in [(a,b,c['lengths'][0],'femur'),(b,d,c['lengths'][1],'tibia')]:
   assert abs((y-x).length-L)<1e-6;o=bpy.data.objects[f'leg-{s}-{name}'];assert (o.matrix_world.translation-body.matrix_world@((x+y)/2)).length<1e-6;legs+=1
  foot=bpy.data.objects['webbed-foot-'+s];actualZ=min((foot.matrix_world@v.co).z for v in foot.data.vertices)
  if c['planted']:
   assert abs(actualZ)<1e-6,(r['facing'],r['clip'],r['index'],s,actualZ);origin=body.matrix_world@Vector(c['footOrigin']);expected=root.matrix_world@Vector(c['ground']);assert (origin-expected).length<1e-6;contacts+=1
  elif not r['swim']:assert actualZ>0
  if r['clip']=='walk' and c['planted']:locks.setdefault((r['facing'],s,c['stanceEpoch']),[]).append(c['travelCompensated'])
 if r['clip']=='walk':
  support.setdefault(r['facing'],[]).append(sum(c['planted'] for c in r['contacts'].values()))
  planted=[s for s,c in r['contacts'].items() if c['planted']]
  if len(planted)==1:
   # Independent ground support polygon, not claimed whole-animal force model.
   foot=bpy.data.objects['webbed-foot-'+planted[0]];points=[foot.matrix_world@v.co for v in foot.data.vertices if abs((foot.matrix_world@v.co).z)<1e-6];cx=sum(p.x for p in points)/len(points);cy=sum(p.y for p in points)/len(points);points=sorted(points,key=lambda p:math.atan2(p.y-cy,p.x-cx));torso=body.matrix_world@Vector((0,0,1.08));cross=[]
   for a,b in zip(points,points[1:]+points[:1]):cross.append((b.x-a.x)*(torso.y-a.y)-(b.y-a.y)*(torso.x-a.x))
   assert min(cross)>-1e-6 or max(cross)<1e-6,(r['facing'],r['index'],planted,torso,cross);weightTransfers+=1
 for s,w in r['wings'].items():
  nodes=[Vector(p) for p in w['nodes']]
  for k,(a,b,L,part) in enumerate(zip(nodes,nodes[1:],w['lengths'],['upper','fore','tip'])):
   assert abs((b-a).length-L)<1e-6;o=bpy.data.objects[f'flipper-{part}-{s}'];assert (o.matrix_world.translation-body.matrix_world@((a+b)/2)).length<1e-6;axis=(o.matrix_world.to_3x3()@Vector((0,0,1))).normalized();expected=(body.matrix_world.to_3x3()@(b-a)).normalized();assert abs(abs(axis.dot(expected))-1)<1e-6;wings+=1
  if r['swim']:
   worldNodes=[body.matrix_world@p for p in nodes];heading=(root.matrix_world.to_3x3()@Vector((0,1,0))).normalized();assert (worldNodes[-1]-worldNodes[0]).dot(heading)<0;tipStroke.setdefault((r['facing'],s),[]).append(round(worldNodes[-1].z,5))
# First swing sample has q0 and actual web z0: count the lift-off endpoint as
# floor contact. Subsequent L7/R3 samples are airborne; phase signs unchanged.
assert all(v==[2,2,2,1,2,2,2,1] for v in support.values()),support
for values in locks.values():assert max((Vector(v)-Vector(values[0])).length for v in values)<1e-6
assert all(len(v)==1 for v in fixedHead.values()) and worst<.001
assert all(max(v)-min(v)>.9 for v in tipStroke.values())
report={'freshSavedSource':True,'meshes':len(meshes),'poses':len(G['records']),'fixedLegLinks':legs,'fixedFlipperLinks':wings,'actualGroundWebContacts':contacts,'torsoOverSingleSupportPolygonChecks':weightTransfers,'belowWaterMeshPoses':water,'swimWorldZBounds':swimBounds,'fixedHeadOrientationAllClips':heads,'unitMeshScaleAndGeometryHash':True,'projectionMaxErrorPixels':worst,'walkSupport':support,'footfalls':'Left0 right4, duty.75, q0 liftoff boundary floor contact counted; airborne apices L7/R3. Planted worldx inverse-compensates body waddle.','plantedTravelCompensation':'Local+Y .32units/cycle, contiguous supports locked','swimWingTipWorldZ':{f'{f}:{s}':v for (f,s),v in tipStroke.items()},'swimSweep':'All actual wing tips behind shoulder relative to swim heading; paired up/down feathering and small articulated bend.','limits':'Gentoo/pooled penguin research informs illustrative emperor schedule, not measured individual forces/speeds. Support check is torso-center geometric placement, not full mass/force dynamics.'}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('PENGUIN_SOURCE_AUDIT_OK',legs,wings,contacts,water,heads,worst,swimBounds)
