"""Actual true-three-wheel sidecar bike + immutable mounted Explorer source fit proof.

No CarMeshAsset or parent cycle adapter is imported. Every fixed bike and rider
triangle participates; only measured saddle/grip/sole interfaces are exceptions.
"""

from pathlib import Path
from collections import Counter, defaultdict
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import intersect_ray_tri

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/sidecar-motorcycle/v1"
O = ROOT / "public/demos/vehicle-bake/sidecar-motorcycle/v1"
D = ROOT / "data/vehicle-bake/sidecar-motorcycle"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
PROFILE = json.loads((ROOT / CFG["riderProfile"]["path"]).read_text())
MOUNT = Vector(CFG["riderMountSource"]) * S
TARGETS = {n: Vector(p) + MOUNT for n, p in PROFILE["contacts"].items()}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def triangles(ob):
    ob.data.calc_loop_triangles()
    pp = [ob.matrix_world @ v.co for v in ob.data.vertices]
    return [[pp[i] for i in f.vertices] for f in ob.data.loop_triangles]


def tree(ts):
    return BVHTree.FromPolygons(
        [p for t in ts for p in t],
        [tuple(3 * i + j for j in range(3)) for i in range(len(ts))],
        all_triangles=True,
        epsilon=0,
    )


def unique(ts):
    return list({tuple(round(c, 5) for c in p): p for t in ts for p in t}.values())


def bounds(ts):
    pp = [p for t in ts for p in t]
    return [min(p[i] for p in pp) for i in range(3)], [
        max(p[i] for p in pp) for i in range(3)
    ]


def in_box(p, box):
    return all(box[0][i] - 1e-5 <= p[i] <= box[1][i] + 1e-5 for i in range(3))


def closed(ts):
    edges = Counter()
    for t in ts:
        vv = [tuple(round(c, 5) for c in p) for p in t]
        for a, b in zip(vv, vv[1:] + vv[:1]):
            edges[tuple(sorted((a, b)))] += 1
    return all(n == 2 for n in edges.values())


def inside(p, bvh):
    near = bvh.find_nearest(p)
    if near[0] is None or near[3] < 1e-4:
        return False
    votes = []
    for direction in [
        Vector((1, 0.237, 0.159)).normalized(),
        Vector((-0.36, 1, 0.17)).normalized(),
        Vector((0.13, 0.27, 1)).normalized(),
    ]:
        cursor = p.copy()
        count = 0
        for _ in range(100):
            hit, normal, index, distance = bvh.ray_cast(cursor, direction, 1000)
            if hit is None:
                break
            count += 1
            cursor = hit + direction * 1e-4
        else:
            raise AssertionError("Containment ray failed to exit")
        votes.append(bool(count % 2))
    return sum(votes) >= 2


def contact_exception(owner, p):
    if "Actual palm wrapped grip" in owner:
        side = "left" if owner.endswith("left") else "right"
        return (p - TARGETS[f"hand_{side}_grip"]).length <= 0.075 * S
    if "Actual sole tangent foot peg" in owner:
        side = "left" if owner.endswith("left") else "right"
        target = TARGETS[f"foot_{side}_support"]
        return (p - target).length <= 0.12 * S and abs(p.z - target.z) <= 0.002 * S
    if "saddle" in owner.lower():
        target = TARGETS["hip_saddle"]
        return (p - target).length <= 0.17 * S and abs(p.z - target.z) <= 0.002 * S
    return False


def intersections(a, b):
    points = []
    for one, two in [(a, b), (b, a)]:
        for p, q in zip(one, one[1:] + one[:1]):
            d = q - p
            hit = intersect_ray_tri(*two, d, p, True)
            if hit is not None and -1e-6 <= (hit - p).dot(d) <= d.length_squared + 1e-6:
                points.append(hit)
    if points:
        return points
    normal = (a[1] - a[0]).cross(a[2] - a[0])
    other = (b[1] - b[0]).cross(b[2] - b[0])
    if normal.length < 1e-8 or other.length < 1e-8:
        return []
    normal.normalize()
    other.normalize()
    if (
        normal.cross(other).length > 1e-5
        or max(abs(normal.dot(p - a[0])) for p in b) > 1e-5
    ):
        return []
    poly = list(a)
    for i in range(3):
        origin, end, third = b[i], b[(i + 1) % 3], b[(i + 2) % 3]
        inward = normal.cross(end - origin)
        if inward.dot(third - origin) < 0:
            inward = -inward
        result = []
        if not poly:
            return []
        previous = poly[-1]
        dp = inward.dot(previous - origin)
        for current in poly:
            dc = inward.dot(current - origin)
            if (dp >= -1e-7) != (dc >= -1e-7):
                result.append(previous.lerp(current, dp / (dp - dc)))
            if dc >= -1e-7:
                result.append(current)
            previous, dp = current, dc
        poly = result
    return poly


def fit_assessment(parts, rt):
    rbvh = tree(rt)
    rbox = bounds(rt)
    rows = []
    bad = []
    containment = []
    rp = unique(rt)
    for name, ts in parts.items():
        bt = tree(ts)
        box = bounds(ts)
        candidates = bt.overlap(rbvh)
        actual_pairs = 0
        point_count = 0
        inappropriate = []
        for i, j in candidates:
            pp = intersections(ts[i], rt[j])
            if not pp:
                continue
            actual_pairs += 1
            point_count += len(pp)
            inappropriate += [list(p) for p in pp if not contact_exception(name, p)]
        if actual_pairs:
            rows.append(
                {
                    "bikeComponent": name,
                    "actualIntersectionTrianglePairs": actual_pairs,
                    "intersectionPoints": point_count,
                    "boundedContactOnly": not inappropriate,
                }
            )
        if inappropriate:
            bad.append(
                {
                    "bikeComponent": name,
                    "unallowedPoints": len(inappropriate),
                    "examplesWorld": inappropriate[:8],
                }
            )
        bike_inside = [
            p
            for p in unique(ts)
            if in_box(p, rbox) and inside(p, rbvh) and not contact_exception(name, p)
        ]
        rider_inside = [
            p
            for p in rp
            if in_box(p, box)
            and closed(ts)
            and inside(p, bt)
            and not contact_exception(name, p)
        ]
        if bike_inside or rider_inside:
            containment.append(
                {
                    "bikeComponent": name,
                    "bikeVerticesInsideRider": len(bike_inside),
                    "riderVerticesInsideClosedBikePart": len(rider_inside),
                    "examplesWorld": [
                        list(p) for p in (bike_inside + rider_inside)[:8]
                    ],
                }
            )
    return {
        "status": "passed" if not bad and not containment else "needs-correction",
        "actualRiderTriangles": len(rt),
        "actualBikeFixedTriangles": sum(len(ts) for ts in parts.values()),
        "allFixedComponentCount": len(parts),
        "actualContactIntersections": rows,
        "inappropriateIntersections": bad,
        "inappropriateContainments": containment,
        "wholeRiderAndAllFixedBikeTrianglesUsed": True,
        "closedBikePartContainmentAndRiderParityChecked": True,
    }


inputs = {p: sha(ROOT / p) for p in CFG["riderInputs"]}
assert inputs == CFG["riderInputs"]
source_vertices = []
packed = {}
for name in ["master.blend", "car.blend"]:
    path = A / name
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    count = 0
    for ob in meshes:
        ob.data.calc_loop_triangles()
        count += len(ob.data.loop_triangles)
        assert (
            len(ob.data.uv_layers) == 1
            and ob.data.uv_layers.active.name == "Semantic_palette_UV"
        )
        if name == "master.blend" and ob.location.length < 1e-7:
            assert "surface_owner" in ob
            source_vertices += [
                (ob.matrix_world @ v.co * S, ob.name) for v in ob.data.vertices
            ]
    assert count == 3418
    if name == "car.blend":
        assert len(meshes) == 4
        assert list(bpy.data.objects["Motorcycle_Root"]["wheel_ids"]) == [
            "F",
            "R",
            "SC",
        ]
    assert sha(path) == before
    packed[name] = {
        "sha256": before,
        "meshObjects": len(meshes),
        "triangles": count,
        "oneSemanticUV": True,
        "packedImages": 2,
    }

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(O / "model.glb"))
bpy.context.view_layer.update()
body = bpy.data.objects["Body_static"]
bt = triangles(body)
kd = KDTree(len(source_vertices))
for i, (p, name) in enumerate(source_vertices):
    kd.insert(p, i)
kd.balance()
owners = []
for t in bt:
    names = set.intersection(
        *[{source_vertices[i][1] for _, i, _ in kd.find_range(p, 0.001)} for p in t]
    )
    assert names, [list(p) for p in t]
    owners.append(sorted(names)[0])
parts = {
    name: [t for t, owner in zip(bt, owners) if owner == name]
    for name in sorted(set(owners))
}
assert sum(len(ts) for ts in parts.values()) == len(bt)
bike_meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bike_bounds = bounds([t for ob in bike_meshes for t in triangles(ob)])
rolls = [bpy.data.objects[f"Wheel_{wid}_Roll"] for wid in ["F", "R", "SC"]]
bike_sockets = {
    n: bpy.data.objects["BikeSocket_" + n].matrix_world.translation.copy()
    for n in TARGETS
}
assert all((p - TARGETS[n]).length < 1e-5 for n, p in bike_sockets.items())
mount_actual = bpy.data.objects[
    "Rider_Mount_Explorer_Upright"
].matrix_world.translation.copy()
assert (mount_actual - MOUNT).length < 1e-5
bpy.ops.import_scene.gltf(
    filepath=str(ROOT / "art-source/vehicle-riders/explorer-upright/v1/rider.glb")
)
rider_root = bpy.data.objects["Explorer_HipOrigin_forward_minus_X"]
rider_root.location += MOUNT
bpy.context.view_layer.update()
rider = next(
    o for o in bpy.context.scene.objects if o.type == "MESH" and o not in bike_meshes
)
rt = triangles(rider)
assert len(rt) == 1956
rbvh = tree(rt)
bbvh = tree(bt)
contacts = []
for name, target in TARGETS.items():
    actual = bpy.data.objects["Socket_" + name].matrix_world.translation.copy()
    assert (actual - target).length < 1e-5
    near, normal, index, distance = bbvh.find_nearest(target)
    rider_near, _, _, rider_distance = rbvh.find_nearest(target)
    owner = owners[index]
    if name.startswith("hand"):
        assert (
            "Actual palm wrapped grip" in owner
            and 0.026 * S * math.cos(math.pi / 12) - 1e-4
            <= distance
            <= 0.026 * S + 1e-4
        ), (owner, distance)
        grip_points = unique(parts[owner])
        axis_x = (min(p.x for p in grip_points) + max(p.x for p in grip_points)) / 2
        axis_z = (min(p.z for p in grip_points) + max(p.z for p in grip_points)) / 2
        assert math.hypot(axis_x - target.x, axis_z - target.z) < 1e-5
        assert min(p.y for p in grip_points) < target.y < max(p.y for p in grip_points)
        assert rider_distance > 0.4
    elif name.startswith("foot"):
        assert (
            "Actual sole tangent foot peg" in owner
            and distance < 1e-4
            and rider_distance < 1e-4
        )
    else:
        assert "saddle" in owner.lower() and distance < 1e-4 and rider_distance < 1e-4
    contacts.append(
        {
            "name": name,
            "profilePlusSingleMountWorld": list(target),
            "actualRiderSocketWorld": list(actual),
            "actualBikeSocketWorld": list(bike_sockets[name]),
            "actualBikeContactOwner": owner,
            "actualBikeSurfaceWorld": list(near),
            "distanceToBikeSurfaceWorld": distance,
            "distanceToRiderSurfaceWorld": rider_distance,
            "semantics": (
                "grip centerline inside closed palm; local wrap"
                if name.startswith("hand")
                else "actual surface tangent"
            ),
        }
    )

baseline = fit_assessment(parts, rt)
(D / "fit-current.json").write_text(
    json.dumps(
        {
            "glbSha256": sha(O / "model.glb"),
            "packed": packed,
            "contacts": contacts,
            "actualFit": baseline,
        },
        indent=2,
    )
    + "\n"
)
print(
    json.dumps(
        {
            "status": baseline["status"],
            "contacts": contacts,
            "badIntersections": baseline["inappropriateIntersections"],
            "badContainments": baseline["inappropriateContainments"],
        },
        indent=2,
    ),
    flush=True,
)
assert (
    baseline["status"] == "passed"
), "Polish actual fit before final negative/reset and wheel proof"


# Retained generic clipped-triangle/cylinder math, not a car rig adapter.
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


# Actual rider displacement: all five sockets leave their physical bike contacts,
# and inappropriate geometry intersections must become visible to the same check.
rest = rider_root.location.copy()
rider_root.location += Vector((0.20, 0.80, -0.38)) * S
bpy.context.view_layer.update()
displaced_rt = triangles(rider)
displaced = fit_assessment(parts, displaced_rt)
assert displaced["status"] == "needs-correction" and (
    displaced["inappropriateIntersections"] or displaced["inappropriateContainments"]
)
displaced_errors = {
    name: (bpy.data.objects["Socket_" + name].matrix_world.translation - target).length
    for name, target in TARGETS.items()
}
assert all(error > 3 for error in displaced_errors.values())
rider_root.location = rest
bpy.context.view_layer.update()
reset_rt = triangles(rider)
assert reset_rt == rt and all(
    (bpy.data.objects["Socket_" + name].matrix_world.translation - target).length < 1e-5
    for name, target in TARGETS.items()
)
fixed = {**parts, "Immutable mounted Explorer ALL1956 triangles": rt}


def measure_envelope(cylinder, geometry):
    best = math.inf
    nearest = None
    for owner, ts in geometry.items():
        for tri in ts:
            poly = clip(clip(tri, 1, cylinder["low"], 1), 1, cylinder["high"], -1)
            if not poly:
                continue
            gap = radial_distance(poly, cylinder["center"], [0, 2]) - cylinder["radius"]
            if gap < best:
                best = gap
                nearest = owner
    return best, nearest


clearance = []
negative = []
for roll in rolls:
    children = [o for o in roll.children_recursive if o.type == "MESH"]
    assert len(children) == 1
    pp = [o.matrix_world @ v.co for o in children for v in o.data.vertices]
    center = roll.matrix_world.translation.copy()
    radius = max(math.hypot(p.x - center.x, p.z - center.z) for p in pp)
    assert (
        abs(radius - roll["wheel_radius"]) < 1e-4 and abs(min(p.z for p in pp)) < 1e-4
    )
    assert list(roll["roll_axis_gltf"]) == [0, 0, -1]
    cylinder = {
        "center": center,
        "low": min(p.y for p in pp),
        "high": max(p.y for p in pp),
        "radius": radius,
    }
    gap, owner = measure_envelope(cylinder, fixed)
    assert gap > 1e-5, (roll.name, gap, owner)
    tri = max(bt, key=lambda t: (t[1] - t[0]).cross(t[2] - t[0]).length)
    delta = center - sum(tri, Vector()) / 3
    controlled = {
        **fixed,
        "CONTROL added collision triangle": [[p + delta for p in tri]],
    }
    controlled_gap, _ = measure_envelope(cylinder, controlled)
    assert controlled_gap <= 0
    assert measure_envelope(cylinder, fixed) == (gap, owner)
    clearance.append(
        {
            "wheel": roll.name,
            "radiusMeasuredWorld": radius,
            "radiusDeclaredWorld": roll["wheel_radius"],
            "groundZWorld": min(p.z for p in pp),
            "minimumGapWorld": gap,
            "nearestFixedOwner": owner,
            "allNeutralRollAngles": True,
            "fixedBikeTriangles": len(bt),
            "fixedRiderTriangles": len(rt),
        }
    )
    negative.append(
        {
            "wheel": roll.name,
            "collisionRejected": True,
            "controlledGapWorld": controlled_gap,
            "fixtureTrianglesAdded": 1,
            "noCandidateTrianglesRemoved": True,
            "baselineRestoredExact": True,
        }
    )
all_points = [
    p for ob in bike_meshes for p in [ob.matrix_world @ v.co for v in ob.data.vertices]
]
low = [min(p[i] for p in all_points) for i in range(3)]
high = [max(p[i] for p in all_points) for i in range(3)]
all_combined = all_points + [p for t in rt for p in t]
combined_low = [min(p[i] for p in all_combined) for i in range(3)]
combined_high = [max(p[i] for p in all_combined) for i in range(3)]
result = {
    "status": "passed-actual-source-pilot",
    "glbSha256": sha(O / "model.glb"),
    "riderInputHashes": inputs,
    "profilePlusOneMeasuredMount": True,
    "mountSource": list(MOUNT / S),
    "actualMountWorld": list(mount_actual),
    "packedScenes": packed,
    "contacts": contacts,
    "actualFit": baseline,
    "displacedRiderNegative": {
        "translationSource": [0.20, 0.80, -0.38],
        "allFiveSocketDistancesWorld": displaced_errors,
        "inappropriateIntersections": displaced["inappropriateIntersections"],
        "inappropriateContainments": displaced["inappropriateContainments"],
        "rejected": True,
        "baselineRestoredExact": True,
    },
    "wholeFixedBikeAndRiderNeutralRoll": clearance,
    "perWheelCollisionNegatives": negative,
    "actualBikeBounds": {
        "minWorld": low,
        "maxWorld": high,
        "spanSource": [(high[i] - low[i]) / S for i in range(3)],
        "centeredHorizontalCeilWorld": [
            math.ceil(2 * max(abs(low[i]), abs(high[i]))) for i in [0, 1]
        ],
        "noRescaleRecenter": True,
    },
    "actualCombinedBounds": {
        "minWorld": combined_low,
        "maxWorld": combined_high,
        "spanSource": [(combined_high[i] - combined_low[i]) / S for i in range(3)],
        "centeredHorizontalCeilWorld": [
            math.ceil(2 * max(abs(combined_low[i]), abs(combined_high[i])))
            for i in [0, 1]
        ],
        "noRescaleRecenter": True,
    },
    "contactExceptions": {
        "saddle": "only actual saddle parts within.17source ofhip tangent andabsvertical.002source",
        "palms": "only actual grips within.075source ofcorrespondingimmutablegripcenterline",
        "soles": "only actualpegparts within.12source ofsoleanchor andabsvertical.002source",
        "allOtherBikeRiderIntersections": "rejected",
    },
    "CarMeshAssetUsed": False,
    "sharedCycleQualification": "pending parent actual shared loader/browser review",
    "normalActivation": False,
}
assert {p: sha(ROOT / p) for p in inputs} == inputs
(D / "fit-proof.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": result["status"],
            "clearance": clearance,
            "negative": negative,
            "actualBikeBounds": result["actualBikeBounds"],
        },
        indent=2,
    )
)
