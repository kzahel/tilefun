"""Independent evaluated saved-scene audit, without importing the builder."""
import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

S = Path(__file__).resolve().parent
ROOT = S.parents[3]
OUT = ROOT/'public/demos/wildlife-v2/horse/motion-study-v3'
bpy.ops.wm.open_mainfile(filepath=str(S/'horse-motion.blend'))
scene = bpy.context.scene
root = bpy.data.objects['ROOT-fixed-ground']
body = bpy.data.objects['BODY-rigid']
cam = scene.camera
meshes = [o for o in scene.objects if o.type == 'MESH']
offsets = {'hind-1':0, 'fore-1':.25, 'hind1':.5, 'fore1':.75}
lengths = {'fore':[.72,.98,.76,.22], 'hind':[.82,.98,.76,.23]}
geometry = lambda o: hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
hashes = {o.name:geometry(o) for o in meshes}
first = {}
contacts = links = planted_pairs = 0
max_length_error = max_slide = max_anchor_error = 0
records = []
for facing, yaw in json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text())['modelYawDegrees'].items():
    root.rotation_euler.z = math.radians(yaw)
    previous = {}
    for i in range(33):
        scene.frame_set(i+1)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        def point(name):
            return bpy.data.objects[name].evaluated_get(dg).matrix_world.translation.copy()
        evaluated_body = body.evaluated_get(dg)
        screen = world_to_camera_view(scene, cam, evaluated_body.matrix_world @ Vector((0,-.1,2.24)))
        ground = world_to_camera_view(scene, cam, root.matrix_world @ Vector((0,0,0)))
        max_anchor_error = max(max_anchor_error, abs(ground.x*80-40), abs((1-ground.y)*80-61))
        supports = 0
        pose_record = {'facing':facing, 'pose':i, 'bodyScreen':[screen.x*80,(1-screen.y)*80], 'joints':{}}
        for name, offset in offsets.items():
            end = 'fore' if name.startswith('fore') else 'hind'
            pts = [point(f'{name}-joint-{j}') for j in range(5)]
            for j, length in enumerate(lengths[end]):
                mesh = bpy.data.objects[f'{name}-link-{j}'].evaluated_get(dg)
                for sign, expected in [(-1,pts[j]), (1,pts[j+1])]:
                    actual = mesh.matrix_world @ Vector((0,0,sign*length/2))
                    assert (actual-expected).length < 2e-5, (name,i,j,'disconnected')
                error = abs((pts[j+1]-pts[j]).length-length)
                max_length_error = max(max_length_error,error)
                assert error < 2e-5
                links += 1
            hip_rest = Vector(((-1 if '-1' in name else 1)*.36, .95 if end=='fore' else -1.02, 2.55))
            assert (pts[0]-evaluated_body.matrix_world@hip_rest).length < 2e-5
            hoof = bpy.data.objects[f'{name}-hoof'].evaluated_get(dg)
            # Evaluated modifier mesh: test the actual rounded solid's sole.
            sole = min((hoof.matrix_world@v.co).z for v in hoof.data.vertices)
            phase = (i/32-offset)%1
            planted = phase < .66
            assert sole > -2e-5, (name,i,sole)
            if planted:
                assert abs(sole) < 2e-5
                contacts += 1
                supports += 1
                # Undo facing only, then add the matching world travel.
                local = root.matrix_world.inverted()@pts[4]
                travelled = Vector((local.x,local.y+1.44*i/32,0))
                if name in previous and phase > previous[name][0]:
                    slide = (travelled-previous[name][1]).length
                    max_slide = max(max_slide,slide)
                    assert slide < 2e-5
                    planted_pairs += 1
                previous[name] = (phase,travelled)
            else:
                previous.pop(name,None)
            pose_record['joints'][name] = [list(p) for p in pts]
        assert supports in [2,3], (i,supports)
        for o in meshes:
            assert geometry(o) == hashes[o.name]
            assert all(abs(s-1)<1e-6 for s in o.scale)
        if i == 0:
            first = {o.name:o.matrix_world.copy() for o in meshes}
        if i == 32:
            assert all(max(abs(o.matrix_world[r][c]-first[o.name][r][c]) for r in range(4) for c in range(4)) < 2e-5 for o in meshes)
        records.append(pose_record)
    values = [p['bodyScreen'][1] for p in records if p['facing']==facing and p['pose']<32]
    assert max(values)-min(values)>1, (facing,values)
for o in scene.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    assert all(fc.data_path != 'scale' for fc in bag.fcurves)
assert hashlib.sha256((S.parent/'draft-v1/horse.blend').read_bytes()).hexdigest() == scene['sourceDraftSha256']
max_continuous_gap = max_rotation_step = 0
root.rotation_euler.z = 0
previous_rotations = {}
for i in range(65):
    scene.frame_set(1+i//2, subframe=(i%2)/2)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    for name in offsets:
        end = 'fore' if name.startswith('fore') else 'hind'
        for j,length in enumerate(lengths[end]):
            mesh = bpy.data.objects[f'{name}-link-{j}'].evaluated_get(dg)
            rotation = mesh.matrix_world.to_quaternion()
            if mesh.name in previous_rotations:
                dot = min(1,abs(rotation.dot(previous_rotations[mesh.name])))
                max_rotation_step = max(max_rotation_step, 2*math.acos(dot))
            previous_rotations[mesh.name] = rotation
            for sign,k in [(-1,j),(1,j+1)]:
                actual = mesh.matrix_world@Vector((0,0,sign*length/2))
                expected = bpy.data.objects[f'{name}-joint-{k}'].evaluated_get(dg).matrix_world.translation
                max_continuous_gap = max(max_continuous_gap,(actual-expected).length)
assert max_continuous_gap < .01, max_continuous_gap
assert max_rotation_step < math.radians(30), max_rotation_step
result = dict(identity='horse-motion-study-v3', status='prototype-checked-human-review-pending', poses=128, continuousSamples=65, maxContinuousEndpointErrorWorldUnits=max_continuous_gap, maxHalfPoseRotationStepDegrees=math.degrees(max_rotation_step), fixedLengthLinkChecks=links, plantedGroundContacts=contacts, plantedTravelPairs=planted_pairs, maxLengthErrorWorldUnits=max_length_error, maxContactSlideWorldUnits=max_slide, maxGroundAnchorErrorPixels=max_anchor_error, bodyVerticalRangePixels={f:round(max(r['bodyScreen'][1] for r in records if r['facing']==f)-min(r['bodyScreen'][1] for r in records if r['facing']==f),4) for f in ['down','up','left','right']}, meshLocalGeometrySha256=hashes, records=records)
(OUT/'source-audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print('HORSE_MOTION_AUDIT_OK', links, contacts, planted_pairs)
