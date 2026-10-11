"""Blender -- ROOT OUTPUT: actual GLB neutral-roll cylinder clearance.

Every exported tire/hub vertex lies inside its measured axle cylinder. Clip each
fixed body triangle to that axial slab and measure distance from the axis in the
radial plane. Positive gaps prove clearance through every neutral roll angle.
Steering, equipment movement and root pitching are separate qualifications.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


root, output = [Path(v).resolve() for v in sys.argv[sys.argv.index('--') + 1:]]
catalog = json.loads((root / 'art-source/vehicle-models/catalog.json').read_text(encoding='utf-8'))
reports = []


def clip(poly, axis, bound, direction):
    if not poly:
        return []
    result = []
    previous = poly[-1]
    prev_in = direction*(previous[axis]-bound) >= -1e-7
    for current in poly:
        inside = direction*(current[axis]-bound) >= -1e-7
        if inside != prev_in:
            t = (bound-previous[axis])/(current[axis]-previous[axis])
            result.append(previous.lerp(current, t))
        if inside:
            result.append(current)
        previous, prev_in = current, inside
    return result


def radial_distance(poly, center, radial):
    points = [(p[radial[0]]-center[radial[0]], p[radial[1]]-center[radial[1]]) for p in poly]
    sides, distances, area = [], [], 0
    for a, b in zip(points, points[1:]+points[:1]):
        sides.append(a[0]*b[1]-a[1]*b[0])
        area += sides[-1]
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = dx*dx+dy*dy
        t = min(1, max(0, -(a[0]*dx+a[1]*dy)/length)) if length else 0
        distances.append(math.hypot(a[0]+t*dx, a[1]+t*dy))
    if abs(area) > 1e-9 and (all(v >= -1e-7 for v in sides) or all(v <= 1e-7 for v in sides)):
        return 0
    return min(distances)


for bundle in catalog['bundles']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root / bundle['glb']))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    moving = [o for o in meshes if o.name.startswith(('Tire_', 'Hub_'))]
    bodies = {}
    for obj in meshes:
        if obj in moving:
            continue
        obj.data.calc_loop_triangles()
        vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
        bodies[obj.name] = [[vertices[i] for i in tri.vertices] for tri in obj.data.loop_triangles]
    cylinders = []
    for obj in moving:
        center = obj.parent.matrix_world.translation.copy()
        vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
        spans = [max(v[k] for v in vertices)-min(v[k] for v in vertices) for k in range(3)]
        axis = min(range(3), key=lambda k: spans[k])
        # All retained rest wheels use a transverse axle; reject an unexpected
        # imported basis rather than silently testing the wrong spin envelope.
        assert axis == 1, (bundle['assetId'], obj.name, spans)
        radial = [k for k in range(3) if k != axis]
        radius = max(math.hypot(*(v[k]-center[k] for k in radial)) for v in vertices)
        if obj.name.startswith('Tire_'):
            assert abs(radius-obj.parent['wheel_radius']) < 1e-5
        cylinders.append({'part': obj.name, 'center': center, 'axis': axis, 'radial': radial,
                          'low': min(v[axis] for v in vertices), 'high': max(v[axis] for v in vertices),
                          'radius': radius})

    def measure(triangles):
        result = []
        for wheel in cylinders:
            best, owner = math.inf, None
            for name, tris in triangles.items():
                for tri in tris:
                    poly = clip(clip(tri, wheel['axis'], wheel['low'], 1), wheel['axis'], wheel['high'], -1)
                    if not poly:
                        continue
                    gap = radial_distance(poly, wheel['center'], wheel['radial'])-wheel['radius']
                    if gap < best:
                        best, owner = gap, name
            if best <= 1e-5:
                raise ValueError(f"{bundle['assetId']} {wheel['part']} cylinder intersects {owner}: {best}")
            result.append({'part': wheel['part'], 'gap': best if math.isfinite(best) else None,
                           'nearestBody': owner, 'radius': wheel['radius'],
                           'axialBounds': [wheel['low'], wheel['high']]})
        return result

    gaps = measure(bodies)
    hood = next((name for name in bodies if name == 'Hood'), None)
    assert hood is not None, 'This qualification route requires a declared hood for its regression probe'
    displaced = {**bodies, hood: [[v-Vector((0,0,6)) for v in tri] for tri in bodies[hood]]}
    rejected = False
    try:
        measure(displaced)
    except ValueError:
        rejected = True
    assert rejected, 'Accepted hood moved into tires'
    assert measure(bodies) == gaps
    reports.append({'assetId': bundle['assetId'], 'revision': bundle['revision'], 'glbSha256': hashlib.sha256((root / bundle['glb']).read_bytes()).hexdigest(), 'clearance': gaps,
                    'neutralRoll': 'All angles enclosed by actual tire/hub cylinders',
                    'steering': 'Unqualified', 'loweredHoodRejected': True, 'restored': True})
output.write_bytes((json.dumps(reports, indent=2)+'\n').encode())
print(json.dumps(reports), flush=True)
