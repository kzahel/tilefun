"""Actual semantic pair-level intersections; only three narrow contact pair kinds."""

from pathlib import Path
import bpy, json, hashlib
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/cruiser-motorcycle/v1"
D = ROOT / "data/vehicle-bake/cruiser-motorcycle"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
MOUNT = Vector(CFG["riderMountSource"]) * S
PROFILE = json.loads((ROOT / CFG["riderProfile"]["path"]).read_text())
TARGETS = {n: Vector(p) + MOUNT for n, p in PROFILE["contacts"].items()}
proof = Path(__file__).with_name("prove-fit.py").read_text()
exec(
    "from collections import Counter, defaultdict\nimport math\nfrom mathutils.bvhtree import BVHTree\nfrom mathutils.geometry import intersect_ray_tri\n"
    + proof[proof.index("def triangles(") : proof.index("\ninputs =")]
)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rider_source = ROOT / CFG["rider"]["sourceDirectory"]
inputs = {
    p.relative_to(ROOT).as_posix(): sha(p)
    for p in [
        A / "master.blend",
        A / "model.glb",
        rider_source / "master.blend",
        rider_source / "rider.glb",
    ]
}
sources = []
for path in [A / "master.blend", rider_source / "master.blend"]:
    bpy.ops.wm.open_mainfile(filepath=str(path))
    sources.append(
        [
            (o.matrix_world @ v.co * S, o.name)
            for o in bpy.context.scene.objects
            if o.type == "MESH"
            for v in o.data.vertices
        ]
    )


def split(ts, source, translation=Vector()):
    kd = KDTree(len(source))
    for i, (p, n) in enumerate(source):
        kd.insert(p + translation, i)
    kd.balance()
    out = {}
    for t in ts:
        names = set.intersection(
            *[{source[i][1] for _, i, _ in kd.find_range(p, 0.001)} for p in t]
        )
        assert names, [list(p) for p in t]
        out.setdefault(sorted(names)[0], []).append(t)
    return out


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(A / "model.glb"))
bpy.context.view_layer.update()
bp = split(triangles(bpy.data.objects["Body_static"]), sources[0])
bpy.ops.import_scene.gltf(filepath=str(rider_source / "rider.glb"))
rroot = bpy.data.objects[CFG["rider"]["rootName"]]
rroot.location = MOUNT
bpy.context.view_layer.update()
rt = triangles(bpy.data.objects[CFG["rider"]["meshName"]])
rp = split(rt, sources[1], MOUNT)


def allowed(b, r, p):
    if "saddle" in b.lower():
        return r == CFG["rider"]["semanticContacts"][
            "hip_saddle"
        ] and contact_exception(b, p)
    for side in ["left", "right"]:
        if b == "Actual palm wrapped grip " + side:
            return r == CFG["rider"]["semanticContacts"][
                "hand_" + side + "_grip"
            ] and contact_exception(b, p)
        if b == "Actual sole tangent foot peg " + side:
            return r == CFG["rider"]["semanticContacts"][
                "foot_" + side + "_support"
            ] and contact_exception(b, p)
    return False


def diagnose(rider_parts):
    rows = []
    bad = []
    for bn, bt in bp.items():
        bbox = bounds(bt)
        btree = tree(bt)
        for rn, rr in rider_parts.items():
            rbox = bounds(rr)
            if any(
                bbox[0][i] > rbox[1][i] + 1e-5 or rbox[0][i] > bbox[1][i] + 1e-5
                for i in range(3)
            ):
                continue
            rtree = tree(rr)
            points = []
            hits = 0
            for i, j in btree.overlap(rtree):
                pp = intersections(bt[i], rr[j])
                if pp:
                    hits += 1
                    points += pp
            binside = [
                p
                for p in unique(bt)
                if in_box(p, rbox) and closed(rr) and inside(p, rtree)
            ]
            rinside = [
                p
                for p in unique(rr)
                if in_box(p, bbox) and closed(bt) and inside(p, btree)
            ]
            allpoints = points + binside + rinside
            if not allpoints:
                continue
            inappropriate = [list(p) for p in allpoints if not allowed(bn, rn, p)]
            row = {
                "bikeOwner": bn,
                "riderOwner": rn,
                "intersectionTrianglePairs": hits,
                "intersectionPoints": len(points),
                "bikeVerticesInsideClosedRiderPart": len(binside),
                "riderVerticesInsideClosedBikePart": len(rinside),
                "boundedDeclaredContactOnly": not inappropriate,
                "unallowedPoints": len(inappropriate),
                "unallowedExamplesWorld": inappropriate[:4],
            }
            rows.append(row)
            if inappropriate:
                bad.append(row)
    return {
        "status": "passed" if not bad else "needs-correction",
        "pairs": rows,
        "inappropriatePairs": bad,
    }


baseline = diagnose(rp)
(D / "contact-pairs-current.json").write_text(json.dumps(baseline, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": baseline["status"],
            "pairs": len(baseline["pairs"]),
            "bad": baseline["inappropriatePairs"],
        },
        indent=2,
    ),
    flush=True,
)
assert baseline["status"] == "passed"
delta = Vector(CFG["negativeRiderTranslationSource"]) * S
negative = diagnose({n: [[p + delta for p in t] for t in ts] for n, ts in rp.items()})
assert negative["status"] == "needs-correction" and any(
    "tank" in row["bikeOwner"] for row in negative["inappropriatePairs"]
)
assert diagnose(rp) == baseline
assert all(sha(ROOT / p) == h for p, h in inputs.items())
receipt = {
    "status": "passed",
    "glbSha256": sha(A / "model.glb"),
    "riderSha256": sha(rider_source / "rider.glb"),
    "inputHashes": inputs,
    "riderTrianglesMatchedToNamedMaster": sum(len(ts) for ts in rp.values()),
    "bikeFixedTrianglesMatchedToNamedMaster": sum(len(ts) for ts in bp.values()),
    "baseline": baseline,
    "negative": {
        "translationSource": [-0.28, 0, -0.22],
        "actualTankCollisionDetected": True,
        "inappropriatePairs": negative["inappropriatePairs"],
        "resetExact": True,
    },
    "exceptions": CFG["contactBoundsSource"],
    "unchangedRiderSelfJoins": "Immutable accepted configured rider anatomy; separate family-local replay of original self/joint/straddle controls retained.",
}
(D / "contact-pairs-proof.json").write_text(json.dumps(receipt, indent=2) + "\n")
