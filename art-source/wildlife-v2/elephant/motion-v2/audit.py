"""Independent saved-scene invariants; never import the motion builder."""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[4];species='elephant'
S=ROOT/f'art-source/wildlife-v2/{species}/motion-v2';O=ROOT/f'public/demos/wildlife-v2/{species}/motion-v2'
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'))
scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects[scene['bodyName']];cam=scene.camera
lengths=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);offsets=json.loads(scene['footfallOffsets'])
W=112;anchor=[56,80]
assert abs(scene.render.fps_base/scene.render.fps*scene['walkFrameStep']*1000-scene['frameDurationMs'])<1e-6
meshes=[o for o in scene.objects if o.type=='MESH']
def geometry(o):return hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes={o.name:geometry(o) for o in meshes}
link_checks=contact_checks=travel_checks=0;max_gap=max_rotation=max_slide=0;records=[]
for facing,yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
    root.rotation_euler.z=math.radians(yaw);previous={};initial={};last_rotations={}
    for i in range(65):
        sample=10+i/2*scene['walkFrameStep'];scene.frame_set(math.floor(sample),subframe=sample%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
        def point(n):return bpy.data.objects[n].evaluated_get(dg).matrix_world.translation.copy()
        bm=body.evaluated_get(dg).matrix_world
        b=world_to_camera_view(scene,cam,bm@Vector(json.loads(scene['bodyAnchor'])))
        a=world_to_camera_view(scene,cam,root.matrix_world.translation)
        assert abs(a.x*W-anchor[0])<.001 and abs((1-a.y)*W-anchor[1])<.001
        supports=0
        for name,Ls in lengths.items():
            pts=[point(f'{name}-joint-{j}') for j in range(5)]
            for j,L in enumerate(Ls):
                mesh=bpy.data.objects[f'{name}-link-{j}'].evaluated_get(dg)
                for sign,k in [(-1,j),(1,j+1)]:
                    gap=(mesh.matrix_world@Vector((0,0,sign*L/2))-pts[k]).length
                    max_gap=max(max_gap,gap);assert gap<.02,(name,i,j,gap)
                if i%2==0:
                    assert abs((pts[j+1]-pts[j]).length-L)<1e-5;link_checks+=1
                q=mesh.matrix_world.to_quaternion()
                if mesh.name in last_rotations:
                    step=2*math.acos(min(1,abs(q.dot(last_rotations[mesh.name]))))
                    max_rotation=max(max_rotation,step);assert step<math.radians(40),(name,i,step)
                last_rotations[mesh.name]=q
            if i%2==0:
                assert (pts[0]-bm@Vector(rests[name])).length<1e-5
            hoof=bpy.data.objects[f'{name}-hoof'].evaluated_get(dg)
            sole=min((hoof.matrix_world@v.co).z for v in hoof.data.vertices);assert sole>-.00001
            phase=(i/64-offsets[name])%1;planted=phase<float(scene['stanceFraction'])
            if i%2==0 and planted:
                assert abs(sole)<.00001;contact_checks+=1;supports+=1
                local=root.matrix_world.inverted()@pts[4];travel=Vector((local.x,local.y+scene['strideWorldUnits']*i/64,0))
                if name in previous and phase>previous[name][0]:
                    drift=(travel-previous[name][1]).length;max_slide=max(max_slide,drift);assert drift<1e-5;travel_checks+=1
                previous[name]=(phase,travel)
            elif i%2==0:previous.pop(name,None)
        if i%2==0:assert supports in [2,3],(species,i,supports)
        for o in meshes:
            assert geometry(o)==hashes[o.name]
            assert all(abs(s-1)<1e-6 for s in o.scale)
        if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
        if i==64:assert all(max(abs(o.matrix_world[a][c]-initial[o.name][a][c]) for a in range(4) for c in range(4))<1e-5 for o in meshes)
        records.append(dict(facing=facing,sample=i,torso=[b.x*W,(1-b.y)*W]))
trunk_checks=tail_checks=0
for yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].values():
    root.rotation_euler.z=math.radians(yaw)
    for frame in json.loads(scene['motionClipFrames']):
        scene.frame_set(frame);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
        joints=[bpy.data.objects[n].evaluated_get(dg).matrix_world.translation for n in json.loads(scene['trunkJointNames'])]
        for i,name in enumerate(json.loads(scene['trunkLinkNames'])):
            obj=bpy.data.objects[name].evaluated_get(dg)
            for sign,index in [(-1,i),(1,i+1)]:assert (obj.matrix_world@Vector((0,0,sign*.616/2))-joints[index]).length<1e-5
            assert abs((joints[i+1]-joints[i]).length-.616)<1e-5;trunk_checks+=1
        bm=body.evaluated_get(dg).matrix_world;tail=bpy.data.objects['tail-volume'].evaluated_get(dg)
        base=bm@Vector((0,-1.97*1.12,2.85*1.12));tip=bpy.data.objects['tail-tuft'].evaluated_get(dg).matrix_world.translation
        assert abs((tip-base).length-1.3664)<1e-5
        for sign,target in [(-1,base),(1,tip)]:assert (tail.matrix_world@Vector((0,0,sign*1.3664/2))-target).length<1e-5
        tail_checks+=1
for o in scene.objects:
    if not o.animation_data or not o.animation_data.action:continue
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
assert hashlib.sha256((S.parent/f'pilot-v2/{species}.blend').read_bytes()).hexdigest()==scene['sourceDraftSha256']
result=dict(identity=f'{species}-motion-v2',status='mechanics-checked-final-pixels-pending-human-review',walkPoses=128,allClipPoses=164,trunkFixedLinkChecks=trunk_checks,tailFixedLinkChecks=tail_checks,continuousSamplesPerFacing=65,fixedLengthLinkChecks=link_checks,plantedGroundContacts=contact_checks,plantedTravelPairs=travel_checks,maxContinuousEndpointGapWorldUnits=max_gap,maxHalfPoseRotationStepDegrees=math.degrees(max_rotation),maxContactSlideWorldUnits=max_slide,meshLocalGeometrySha256=hashes,bodyRangePixels={f:max(r['torso'][1] for r in records if r['facing']==f)-min(r['torso'][1] for r in records if r['facing']==f) for f in ['down','up','left','right']})
assert all(v>=1 for v in result['bodyRangePixels'].values())
(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print('LONG_LEGGED_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
