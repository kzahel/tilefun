"""Read-only fresh-process audit of the saved fox source; run after its .blend path."""
import hashlib
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[4]
scene = bpy.context.scene
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
initial = {o.name:hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest() for o in meshes}
topology_hashes={o.name:hashlib.sha256(json.dumps([list(p.vertices) for p in o.data.polygons]).encode()).hexdigest() for o in meshes}
guides=json.loads((Path(__file__).parent/'projected-guides.json').read_text())
assert initial==guides['meshLocalGeometrySha256']
assert hashlib.sha256((Path(__file__).parent/'fox.blend').read_bytes()).hexdigest()==guides['blendSha256']
skull=bpy.data.objects['skull-volume']
assert abs(skull.dimensions.x-.78)<1e-5
samples = {}
for frame in [1,*range(10,19),*range(30,39)]:
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    assert tuple(bpy.data.objects['ROOT-fixed-ground'].location)==(0,0,0)
    for o in meshes:
        assert all(abs(s-1)<1e-6 for s in o.scale), (frame,o.name,list(o.scale))
        digest = hashlib.sha256(json.dumps([list(v.co) for v in o.data.vertices]).encode()).hexdigest()
        assert digest==initial[o.name], (frame,o.name,'local geometry changed')
    assert tuple(bpy.data.objects['HEAD-fixed-orientation'].rotation_euler)==(0,0,0)
    samples[frame] = {name:list(bpy.data.objects[name].matrix_world.translation) for name in ['skull-volume','trunk-volume','fore--1-paw-volume','hind-1-paw-volume','tail-3-volume']}
for o in bpy.data.objects:
    if o.animation_data and o.animation_data.action:
        for layer in o.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    assert all(fc.data_path!='scale' for fc in bag.fcurves),o.name
for name in ['skull-volume','trunk-volume']:
    assert len({tuple(s[name]) for s in samples.values()})==1
assert len({tuple(samples[f]['fore--1-paw-volume']) for f in range(10,18)})>=6
assert len({tuple(samples[f]['tail-3-volume']) for f in range(30,38)})>=6
report = {'status':'passed saved-source integrity; no artistic acceptance','source':'art-source/wildlife-v2/fox/pilot-v2/fox.blend','blender':bpy.app.version_string,'meshCount':len(meshes),'meshGeometryHashes':initial,'meshTopologyHashes':topology_hashes,'frameSamples':samples,'fixedLocalGeometry':True,'noScaleKeys':True,'rootFixed':True,'bodyAndHeadVolumeFixed':True,'articulation':'Object-rigid rig with analytical fixed-length two-segment limb IK; tail joint volumes; ear hinge controls. No deforming armature export.'}
path = ROOT/'public/demos/wildlife-v2/fox/pilot-v2/source-audit.json'
path.write_text(json.dumps(report,indent=2)+'\n')
print('SAVED_FOX_SOURCE_AUDIT_OK',len(meshes),len(samples))
