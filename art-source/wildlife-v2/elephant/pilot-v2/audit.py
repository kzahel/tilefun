"""Fresh saved-source audit: immutable mesh volumes, contacts and camera.
Run Blender with elephant.blend BEFORE this script. No drawing inputs.
"""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/elephant/pilot-v2'
G=json.loads((S/'projected-guides.json').read_text());scene=bpy.context.scene;cam=scene.camera
root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects['BODY-weight-shift'];head=bpy.data.objects['HEAD-fixed-orientation']
meshes=[o for o in bpy.data.objects if o.type=='MESH']
geometry={o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
topology={o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}
assert geometry==G['meshLocalGeometrySha256']
assert topology==G['meshTopologySha256']
assert hashlib.sha256((S/'elephant.blend').read_bytes()).hexdigest()==G['blendSha256']
assert cam.data.type=='ORTHO' and abs(cam.data.ortho_scale/112-.1)<1e-6
assert abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-5
assert abs(cam.data.shift_y-24/112)<1e-6
def project(p):
    q=world_to_camera_view(scene,cam,p);return [q.x*112,(1-q.y)*112,q.z]
worst=0;scales=set();contacts=0;lengths={}
for r in G['records']:
    scene.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']])
    bpy.context.view_layer.update()
    assert tuple(root.location)==(0,0,0)
    assert tuple(head.rotation_euler)==(0,0,0)
    for o in meshes:
        assert all(abs(v-1)<1e-6 for v in o.scale)
        digest=hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
        assert digest==geometry[o.name]
        ps=[project(o.matrix_world@v.co) for v in o.data.vertices]
        bounds=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
        error=max(abs(a-b) for a,b in zip(bounds,r['volumes'][o.name]['bbox']))
        worst=max(worst,error);assert error<.001,(r['facing'],r['frame'],o.name,error)
    for n,c in r['contacts'].items():
        o=bpy.data.objects[n+'-foot-volume']
        assert (o.matrix_world.translation-root.matrix_world@Vector(c['foot'])).length<1e-5
        assert abs(c['ground'][2])<1e-7 if c['planted'] else c['ground'][2]>0
        assert abs((Vector(c['hip'])-Vector(c['knee'])).length-1.10*1.12)<1e-6
        assert abs((Vector(c['foot'])-Vector(c['knee'])).length-.98*1.12)<1e-6
        contacts+=1
    for i in range(5):
        mesh=bpy.data.objects[f'trunk-{i}-volume']
        points=[root.matrix_world@Vector(p) for p in r['trunkWorld'][i:i+2]]
        assert abs((points[1]-points[0]).length-.55*1.12)<1e-6
        assert (mesh.matrix_world.translation-(points[0]+points[1])/2).length<1e-5
        axis=(mesh.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
        assert abs(abs(axis.dot((points[1]-points[0]).normalized()))-1)<1e-5
        lengths[i]=.55*1.12
    assert max(abs(a-b) for a,b in zip(project(head.matrix_world.translation),r['head']))<.001
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
report={'status':'passed source invariance; no artistic approval','blender':bpy.app.version_string,'blendSha256':G['blendSha256'],'meshes':len(meshes),'poses':len(G['records']),'contactChecks':contacts,'maxFreshProjectionErrorPixels':worst,'meshGeometrySha256':geometry,'meshTopologySha256':topology,'fixedMeshScales':True,'noScaleKeys':True,'fixedRoot':True,'headOrientationFixed':True,'limbLengths':[1.232,1.0976],'trunkSegmentLengths':lengths,'rig':'editable object-rigid two-link IK and retained five-segment trunk; no deforming engine skeleton export'}
walk=sorted([r for r in G['records'] if r['facing']=='down' and r['clip']=='walk'],key=lambda r:r['index'])
footfalls=[]
for i,r in enumerate(walk):
    previous=walk[(i-1)%12]
    for n,c in r['contacts'].items():
        if c['planted'] and not previous['contacts'][n]['planted']:footfalls.append([i,n])
assert footfalls==[[0,'hind--1'],[3,'fore--1'],[6,'hind-1'],[9,'fore-1']],footfalls
report['lateralFootfallSequence']=footfalls
report['sourceRevision']='elephant/pilot-v2'
report['inheritedGeometryIdentity']='elephant-pilot-v1-geometry-06'
report['contactSequenceReference']='https://pubmed.ncbi.nlm.nih.gov/16985198/'
report['walkContactTable']=[{'sample':r['index'],'planted':[n for n,c in r['contacts'].items() if c['planted']],'swing':[n for n,c in r['contacts'].items() if not c['planted']]} for r in walk]
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('FRESH_ELEPHANT_SOURCE_AUDIT_OK',len(G['records']),contacts,worst)
