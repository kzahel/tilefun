"""Measure exact GLB mesh vertices after Blender's glTF import, without re-exporting.

Invoked by runtime-export.py with Blender --background --factory-startup.
Blender restores +Z up/-X forward; CarMeshAsset rigidly converts this to game
+Z up/+X forward. No fit, recentering or scaling is applied to original vehicles.
"""
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector


source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
bpy.context.view_layer.update()
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
triangles = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
receipt = {
    'modelSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'measurement': 'Actual imported GLB mesh vertices transformed by matrix_world; no re-export',
    'blenderVersion': bpy.app.version_string,
    'axes': {'length': 'Blender X', 'width': 'Blender Y', 'height': 'Blender Z'},
    'worldBounds': {'min': list(low), 'max': list(high), 'size': list(high - low)},
    'triangles': triangles,
    'meshes': len(meshes),
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, indent=2))
