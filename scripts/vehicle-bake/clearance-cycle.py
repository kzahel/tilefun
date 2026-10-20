"""Motorcycle-v1 actual GLB envelopes: every F/R[/SC] cylinder, own radius and targeted collision/reset.

Duplicated from immutable clearance-v2.py; stricter marked-root audit is injected before import. No four-corner requirement or fake corner geometry.

Uses the same clipped-triangle/cylinder method as authored-assets' retained-vehicle
qualification, resolving moving meshes through declared wheel ancestors rather
than tire-name conventions. Blender -- MANIFEST OUTPUT_JSON.
"""

import hashlib
import json
import math
from pathlib import Path
import sys
import importlib.util

spec = importlib.util.spec_from_file_location(
    "catalog_cycle", Path(__file__).with_name("catalog-cycle.py")
)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
manifest_path, output_path = map(Path, sys.argv[sys.argv.index("--") + 1 :])
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))


def clip(poly, axis, bound, direction):
    if not poly:
        return []
    result = []
    previous = poly[-1]
    prev_in = direction * (previous[axis] - bound) >= -1e-7
    for current in poly:
        inside = direction * (current[axis] - bound) >= -1e-7
        if inside != prev_in:
            result.append(
                previous.lerp(
                    current, (bound - previous[axis]) / (current[axis] - previous[axis])
                )
            )
        if inside:
            result.append(current)
        previous, prev_in = current, inside
    return result


def radial_distance(poly, center, radial):
    points = [
        (p[radial[0]] - center[radial[0]], p[radial[1]] - center[radial[1]])
        for p in poly
    ]
    sides, distances, area = [], [], 0
    for a, b in zip(points, points[1:] + points[:1]):
        cross = a[0] * b[1] - a[1] * b[0]
        sides.append(cross)
        area += cross
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = dx * dx + dy * dy
        t = min(1, max(0, -(a[0] * dx + a[1] * dy) / length)) if length else 0
        distances.append(math.hypot(a[0] + t * dx, a[1] + t * dy))
    if abs(area) > 1e-9 and (
        all(v >= -1e-7 for v in sides) or all(v <= 1e-7 for v in sides)
    ):
        return 0
    return min(distances)


def inspect(candidate):
    assert (
        candidate["toolchain"] == "motorcycle-v1"
    ), "Explicit motorcycle-v1 clearance required"
    expected = catalog.validate_ids(candidate["wheelIds"])
    path = (
        (ROOT / candidate["input"]).resolve()
        if "input" in candidate
        else (ROOT / "public/demos/vehicle-bake" / candidate["glb"]).resolve()
    )
    assert path.is_relative_to(ROOT.resolve()), "Cycle input escapes repository"
    audit = catalog.audit_glb(path, expected)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    rolls = [
        o
        for o in bpy.context.scene.objects
        if o.name.startswith("Wheel_") and o.name.endswith("_Roll")
    ]
    actual = [o.name.removeprefix("Wheel_").removesuffix("_Roll") for o in rolls]
    assert len(actual) == len(expected) and set(actual) == set(expected), (
        "Declared/actual cycle wheels",
        expected,
        actual,
    )
    moving = set()
    cylinders = []
    for roll in rolls:
        children = [o for o in roll.children_recursive if o.type == "MESH"]
        moving.update(children)
        vertices = [o.matrix_world @ v.co for o in children for v in o.data.vertices]
        assert vertices, f"No wheel geometry: {roll.name}"
        center = roll.matrix_world.translation.copy()
        world_axis = (roll.matrix_world.to_3x3() @ Vector((0, 1, 0))).normalized()
        assert abs(abs(world_axis.y) - 1) < 1e-6, (
            "Non-neutral/tilted cycle wheel axis: " + roll.name
        )
        axis = 1
        radius = max(math.hypot(v.x - center.x, v.z - center.z) for v in vertices)
        declared = roll["wheel_radius"]
        assert math.isfinite(radius) and abs(radius - declared) < 0.0001, (
            roll.name,
            radius,
            declared,
        )
        assert (
            abs(min(v.z for v in vertices)) < 0.0001
        ), f"Ground contact differs: {roll.name}"
        cylinders.append(
            {
                "part": roll.name,
                "center": center,
                "axis": axis,
                "radial": [0, 2],
                "low": min(v.y for v in vertices),
                "high": max(v.y for v in vertices),
                "radius": radius,
            }
        )
    bodies = {}
    triangles = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        if obj in moving:
            continue
        vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
        bodies[obj.name] = [
            [vertices[i] for i in tri.vertices] for tri in obj.data.loop_triangles
        ]
    assert bodies

    def measure(fixed, only=None):
        gaps = []
        for cylinder in cylinders:
            if only is not None and cylinder["part"] != only:
                continue
            best, owner = math.inf, None
            for name, tris in fixed.items():
                for tri in tris:
                    poly = clip(
                        clip(tri, 1, cylinder["low"], 1), 1, cylinder["high"], -1
                    )
                    if not poly:
                        continue
                    gap = (
                        radial_distance(poly, cylinder["center"], [0, 2])
                        - cylinder["radius"]
                    )
                    if gap < best:
                        best, owner = gap, name
            if best <= 1e-5:
                raise ValueError(f"{cylinder['part']} intersects {owner}: {best:.6f}")
            gaps.append(
                {
                    "wheel": cylinder["part"],
                    "radius": cylinder["radius"],
                    "minimumGap": best if math.isfinite(best) else None,
                    "nearestBody": owner,
                }
            )
        return gaps

    gaps = measure(bodies)
    owner = next(iter(bodies))
    tri = max(bodies[owner], key=lambda t: (t[1] - t[0]).cross(t[2] - t[0]).length)
    controls = []
    for cylinder in cylinders:
        delta = cylinder["center"] - sum(tri, Vector()) / 3
        rejected = False
        try:
            measure({**bodies, owner: [[v + delta for v in tri]]}, cylinder["part"])
        except ValueError:
            rejected = True
        assert rejected, "Collision control was accepted: " + cylinder["part"]
        assert measure(bodies) == gaps, "Collision baseline did not restore"
        controls.append(
            {
                "wheel": cylinder["part"],
                "collidingBodyRejected": True,
                "baselineRestored": True,
            }
        )
    assert measure(bodies) == gaps
    assert (
        hashlib.sha256(path.read_bytes()).hexdigest() == audit["sha256"]
    ), "Cycle input changed"
    return {
        "toolchain": "motorcycle-v1",
        "wheelIds": list(expected),
        "inputBytesUnchanged": True,
        "id": candidate["id"],
        "glbSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "triangles": triangles,
        "clearance": gaps,
        "allNeutralRollAngles": True,
        "collidingBodyRejected": True,
        "perWheelCollisionControls": controls,
        "baselineRestored": True,
        "steering": "unqualified",
    }


reports = []
for candidate in manifest["candidates"]:
    try:
        reports.append({"status": "passed", **inspect(candidate)})
    except Exception as error:
        reports.append({"status": "failed", "id": candidate["id"], "error": str(error)})
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
print(json.dumps(reports, indent=2), flush=True)
if any(report["status"] != "passed" for report in reports):
    raise RuntimeError("One or more declared wheel/body qualifications failed")
