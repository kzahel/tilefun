"""Read-only Blender audit: --python this.py -- CHECKOUT_ROOT OUTPUT_JSON."""
import hashlib
import json
from pathlib import Path
import sys

import bpy


root, output = [Path(value).resolve() for value in sys.argv[sys.argv.index('--') + 1:]]
catalog = json.loads((root / 'art-source/vehicle-models/catalog.json').read_text())
results, shapes = [], {}
for bundle in catalog['bundles']:
    source = root / bundle['source']
    bpy.ops.wm.open_mainfile(filepath=str(source / 'car.blend'))
    meshes = sorted((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: o.name)
    expected = bundle.get('geometry', {'meshObjects': 55, 'triangles': 842})
    recipe = json.loads((source / 'recipe.json').read_text())
    rig = json.loads((source / 'rig.json').read_text())
    assert len(meshes) == expected['meshObjects']
    triangles = 0
    shape = []
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        assert obj.data.uv_layers.active is not None, obj.name
        shape.append([obj.name, [list(v.co) for v in obj.data.vertices],
                      [list(p.vertices) for p in obj.data.polygons],
                      [list(loop.uv) for loop in obj.data.uv_layers.active.data],
                      obj.parent.name if obj.parent else None,
                      [list(row) for row in obj.matrix_world]])
    assert triangles == expected['triangles']
    shape_hash = hashlib.sha256(json.dumps(shape).encode()).hexdigest()
    shapes.setdefault(recipe['family'], []).append(shape_hash)
    material = bpy.data.materials[recipe['projection']['material']]
    atlas = material.node_tree.nodes['Clean atlas'].image
    assert atlas.packed_file is not None
    assert hashlib.sha256(bytes(atlas.packed_file.data)).hexdigest() == hashlib.sha256((source / 'car-atlas.png').read_bytes()).hexdigest()
    images = [image for image in bpy.data.images if image.type == 'IMAGE' and image.source == 'FILE']
    assert images and all(image.packed_file is not None for image in images)
    car, body = bpy.data.objects['CarRoot'], bpy.data.objects['Body']
    assert body.parent == car
    for wheel in ['FL', 'FR', 'RL', 'RR']:
        steer, roll = bpy.data.objects[f'Wheel_{wheel}_Steer'], bpy.data.objects[f'Wheel_{wheel}_Roll']
        assert steer.parent == car and roll.parent == steer and len(roll.children) == 2
        wheel_record = next(w for w in rig['wheels'] if w['id'] == wheel)
        assert abs(roll['wheel_radius'] - wheel_record['radius']) < 1e-6
        assert all(obj.type == 'MESH' for obj in roll.children)
    results.append({'assetId': bundle['assetId'], 'meshObjects': len(meshes), 'triangles': triangles,
                    'packedFileImages': len(images), 'cleanAtlasBytes': 'exact retained PNG',
                    'shapeUvHierarchySha256': shape_hash})
assert len(set(shapes.get('compact', []))) == 1, 'Compact variants differ in geometry/UVs/rig'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
print(json.dumps(results), flush=True)
