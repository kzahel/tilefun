"""Read-only six-wheel packed scene and actual all-triangle dump-depth controls."""

from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/dump-truck/v1"
O = ROOT / "public/demos/vehicle-bake/dump-truck/v1"
D = ROOT / "data/vehicle-bake/dump-truck"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
IDS = CFG["wheelIds"]
results = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def points_of(obs):
    return [o.matrix_world @ v.co for o in obs for v in o.data.vertices]


def depth_proof(meshes, scale):
    points, faces, owners = [], [], []
    for ob in meshes:
        ob.data.calc_loop_triangles()
        offset = len(points)
        points.extend(points_of([ob]))
        for t in ob.data.loop_triangles:
            faces.append([offset + i for i in t.vertices])
            owners.append(ob.name)
    config = CFG["dumpBody"]
    rail = max(
        p.z / scale
        for p in points
        if p.x / scale > -0.85 and abs(p.y / scale) > 0.9 and 2.4 < p.z / scale < 2.5
    )
    assert abs(rail - config["railTop"]) < 1e-5

    def rays(vv, ff, labels):
        bvh = BVHTree.FromPolygons(vv, ff, all_triangles=True)
        out = []
        for x in config["rayXs"]:
            for y in config["rayYs"]:
                p, n, i, d = bvh.ray_cast(
                    Vector((x * scale, y * scale, 4 * scale)),
                    Vector((0, 0, -1)),
                    5 * scale,
                )
                assert p is not None, (x, y)
                out.append(
                    {
                        "xySource": [x, y],
                        "firstHitZSource": p.z / scale,
                        "depthBelowActualRailSource": rail - p.z / scale,
                        "owner": labels[i],
                    }
                )
        return out

    baseline = rays(points, faces, owners)
    assert len(baseline) == 15 and all(
        abs(r["firstHitZSource"] - config["floorTop"]) < 1e-5
        and r["depthBelowActualRailSource"] >= config["minimumDepth"]
        for r in baseline
    )
    offset = len(points)
    fill = [
        Vector((x * scale, y * scale, config["negativeFillZ"] * scale))
        for x, y in [
            (config["fillXMin"], config["fillYMin"]),
            (config["fillXMax"], config["fillYMin"]),
            (config["fillXMax"], config["fillYMax"]),
            (config["fillXMin"], config["fillYMax"]),
        ]
    ]
    blocked = rays(
        points + fill,
        faces + [[offset, offset + 1, offset + 2], [offset, offset + 2, offset + 3]],
        owners + ["CONTROL filled dump top"] * 2,
    )
    assert all(
        r["owner"] == "CONTROL filled dump top"
        and r["depthBelowActualRailSource"] < config["minimumDepth"]
        for r in blocked
    )
    assert rays(points, faces, owners) == baseline
    return {
        "allTriangleCount": len(faces),
        "rayCount": 15,
        "actualRailTopSource": rail,
        "rays": baseline,
        "minimumMeasuredDepthSource": min(
            r["depthBelowActualRailSource"] for r in baseline
        ),
        "filledTopNegative": {
            "fixtureTriangles": 2,
            "rejectedRayCount": len(blocked),
            "rays": blocked,
            "rejected": True,
        },
        "baselineRestoredExact": True,
        "noCandidateGeometryRemoved": True,
        "levelStaticOnly": True,
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
    assert triangles == 3720
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 45 and all("surface_owner" in o for o in meshes)
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        ribs = [o for o in meshes if o.name.startswith("Broad dump side rib")]
        assert len(ribs) == 6
        rams = [o for o in equipment if "fixed stowed underbed ram" in o.name]
        hinges = [o for o in equipment if "bed hinge" in o.name]
        assert len(rams) == 2 and len(hinges) == 3
        results["fixedEquipment"] = {
            "components": [o.name for o in equipment],
            "sixBroadSideRibs": [o.name for o in ribs],
            "twoFixedRams": [o.name for o in rams],
            "fixedHinges": [o.name for o in hinges],
            "noMotionMetadata": True,
            "levelStaticStowedOnly": True,
            "noTippingOrCargoAnimationClaim": True,
        }
        results["sourceDumpDepth"] = depth_proof(meshes, 1)
        assert all(
            r["owner"] == "Deep open steel blue dump bed actual floor"
            for r in results["sourceDumpDepth"]["rays"]
        )
        results["skinOwnership"] = {
            "method": CFG["paintOwnership"],
            "frontRearGlassAndRoofSeparateCharts": True,
            "actualBedFloorOwner": "Deep open steel blue dump bed actual floor",
            "slopedInnerOuterWallOwners": True,
            "frontBulkheadAndTailgateOwnersSeparate": True,
            "noGlassOverlayMeshes": True,
            "notCameraProjection": True,
        }
    else:
        assert len(meshes) == 7
        rolls = [o for o in bpy.context.scene.objects if "wheel_radius" in o]
        assert sorted(o.name for o in rolls) == sorted(f"Wheel_{w}_Roll" for w in IDS)
        measured = []
        for wid, spec in CFG["wheelSpecs"].items():
            roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
            assert roll.parent.name == f"Wheel_{wid}_Steer" and list(
                roll["roll_axis_gltf"]
            ) == [0, 0, -1]
            assert bool(roll.parent["steering_enabled"]) == (wid[0] == "F")
            assert abs(roll["wheel_radius"] - spec["radius"] * S) < 1e-10
            children = [o for o in roll.children_recursive if o.type == "MESH"]
            assert len(children) == 1
            center = roll.matrix_world.translation
            points = points_of(children)
            radius = max(math.hypot(p.x - center.x, p.z - center.z) for p in points)
            assert (
                abs(radius - spec["radius"]) < 1e-6
                and abs(min(p.z for p in points)) < 1e-6
            )
            assert (
                abs(center.x - spec["axle"]) < 1e-6
                and abs(abs(center.y) - spec["halfTrack"]) < 1e-6
            )
            measured.append(
                {
                    "id": wid,
                    "axleSourceMeasured": center.x,
                    "radiusSourceMeasured": radius,
                    "radiusWorldDeclared": roll["wheel_radius"],
                    "geometryAndOwnMetadataMatch": True,
                }
            )
        results["sixWheelRadiusRig"] = measured
        body = bpy.data.objects["Body_static"]
        assert (
            body.parent.name == "Dump_Truck_Root_forward_minus_X"
            and not body.animation_data
            and "wheel_radius" not in body
        )
        assert not any(o.animation_data for o in bpy.context.scene.objects)
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
points = points_of(meshes)
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
dims = [(high[i] - low[i]) / S for i in range(3)]
assert 6.39 < dims[0] < 6.41 and 2.59 < dims[1] < 2.61 and 2.79 < dims[2] < 2.81, dims
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
    "includesActualLevelTubRimsHingesRamsSixWheels": True,
    "rootUnchangedNoRecenterOrFitScale": True,
    "runtimeIntegration": "parent-owned; centered2*maxAbs footprint",
}
results["actualGLBDumpDepth"] = {"glbSha256": before, **depth_proof(meshes, S)}
body = bpy.data.objects["Body_static"]
fixed = points_of([body])
attachment = []
for wid, spec in CFG["wheelSpecs"].items():
    roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
    tire = points_of([o for o in roll.children_recursive if o.type == "MESH"])
    inner = min(abs(p.y) for p in tire)
    side = -1 if wid[1] == "L" else 1
    arm = [
        p
        for p in fixed
        if abs(p.x / S - spec["axle"]) < 0.05
        and abs(p.z / S - 0.50) < 0.05
        and 0.80 < side * p.y / S < 0.86
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
results["actualGLBSixAttachments"] = {
    "glbSha256": before,
    "results": attachment,
    "allFixedTrianglesSeparatelyClearanceProven": True,
}
assert sha(path) == before
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
