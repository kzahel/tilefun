"""Fresh-process saved geometry/projection/contact audit; no pixel inputs."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/giraffe/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;cam=sc.camera;W=144
root=bpy.data.objects['ROOT-fixed-ground'];head=bpy.data.objects['HEAD-fixed-volume']
meshes=[o for o in bpy.data.objects if o.type=='MESH']
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
topology={o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}
assert geometry==G['meshLocalGeometrySha256'];assert topology==G['meshTopologySha256']
assert hashlib.sha256((S/'giraffe.blend').read_bytes()).hexdigest()==G['blendSha256']
assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale/W-.1)<1e-6
assert abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-5
assert abs(cam.data.shift_y-48/144)<1e-6
def project(p):
 q=world_to_camera_view(sc,cam,p);return [q.x*W,(1-q.y)*W,q.z]
worst=0;contacts=0
for r in G['records']:
 sc.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);bpy.context.view_layer.update()
 assert tuple(root.location)==(0,0,0);assert tuple(head.rotation_euler)==(0,0,0)
 for o in meshes:
  assert all(abs(v-1)<1e-6 for v in o.scale)
  assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==geometry[o.name]
  ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
  b=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
  e=max(abs(a-b) for a,b in zip(b,r['volumes'][o.name]['bbox']));worst=max(worst,e);assert e<.001,(r['facing'],r['frame'],o.name,e)
 for n,c in r['contacts'].items():
  assert (bpy.data.objects[n+'-hoof-volume'].matrix_world.translation-root.matrix_world@Vector(c['foot'])).length<1e-5
  assert abs(c['ground'][2])<1e-7 if c['planted'] else c['ground'][2]>0
  points=[Vector(c[k]) for k in ['hip','proximal','joint','foot']]
  for i,(a,b,l) in enumerate(zip(points,points[1:],c['lengths'])):
   assert abs((a-b).length-l)<1e-6
   ob=bpy.data.objects[f'{n}-{i}-volume'];mid=root.matrix_world@((a+b)/2)
   assert (ob.matrix_world.translation-mid).length<1e-5
  contacts+=1
 for i,length in enumerate([.60,.58,.54]):
  a,b=[Vector(p) for p in r['tailWorld'][i:i+2]];assert abs((b-a).length-length)<1e-6
 assert max(abs(a-b) for a,b in zip(project(head.matrix_world.translation),r['head']))<.001
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
walk=sorted([r for r in G['records'] if r['facing']=='down' and r['clip']=='walk'],key=lambda r:r['index'])
falls=[]
for i,r in enumerate(walk):
 previous=walk[(i-1)%16]
 for n,c in r['contacts'].items():
  if c['planted'] and not previous['contacts'][n]['planted']:falls.append([i,n])
assert falls==[[0,'hind--1'],[2,'fore--1'],[8,'hind-1'],[10,'fore-1']],falls
report={'status':'saved-source integrity passed; visual gate separate','blender':bpy.app.version_string,'blendSha256':G['blendSha256'],'meshes':len(meshes),'poses':len(G['records']),'contactChecks':contacts,'maxFreshProjectionErrorPixels':worst,'meshGeometrySha256':geometry,'meshTopologySha256':topology,'fixedMeshScales':True,'noScaleKeys':True,'fixedRoot':True,'headOrientationFixed':True,'limbLengths':{'fore':[1.15,1.20,1.40],'hind':[.85,1.12,1.52]},'tailLengths':[.60,.58,.54],'actualFootfalls':falls,'walkContactTable':[{'sample':r['index'],'planted':[n for n,c in r['contacts'].items() if c['planted']],'swing':[n for n,c in r['contacts'].items() if not c['planted']]} for r in walk],'contactReference':'https://rvc-repository.worktribe.com/preview/1384470/11864.pdf','design':'16-pose lateral sequence approximately 69% stance and 12.5% ipsilateral phase, in-place stride; root travel belongs to a future controller. Three-link rigid limbs retain shoulder/elbow/carpus and hip/stifle/hock distinctions.'}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('GIRAFFE_FRESH_SOURCE_AUDIT_OK',contacts,worst,falls)
