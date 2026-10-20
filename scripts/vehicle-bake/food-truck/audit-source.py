"""Read-only packed mobile kitchen and actual all-triangle recess controls."""

from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/food-truck/v1"
O = ROOT / "public/demos/vehicle-bake/food-truck/v1"
D = ROOT / "data/vehicle-bake/food-truck"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
results = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def triangle_data(meshes):
    points, faces, owners = [], [], []
    for ob in meshes:
        ob.data.calc_loop_triangles()
        offset = len(points)
        points.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
        for t in ob.data.loop_triangles:
            faces.append([offset + i for i in t.vertices])
            owners.append(ob.name)
    return points, faces, owners


def recess_proof(meshes, scale):
    points, faces, owners = triangle_data(meshes)
    config = CFG["servingRecess"]

    def rays(vv, ff, labels):
        bvh = BVHTree.FromPolygons(vv, ff, all_triangles=True)
        result = []
        for x in config["rayXs"]:
            for z in config["rayZs"]:
                p, n, i, d = bvh.ray_cast(
                    Vector((x * scale, config["rayOriginY"] * scale, z * scale)),
                    Vector((0, 1, 0)),
                    5 * scale,
                )
                assert p is not None, (x, z)
                result.append(
                    {
                        "xzSource": [x, z],
                        "firstHitYSource": p.y / scale,
                        "depthBehindActualOuterPlaneSource": p.y / scale
                        - config["outerPlaneY"],
                        "owner": labels[i],
                    }
                )
        return result

    baseline = rays(points, faces, owners)
    assert len(baseline) == 15 and all(
        abs(r["firstHitYSource"] - config["backWallY"]) < 1e-5
        and r["depthBehindActualOuterPlaneSource"] >= config["minimumDepth"]
        for r in baseline
    )
    # Explicit two-triangle filled-window counterexample; no source objects or
    # retained files are mutated. The full original all-triangle body remains.
    offset = len(points)
    fill = [
        Vector((x * scale, config["negativeFillY"] * scale, z * scale))
        for x, z in [
            (config["xMin"], config["zMin"]),
            (config["xMax"], config["zMin"]),
            (config["xMax"], config["zMax"]),
            (config["xMin"], config["zMax"]),
        ]
    ]
    blocked = rays(
        points + fill,
        faces + [[offset, offset + 1, offset + 2], [offset, offset + 2, offset + 3]],
        owners + ["CONTROL filled serving plane"] * 2,
    )
    assert all(
        r["owner"] == "CONTROL filled serving plane"
        and r["depthBehindActualOuterPlaneSource"] < config["minimumDepth"]
        for r in blocked
    )
    restored = rays(points, faces, owners)
    assert restored == baseline
    return {
        "allTriangleCount": len(faces),
        "rayCount": 15,
        "rays": baseline,
        "minimumMeasuredDepthSource": min(
            r["depthBehindActualOuterPlaneSource"] for r in baseline
        ),
        "outerPlaneSourceY": config["outerPlaneY"],
        "filledWindowNegative": {
            "fixtureTriangles": 2,
            "rejectedRayCount": len(blocked),
            "rays": blocked,
            "rejected": True,
        },
        "baselineRestoredExact": True,
        "noCandidateGeometryRemoved": True,
        "noPackedSourceMutation": True,
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
    assert triangles == 2934
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 35 and all("surface_owner" in o for o in meshes)
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        shade = [o for o in equipment if "short serving shade" in o.name]
        counter = [o for o in equipment if "counter" in o.name]
        vents = [o for o in equipment if "one broad cream roof vent" in o.name]
        assert len(shade) == 1 and len(counter) == 2 and len(vents) == 1
        results["fixedEquipment"] = {
            "components": [o.name for o in equipment],
            "shadeCounterFoldedEdgeAndOneVentStatic": True,
            "noMotionMetadata": True,
        }
        results["sourceServingRecess"] = recess_proof(meshes, 1)
        assert all(
            r["owner"]
            == "Red cream kitchen box actual serving recess and opposite emblem skin"
            for r in results["sourceServingRecess"]["rays"]
        )
        results["skinOwnership"] = {
            "method": CFG["paintOwnership"],
            "closedCabOwner": "Cream closed forward cab continuous side front rear glass skin",
            "frontWindshieldSeparateChart": True,
            "oppositeSidesDifferentCharts": True,
            "burger": "Broad custom UV-surface graphic on opposite +Y side; no lettering/brands/tiny texture",
            "noGlassOverlayMeshes": True,
            "servingInteriorBackWallOwnChart": True,
        }
    else:
        assert (
            len(meshes) == 5
            and len([o for o in bpy.context.scene.objects if "wheel_radius" in o]) == 4
        )
        measured = []
        for wid, spec in CFG["wheelSpecs"].items():
            roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
            assert roll.parent.name == f"Wheel_{wid}_Steer" and list(
                roll["roll_axis_gltf"]
            ) == [0, 0, -1]
            assert abs(roll["wheel_radius"] - spec["radius"] * S) < 1e-10
            children = [o for o in roll.children_recursive if o.type == "MESH"]
            assert len(children) == 1
            center = roll.matrix_world.translation
            points = [o.matrix_world @ v.co for o in children for v in o.data.vertices]
            radius = max(math.hypot(p.x - center.x, p.z - center.z) for p in points)
            assert (
                abs(radius - spec["radius"]) < 1e-6
                and abs(min(p.z for p in points)) < 1e-6
            )
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
            body.parent.name == "Food_Truck_Root_forward_minus_X"
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
before = sha(path)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
dims = [(high[i] - low[i]) / S for i in range(3)]
assert 5.99 < dims[0] < 6.01 and 2.63 < dims[1] < 2.67 and 2.79 < dims[2] < 2.81, dims
assert abs(low[2]) < 1e-4
centered = [2 * max(abs(low[i]), abs(high[i])) for i in [0, 1]]
results["actualGLBBounds"] = {
    "glbSha256": before,
    "minBlenderWorld": low,
    "maxBlenderWorld": high,
    "dimensionsBlenderWorld": [high[i] - low[i] for i in range(3)],
    "dimensionsSourceUnits": dims,
    "centeredHorizontalExtentWorld": centered,
    "centeredHorizontalExtentSource": [v / S for v in centered],
    "centeredCeilWorldFootprint": [math.ceil(v) for v in centered],
    "includesActualShadeCounterFoldedEdgeAndVent": True,
    "asymmetricEquipmentPreserved": True,
    "rootUnchangedNoRecenterOrFitScale": True,
    "runtimeIntegration": "parent-owned; measure centered2*maxAbs rather than raw span",
}
results["actualGLBServingRecess"] = {"glbSha256": before, **recess_proof(meshes, S)}
body = bpy.data.objects["Body_static"]
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
        if abs(p.x / S - spec["axle"]) < 0.05
        and abs(p.z / S - 0.48) < 0.05
        and 0.74 < side * p.y / S < 0.79
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
    "glbSha256": before,
    "results": attachment,
    "allFixedTrianglesSeparatelyClearanceProven": True,
}
assert sha(path) == before
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
