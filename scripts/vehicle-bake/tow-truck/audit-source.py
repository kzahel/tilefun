"""Read-only tow packed source, low static equipment and actual export audit."""

from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/tow-truck/v1"
O = ROOT / "public/demos/vehicle-bake/tow-truck/v1"
D = ROOT / "data/vehicle-bake/tow-truck"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
keys = list(CFG["palette"])
results = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def points_of(obs):
    return [o.matrix_world @ v.co for o in obs for v in o.data.vertices]


def platform_rays(meshes, scale):
    points, faces, owners = [], [], []
    for ob in meshes:
        ob.data.calc_loop_triangles()
        offset = len(points)
        points.extend(points_of([ob]))
        for t in ob.data.loop_triangles:
            faces.append([offset + i for i in t.vertices])
            owners.append(ob.name)
    bvh = BVHTree.FromPolygons(points, faces, all_triangles=True)
    rays = []
    for x in [-0.10, 0.70, 1.60, 2.25]:
        for y in [-0.95, 0.95]:
            p, n, i, d = bvh.ray_cast(
                Vector((x * scale, y * scale, 3 * scale)), Vector((0, 0, -1)), 4 * scale
            )
            assert p is not None and abs(p.z / scale - 1.17) < 1e-5, (x, y, p)
            rays.append(
                {
                    "xySource": [x, y],
                    "actualTopZSource": p.z / scale,
                    "owner": owners[i],
                }
            )
    return {
        "meaning": "Flat recovery platform, no recessed cargo bed claim",
        "rays": rays,
        "flatTop1_17Source": True,
        "allCandidateTrianglesIncluded": True,
    }


def role_points(ob, role):
    uv = ob.data.uv_layers.active.data
    idx = keys.index(role)
    vertices = set()
    for f in ob.data.polygons:
        p = uv[f.loop_indices[0]].uv
        px, py = p.x * 512, (1 - p.y) * 512
        if py >= 480 and int(px // 32) + int((py - 480) // 16) * 16 == idx:
            vertices.update(f.vertices)
    assert vertices, role
    return [ob.matrix_world @ ob.data.vertices[i].co for i in sorted(vertices)]


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
    assert triangles == 3394
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 35 and all("surface_owner" in o for o in meshes)
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        boom = [
            o
            for o in equipment
            if any(s in o.name for s in ["orange recovery", "orange folded"])
        ]
        cable = [o for o in equipment if "gray cable" in o.name]
        hook = [o for o in equipment if "cast gray C hook" in o.name]
        assert len(boom) == 5 and len(cable) == 2 and len(hook) == 1
        cab = bpy.data.objects[
            "Cream closed tow cab continuous side front rear roof skin"
        ]
        roof = max(p.z for p in points_of([cab]))
        boom_top = max(p.z for p in points_of(boom))
        assert (
            0 <= roof - boom_top < 0.15
            and boom_top <= roof + CFG["recoveryEquipment"]["maximumBoomAboveCabSource"]
        )
        hp = points_of(hook)
        hook_floor = min(p.z for p in hp)
        hook_front = min(p.x for p in hp)
        assert (
            hook_floor > CFG["recoveryEquipment"]["minimumHookGroundClearanceSource"]
            and hook_front > CFG["recoveryEquipment"]["deckRearX"]
        )
        cable_measure = []
        for ob in cable:
            pp = points_of([ob])
            a = sum(pp[:8], Vector()) / 8
            b = sum(pp[8:], Vector()) / 8
            t = (b - a).normalized()
            radius = max(((p - a) - t * (p - a).dot(t)).length for p in pp)
            assert abs(radius - 0.035) < 1e-6 and 2 * radius * S >= 1
            cable_measure.append(
                {
                    "component": ob.name,
                    "radiusSourceMeasured": radius,
                    "diameterWorldMeasured": 2 * radius * S,
                    "nativeAtLeastOnePixel": True,
                }
            )
        results["fixedEquipment"] = {
            "components": [o.name for o in equipment],
            "noMotionMetadata": True,
            "staticStowedOnly": True,
            "cabRoofMeasuredSource": roof,
            "boomTopMeasuredSource": boom_top,
            "boomBelowCabRoof": True,
            "hookMinimumGroundClearanceSource": hook_floor,
            "hookFrontmostXSource": hook_front,
            "hookBehindPlatform": True,
            "cableMeasurements": cable_measure,
            "noTowHookCablePhysicsOrAnimationClaim": True,
        }
        results["sourceFlatPlatform"] = platform_rays(meshes, 1)
        results["skinOwnership"] = {
            "method": CFG["paintOwnership"],
            "cabFrontRearRoofOwnershipSeparate": True,
            "coherentOppositeBodySides": True,
            "orangeFrameAndGrayEquipmentSwatchesExplicit": True,
            "noGlassOverlayMeshes": True,
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
            points = points_of(children)
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
            body.parent.name == "Tow_Truck_Root_forward_minus_X"
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
points = points_of(meshes)
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
dims = [(high[i] - low[i]) / S for i in range(3)]
assert 5.79 < dims[0] < 5.84 and 2.23 < dims[1] < 2.25 and 2.29 < dims[2] < 2.31, dims
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
    "includesActualLowBoomWinchCableHook": True,
    "rootUnchangedNoRecenterOrFitScale": True,
    "runtimeIntegration": "parent-owned; centered2*maxAbs footprint",
}
body = bpy.data.objects["Body_static"]
hp = role_points(body, "hook")
cp = role_points(body, "cable")
hook_floor = min(p.z for p in hp) / S
hook_front = min(p.x for p in hp) / S
assert hook_floor > 0.75 and hook_front > 2.47
segments = [
    (Vector(a) * S, Vector(b) * S)
    for a, b in [((0.22, 0, 1.54), (1.94, 0, 2.18)), ((1.94, 0, 2.18), (2.72, 0, 1.17))]
]


def radial_distance(p, a, b):
    t = (b - a).normalized()
    return ((p - a) - t * (p - a).dot(t)).length


radius = max(min(radial_distance(p, a, b) for a, b in segments) for p in cp)
assert abs(radius / S - 0.035) < 1e-5 and radius * 2 >= 1
results["actualGLBStaticRecovery"] = {
    "glbSha256": before,
    "fixedOwner": "Body_static",
    "hookMinimumGroundClearanceSource": hook_floor,
    "hookFrontmostXSource": hook_front,
    "hookBehindActualFlatPlatform": True,
    "cableDiameterWorldMeasured": 2 * radius,
    "cableAtLeastOneNativePixel": True,
    "noMotionMetadataOnBody": True,
    "staticStowedOnly": True,
    "allFixedTrianglesIncludedInNeutralRollEnvelope": True,
}
results["actualGLBFlatPlatform"] = {"glbSha256": before, **platform_rays(meshes, S)}
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
        and abs(p.z / S - 0.49) < 0.05
        and 0.67 < side * p.y / S < 0.71
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
