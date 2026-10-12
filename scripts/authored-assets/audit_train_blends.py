"""Read-only packed train source audit in Blender: -- ROOT OUTPUT."""
import hashlib
import json
from pathlib import Path
import sys

import bpy

root,output=[Path(v).resolve() for v in sys.argv[sys.argv.index('--')+1:]]
catalog=json.loads((root/'art-source/train-models/catalog.json').read_text(encoding='utf-8'))
reports=[]
for bundle in catalog['bundles']:
    source=root/bundle['source'];rig=json.loads((source/'rig.json').read_text(encoding='utf-8'))
    recipe=json.loads((source/'recipe.json').read_text(encoding='utf-8'))
    bpy.ops.wm.open_mainfile(filepath=str(source/'car.blend'))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    triangles=0
    for mesh in meshes:
        mesh.data.calc_loop_triangles();triangles+=len(mesh.data.loop_triangles)
        assert mesh.data.uv_layers.active is not None
    assert len(meshes)==bundle['geometry']['meshObjects'] and triangles==bundle['geometry']['triangles']
    material=bpy.data.materials[recipe['projection']['material']]
    atlas=material.node_tree.nodes[recipe['projection']['textureNode']].image
    assert atlas.packed_file is not None
    assert hashlib.sha256(bytes(atlas.packed_file.data)).hexdigest()==hashlib.sha256((source/'car-atlas.png').read_bytes()).hexdigest()
    images=[i for i in bpy.data.images if i.type=='IMAGE' and i.source=='FILE']
    assert images and all(i.packed_file is not None for i in images)
    draft=bpy.data.images['Draft projection · reference only']
    assert hashlib.sha256(bytes(draft.packed_file.data)).hexdigest()==hashlib.sha256((source/'projection-draft.png').read_bytes()).hexdigest()
    assert bpy.data.objects['Body'].parent.name=='TrainRoot'
    for wheel in rig['wheels']:
        steer,roll,bogie=[bpy.data.objects[wheel[k]] for k in ['steer','roll','bogie']]
        assert steer.parent==bogie and roll.parent==steer and len(roll.children)==2
        assert abs(roll['wheel_radius']-wheel['radius'])<1e-6
    reports.append({'assetId':bundle['assetId'],'packedAtlasAndOwnDraft':'exact PNG bytes','packedImages':len(images),'wheels':len(rig['wheels']),'triangles':triangles})
output.write_bytes((json.dumps(reports,indent=2)+'\n').encode())
print(json.dumps(reports),flush=True)
