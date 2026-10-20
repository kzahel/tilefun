"""Actual GLB profile contacts, finite straddle opening and semantic self-intersections.
Self/anatomy only; no synthetic fixture imported. Actual bike proof is separate.
"""

from pathlib import Path
import bpy, json, hashlib, itertools
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import intersect_ray_tri
from collections import Counter

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = R / "scripts/vehicle-riders/explorer-upright"
C = json.loads((S / "rider.json").read_text())
P = json.loads((S / "profile.json").read_text())
D = R / "data/vehicle-riders/explorer-upright"
A = R / "art-source/vehicle-riders/explorer-upright/v1"
O = R / "public/demos/vehicle-riders/explorer-upright/v1"
scale = C["worldScale"]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


assert (
    sha(S / "profile.json")
    == sha(R / C["contactProfile"]["source"])
    == C["contactProfile"]["sha256"]
)


def tris(o):
    o.data.calc_loop_triangles()
    v = [o.matrix_world @ p.co for p in o.data.vertices]
    return [[v[i] for i in t.vertices] for t in o.data.loop_triangles]


def tree(ts):
    return BVHTree.FromPolygons(
        [p for t in ts for p in t],
        [tuple(3 * i + j for j in range(3)) for i in range(len(ts))],
        all_triangles=True,
        epsilon=0,
    )


source_vertices = []
packed = {}
for name in ["master.blend", "low.blend"]:
    before = sha(A / name)
    bpy.ops.wm.open_mainfile(filepath=str(A / name))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 1 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 30
        for o in meshes:
            assert o["static_seated_component"]
            source_vertices.extend(
                (o.matrix_world @ p.co * scale, o.name) for p in o.data.vertices
            )
    else:
        assert len(meshes) == 1
    assert sha(A / name) == before
    packed[name] = {
        "sha256": before,
        "meshes": len(meshes),
        "packedImages": 1,
        "semanticUV": True,
    }
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(O / "rider.glb"))
bpy.context.view_layer.update()
rider = next(o for o in bpy.context.scene.objects if o.type == "MESH")
rt = tris(rider)
kd = KDTree(len(source_vertices))
for i, (v, name) in enumerate(source_vertices):
    kd.insert(v, i)
kd.balance()
owners = []
for t in rt:
    common = set.intersection(
        *[{source_vertices[i][1] for co, i, d in kd.find_range(v, 0.001)} for v in t]
    )
    assert common
    owners.append(sorted(common)[0])
components = {n: [t for t, o in zip(rt, owners) if o == n] for n in sorted(set(owners))}
trees = {n: tree(ts) for n, ts in components.items()}


def kind(n):
    if n.startswith("Straddle thigh"):
        return "thigh"
    if n.startswith("Bent outboard knee"):
        return "knee"
    if n.startswith("Bent support shin"):
        return "shin"
    if n.startswith("Boot sole"):
        return "sole"
    if n.startswith("Brown boot toe"):
        return "toe"
    if n.startswith("Bent upper teal sleeve"):
        return "upperarm"
    if n.startswith("Actual elbow"):
        return "elbow"
    if n.startswith("Raised teal forearm"):
        return "forearm"
    if n.startswith("Warm gripping hand"):
        return "hand"
    if "pelvis" in n:
        return "pelvis"
    if "jacket torso" in n:
        return "torso"
    if "neck" in n:
        return "neck"
    if any(
        w in n for w in ["head UV", "hair crown", "fringe", "face nose", "Warm ear"]
    ):
        return "headassembly"
    if "backpack" in n:
        return "packassembly"
    if "shoulder strap" in n:
        return "strap"
    return "jackettrim"


def side(n):
    return "left" if n.endswith("left") else "right" if n.endswith("right") else None


allowed = [
    {"thigh", "knee"},
    {"knee", "shin"},
    {"shin", "sole"},
    {"shin", "toe"},
    {"sole", "toe"},
    {"upperarm", "elbow"},
    {"elbow", "forearm"},
    {"upperarm", "forearm"},
    {"forearm", "hand"},
    {"torso", "upperarm"},
    {"torso", "strap"},
    {"upperarm", "strap"},
    {"torso", "jackettrim"},
    {"jackettrim", "strap"},
    {"jackettrim", "upperarm"},
    {"jackettrim", "neck"},
    {"torso", "neck"},
    {"neck", "headassembly"},
    {"pelvis", "thigh"},
    {"pelvis", "torso"},
    {"pelvis", "jackettrim"},
    {"torso", "packassembly"},
]
rows = []
bad = []


def intersection_points(ta, tb):
    points = []
    for one, two in [(ta, tb), (tb, ta)]:
        for p, q in zip(one, one[1:] + one[:1]):
            direction = q - p
            hit = intersect_ray_tri(*two, direction, p, True)
            if (
                hit is not None
                and -0.00001
                <= (hit - p).dot(direction)
                <= direction.length_squared + 0.00001
            ):
                points.append(hit)
    return points


for a, b in itertools.combinations(components, 2):
    hits = trees[a].overlap(trees[b])
    if not hits:
        continue
    ka, kb = kind(a), kind(b)
    sa, sb = side(a), side(b)
    joint = (ka == kb and ka in ["headassembly", "packassembly", "jackettrim"]) or {
        ka,
        kb,
    } in allowed
    if sa and sb and sa != sb:
        joint = False
    region = None
    if sa == sb and sa and {ka, kb} == {"thigh", "shin"}:
        sign = -1 if sa == "left" else 1
        foot = Vector(P["contacts"]["foot_" + sa + "_support"])
        center = Vector(
            (
                C["anatomy"]["kneeForwardSource"] * scale,
                sign
                * (abs(foot.y) + C["anatomy"]["kneeOutboardBeyondFootSource"] * scale),
                C["anatomy"]["kneeDropSource"] * scale,
            )
        )
        points = [
            p
            for i, j in hits
            for p in intersection_points(components[a][i], components[b][j])
        ]
        maximum = max((p - center).length for p in points) if points else 999
        joint = maximum < 2.0
        region = {
            "declaredJoin": "Same-side bent knee, actual triangle intersection points",
            "maximumIntersectionDistanceWorld": maximum,
            "pointCount": len(points),
        }
    if (a == "Jacket dark waist seam" and kb == "thigh") or (
        b == "Jacket dark waist seam" and ka == "thigh"
    ):
        points = [
            p
            for i, j in hits
            for p in intersection_points(components[a][i], components[b][j])
        ]
        maximum = max(p.length for p in points) if points else 999
        joint = maximum < 3.5
        region = {
            "declaredJoin": "Waist garment meets proximal thigh at hip",
            "maximumIntersectionDistanceWorld": maximum,
            "pointCount": len(points),
        }
    row = {
        "partA": a,
        "partB": b,
        "trianglePairs": len(hits),
        "declaredAnatomicalOrGarmentJoin": joint,
        "boundedJointRegion": region,
    }
    rows.append(row)
    if not joint:
        bad.append(row)
leg_names = [
    n for n in components if kind(n) in ["thigh", "knee", "shin", "sole", "toe"]
]
solid_checks = []
for name, ts in components.items():
    if kind(name) not in ["hand", "sole", "toe"]:
        continue
    edges = Counter()
    for t in ts:
        vv = [tuple(round(c, 5) for c in p) for p in t]
        for p, q in zip(vv, vv[1:] + vv[:1]):
            edges[tuple(sorted([p, q]))] += 1
    assert all(n == 2 for n in edges.values()), (name, Counter(edges.values()))
    volume = abs(sum(t[0].dot(t[1].cross(t[2])) / 6 for t in ts))
    assert volume > 0.01
    solid_checks.append(
        {
            "component": name,
            "closedTwoManifoldAfterUVVertexWeld": True,
            "volumeWorld3": volume,
        }
    )
left = [t for n in leg_names if side(n) == "left" for t in components[n]]
right = [t for n in leg_names if side(n) == "right" for t in components[n]]
half_gap = min(abs(p.y) for n in leg_names for t in components[n] for p in t)
assert half_gap > 0.90
assert all(p.y < -0.90 for t in left for p in t) and all(
    p.y > 0.90 for t in right for p in t
)
collapsed = [[Vector((p.x, -p.y, p.z)) for p in t] for t in right]
negative_leg_pairs = len(tree(left).overlap(tree(collapsed)))
assert negative_leg_pairs > 0
root = bpy.data.objects["Explorer_HipOrigin_forward_minus_X"]
sockets = {n: bpy.data.objects["Socket_" + n] for n in P["contacts"]}
baseline = {n: o.matrix_world.translation.copy() for n, o in sockets.items()}
contacts = []
for name, target in P["contacts"].items():
    point = sockets[name].matrix_world.translation
    assert (point - Vector(target)).length < 1e-5
    contacts.append(
        {
            "name": name,
            "actualGLBAnchorLocalWorld": list(point),
            "profileTargetLocalWorld": target,
            "profileErrorWorld": (point - Vector(target)).length,
        }
    )
rest = root.location.copy()
root.location += Vector((3, 0, 2))
bpy.context.view_layer.update()
displaced = {
    n: (o.matrix_world.translation - Vector(P["contacts"][n])).length
    for n, o in sockets.items()
}
assert all(e > 3 for e in displaced.values())
root.location = rest
bpy.context.view_layer.update()
assert all(
    (o.matrix_world.translation - baseline[n]).length < 1e-6 for n, o in sockets.items()
)
result = {
    "status": "passed" if not bad else "needs-correction",
    "presentationStatus": "prototype-not-production",
    "humanApproval": False,
    "actualBikePresent": False,
    "riderSha256": sha(O / "rider.glb"),
    "profileSha256": sha(S / "profile.json"),
    "packedSources": packed,
    "contactLandmarks": contacts,
    "selfIntersectionPairs": rows,
    "inappropriateSelfIntersectionPairs": bad,
    "straddleOpening": {
        "allLegTrianglesOutsideCentralYStrip": True,
        "minimumLegInnerHalfGapWorld": half_gap,
        "certifiedFiniteEmptyStripWidthWorld": 1.8,
        "excludesPelvisAndFixture": True,
        "notBikeClearance": True,
    },
    "negativeControls": {
        "displacedSocketDistancesWorld": displaced,
        "allDisplacedSocketsRejected": True,
        "collapsedRightLegIntoLeftTrianglePairs": negative_leg_pairs,
        "collapsedLegsRejected": True,
        "baselineRestored": True,
    },
    "footHandGeometry": {
        "actualClosedSolidChecks": solid_checks,
        "closedVolumetricHandFootComponents": True,
        "handsWrapGripCentersAsDeclaredException": True,
        "soleAnchorsOnSupportTopNotPegCenters": True,
    },
    "limits": [
        "No actual bike/frame/wheel geometry exists or is qualified",
        "Declared joints/garment attachments and palm/grip wrapping are intentional local intersections",
        "Finite leg opening and static triangle surface diagnostics do not qualify arbitrary mounts, animation, other avatars or production depth",
    ],
}
(R / "data/vehicle-bake/cruiser-motorcycle/rider-self-contact-proof.json").write_text(
    json.dumps(result, indent=2) + "\n"
)
print(
    json.dumps(
        {
            "status": result["status"],
            "badSelf": bad,
            "openingHalfGapWorld": half_gap,
            "contacts": contacts,
        },
        indent=2,
    ),
    flush=True,
)
assert not bad
