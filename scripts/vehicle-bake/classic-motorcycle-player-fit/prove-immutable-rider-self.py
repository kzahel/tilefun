"""Actual RiderClassic GLB contact, fixed bones, finite opening and local-joint surface diagnostics.
Synthetic fixture only: never a bike/frame/wheel/production clearance certificate.
"""

from pathlib import Path
import bpy, json, hashlib, itertools, math
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import intersect_ray_tri

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = R / "scripts/vehicle-riders/classic-upright-v3"
A = R / "art-source/vehicle-riders/classic-upright/v3"
O = R / "public/demos/vehicle-riders/classic-upright/v3"
D = R / "data/vehicle-bake/classic-motorcycle-player-fit"
C = json.loads((S / "rider.json").read_text())
P = json.loads((S / C["contactProfile"]["ownCopy"]).read_text())
recipe = json.loads((O / "recipe.json").read_text())
scale = C["worldScale"]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


assert sha(S / C["contactProfile"]["ownCopy"]) == C["contactProfile"]["sha256"]


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


source = []
packed = {}
for name in ["master.blend", "low.blend"]:
    before = sha(A / name)
    bpy.ops.wm.open_mainfile(filepath=str(A / name))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 1 and images[0].packed_file
    if name == "master.blend":
        assert len(meshes) >= 20
        for o in meshes:
            assert o["static_seated_component"]
            source.extend(
                (o.matrix_world @ v.co * scale, o.name) for v in o.data.vertices
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
kd = KDTree(len(source))
for i, (v, n) in enumerate(source):
    kd.insert(v, i)
kd.balance()
owners = []
for t in rt:
    common = set.intersection(
        *[{source[i][1] for co, i, d in kd.find_range(v, 0.001)} for v in t]
    )
    assert common
    owners.append(sorted(common)[0])
components = {n: [t for t, o in zip(rt, owners) if o == n] for n in sorted(set(owners))}
trees = {n: tree(ts) for n, ts in components.items()}


def kind(n):
    n = n.removeprefix("RiderClassic ")
    for word, key in [
        ("upper arm", "upperarm"),
        ("forearm", "forearm"),
        ("elbow", "elbow"),
        ("palm", "hand"),
        ("thigh", "thigh"),
        ("knee", "knee"),
        ("shin", "shin"),
        ("boot", "sole"),
        ("pelvis", "pelvis"),
        ("torso", "torso"),
        ("neck", "neck"),
        ("face UV", "head"),
        ("ear", "ear"),
        ("nose", "nose"),
        ("cap crown", "crown"),
        ("cap band", "band"),
        ("cap brim", "brim"),
    ]:
        if word in n:
            return key
    raise ValueError(n)


def side(n):
    return "left" if n.endswith("left") else "right" if n.endswith("right") else None


def points(ta, tb):
    out = []
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
                out.append(hit)
    return out


# Every allowable join has its own finite center/radius; other body contacts fail.
fixedJoins = {
    frozenset(["neck", "torso"]): ([0, 0, 0.10], 0.19),
    frozenset(["pelvis", "torso"]): ([0, 0, 0.035], 0.17),
    frozenset(["torso", "head"]): ([-0.012, 0, 0.145], 0.19),
}
rows = []
bad = []
for a, b in itertools.combinations(components, 2):
    hits = trees[a].overlap(trees[b])
    if not hits:
        continue
    ka, kb = kind(a), kind(b)
    sa, sb = side(a), side(b)
    pair = frozenset([ka, kb])
    region = None
    if pair in fixedJoins:
        region = fixedJoins[pair]
    if "ear" in pair and "head" in pair:
        ear = a if ka == "ear" else b
        sign = -1 if ear.endswith("left") else 1
        region = (
            [0.005, sign * 0.20, 0.50],
            math.sqrt(0.12**2 + 0.13**2 + 0.06**2) + 1e-6,
        )
    limbSide = sa or sb
    if limbSide and not (sa and sb and sa != sb):
        j = recipe["anatomicalJointsSource"][limbSide]
        if pair in [
            frozenset(["upperarm", "elbow"]),
            frozenset(["elbow", "forearm"]),
            frozenset(["upperarm", "forearm"]),
        ]:
            region = (j["elbow"], 0.05)
        if pair == frozenset(["forearm", "hand"]):
            region = (j["palm"], 0.065)
        if pair == frozenset(["upperarm", "torso"]):
            region = (j["shoulder"], 0.07)
        if pair in [
            frozenset(["thigh", "knee"]),
            frozenset(["knee", "shin"]),
            frozenset(["thigh", "shin"]),
        ]:
            region = (j["knee"], 0.05)
        if pair == frozenset(["shin", "sole"]):
            region = (j["ankle"], 0.075)
        if pair in [frozenset(["pelvis", "thigh"]), frozenset(["torso", "thigh"])]:
            region = (j["hip"], 0.06)
    actualPoints = [
        p for i, j in hits for p in points(components[a][i], components[b][j])
    ]
    maximum = (
        max(((p - Vector(region[0]) * scale).length for p in actualPoints), default=999)
        if region
        else None
    )
    okay = bool(region and maximum < region[1] * scale)
    row = {
        "partA": a,
        "partB": b,
        "trianglePairs": len(hits),
        "declaredLocalAnatomicalJoin": okay,
        "boundedJointRegion": (
            {
                "centerSource": region[0],
                "radiusWorld": region[1] * scale,
                "maximumActualIntersectionDistanceWorld": maximum,
                "actualIntersectionPointCount": len(actualPoints),
            }
            if region
            else None
        ),
    }
    rows.append(row)
    if not okay:
        bad.append(row)
# Actual tubular bone end rings reconstructed from GLB vertices, not socket labels.
boneChecks = []
for sideName, j in recipe["anatomicalJointsSource"].items():
    for name, ap, bp, length in [
        (
            "RiderClassic upper arm ",
            j["shoulder"],
            j["elbow"],
            C["anatomy"]["armLengthsSource"][0],
        ),
        (
            "RiderClassic forearm ",
            j["elbow"],
            j["wrist"],
            C["anatomy"]["armLengthsSource"][1]
            - C["anatomy"]["wristInsetFromPalmSource"],
        ),
        (
            "RiderClassic bent thigh ",
            j["hip"],
            j["knee"],
            C["anatomy"]["legLengthsSource"][0],
        ),
        (
            "RiderClassic short shin ",
            j["knee"],
            j["ankle"],
            C["anatomy"]["legLengthsSource"][1],
        ),
    ]:
        name += sideName
        a, b = Vector(ap) * scale, Vector(bp) * scale
        axis = (b - a).normalized()
        vv = {tuple(round(c, 6) for c in p) for t in components[name] for p in t}
        vv = [Vector(p) for p in vv]
        projection = [(p - a).dot(axis) for p in vv]
        lo, hi = min(projection), max(projection)
        ends = []
        for value in [lo, hi]:
            ring = [p for p, t in zip(vv, projection) if abs(t - value) < 0.0001]
            assert len(ring) == 8
            ends.append(sum(ring, Vector()) / 8)
        actual = (ends[1] - ends[0]).length
        assert abs(actual - length * scale) < 0.0001
        boneChecks.append(
            {
                "owner": name,
                "actualGLBRingCentersWorld": [list(p) for p in ends],
                "actualLengthWorld": actual,
                "fixedAuthoredLengthWorld": length * scale,
                "forepawCenterBeyondWristWorld": (
                    C["anatomy"]["wristInsetFromPalmSource"] * scale
                    if "forearm" in name
                    else 0
                ),
                "errorWorld": abs(actual - length * scale),
            }
        )
solid = []
for name, ts in components.items():
    if kind(name) not in ["hand", "sole"]:
        continue
    edges = Counter()
    for t in ts:
        vv = [tuple(round(c, 5) for c in p) for p in t]
        for a, b in zip(vv, vv[1:] + vv[:1]):
            edges[tuple(sorted([a, b]))] += 1
    assert all(n == 2 for n in edges.values()), (name, Counter(edges.values()))
    volume = abs(sum(t[0].dot(t[1].cross(t[2])) / 6 for t in ts))
    assert volume > 0.01
    solid.append(
        {
            "owner": name,
            "closedTwoManifoldAfterUVVertexWeld": True,
            "volumeWorld3": volume,
        }
    )
legs = [n for n in components if kind(n) in ["thigh", "knee", "shin", "sole"]]
left = [t for n in legs if side(n) == "left" for t in components[n]]
right = [t for n in legs if side(n) == "right" for t in components[n]]
halfGap = min([-p.y for t in left for p in t] + [p.y for t in right for p in t])
assert halfGap > 1
collapsed = [[Vector((p.x, -p.y, p.z)) for p in t] for t in right]
negativeLegHits = len(tree(left).overlap(tree(collapsed)))
assert negativeLegHits > 0
root = bpy.data.objects["RiderClassic_HipOrigin_forward_minus_X"]
sockets = {n: bpy.data.objects["RiderClassic_Socket_" + n] for n in P["contacts"]}
baseline = {n: o.matrix_world.translation.copy() for n, o in sockets.items()}
bpy.ops.import_scene.gltf(filepath=str(D / "synthetic-contact-fixture.glb"))
bpy.context.view_layer.update()
contacts = []
fixtureBad = []
for name, target in P["contacts"].items():
    target = Vector(target)
    p = sockets[name].matrix_world.translation
    error = (p - target).length
    assert error < 1e-5
    fixture = bpy.data.objects["FIXTURE_" + name]
    ft = tris(fixture)
    ftree = tree(ft)
    near, _, _, distance = ftree.find_nearest(p)
    part = (
        "RiderClassic seated pelvis"
        if name == "hip_saddle"
        else (
            "RiderClassic gripping palm "
            if name.startswith("hand")
            else "RiderClassic boot "
        )
        + ("left" if "left" in name else "right")
    )
    rn, _, _, rd = trees[part].find_nearest(p)
    centerError = None
    if name.startswith("hand"):
        assert (
            abs(distance - C["fixture"]["gripRadiusWorld"]) < 0.03
            and rd > C["fixture"]["gripRadiusWorld"]
        )
        vv = [p for t in components[part] for p in t]
        center = Vector(
            [(min(p[i] for p in vv) + max(p[i] for p in vv)) / 2 for i in range(3)]
        )
        centerError = (center - p).length
        assert centerError < 1e-5
    else:
        assert distance < 1e-5 and rd < 1e-5
    contacts.append(
        {
            "name": name,
            "actualGLBAnchorWorld": list(p),
            "profileTargetWorld": list(target),
            "profileErrorWorld": error,
            "actualRiderContactOwner": part,
            "closestRiderSurfaceWorld": list(rn),
            "closestRiderSurfaceDistanceWorld": rd,
            "handCenterErrorWorld": centerError,
            "closestFixtureSurfaceWorld": list(near),
            "closestFixtureSurfaceDistanceWorld": distance,
            "contactSemantics": (
                "Grip center inside closed palm; deliberate palm wrapping"
                if name.startswith("hand")
                else "Pelvis bottom / boot sole on actual top of synthetic contact patch"
            ),
        }
    )
    for owner, btree in trees.items():
        hits = btree.overlap(ftree)
        if hits and owner != part:
            fixtureBad.append(
                {"fixture": name, "riderOwner": owner, "trianglePairs": len(hits)}
            )
start = root.location.copy()
root.location += Vector((3, 0, 2))
bpy.context.view_layer.update()
displaced = {
    n: (o.matrix_world.translation - Vector(P["contacts"][n])).length
    for n, o in sockets.items()
}
assert all(v > 3 for v in displaced.values())
root.location = start
bpy.context.view_layer.update()
assert all(
    (o.matrix_world.translation - baseline[n]).length < 1e-6 for n, o in sockets.items()
)
# Explicit actual-GLB negative controls, without changing retained input bytes.
closedNegatives = []
for name, ts in components.items():
    if kind(name) not in ["hand", "sole"]:
        continue

    def edge_counts(triangles):
        edges = Counter()
        for t in triangles:
            vv = [tuple(round(c, 5) for c in v) for v in t]
            for one, two in zip(vv, vv[1:] + vv[:1]):
                edges[tuple(sorted([one, two]))] += 1
        return edges

    baselineClosed = all(n == 2 for n in edge_counts(ts).values())
    missingTriangle = ts[1:]
    openEdges = sum(n != 2 for n in edge_counts(missingTriangle).values())
    assert baselineClosed and openEdges > 0
    assert all(n == 2 for n in edge_counts(ts).values())
    closedNegatives.append(
        {
            "owner": name,
            "removedActualTriangleRejected": True,
            "boundaryEdges": openEdges,
            "resetClosed": True,
        }
    )
palmName = "RiderClassic gripping palm left"
headEarNeckControls = []
for name in [
    "RiderClassic broad face UV owner",
    "RiderClassic pointed ear left",
    "RiderClassic pointed ear right",
    "RiderClassic neck collar visible skin",
]:
    ts = components[name]
    assert all(n == 2 for n in edge_counts(ts).values()), name
    boundary = sum(n != 2 for n in edge_counts(ts[1:]).values())
    assert boundary > 0 and all(n == 2 for n in edge_counts(ts).values())
    headEarNeckControls.append(
        {
            "owner": name,
            "actualDecodedTriangles": len(ts),
            "closedSurface": True,
            "removedActualTriangleBoundaryEdges": boundary,
            "negativeRejected": True,
            "resetExact": True,
        }
    )
headName = "RiderClassic broad face UV owner"
palmTriangles = components[palmName]
headTriangles = components[headName]
palmCenter = Vector(recipe["anatomicalJointsSource"]["left"]["palm"]) * scale
negativeHeadSurface = trees[headName].ray_cast(
    Vector((-2 * scale, 0, 0.30 * scale)), Vector((1, 0, 0))
)[0]
assert negativeHeadSurface is not None
shift = negativeHeadSurface - palmCenter
movedPalm = [[p + shift for p in t] for t in palmTriangles]
negativePalmHeadHits = len(tree(movedPalm).overlap(tree(headTriangles)))
assert negativePalmHeadHits > 0 and not trees[palmName].overlap(trees[headName])
assert not tree(left).overlap(tree(right))
report = {
    "headEarNeckClosedSurfaceControls": headEarNeckControls,
    "status": "passed" if not bad and not fixtureBad else "FAILED-geometry-diagnostics",
    "presentationStatus": "prototype-not-production",
    "humanApproval": False,
    "actualBikePresent": False,
    "riderSha256": sha(O / "rider.glb"),
    "profileSha256": sha(S / C["contactProfile"]["ownCopy"]),
    "fixtureSha256": sha(D / "synthetic-contact-fixture.glb"),
    "packedSources": packed,
    "contactLandmarks": contacts,
    "actualFixedBoneLengthChecks": boneChecks,
    "selfIntersectionPairs": rows,
    "inappropriateSelfIntersectionPairs": bad,
    "inappropriateFixtureIntersectionPairs": fixtureBad,
    "straddleOpening": {
        "allLegTrianglesOutsideCentralYStrip": True,
        "minimumLegInnerHalfGapWorld": halfGap,
        "certifiedFiniteEmptyStripWidthWorld": 2,
        "excludesPelvisAndFixture": True,
        "notBikeClearance": True,
    },
    "negativeControls": {
        "displacedSocketDistancesWorld": displaced,
        "allDisplacedSocketsRejected": True,
        "collapsedRightLegIntoLeftTrianglePairs": negativeLegHits,
        "collapsedLegsRejected": True,
        "baselineRestored": True,
        "closedPalmSoleControls": closedNegatives,
        "translatedPalmIntoHeadRejected": {
            "actualTrianglePairs": negativePalmHeadHits,
            "resetPairs": 0,
            "boundedJoinExceptionAllowed": False,
        },
        "straddleResetIntersectionPairs": 0,
    },
    "actualPartBoundsWorld": {
        n: {
            "min": [min(p[i] for t in ts for p in t) for i in range(3)],
            "max": [max(p[i] for t in ts for p in t) for i in range(3)],
        }
        for n, ts in components.items()
    },
    "handFootGeometry": {
        "actualClosedSolidChecks": solid,
        "closedVolumetricPalmsBoots": len(solid) == 4,
    },
    "limits": [
        "Body depth/joint positions inferred from2D; not unique observed anatomy",
        "Only declared bounded anatomical joins and matching fixture contacts excepted",
        "Finite triangle surface and central opening checks do not prove any bike/frame/wheel/animation or other-avatar fit",
    ],
}
(D / "rider-self-contact-proof.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": report["status"],
            "badSelf": bad,
            "badFixture": fixtureBad,
            "openingHalfGapWorld": halfGap,
        },
        indent=2,
    )
)
assert not bad and not fixtureBad
