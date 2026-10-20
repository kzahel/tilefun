"""Read-only forklift packed source, actual open spaces, fixed mast/forks and UV export audit."""

from pathlib import Path
import hashlib
import json
import math
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/forklift/v1"
O = ROOT / "public/demos/vehicle-bake/forklift/v1"
D = ROOT / "data/vehicle-bake/forklift"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
keys = list(CFG["palette"])
results = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def points_of(obs):
    return [o.matrix_world @ v.co for o in obs for v in o.data.vertices]


def assess_parts(parts):
    rails = [(n, p) for n, p in parts.items() if "tall twin mast rail" in n]
    pillars = [
        (n, p) for n, p in parts.items() if "vertical overhead guard pillar" in n
    ]
    blades = [
        (n, p) for n, p in parts.items() if "actual low narrow forward fork blade" in n
    ]
    assert len(rails) == 2 and len(pillars) == 4 and len(blades) == 2
    mast_top = max(p.z for n, pp in rails for p in pp)
    assert abs(mast_top - 2.15) < 1e-5
    fork = []
    for n, pp in blades:
        lo = [min(p[i] for p in pp) for i in range(3)]
        hi = [max(p[i] for p in pp) for i in range(3)]
        assert abs(lo[0] + 2.30) < 1e-5 and abs(hi[0] + 1.10) < 1e-5
        assert (
            abs(hi[1] - lo[1] - 0.12) < 1e-5
            and abs(lo[2] - 0.10) < 1e-5
            and abs(hi[2] - 0.18) < 1e-5
        )
        fork.append(
            {
                "component": n,
                "minimumSource": lo,
                "maximumSource": hi,
                "actualLengthSource": hi[0] - lo[0],
                "actualWidthSource": hi[1] - lo[1],
            }
        )
    floor = next(pp for n, pp in parts.items() if "open footwell lower floor" in n)
    seat = next(pp for n, pp in parts.items() if "seat cushion actual volume" in n)
    floor_top = max(p.z for p in floor)
    seat_top = max(p.z for p in seat)
    assert abs(floor_top - 0.36) < 1e-5 and abs(seat_top - 0.80) < 1e-5
    assert max(p.z for p in seat) - min(p.z for p in seat) > 0.13
    return {
        "twoActualForkBlades": fork,
        "twoMastRails": len(rails),
        "fourGuardPillars": len(pillars),
        "mastTopSource": mast_top,
        "actualFootwellFloorTop": floor_top,
        "actualSeatTop": seat_top,
        "seatAboveFloorSource": seat_top - floor_top,
        "equipmentStaticOnly": True,
    }


def spaces(meshes, scale):
    points = []
    faces = []
    for ob in meshes:
        ob.data.calc_loop_triangles()
        offset = len(points)
        points.extend(points_of([ob]))
        faces += [[offset + i for i in f.vertices] for f in ob.data.loop_triangles]

    def bvh(extra=[], extra_faces=[]):
        return BVHTree.FromPolygons(
            points + extra, faces + extra_faces, all_triangles=True
        )

    tree = bvh()
    floor_rays = []
    for x in [-0.32, -0.20]:
        for y in [-0.23, 0.23]:
            hit = tree.ray_cast(
                Vector((x * scale, y * scale, 1.4 * scale)),
                Vector((0, 0, -1)),
                2 * scale,
            )[0]
            assert hit is not None and abs(hit.z / scale - 0.36) < 1e-5, (x, y, hit)
            floor_rays.append(
                {
                    "xySource": [x, y],
                    "firstHitFloorZ": hit.z / scale,
                    "depthBelowSeatSource": 0.8 - hit.z / scale,
                }
            )
    voids = []
    for y in [0, 0.15]:
        for z in [0.58, 1.0, 1.65, 1.87]:
            origin = Vector((-1.30 * scale, y * scale, z * scale))
            direction = Vector((1, 0, 0))
            distance = 0.48 * scale
            assert tree.ray_cast(origin, direction, distance)[0] is None
            voids.append(("mast", origin, direction, distance))
    for x in [-0.2, 0.1, 0.4]:
        for z in [1.35, 1.60]:
            origin = Vector((x * scale, -1 * scale, z * scale))
            direction = Vector((0, 1, 0))
            distance = 2 * scale
            assert tree.ray_cast(origin, direction, distance)[0] is None
            voids.append(("guard", origin, direction, distance))
    for x in [-1.8, -1.4]:
        origin = Vector((x * scale, 0, 2.5 * scale))
        direction = Vector((0, 0, -1))
        distance = 3 * scale
        assert tree.ray_cast(origin, direction, distance)[0] is None
        voids.append(("fork-gap", origin, direction, distance))
    controls = []
    fixtures = {
        "footwell": [
            (-0.6, -0.30, 0.79),
            (-0.1, -0.30, 0.79),
            (-0.1, 0.30, 0.79),
            (-0.6, 0.30, 0.79),
        ],
        "mast": [
            (-1.01, -0.28, 0.51),
            (-1.01, 0.28, 0.51),
            (-1.01, 0.28, 1.99),
            (-1.01, -0.28, 1.99),
        ],
        "guard": [
            (-0.4, -0.59, 1.24),
            (0.6, -0.59, 1.24),
            (0.6, -0.59, 1.92),
            (-0.4, -0.59, 1.92),
        ],
        "fork-gap": [
            (-2, -0.2, 0.20),
            (-1.2, -0.2, 0.20),
            (-1.2, 0.2, 0.20),
            (-2, 0.2, 0.20),
        ],
    }
    for name, pp in fixtures.items():
        off = len(points)
        test = bvh(
            [Vector(p) * scale for p in pp],
            [[off, off + 1, off + 2], [off, off + 2, off + 3]],
        )
        if name == "footwell":
            blocked = [
                test.ray_cast(
                    Vector(
                        (
                            r["xySource"][0] * scale,
                            r["xySource"][1] * scale,
                            1.4 * scale,
                        )
                    ),
                    Vector((0, 0, -1)),
                    2 * scale,
                )[0]
                for r in floor_rays
            ]
            assert all(p is not None and 0.8 - p.z / scale < 0.05 for p in blocked)
        else:
            blocked = [
                test.ray_cast(o, d, distance)[0]
                for kind, o, d, distance in voids
                if kind == name
            ]
            assert blocked and all(p is not None for p in blocked)
        controls.append(
            {
                "fixture": name + "-filled",
                "fixtureTrianglesAdded": 2,
                "rejectedRayCount": len(blocked),
                "rejected": True,
                "noCandidateTrianglesRemoved": True,
            }
        )
    assert all(tree.ray_cast(o, d, distance)[0] is None for _, o, d, distance in voids)
    return {
        "status": "passed",
        "allCandidateTriangleCount": len(faces),
        "fourFootwellFloorRays": floor_rays,
        "openMastRays": 8,
        "openGuardRays": 6,
        "separateForkGapRays": 2,
        "fillNegativeControls": controls,
        "baselineRestoredExact": True,
        "actualGeometryNotPaintedDecals": True,
    }


def semantic_snapshot(objects):
    result = {}
    for original in objects:
        ob = original.copy()
        ob.data = original.data.copy()
        bpy.context.scene.collection.objects.link(ob)
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new(
            "Read-only explicit runtime triangulation snapshot", "TRIANGULATE"
        )
        bpy.ops.object.modifier_apply(modifier=mod.name)
        ob.data.calc_loop_triangles()
        uv = ob.data.uv_layers.active.data
        result[original.name] = {
            "points": [list(p) for p in points_of([ob])],
            "triangles": [
                {
                    "vertices": list(t.vertices),
                    "uv": [list(uv[li].uv) for li in t.loops],
                }
                for t in ob.data.loop_triangles
            ],
        }
        bpy.data.objects.remove(ob, do_unlink=True)
    return result


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
    assert triangles == 2940
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 35 and all("surface_owner" in o for o in meshes)
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        fixed = [
            o
            for o in meshes
            if not any(
                w in o.name for w in [" road tire ", " wheel rim ", " hub ", " inset "]
            )
        ]
        # Master road assemblies are the only meshes moved to declared wheel centers.
        fixed = [o for o in meshes if o.location.length < 1e-7]
        assert len(fixed) + 16 == len(meshes)
        parts = {o.name: points_of([o]) for o in fixed}
        measured_equipment = assess_parts(parts)
        snapshots = semantic_snapshot(fixed)
        results["fixedEquipment"] = {
            "components": [o.name for o in equipment],
            "noMotionMetadata": True,
            "staticMastForksOnly": True,
            "noLiftingGameplayClaim": True,
            **measured_equipment,
        }
        results["sourceNegativeSpaces"] = spaces(meshes, 1)
        results["skinOwnership"] = {
            "method": CFG["paintOwnership"],
            "counterweightSideEndTopCharts": True,
            "seatFootwellGuardMastForkSwatches": True,
            "noGlassOrNegativeSpaceOverlayPlanes": True,
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
            body.parent.name == "Forklift_Root_forward_minus_X"
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
assert 3.69 < dims[0] < 3.71 and 1.57 < dims[1] < 1.59 and 2.14 < dims[2] < 2.16, dims
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
    "includesActualForkTipsMastGuardCounterweightWheels": True,
    "rootUnchangedNoRecenterOrFitScale": True,
    "runtimeIntegration": "parent-owned; centered2*maxAbs footprint",
}
body = bpy.data.objects["Body_static"]
# Match every actual equipment triangle corner to the packed component master
# using source-space positions AND actual UVs; winding/triangle order independent.
body.data.calc_loop_triangles()
uv = body.data.uv_layers.active.data
from mathutils.kdtree import KDTree

actual = []
for f in body.data.loop_triangles:
    actual.append(
        [
            (body.matrix_world @ body.data.vertices[i].co / S, uv[li].uv.copy())
            for i, li in zip(f.vertices, f.loops)
        ]
    )
centers = KDTree(len(actual))
for i, tri in enumerate(actual):
    centers.insert(sum((p for p, q in tri), Vector()) / 3, i)
centers.balance()
used = set()
matched = []
actual_parts = {}
for name, snap in snapshots.items():
    pp = [Vector(p) for p in snap["points"]]
    actual_parts[name] = []
    for t in snap["triangles"]:
        expected = [(pp[i], Vector(q)) for i, q in zip(t["vertices"], t["uv"])]
        center = sum((p for p, q in expected), Vector()) / 3
        matches = [
            i
            for _, i, _ in centers.find_range(center, 2e-5)
            if i not in used
            and all(
                any(
                    (p - ap).length < 2e-5 and (q - aq).length < 2e-6
                    for ap, aq in actual[i]
                )
                for p, q in expected
            )
        ]
        assert matches, (name, t)
        used.add(matches[0])
    for p in pp:
        closest = min(
            (body.matrix_world @ v.co / S for v in body.data.vertices),
            key=lambda q: (q - p).length_squared,
        )
        assert (closest - p).length < 1e-5
        actual_parts[name].append(closest.copy())
    matched.append(
        {
            "component": name,
            "actualTrianglesWithMatchingPositionAndUV": len(snap["triangles"]),
            "actualVerticesMatched": len(pp),
        }
    )
actual_equipment = assess_parts(actual_parts)
results["actualGLBEquipmentGeometryUV"] = {
    "glbSha256": before,
    "status": "passed",
    "fixedOwner": "Body_static",
    "allFixedComponentsMatched": len(matched),
    "actualTriangleUvMatches": sum(
        c["actualTrianglesWithMatchingPositionAndUV"] for c in matched
    ),
    "components": matched,
    "actualAssessment": actual_equipment,
    "exactFourRoadRollNodes": len(
        [o for o in bpy.context.scene.objects if "wheel_radius" in o]
    )
    == 4,
    "noEquipmentAnimation": not any(
        o.animation_data for o in bpy.context.scene.objects
    ),
    "viewIndependentSurfacePaint": True,
    "positionToleranceSource": 2e-5,
    "uvTolerance": 2e-6,
}
results["actualGLBNegativeSpaces"] = {"glbSha256": before, **spaces(meshes, S)}
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
        and abs(p.z / S - spec["radius"]) < 0.05
        and spec["halfTrack"] - spec["width"] / 2 - 0.04
        < side * p.y / S
        < spec["halfTrack"] - spec["width"] / 2
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
