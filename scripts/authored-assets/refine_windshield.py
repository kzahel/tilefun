"""Split the windshield surface into a glass aperture and a connected frame.

Blender --background COPY.blend --python this.py -- NEW_OUT config.json
Outer windshield vertices, all other meshes/UVs and rigid wheel nodes stay fixed.
"""
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

out, config_path = (Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:])
out.mkdir(parents=True, exist_ok=False)
config = json.loads(config_path.read_text(encoding='utf-8'))
obj = bpy.data.objects['Windshield']
if len(obj.data.vertices) != 4 or len(obj.data.polygons) != 1:
    raise ValueError('Load an unchanged v4 windshield COPY.')
before = {o.name: [list(v.co) for v in o.data.vertices] for o in bpy.context.scene.objects
          if o.type == 'MESH' and o != obj}
outer = [v.co.copy() for v in obj.data.vertices]
old_uv = obj.data.uv_layers.active
mapping = {obj.data.loops[i].vertex_index: old_uv.data[i].uv.copy() for i in obj.data.polygons[0].loop_indices}
def blend(values, s, t):
    return values[0]*(1-s)*(1-t)+values[1]*s*(1-t)+values[2]*s*t+values[3]*(1-s)*t
s, lo, hi = config['insetAcross'], config['insetBottom'], 1-config['insetTop']
if not 0 < s < .25 or not 0 < lo < hi < 1:
    raise ValueError('Invalid windshield aperture.')
inner_st = [(s, lo), (1-s, lo), (1-s, hi), (s, hi)]
vertices = outer+[blend(outer, *st) for st in inner_st]
uvs = [mapping[i] for i in range(4)]+[blend(mapping, *st) for st in inner_st]
faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]
data = bpy.data.meshes.new('Windshield aperture and frame')
data.from_pydata(vertices, [], faces)
data.update()
data.materials.append(obj.data.materials[0])
uv = data.uv_layers.new(name='WindshieldAtlas')
for face in data.polygons:
    for loop in face.loop_indices:
        uv.data[loop].uv = uvs[data.loops[loop].vertex_index]
obj.data = data
obj['glass_aperture'] = 'Interior face 4; surrounding faces 0..3 are body/frame'
obj['provenance'] = 'Authored glass aperture/frame and source-owned UV paint; unreviewed'
assert all(before[o.name] == [list(v.co) for v in o.data.vertices] for o in bpy.context.scene.objects
           if o.type == 'MESH' and o != obj)
assert [list(v.co) for v in data.vertices[:4]] == [list(v) for v in outer]
# Frame + glass exactly tessellate the original surface, with no overlapping shell.
normal = (outer[1]-outer[0]).cross(outer[3]-outer[0]).normalized()
assert all(abs(normal.dot(v-outer[0])) < 1e-5 for v in vertices)
data.calc_loop_triangles()
assert len(data.loop_triangles) == 10
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene['review_status'] = 'Unreviewed windshield boundary correction; rigid wheel/body fit retained'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'car.blend'))
record = {'configSha256': hashlib.sha256(config_path.read_bytes()).hexdigest(),
          'originalOuterBoundaryPreserved': True, 'otherMeshVerticesPreserved': len(before),
          'windshieldFaces': {'frame': [0, 1, 2, 3], 'glass': [4]},
          'windshieldVertices': [list(v) for v in vertices],
          'cabinSurfaces': {}, 'rigPreserved': True}
for label in ['left', 'right']:
    cabin = bpy.data.objects['Cabin · '+label]
    cabin.data.calc_loop_triangles()
    layer = cabin.data.uv_layers.active
    record['cabinSurfaces'][label] = [
        {'positions': [list(cabin.data.vertices[i].co) for i in tri.vertices],
         'uv': [list(layer.data[i].uv) for i in tri.loops]}
        for tri in cabin.data.loop_triangles]
(out/'windshield.json').write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
print('Connected windshield aperture/frame; other meshes and wheel rig unchanged.')
