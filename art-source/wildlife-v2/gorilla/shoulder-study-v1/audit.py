"""Independent saved-scene invariants; never import the motion builder."""
import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[4];species='gorilla'
S=ROOT/f'art-source/wildlife-v2/{species}/shoulder-study-v1';O=ROOT/f'public/demos/wildlife-v2/{species}/shoulder-study-v1'
bpy.ops.wm.open_mainfile(filepath=str(S/f'{species}.blend'))
scene=bpy.context.scene;root=bpy.data.objects['ROOT-fixed-ground'];body=bpy.data.objects[scene['bodyName']];cam=scene.camera
lengths=json.loads(scene['limbLengths']);rests=json.loads(scene['hipRest']);offsets=json.loads(scene['footfallOffsets'])
W=96;anchor=[48,72]
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
            sole=min((part.evaluated_get(dg).matrix_world@v.co).z for part in [bpy.data.objects[f'{name}-hoof'],*bpy.data.objects[f'{name}-hoof'].children] if part.type=='MESH' for v in part.data.vertices);assert sole>-.00001
            phase=(i/64-offsets[name])%1;planted=phase<float(scene['stanceFraction'])
            if i%2==0 and planted:
                assert abs(sole)<.00001;contact_checks+=1;supports+=1
                local=root.matrix_world.inverted()@pts[4];travel=Vector((local.x,local.y+scene['strideWorldUnits']*i/64,0))
                if name in previous and phase>previous[name][0]:
                    drift=(travel-previous[name][1]).length;max_slide=max(max_slide,drift);assert drift<1e-5;travel_checks+=1
                previous[name]=(phase,travel)
            elif i%2==0:previous.pop(name,None)
        if i%2==0:assert supports in [3,4],(species,i,supports)
        for o in meshes:
            assert geometry(o)==hashes[o.name]
            assert all(abs(s-1)<1e-6 for s in o.scale)
        if i==0:initial={o.name:o.matrix_world.copy() for o in meshes}
        if i==64:assert all(max(abs(o.matrix_world[a][c]-initial[o.name][a][c]) for a in range(4) for c in range(4))<1e-5 for o in meshes)
        records.append(dict(facing=facing,sample=i,torso=[b.x*W,(1-b.y)*W]))
action_checks=0;action_gap=0;action_rotation=0
for yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].values():
    root.rotation_euler.z=math.radians(yaw);last={};initial_action={}
    for j in range(129):
        frame=260+j*.625;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();bm=body.evaluated_get(dg).matrix_world
        for name,Ls in lengths.items():
            ps=[bpy.data.objects[f'{name}-joint-{k}'].evaluated_get(dg).matrix_world.translation for k in range(5)]
            for k,L in enumerate(Ls):
                obj=bpy.data.objects[f'{name}-link-{k}'].evaluated_get(dg)
                for sign,index in [(-1,k),(1,k+1)]:
                    gap=(obj.matrix_world@Vector((0,0,sign*L/2))-ps[index]).length;action_gap=max(action_gap,gap);assert gap<.02,(j,name,k,gap)
                q=obj.matrix_world.to_quaternion()
                if obj.name in last:
                    step=2*math.acos(min(1,abs(q.dot(last[obj.name]))));action_rotation=max(action_rotation,step);assert step<math.radians(40),(j,name,k,step)
                last[obj.name]=q
                if j%8==0:assert abs((ps[k+1]-ps[k]).length-L)<1e-5;action_checks+=1
            if j%8==0:assert (ps[0]-bm@Vector(rests[name])).length<1e-5
            if name.startswith('hind'):
                raw=bpy.data.objects[f'{name}-hoof'];sole=min((part.evaluated_get(dg).matrix_world@v.co).z for part in [raw,*raw.children] if part.type=='MESH' for v in part.data.vertices);assert abs(sole)<1e-6
        if j==0:initial_action={o.name:o.matrix_world.copy() for o in meshes}
        if j==128:assert all(max(abs(o.matrix_world[a][c]-initial_action[o.name][a][c]) for a in range(4) for c in range(4))<1e-5 for o in meshes)
for o in scene.objects:
    if not o.animation_data or not o.animation_data.action:continue
    for layer in o.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:assert all(fc.data_path!='scale' for fc in bag.fcurves)
assert len(lengths)==4
result=dict(identity=f'{species}-shoulder-study-v1',status='mechanics-checked-final-pixels-pending-human-review',walkPoses=128,allClipPoses=196,chestBeatHalfSourceSamples=129,chestBeatFixedLinkChecks=action_checks,maxChestBeatEndpointGapWorldUnits=action_gap,maxChestBeatRotationStepDegrees=math.degrees(action_rotation),continuousSamplesPerFacing=65,fixedLengthLinkChecks=link_checks,plantedGroundContacts=contact_checks,plantedTravelPairs=travel_checks,maxContinuousEndpointGapWorldUnits=max_gap,maxHalfPoseRotationStepDegrees=math.degrees(max_rotation),maxContactSlideWorldUnits=max_slide,meshLocalGeometrySha256=hashes,bodyRangePixels={f:max(r['torso'][1] for r in records if r['facing']==f)-min(r['torso'][1] for r in records if r['facing']==f) for f in ['down','up','left','right']})
assert all(v>=1 for v in result['bodyRangePixels'].values())
(O/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print('LONG_LEGGED_AUDIT_OK',json.dumps(result|{'meshLocalGeometrySha256':'omitted'}))
