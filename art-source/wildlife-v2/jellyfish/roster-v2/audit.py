"""Independent saved jellyfish volume, manifold and articulation checks."""
import bpy,math,json,hashlib,os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent;O=Path(os.environ.get('WILDLIFE_OUTPUT_DIR',str(ROOT/'public/demos/wildlife-v2/jellyfish/roster-v2')))
bpy.ops.wm.open_mainfile(filepath=str(S/'jellyfish.blend'));scene=bpy.context.scene;root=bpy.data.objects['ROOT-water'];body=bpy.data.objects['BODY-floating'];bell=bpy.data.objects['BELL-volume-preserving'];meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
def volume(m):
 m.calc_loop_triangles();return abs(sum(m.vertices[t.vertices[0]].co.dot(m.vertices[t.vertices[1]].co.cross(m.vertices[t.vertices[2]].co)) for t in m.loop_triangles)/6)
hashes={o.name:geometry(o) for o in meshes};baseline=volume(bell.data);assert baseline>0
edges={}
for f in bell.data.polygons:
 for a,b in zip(f.vertices,list(f.vertices[1:])+[f.vertices[0]]):
  e=tuple(sorted([a,b]));edges[e]=edges.get(e,0)+1
assert all(n==2 for n in edges.values()),'Bell must be closed/manifold'
lengths=json.loads(scene['tendrilLengths']);oral_lengths=json.loads(scene['oralLengths']);checks=volume_checks=0;gap=rotation=volume_error=attachment=0;records=[]
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
 root.rotation_euler.z=math.radians(yaw)
 for clip,start,count,step in [('pulse',10,32,4),('action',160,8,10)]:
  last={};initial={};initial_bell=None
  for i in range(count*4+1):
   frame=start+i*step/4;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
   def obj(n):return bpy.data.objects[n].evaluated_get(dg)
   b=bell.evaluated_get(dg);m=b.to_mesh();error=abs(volume(m)/baseline-1);volume_error=max(volume_error,error);assert error<2e-6,(clip,i,error);volume_checks+=1
   r=1+root['amplitude']*math.sin(2*math.pi*root['phase'])
   for prefix,total,Ls in [('tendril',8,lengths),('oral',4,oral_lengths)]:
    for n in range(total):
     name=f'{prefix}{n}';ps=[obj(f'{name}-joint-{j}').matrix_world.translation.copy() for j in range(len(Ls)+1)]
     if prefix=='tendril':
      a=n*math.pi/4;expected=bm@Vector((scene['bellRadius']*r*math.cos(a),scene['bellRadius']*r*math.sin(a),1.02));error=(ps[0]-expected).length;attachment=max(attachment,error);assert error<.002
     for j,L in enumerate(Ls):
      link=obj(f'{name}-link-{j}')
      for sign,k in [(-1,j),(1,j+1)]:
       error=(link.matrix_world@Vector((0,0,sign*L/2))-ps[k]).length;gap=max(gap,error);assert error<.02,(clip,i,name,j,error)
      if i%2==0:assert abs((ps[j+1]-ps[j]).length-L)<1e-5;checks+=1
      q=link.matrix_world.to_quaternion()
      if link.name in last:
       angle=2*math.acos(min(1,abs(q.dot(last[link.name]))));rotation=max(rotation,angle);assert angle<math.radians(40)
      last[link.name]=q
   for o in meshes:
    assert geometry(o)==hashes[o.name];assert all(abs(s-1)<1e-6 for s in o.scale)
   if i==0:initial={o.name:o.matrix_world.copy() for o in meshes};initial_bell=[v.co.copy() for v in m.vertices]
   if i==count*4:
    assert all(max(abs(o.matrix_world[a][c]-initial[o.name][a][c]) for a in range(4) for c in range(4))<1e-5 for o in meshes)
    assert all((v.co-previous).length<1e-5 for v,previous in zip(m.vertices,initial_bell))
   if clip=='pulse':
    points=[world_to_camera_view(scene,scene.camera,b.matrix_world@v.co) for v in m.vertices];records.append(dict(facing=facing,width=(max(p.x for p in points)-min(p.x for p in points))*32))
   b.to_mesh_clear()
for o in scene.objects:
 if not o.animation_data or not o.animation_data.action:continue
 for layer in o.animation_data.action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
result=dict(identity='jellyfish-roster-v2',status='mechanics-checked-final-pixels-pending-human-review',allClipPoses=164,continuousPulseSamplesPerFacing=129,continuousActionSamplesPerFacing=33,closedBellVolumeChecks=volume_checks,maxRelativeBellVolumeError=volume_error,closedBellManifoldEdges=len(edges),fixedLengthTendrilLinkChecks=checks,maxContinuousEndpointGapWorldUnits=gap,maxBellAttachmentGapWorldUnits=attachment,maxQuarterPoseRotationStepDegrees=math.degrees(rotation),meshLocalGeometrySha256=hashes,bellWidthRangePixels={f:max(r['width'] for r in records if r['facing']==f)-min(r['width'] for r in records if r['facing']==f) for f in ['down','up','left','right']})
assert all(v>=2 for v in result['bellWidthRangePixels'].values());(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print('JELLYFISH_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
