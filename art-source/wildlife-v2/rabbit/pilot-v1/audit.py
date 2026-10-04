"""One read-only fresh Blender audit of actual saved geometry and projection."""
from pathlib import Path
import bpy,math,json,hashlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/rabbit/pilot-v1'
G=json.loads((S/'projected-guides.json').read_text());scene=bpy.context.scene;cam=scene.camera;root=bpy.data.objects['ROOT-fixed-ground']
meshes=[o for o in bpy.data.objects if o.type=='MESH']
def geo(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
assert {o.name:geo(o) for o in meshes}==G['geometryHashes']
assert hashlib.sha256((S/'rabbit.blend').read_bytes()).hexdigest()==G['blendSha256']
assert abs(cam.data.ortho_scale-3.2)<1e-6
assert abs(math.degrees(math.atan2(cam.location.z,-cam.location.y))-40)<1e-6
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    assert all(fc.data_path!='scale' for fc in bag.fcurves),o.name
def projection(p):
    v=world_to_camera_view(scene,cam,p);return [v.x*32,(1-v.y)*32,v.z]
max_error=0;footfall={};contact_sequences={};planted_positions={}
for r in G['records']:
    scene.frame_set(r['frame']);root.rotation_euler.z=math.radians(G['facings'][r['facing']]);bpy.context.view_layer.update()
    assert tuple(root.location)==(0,0,0)
    assert tuple(bpy.data.objects['HEAD-stable-volume'].rotation_euler)==(0,0,0)
    for o in meshes:
        assert all(abs(v-1)<1e-6 for v in o.scale),(o.name,r['frame'])
        assert geo(o)==G['geometryHashes'][o.name]
        ps=[projection(o.matrix_world@v.co) for v in o.data.vertices]
        b=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
        max_error=max(max_error,max(abs(a-b) for a,b in zip(b,r['volumes'][o.name]['bounds'])))
        assert max_error<.001
    for name,c in r['contacts'].items():
        actual=bpy.data.objects[name+'-foot'].matrix_world.translation
        assert (actual-root.matrix_world@Vector(c['foot'])).length<1e-5
        a,k,f=[Vector(c[q]) for q in ['hip','knee','foot']]
        assert abs((k-a).length-c['lengths'][0])<1e-5 and abs((f-k).length-c['lengths'][1])<1e-5
        for part,p,q,length in [('upper',a,k,c['lengths'][0]),('lower',k,f,c['lengths'][1])]:
            obj=bpy.data.objects[name+'-'+part]
            assert (obj.matrix_world.translation-root.matrix_world@((p+q)/2)).length<1e-5
            direction=(obj.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
            assert abs(abs(direction.dot((root.matrix_world.to_3x3()@(q-p)).normalized()))-1)<1e-5
            assert abs(obj.dimensions.z-length)<1e-5
        actual_contact=abs((root.matrix_world.inverted()@actual).z-.055)<1e-6
        assert actual_contact==c['planted']
        if r['facing']=='down' and r['clip']=='hop':
            contact_sequences.setdefault(name,[]).append(actual_contact)
            if actual_contact:planted_positions.setdefault(name,[]).append(tuple(c['foot']))
for name,seq in contact_sequences.items():
    footfall[name]=[i for i in range(8) if seq[i] and not seq[(i-1)%8]]
    assert len(set(planted_positions[name]))==1,(name,'planted sliding')
assert footfall=={'fore-1':[4],'fore1':[5],'hind-1':[6],'hind1':[6]},footfall
assert all(not contact_sequences[n][i] for n in contact_sequences for i in [2,3])
report={'status':'passed source integrity; no artistic acceptance','blender':bpy.app.version_string,'blendSha256':G['blendSha256'],'geometryHashes':G['geometryHashes'],'topologyHashes':{o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes},'meshCount':len(meshes),'poseCount':len(G['records']),'fixedMeshGeometryAndUnitScale':True,'noScaleKeys':True,'rootFixed':True,'skullOrientationFixed':True,'maxProjectedBoundsErrorPixels':max_error,'actualContactSequences':contact_sequences,'actualLandingIndices':footfall,'allFeetFlightSamples':[2,3],'plantedAnklesFixed':True,'articulation':'rigid object joints, fixed-length 2-segment IK plus distinct long hind feet; no deforming skin export','cameraElevationAboveGroundDegrees':40,'density':10}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('RABBIT_SOURCE_AUDIT_OK',len(meshes),len(G['records']),footfall)
