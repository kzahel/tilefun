"""Fresh saved mallard geometry/media/contacts/wing linkage audit."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/mallard-duck/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;cam=sc.camera;root=bpy.data.objects['ROOT-fixed-ground'];head=bpy.data.objects['HEAD-fixed-volume'];W=48
meshes=[o for o in bpy.data.objects if o.type=='MESH'];geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes};topology={o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}
assert geometry==G['meshLocalGeometrySha256'];assert topology==G['meshTopologySha256'];assert hashlib.sha256((S/'mallard-duck.blend').read_bytes()).hexdigest()==G['blendSha256']
assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale/W-.1)<1e-6;assert abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-5
def project(p):q=world_to_camera_view(sc,cam,p);return [q.x*W,(1-q.y)*W,q.z]
worst=0;contacts=0;links=0
for r in G['records']:
 sc.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);bpy.context.view_layer.update()
 assert tuple(root.location)==(0,0,0);assert tuple(head.rotation_euler)==(0,0,0)
 for o in meshes:
  assert all(abs(v-1)<1e-6 for v in o.scale);assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==geometry[o.name]
  ps=[project(o.matrix_world@v.co) for v in o.data.vertices];bounds=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
  e=max(abs(a-b) for a,b in zip(bounds,r['volumes'][o.name]['bbox']));worst=max(worst,e);assert e<.001
 for s,c in r['contacts'].items():
  ctl=bpy.data.objects['FOOT-'+s];assert (ctl.matrix_world.translation-root.matrix_world@Vector(c['foot'])).length<1e-5
  a,b,d=[Vector(c[k]) for k in ['hip','joint','foot']];assert abs((a-b).length-.23)<1e-6;assert abs((b-d).length-.28)<1e-6
  web=bpy.data.objects[f'web-{s}-volume'];minz=min((web.matrix_world@v.co).z for v in web.data.vertices)
  if c['planted']:assert abs(minz)<1e-6
  if c['media']=='air':assert minz>.8 and not c['planted']
  if c['media']=='water':assert not c['planted'] and minz<.12
  contacts+=1
 for s in [-1,1]:
  sh=bpy.data.objects[f'WING-{s}'];el=bpy.data.objects[f'ELBOW-{s}'];assert abs((el.matrix_world.translation-sh.matrix_world.translation).length-math.hypot(.4,.16))<1e-6
  assert el.parent==sh;assert bpy.data.objects[f'primary-{s}-volume'].parent==el;links+=1
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
walk=sorted([r for r in G['records'] if r['facing']=='down' and r['clip']=='waddle'],key=lambda r:r['index']);falls=[]
for i,r in enumerate(walk):
 for s,c in r['contacts'].items():
  if c['planted'] and not walk[(i-1)%8]['contacts'][s]['planted']:falls.append([i,s])
assert falls==[[0,'-1'],[4,'1']],falls
report={'status':'saved source/media integrity passed; not art approval','blender':bpy.app.version_string,'blendSha256':G['blendSha256'],'meshes':len(meshes),'poses':len(G['records']),'contactChecks':contacts,'wingLinkChecks':links,'maxFreshProjectionErrorPixels':worst,'meshGeometrySha256':geometry,'meshTopologySha256':topology,'fixedMeshScales':True,'noScaleKeys':True,'fixedHeadVolume':True,'legLengths':[.23,.28],'fixedWingLinkLength':math.hypot(.4,.16),'actualWaddleLandings':falls,'walkContactTable':[{'sample':r['index'],'planted':[s for s,c in r['contacts'].items() if c['planted']],'lift':[s for s,c in r['contacts'].items() if not c['planted']]} for r in walk],'swimDesign':'Alternating power and feathered recovery; feet below water-plane z0.12, no ground contact. Rigid web folds35 degrees for reduced projected recovery area.','flightDesign':'Same body/head volumes; rigid head translates into a lower forward flight posture. Three media are separate clips. Closed primary/secondary fans pivot at fixed linked shoulder/elbow; feet tuck above ground.','references':['https://biewenerlab.oeb.harvard.edu/publications/dynamics-mallard-anas-platyrynchos-gastrocnemius-function-during-swimming','https://pmc.ncbi.nlm.nih.gov/articles/PMC12079667/']}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('MALLARD_FRESH_SOURCE_AUDIT_OK',contacts,links,worst,falls)
