"""Read actual GLBs for rest-pose surface crossings; Blender -- ROOT OUTPUT.

Discovery probe: coplanar contacts and enclosing solids need separate qualification.
Does not mutate retained scenes, asset bytes, or reviews.
"""
import json
from pathlib import Path
import sys

import bpy
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri


root, output = [Path(v).resolve() for v in sys.argv[sys.argv.index('--') + 1:]]
catalog = json.loads((root / 'art-source/vehicle-models/catalog.json').read_text(encoding='utf-8'))
reports = []


def geometry(obj):
    obj.data.calc_loop_triangles()
    vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
    faces = [tuple(t.vertices) for t in obj.data.loop_triangles]
    return vertices, faces, BVHTree.FromPolygons(vertices, faces, all_triangles=True)


def crosses(a, b):
    for start, end in zip(a, a[1:] + a[:1]):
        edge = end - start
        if edge.length_squared < 1e-12:
            continue
        hit = intersect_ray_tri(*b, edge, start, True)
        if hit is not None:
            t = (hit - start).dot(edge) / edge.length_squared
            if 1e-5 < t < 1-1e-5:
                return True
    return False


for bundle in catalog['bundles']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root / bundle['glb']))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    moving = [o for o in meshes if o.name.startswith(('Tire_', 'Hub_'))]
    fixed = [o for o in meshes if o not in moving]
    data = {o.name: geometry(o) for o in meshes}
    overlaps = []
    for wheel in moving:
        va, fa, ta = data[wheel.name]
        for body in fixed:
            vb, fb, tb = data[body.name]
            for ia, ib in ta.overlap(tb):
                a, b = [va[i] for i in fa[ia]], [vb[i] for i in fb[ib]]
                if crosses(a, b) or crosses(b, a):
                    overlaps.append({'wheel': wheel.name, 'body': body.name})
                    break
    reports.append({'assetId': bundle['assetId'], 'crossings': overlaps,
                    'scope': 'Rest-pose non-coplanar surface crossings; discovery only'})
output.write_bytes((json.dumps(reports, indent=2)+'\n').encode())
print(json.dumps(reports), flush=True)
