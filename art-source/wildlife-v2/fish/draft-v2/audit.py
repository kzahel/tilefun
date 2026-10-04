"""Fresh saved-source audit: actual axial chain, rigid geometry and water depth."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/fish/draft-v2';G=json.loads((S/'projected-guides.json').read_text());sc=bpy.context.scene;cam=sc.camera;root=bpy.data.objects['ROOT-fixed-pond-anchor'];W=48
assert hashlib.sha256((S/'fish.blend').read_bytes()).hexdigest()==G['blendSha256'];scales={o.name:tuple(o.scale) for o in bpy.data.objects};error=0;links=0;waterchecks=0;table=[]
for n,h in G['meshLocalGeometrySha256'].items():
 o=bpy.data.objects[n];assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==h;assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][n]
for o in bpy.data.objects:
 if o.animation_data and o.animation_data.action:
  for layer in o.animation_data.action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
def project(v):q=world_to_camera_view(sc,cam,v);return [q.x*W,(1-q.y)*W]
minz=100;maxz=-100
for r in G['records']:
 root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);sc.frame_set(r['frame']);bpy.context.view_layer.update();assert root.location.length==0;assert not r['contacts'];assert r['media']['waterSurfaceZ']==1.2
 for o in bpy.data.objects:assert tuple(o.scale)==scales[o.name]
 for n,v in r['volumes'].items():
  o=bpy.data.objects[n];vs=[o.matrix_world@p.co for p in o.data.vertices];ps=[project(p) for p in vs];bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)];error=max(error,max(abs(a-b) for a,b in zip(bb,v['bbox'])));zs=[p.z for p in vs];minz=min(minz,min(zs));maxz=max(maxz,max(zs));assert min(zs)>0 and max(zs)<1.2,(n,min(zs),max(zs));waterchecks+=1
 for parent,child,length in [('SPINE1-posterior','SPINE2-peduncle',.30),('SPINE2-peduncle','CAUDAL-fork',.28)]:
  a,b=bpy.data.objects[parent],bpy.data.objects[child];assert abs((a.matrix_world.translation-b.matrix_world.translation).length-length)<1e-6;links+=1
 assert tuple(bpy.data.objects['HEAD-fixed-volume'].location)==tuple(Vector((0,.45,.015)))
 assert Vector(bpy.data.objects['HEAD-fixed-volume'].rotation_euler).length==0;assert Vector(bpy.data.objects['TORSO-stable-volume'].rotation_euler).length==0
 if r['facing']=='down' and r['clip']=='swim':
  a=bpy.data.objects['CAUDAL-fork'];tip=a.matrix_world@Vector((0,-.43,.32));table.append({'pose':r['index'],'spine1Degrees':math.degrees(bpy.data.objects['SPINE1-posterior'].rotation_euler.z),'spine2Degrees':math.degrees(bpy.data.objects['SPINE2-peduncle'].rotation_euler.z),'caudalDegrees':math.degrees(a.rotation_euler.z),'tailTipWorld':list(tip),'tailTipScreen':project(tip)})
assert error<.0001;assert abs(cam.data.ortho_scale-4.8)<1e-6
assert max(t['tailTipWorld'][0] for t in table)-min(t['tailTipWorld'][0] for t in table)>.30
report={'status':'source integrity passed; visual judgment separate','blender':bpy.app.version_string,'blendSha256':G['blendSha256'],'meshes':len(G['meshLocalGeometrySha256']),'poses':len(G['records']),'fixedMeshScales':True,'noScaleKeys':True,'fixedHeadAndAnteriorVolume':True,'axialLengths':[.30,.28],'axialLinkChecks':links,'waterVolumeChecks':waterchecks,'minWorldZ':minz,'maxWorldZ':maxz,'waterSurfaceZ':1.2,'groundContacts':0,'maxFreshProjectionErrorPixels':error,'actualAxialPhaseTable':table,'tailTipLateralPeakToPeak':max(t['tailTipWorld'][0] for t in table)-min(t['tailTipWorld'][0] for t in table),'contactDesign':'Suspended below fixed water surface, above pond ground. No feet or hard contacts. Actual axial links/fins supply swim articulation; no body/head scaling or root travel.','references':['https://invasions.si.edu/nemesis/species_summary/163350','https://www.mdpi.com/2410-3888/9/9/365']}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('FISH_SOURCE_AUDIT_OK',links,waterchecks,error,minz,maxz)
