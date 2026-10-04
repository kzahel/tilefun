"""Fresh-process saved robin source/geometry/contact/rigid skull audit."""
import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/robin/draft-v2';G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;cam=sc.camera;root=bpy.data.objects['ROOT-ground-fixed'];W=32
assert hashlib.sha256((S/'robin.blend').read_bytes()).hexdigest()==G['blendSha256']
scales={o.name:tuple(o.scale) for o in bpy.data.objects};count=links=0;error=0;headlocal=None
for n,h in G['meshLocalGeometrySha256'].items():
 o=bpy.data.objects[n];assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==h
 assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][n]
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
def project(v):q=world_to_camera_view(sc,cam,v);return [q.x*W,(1-q.y)*W]
for r in G['records']:
 root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);sc.frame_set(r['frame']);bpy.context.view_layer.update();assert root.location.length==0
 for o in bpy.data.objects:assert tuple(o.scale)==scales[o.name],(r['frame'],o.name)
 for n,v in r['volumes'].items():
  o=bpy.data.objects[n];ps=[project(o.matrix_world@p.co) for p in o.data.vertices];bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)];error=max(error,max(abs(a-b) for a,b in zip(bb,v['bbox'])))
 for s,c in r['contacts'].items():
  for kind,a,b,length in [('femur','hip','knee',.12),('tibia','knee','hock',.15),('tarsus','hock','ankle',.13)]:
   assert abs((Vector(c[a])-Vector(c[b])).length-length)<1e-6
   obj=bpy.data.objects[f'leg-{s}-{kind}-volume'];aa=obj.matrix_world@Vector((0,0,-length/2));bb=obj.matrix_world@Vector((0,0,length/2));assert min((aa-root.matrix_world@Vector(c[a])).length,(bb-root.matrix_world@Vector(c[a])).length)<1e-6
  ctl=bpy.data.objects['FOOT-'+s];z=min((bpy.data.objects[f'toe-{s}-{j}-volume'].matrix_world@v.co).z for j in range(4) for v in bpy.data.objects[f'toe-{s}-{j}-volume'].data.vertices)
  assert abs(z-c['foot'][2])<1e-6;assert (z<1e-7)==c['planted'];count+=1
  sh,el=bpy.data.objects['SHOULDER-'+s],bpy.data.objects['ELBOW-'+s];assert abs((el.matrix_world.translation-sh.matrix_world.translation).length-math.hypot(.22,.08))<1e-6;links+=1
table=[{'pose':r['index'],'planted':[s for s,c in r['contacts'].items() if c['planted']],'state':r['contacts']['-1']['state'],'bodyZ':bpy.data.objects['BODY-hop-flight'].location.z,'footZ':r['contacts']['-1']['foot'][2]} for r in G['records'] if r['facing']=='left' and r['clip']=='hop']
# Table body Z comes from the independently retained contact hip minus fixed local hip.
for t in table:
 r=next(r for r in G['records'] if r['facing']=='left' and r['clip']=='hop' and r['index']==t['pose']);t['bodyZ']=r['contacts']['-1']['hip'][2]-.22
landings=[]
for i,t in enumerate(table):
 for s in t['planted']:
  if s not in table[(i-1)%8]['planted']:landings.append([i,s])
assert landings==[[5,'-1'],[5,'1']],landings
assert [t['pose'] for t in table if not t['planted']]==[2,3,4]
assert table[3]['footZ']-table[3]['bodyZ']>table[1]['footZ']-table[1]['bodyZ']+.07
assert error<.0001;assert abs(cam.data.ortho_scale-3.2)<1e-6
report={'status':'source integrity passed; not visual approval','blender':bpy.app.version_string,'blendSha256':G['blendSha256'],'meshes':len(G['meshLocalGeometrySha256']),'poses':len(G['records']),'contactChecks':count,'wingLinkChecks':links,'maxFreshProjectionErrorPixels':error,'fixedMeshScales':True,'noScaleKeys':True,'fixedSkullGeometry':True,'legLengths':[.12,.15,.13],'wingLinkLength':math.hypot(.22,.08),'hopContactTable':table,'actualHopLandings':landings,'airborneHopPoses':[2,3,4],'pairedHopDesign':'Gather/push and paired flight; feet tuck closer to belly at apex, then extend for both-foot landing. Stylized robin gait, not measured species kinematics.','references':['https://ebird.org/species/eurrob1/IS','https://www.rspb.org.uk/birds-and-wildlife/robin']}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('ROBIN_SOURCE_AUDIT_OK',count,links,error,landings)
