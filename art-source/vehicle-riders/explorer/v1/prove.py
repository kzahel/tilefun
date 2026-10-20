"""Actual GLB contacts/intersections, source semantic triangle ownership and collision control."""

from pathlib import Path
import bpy, json, hashlib, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
C = json.loads((S / "rider.json").read_text())
D = R / "data/vehicle-riders/explorer"
A = R / "art-source/vehicle-riders/explorer/v1"
O = R / "public/demos/vehicle-riders/explorer/v1"
scale = C["worldScale"]
hip = Vector(C["hipSocketSource"])
carpath = R / C["carControl"]["glb"]
riderpath = O / "rider.glb"


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


carsha = sha(carpath)
ridersha = sha(riderpath)
assert carsha == C["carControl"]["sha256"]


def key(tri):
    return tuple(sorted(tuple(round(c, 3) for c in v) for v in tri))


def triangles(o, offset=Vector()):
    o.data.calc_loop_triangles()
    vv = [o.matrix_world @ v.co + offset for v in o.data.vertices]
    return [[vv[i] for i in t.vertices] for t in o.data.loop_triangles]


carowners = {}
riderowners = {}
carvertices = []
ridervertices = []
packed = {}
bpy.ops.wm.open_mainfile(filepath=str(R / C["carControl"]["master"]))
body_names = {
    p["name"]
    for p in json.loads(
        (R / "art-source/vehicle-bake/classic-roadster/v1/recipe.json").read_text()
    )["components"]
    if p["group"] == "body"
}
for o in bpy.context.scene.objects:
    if o.type == "MESH" and o.name in body_names:
        carvertices.extend(
            (o.matrix_world @ v.co * scale, o.name) for v in o.data.vertices
        )
        for tri in triangles(o):
            carowners[key([v * scale for v in tri])] = o.name
for name in ["master.blend", "low.blend"]:
    p = A / name
    before = sha(p)
    bpy.ops.wm.open_mainfile(filepath=str(p))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 1 and all(i.packed_file for i in images)
    assert all(len(o.data.uv_layers) == 1 for o in meshes)
    if name == "master.blend":
        assert len(meshes) > 30 and all("semantic_owner" in o for o in meshes)
        for o in meshes:
            ridervertices.extend(
                ((o.matrix_world @ v.co + hip) * scale, o.name) for v in o.data.vertices
            )
            for tri in triangles(o):
                riderowners[key([(v + hip) * scale for v in tri])] = o.name
    else:
        assert len(meshes) == 1
    assert sha(p) == before
    packed[name] = {
        "sha256": before,
        "meshes": len(meshes),
        "packedImages": len(images),
        "oneSemanticUV": True,
    }
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(carpath))
bpy.context.view_layer.update()
carobj = bpy.data.objects["Body_static"]
ct = triangles(carobj)


def semantic_owners(tris, points):
    kd = KDTree(len(points))
    for i, (v, name) in enumerate(points):
        kd.insert(v, i)
    kd.balance()
    result = []
    for tri in tris:
        names = [{points[i][1] for co, i, d in kd.find_range(v, 0.001)} for v in tri]
        common = set.intersection(*names)
        assert common, [(list(v), kd.find(v)[2]) for v in tri]
        result.append(sorted(common)[0])
    return result


carowner = semantic_owners(ct, carvertices)
main = [t for t, n in zip(ct, carowner) if n.startswith("Own long rounded roadster")]
print(
    "MAIN_TRIANGLES",
    len(main),
    "OWNER_MATCHES",
    sum(n != "unmatched-actual-body-triangle" for n in carowner),
    flush=True,
)
assert len(main) == 696
bpy.ops.import_scene.gltf(filepath=str(riderpath))
bpy.context.view_layer.update()
rider = bpy.data.objects["Explorer_static_seated"]
rt = triangles(rider, hip * scale)
ro = semantic_owners(rt, ridervertices)
assert all(n != "unmatched-rider-triangle" for n in ro)


def tree(tris):
    return BVHTree.FromPolygons(
        [v for t in tris for v in t],
        [tuple(3 * i + j for j in range(3)) for i in range(len(tris))],
        all_triangles=True,
        epsilon=0,
    )


carbvh = tree(ct)
mainbvh = tree(main)


def overlaps(tris):
    pairs = tree(tris).overlap(carbvh)
    rows = []
    for ri, ci in pairs:
        rn = ro[ri]
        cn = carowner[ci]
        exception = None
        if rn.startswith("Warm hand gripping actual rim") and cn in [
            "Static steering wheel in cockpit",
            "Static steering wheel spoke",
        ]:
            exception = "declared palm wraps rim"
        if rn == "Seated dark trouser pelvis" and cn in [
            "Cream tan cushion center -1",
            "Tan bucket seat cushion -1",
        ]:
            exception = "declared pelvis cushion contact"
        if (
            rn.startswith("Brown boot solid sole")
            and cn == "Recessed cockpit floor visible in footwells"
        ):
            exception = "declared sole floor contact"
        rows.append(
            {
                "riderTriangle": ri,
                "riderOwner": rn,
                "carTriangle": ci,
                "carOwner": cn,
                "declaredContactException": exception,
            }
        )
    return rows


direction = Vector((1, 0.279, 0.137)).normalized()


def inside(v):
    p = v + direction * 0.0001
    hits = 0
    for _ in range(30):
        hit, normal, face, dist = mainbvh.ray_cast(p, direction, 1000)
        if hit is None:
            break
        hits += 1
        p = hit + direction * 0.0001
    return bool(hits % 2)


baseline = overlaps(rt)
bad = [p for p in baseline if not p["declaredContactException"]]
packpoints = [
    v
    for t, n in zip(rt, ro)
    if n.startswith(("Raised canvas backpack", "Canvas pack"))
    for v in t
]
seatback = [
    t
    for t, n in zip(ct, carowner)
    if n
    in [
        "Tan bucket seatback -1",
        "Tan seatback center face -1",
        "Seatback top warm seam -1",
    ]
]
assert packpoints and seatback
pack_gap = min(v.z for v in packpoints) - max(v.z for t in seatback for v in t)
assert pack_gap > 0
vertices = {tuple(v) for t in rt for v in t}
inside_baseline = [v for v in vertices if inside(Vector(v))]
contacts = []
for name, point in C["riderContactSocketsSource"].items():
    socket = bpy.data.objects["Socket_" + name]
    actual = socket.matrix_world.translation + hip * scale
    target = Vector(point) * scale
    near, normal, face, distance = carbvh.find_nearest(actual)
    contacts.append(
        {
            "name": name,
            "actualGLTFSocketWorldBlender": list(actual),
            "targetWorldBlender": list(target),
            "socketToDeclaredTargetWorld": (actual - target).length,
            "nearestActualCarSurfaceWorld": list(near),
            "distanceToActualSurfaceWorld": distance,
            "surfaceOwner": carowner[face],
            "meaning": (
                "Hand targets are exact ring centerline grips; palms wrap rim solid as declared exception"
                if name.startswith("hand")
                else "Surface contact anchor"
            ),
        }
    )
    assert (actual - target).length < 1e-4
    assert distance < (0.5 if name.startswith("hand") else 0.002)
negative = [[v + Vector((-1.7 * scale, 0, 0)) for v in t] for t in rt]
negative_inside = sum(
    inside(Vector(v) + Vector((-1.7 * scale, 0, 0))) for v in vertices
)
negative_overlaps = overlaps(negative)
assert negative_inside > 0 and any(
    not p["declaredContactException"] for p in negative_overlaps
)
assert overlaps(rt) == baseline
result = {
    "status": "passed" if not bad and not inside_baseline else "needs-correction",
    "presentationStatus": "prototype-not-production",
    "humanApproval": False,
    "riderSha256": ridersha,
    "carSha256": carsha,
    "packedSources": packed,
    "actualContactSockets": contacts,
    "actualSurfaceIntersections": baseline,
    "inappropriateSurfaceIntersections": bad,
    "actualMainBodyInteriorVertexCount": len(inside_baseline),
    "actualMainBodyInteriorVerticesWorld": inside_baseline,
    "backpackSeatbackVerticalSeparationWorld": pack_gap,
    "mainBodyTrianglesFromActualGLB": len(main),
    "carSemanticOwnershipMatches": sum(
        n != "unmatched-actual-body-triangle" for n in carowner
    ),
    "contactExceptions": C["contactExceptions"],
    "controls": {
        "translatedIntoHoodRejected": True,
        "negativeInteriorVertices": negative_inside,
        "negativeSurfaceIntersectionCount": len(negative_overlaps),
        "baselineRestored": True,
        "inputBytesUnchanged": sha(carpath) == carsha and sha(riderpath) == ridersha,
    },
    "limits": [
        "Static art pose only; no moving wheel/driver interaction or production physics qualification",
        "Hand/rim overlap is an intended grip exception; not mislabeled as universal separation",
        "Surface intersection plus actual closed main-body interior ray parity, no universal animated clearance claim",
    ],
}
(D / "contact-proof.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": result["status"],
            "inappropriate": bad,
            "mainBodyInterior": len(inside_baseline),
            "contacts": contacts,
        },
        indent=2,
    )
)
assert not bad and not inside_baseline
