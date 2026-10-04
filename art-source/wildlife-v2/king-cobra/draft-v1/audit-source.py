"""Fresh-process saved mesh, scale, actual articulation, contact and projection audit."""
import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/king-cobra/draft-v1'
G=json.loads((S/'projected-guides.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(S/'king-cobra.blend'))
scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];cam=scene.camera
assert hashlib.sha256((S/'king-cobra.blend').read_bytes()).hexdigest()==G['blendSha256']
assert abs(cam.data.ortho_scale-9.6)<1e-6 and abs(cam.data.shift_y-.125)<1e-7
assert abs(math.degrees(math.atan2(cam.location.z,math.hypot(cam.location.x,cam.location.y)))-40)<1e-5
checks=0;contactChecks=0;projectionError=0;endpointError=0;minz=1;maxz=-1
meshes=[bpy.data.objects[n] for n in G['meshLocalGeometrySha256']]
for o in meshes:
    assert list(o.scale)==[1,1,1]
    assert hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()==G['meshLocalGeometrySha256'][o.name]
    assert hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest()==G['meshTopologySha256'][o.name]
for r in G['records']:
    root.rotation_euler.z=math.radians(G['cameraContract']['modelYawDegrees'][r['facing']]);scene.frame_set(r['frame']);bpy.context.view_layer.update()
    assert list(root.location)==[0,0,0]
    h=bpy.data.objects['HEAD-rigid'];assert (h.location-Vector((0,.20,1.82))).length<1e-6
    assert list(h.scale)==[1,1,1] and list(h.rotation_euler)==[0,0,0]
    for j in range(15):
        o=bpy.data.objects['body-link-%02d'%j]
        a=o.matrix_world@Vector((0,0,0));b=o.matrix_world@Vector((0,0,G['linkLength']))
        assert abs((b-a).length-G['linkLength'])<1e-6
        intended=[root.matrix_world@Vector(p) for p in r['nodesWorld'][j:j+2]]
        err=max((a-intended[0]).length,(b-intended[1]).length);endpointError=max(endpointError,err);assert err<1e-6
        checks+=1
    for o in meshes:
        ws=[o.matrix_world@v.co for v in o.data.vertices]
        ps=[]
        for v in ws:
            q=world_to_camera_view(scene,cam,v);ps.append([q.x*96,(1-q.y)*96])
        bb=[min(p[0] for p in ps),min(p[1] for p in ps),max(p[0] for p in ps),max(p[1] for p in ps)]
        err=max(abs(a-b) for a,b in zip(bb,r['volumes'][o.name]['bbox']));projectionError=max(projectionError,err);assert err<1e-4
        if o.name in r['contacts']:
            z=min(v.z for v in ws);minz=min(minz,z);maxz=max(maxz,z)
            assert z>=-1e-6 and z<.0002
            assert abs(z-r['contacts'][o.name]['minWorldZ'])<1e-6;contactChecks+=1
sequence=[]
walk=[r for r in G['records'] if r['facing']=='down' and r['clip']=='slither']
for j in range(15):
    peak=max(walk,key=lambda r:r['anglesDegrees'][j])['index'];assert peak==(j+2)%8
    sequence.append({'link':j,'maximumLeftBendPose':peak,'support':'continuous sliding belly contact in all eight poses'})
report={'status':'passed','meshes':len(meshes),'poses':len(G['records']),'fixedLengthLinkChecks':checks,'groundContactChecks':contactChecks,'contactMinMaxZ':[minz,maxz],'maxEndpointErrorWorld':endpointError,'maxProjectionErrorPixels':projectionError,'actualBendWaveSequence':sequence,'bodyHeadScale':[1,1,1],'gaitLimit':'Raised forebody held fixed. Posterior undulation is stylized defensive movement, not a measured species speed or friction simulation. No feet or discrete footfall sequence.'}
(O/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('COBRA_SOURCE_AUDIT_OK',checks,contactChecks,endpointError,projectionError)
