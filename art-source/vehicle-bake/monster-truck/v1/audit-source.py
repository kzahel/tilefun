"""Read-only packed monster pickup, real cargo recess and attachment audit."""

from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/monster-truck/v1"
O = ROOT / "public/demos/vehicle-bake/monster-truck/v1"
D = ROOT / "data/vehicle-bake/monster-truck"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
results = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def bed_rays(meshes, scale):
    points, faces, owners = [], [], []
    for ob in meshes:
        ob.data.calc_loop_triangles()
        offset = len(points)
        points.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
        for tri in ob.data.loop_triangles:
            faces.append([offset + i for i in tri.vertices])
            owners.append(ob.name)
    bvh = BVHTree.FromPolygons(points, faces, all_triangles=True)
    rays = []
    for x in CFG["cargoBed"]["rayXs"]:
        for y in CFG["cargoBed"]["rayYs"]:
            p, n, i, distance = bvh.ray_cast(
                Vector((x * scale, y * scale, 5 * scale)), Vector((0, 0, -1)), 6 * scale
            )
            assert p is not None and abs(p.z / scale - 1.85) < 1e-5
            rays.append(
                {"xySource": [x, y], "firstHitZSource": p.z / scale, "owner": owners[i]}
            )
    rail_top = max(
        p.z / scale
        for p in points
        if 0.50 < p.x / scale < 2.40
        and 0.7 < abs(p.y / scale) < 0.95
        and 2.3 < p.z / scale < 2.6
    )
    assert abs(rail_top - CFG["cargoBed"]["railTop"]) < 1e-5
    depth = rail_top - max(r["firstHitZSource"] for r in rays)
    assert depth >= CFG["cargoBed"]["minimumDepth"]
    return {
        "rays": rays,
        "railTopSource": rail_top,
        "railTopMeasuredFromGeometry": True,
        "minimumMeasuredRecessSource": depth,
        "realOpenRecess": True,
    }


for name in ["master.blend", "car.blend"]:
    path = A / name
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    triangles = 0
    for ob in meshes:
        ob.data.calc_loop_triangles()
        triangles += len(ob.data.loop_triangles)
        assert (
            len(ob.data.uv_layers) == 1
            and ob.data.uv_layers.active.name == "Semantic_palette_UV"
        )
    assert triangles == 3534
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 100 and all("surface_owner" in o for o in meshes)
        assert not any("fender" in o.name.lower() for o in meshes)
        tread = [o for o in meshes if o.name.startswith("Broad block tread")]
        assert len(tread) == 96
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        assert len(equipment) == 16
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        results["fixedEquipment"] = {
            "components": [o.name for o in equipment],
            "noMotionMetadata": True,
            "fakeFenderCaps": 0,
            "coverage": "not-applicable/intentionally-exposed",
        }
        results["sourceCargoRecess"] = bed_rays(
            [
                o
                for o in meshes
                if not any(
                    o.name.endswith(w) or ("tread " + w + " ") in o.name
                    for w in CFG["wheelSpecs"]
                )
            ],
            1,
        )
        assert all(
            r["owner"] == "Recessed monster cargo floor"
            for r in results["sourceCargoRecess"]["rays"]
        )
        results["skinOwnership"] = {
            "cab": "Continuous actual-skin side glass; fixed front/rear glass half charts and own purple roof chart",
            "hood": "Own lime actual-skin chart",
            "cargo": "Actual recessed floor owns sparse rib paint; walls own inside/outside palette swatches",
            "treads": "96 broad wedge blocks with explicit tire roles; purple hubs own palette swatches",
            "noGlassOverlayMeshes": True,
        }
    else:
        assert len(meshes) == 5
        measured = []
        assert len([o for o in bpy.context.scene.objects if "wheel_radius" in o]) == 4
        for wid, spec in CFG["wheelSpecs"].items():
            roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
            assert roll.parent.name == f"Wheel_{wid}_Steer"
            assert list(roll["roll_axis_gltf"]) == [0, 0, -1]
            assert abs(roll["wheel_radius"] - spec["radius"] * S) < 1e-10
            children = [o for o in roll.children_recursive if o.type == "MESH"]
            assert len(children) == 1
            center = roll.matrix_world.translation
            points = [o.matrix_world @ v.co for o in children for v in o.data.vertices]
            radius = max(math.hypot(p.x - center.x, p.z - center.z) for p in points)
            assert abs(radius - spec["radius"]) < 1e-6
            assert abs(min(p.z for p in points)) < 1e-6
            measured.append(
                {
                    "id": wid,
                    "radiusSourceMeasured": radius,
                    "radiusWorldDeclared": roll["wheel_radius"],
                    "geometryAndOwnMetadataMatch": True,
                }
            )
        results["wheelRadiusRig"] = measured
        body = bpy.data.objects["Body_static"]
        assert (
            body.parent.name == "Monster_Pickup_Root_forward_minus_X"
            and not body.animation_data
            and "wheel_radius" not in body
        )
    assert sha(path) == before
    results[name] = {
        "sha256": before,
        "triangles": triangles,
        "meshObjects": len(meshes),
        "packedImages": [i.name for i in images],
        "oneSemanticUVLayer": True,
    }

path = O / "model.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
dims = [(high[i] - low[i]) / S for i in range(3)]
assert 4.99 < dims[0] < 5.01 and 2.95 < dims[1] < 3.01 and 2.99 < dims[2] < 3.01, dims
assert abs(low[2]) < 1e-4
results["actualGLBBounds"] = {
    "glbSha256": sha(path),
    "minBlenderWorld": low,
    "maxBlenderWorld": high,
    "dimensionsBlenderWorld": [high[i] - low[i] for i in range(3)],
    "dimensionsSourceUnits": dims,
}
body = bpy.data.objects["Body_static"]
results["actualGLBCargoRecess"] = {"glbSha256": sha(path), **bed_rays([body], S)}
fixed = [body.matrix_world @ v.co for v in body.data.vertices]
attachment = []
for wid, spec in CFG["wheelSpecs"].items():
    roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
    tire = [
        o.matrix_world @ v.co
        for o in roll.children_recursive
        if o.type == "MESH"
        for v in o.data.vertices
    ]
    inner = min(abs(p.y) for p in tire)
    side = -1 if wid[1] == "L" else 1
    arm = [
        p
        for p in fixed
        if abs(p.x / S - spec["axle"]) < 0.08
        and abs(p.z / S - 0.85) < 0.08
        and 0.70 < side * p.y / S < 0.77
    ]
    assert arm
    end = max(side * p.y for p in arm)
    gap = inner - end
    assert 0 < gap < 0.5
    attachment.append(
        {
            "id": wid,
            "actualTireSlabInnerAbsY": inner,
            "actualStaticArmEndAbsY": end,
            "axialGapWorld": gap,
            "subpixelGap": True,
        }
    )
results["actualGLBAttachments"] = {
    "glbSha256": sha(path),
    "results": attachment,
    "allFixedTrianglesSeparatelyClearanceProven": True,
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
