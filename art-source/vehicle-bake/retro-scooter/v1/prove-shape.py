"""Read-only scooter morphology and actual-GLB open floor ray controls."""

from pathlib import Path
import bpy, json, hashlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/retro-scooter/v1"
D = ROOT / "data/vehicle-bake/retro-scooter"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {n: sha(A / n) for n in ["master.blend", "model.glb"]}
bpy.ops.wm.open_mainfile(filepath=str(A / "master.blend"))
meshes = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}


def box(o):
    pp = [o.matrix_world @ v.co for v in o.data.vertices]
    lo = [min(p[i] for p in pp) for i in range(3)]
    hi = [max(p[i] for p in pp) for i in range(3)]
    return {
        "minSource": lo,
        "maxSource": hi,
        "spanSource": [b - a for a, b in zip(lo, hi)],
    }


parts = {k: box(meshes[n]) for k, n in CFG["geometryOwners"].items()}
assert (
    parts["shield"]["spanSource"][1] > 0.71 and parts["shield"]["spanSource"][2] > 0.72
)
assert parts["rearBody"]["spanSource"][1] > 0.71
assert parts["floor"]["spanSource"][0] > 0.87 and parts["floor"]["spanSource"][1] > 0.65
seat = box(meshes["Scooter broad long rear saddle"])
assert seat["spanSource"][0] > 0.83 and seat["spanSource"][1] > 0.42
source = [
    (o.matrix_world @ v.co * S, o.name)
    for o in meshes.values()
    for v in o.data.vertices
]
kd = KDTree(len(source))
for i, (p, n) in enumerate(source):
    kd.insert(p, i)
kd.balance()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(A / "model.glb"))
bpy.context.view_layer.update()
body = bpy.data.objects["Body_static"]
body.data.calc_loop_triangles()
pp = [body.matrix_world @ v.co for v in body.data.vertices]
ts = [[pp[i] for i in t.vertices] for t in body.data.loop_triangles]
owners = []
for t in ts:
    names = set.intersection(
        *[{source[i][1] for _, i, _ in kd.find_range(p, 0.001)} for p in t]
    )
    assert names
    owners.append(sorted(names)[0])


def tree(tris):
    return BVHTree.FromPolygons(
        [p for t in tris for p in t],
        [tuple(3 * i + j for j in range(3)) for i in range(len(tris))],
        all_triangles=True,
    )


floor_cfg = CFG["floor"]
floor_owner = floor_cfg["owner"]
top = parts["floor"]["maxSource"][2]


def probe(tris, labels):
    bvh = tree(tris)
    rows = []
    for x in floor_cfg["rayX"]:
        for y in floor_cfg["rayY"]:
            origin = Vector((x, y, floor_cfg["rayOriginZ"])) * S
            p, normal, i, dist = bvh.ray_cast(origin, Vector((0, 0, -1)), 100)
            rows.append(
                {
                    "originSource": [x, y, floor_cfg["rayOriginZ"]],
                    "hitSource": list(p / S) if p is not None else None,
                    "owner": labels[i] if p is not None else None,
                    "floorReached": p is not None
                    and labels[i] == floor_owner
                    and abs(p.z / S - top) < 1e-5,
                }
            )
    return rows


baseline = probe(ts, owners)
assert len(baseline) == 9 and all(r["floorReached"] for r in baseline)
kept = [(t, n) for t, n in zip(ts, owners) if n != floor_owner]
removed = probe([t for t, n in kept], [n for t, n in kept])
assert not any(r["floorReached"] for r in removed)
z = top + 0.30
deck = [
    Vector((x, y, z)) * S
    for x, y in [(-0.49, -0.28), (-0.08, -0.28), (-0.08, 0.28), (-0.49, 0.28)]
]
negative = probe(
    ts + [[deck[0], deck[1], deck[2]], [deck[0], deck[2], deck[3]]],
    owners + ["Opaque upper deck negative"] * 2,
)
assert not any(r["floorReached"] for r in negative)
assert all(r["owner"] == "Opaque upper deck negative" for r in negative)
assert probe(ts, owners) == baseline
assert all(sha(A / n) == h for n, h in before.items())
result = {
    "status": "passed",
    "glbSha256": before["model.glb"],
    "sourceHashes": before,
    "ownMasterMeshComponents": len(meshes),
    "geometryOnlyPaletteChange": False,
    "actualScooterParts": parts,
    "broadRearSaddle": seat,
    "wheelbaseSource": CFG["wheelSpecs"]["R"]["axle"] - CFG["wheelSpecs"]["F"]["axle"],
    "independentDifferentRadiiSource": {
        n: v["radius"] for n, v in CFG["wheelSpecs"].items()
    },
    "floorDepth": {
        "actualGLBDownRays": baseline,
        "all9ActualFloorHits": True,
        "floorTopSource": top,
        "railTopSource": top + floor_cfg["railHeight"],
        "recessBelowRailsSource": floor_cfg["railHeight"],
        "floorRemovalNegative": removed,
        "opaqueDeckNegative": negative,
        "resetExact": True,
    },
    "noAvatarGeometryOrScaleChange": True,
    "sourceMasterUnchanged": True,
    "limits": "Actual source morphology/floor evidence only. Rider retains upright straddle pose; no scooter-specific knees-together pose, animation or shared runtime claim.",
}
(D / "shape-proof.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "actualFloorRays": len(baseline),
            "components": len(meshes),
        }
    )
)
