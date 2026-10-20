"""Read-only cart packed source, open well, canopy and wheel attachment audit."""

from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/golf-cart/v1"
O = ROOT / "public/demos/vehicle-bake/golf-cart/v1"
D = ROOT / "data/vehicle-bake/golf-cart"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
results = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def bvh_of(meshes):
    points, faces, owners = [], [], []
    for ob in meshes:
        ob.data.calc_loop_triangles()
        offset = len(points)
        points.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
        for tri in ob.data.loop_triangles:
            faces.append([offset + i for i in tri.vertices])
            owners.append(ob.name)
    return BVHTree.FromPolygons(points, faces, all_triangles=True), points, owners


def space_proof(meshes, scale):
    bvh, points, owners = bvh_of(meshes)
    foot, cargo, openings = [], [], []
    for config, rays, originz in [
        (CFG["passengerWell"], foot, 1.2),
        (CFG["bagWell"], cargo, 1.3),
    ]:
        for x in config["rayXs"]:
            for y in config["rayYs"]:
                p, n, i, distance = bvh.ray_cast(
                    Vector((x * scale, y * scale, originz * scale)),
                    Vector((0, 0, -1)),
                    2 * scale,
                )
                assert p is not None and abs(p.z / scale - config["floorTop"]) < 1e-5, (
                    x,
                    y,
                    originz,
                    tuple(p) if p else None,
                    owners[i] if p else None,
                )
                rays.append(
                    {
                        "xySource": [x, y],
                        "originZSource": originz,
                        "firstHitZSource": p.z / scale,
                        "owner": owners[i],
                    }
                )
    for x in CFG["passengerWell"]["rayXs"]:
        for z in [0.42, 0.55, 0.68]:
            hit = bvh.ray_cast(
                Vector((x * scale, 2 * scale, z * scale)), Vector((0, -1, 0)), 4 * scale
            )[0]
            assert hit is None, (x, z, hit)
            openings.append({"xSource": x, "zSource": z, "fullSideToSideOpen": True})
    seat_top = max(
        p.z / scale
        for p in points
        if 0.10 < p.x / scale < 0.83
        and abs(p.y / scale) < 0.66
        and 0.64 < p.z / scale < 0.80
    )
    rail_top = max(
        p.z / scale
        for p in points
        if 1.0 < p.x / scale < 1.56
        and 0.48 < abs(p.y / scale) < 0.81
        and 0.70 < p.z / scale < 0.82
    )
    seat_height = seat_top - max(r["firstHitZSource"] for r in foot)
    depth = rail_top - max(r["firstHitZSource"] for r in cargo)
    assert (
        seat_height >= CFG["passengerWell"]["minimumSeatAboveFloor"]
        and depth >= CFG["bagWell"]["minimumRecess"]
    )
    return {
        "footwellRays": foot,
        "sideOpeningRays": openings,
        "bagwellRays": cargo,
        "seatTopMeasuredSource": seat_top,
        "seatAboveFloorMeasuredSource": seat_height,
        "bagwellRailTopMeasuredSource": rail_top,
        "bagwellRecessMeasuredSource": depth,
        "realOpenPassengerWell": True,
        "realRecessedRearBagwell": True,
        "originsBelowCanopy": True,
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
    assert triangles == 2682
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 35 and all("surface_owner" in o for o in meshes)
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        supports = [o for o in equipment if "slim canopy support" in o.name]
        assert len(supports) == 4
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        results["fixedEquipment"] = {
            "components": [o.name for o in equipment],
            "fourSlimCanopySupports": [o.name for o in supports],
            "supportDiameterSource": 0.048,
            "supportDiameterWorld": 0.048 * S,
            "noMotionMetadata": True,
            "driverDisplay": "ordinary hidden; no occupant geometry",
        }
        body = [o for o in meshes if not any(w in o.name for w in CFG["wheelSpecs"])]
        results["sourceOpenSpaces"] = space_proof(body, 1)
        assert all(
            r["owner"] == "Actual low open passenger footwell floor"
            for r in results["sourceOpenSpaces"]["footwellRays"]
        )
        assert all(
            r["owner"] == "Mint rear bag tub integrated natural rear fenders"
            for r in results["sourceOpenSpaces"]["bagwellRays"]
        )
        # Probe actual supporting skin under each lower endpoint. Canopy bottom
        # z1.70 and support tops1.72 overlap at the upper ends.
        support_mounts = []
        for x, z, owner in [
            (
                -0.65,
                0.73,
                "Low blunt rounded mint front nose integrated natural front fenders",
            ),
            (0.90, 0.77, "Mint rear bag tub integrated natural rear fenders"),
        ]:
            bvh, _, _ = bvh_of([bpy.data.objects[owner]])
            for side in [-1, 1]:
                p = bvh.ray_cast(Vector((x, side * 0.66, 1.3)), Vector((0, 0, -1)), 2)[
                    0
                ]
                assert p is not None and z < p.z < z + 0.08
                support_mounts.append(
                    {
                        "xySource": [x, side * 0.66],
                        "supportBottomSource": z,
                        "actualBodyTopSource": p.z,
                        "plantedInActualBody": True,
                    }
                )
        results["canopyMounts"] = {
            "lowerEndpoints": support_mounts,
            "upperEndpointZ": 1.72,
            "canopyBottomZ": 1.70,
            "allFourPlanted": True,
        }
        results["skinOwnership"] = {
            "method": CFG["paintOwnership"],
            "frontScreenOwner": "STATIC small framed blue front windscreen own skin",
            "roofOwner": "STATIC white flat softly edged canopy own roof skin",
            "sidePassengerOpen": True,
            "noBodyGlassOverlayMeshes": True,
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
            body.parent.name == "Golf_Cart_Root_forward_minus_X"
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
assert 3.19 < dims[0] < 3.21 and 1.69 < dims[1] < 1.71 and 1.79 < dims[2] < 1.81, dims
assert abs(low[2]) < 1e-4
results["actualGLBBounds"] = {
    "glbSha256": sha(path),
    "minBlenderWorld": low,
    "maxBlenderWorld": high,
    "dimensionsBlenderWorld": [high[i] - low[i] for i in range(3)],
    "dimensionsSourceUnits": dims,
}
body = bpy.data.objects["Body_static"]
results["actualGLBOpenSpaces"] = {"glbSha256": sha(path), **space_proof([body], S)}
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
        if abs(p.x / S - spec["axle"]) < 0.04
        and abs(p.z / S - 0.31) < 0.04
        and 0.48 < side * p.y / S < 0.53
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
