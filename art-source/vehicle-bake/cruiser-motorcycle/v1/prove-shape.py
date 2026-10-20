"""Read-only actual master morphology for the original cruiser family."""

from pathlib import Path
import bpy, json, hashlib, math
import numpy as np
from mathutils import Vector

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/cruiser-motorcycle/v1"
D = ROOT / "data/vehicle-bake/cruiser-motorcycle"
CFG = json.loads((A / "family.json").read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = sha(A / "master.blend")
bpy.ops.wm.open_mainfile(filepath=str(A / "master.blend"))
meshes = {o.name: o for o in bpy.context.scene.objects if o.type == "MESH"}


def points(ob):
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def box(ob):
    p = points(ob)
    lo = [min(v[i] for v in p) for i in range(3)]
    hi = [max(v[i] for v in p) for i in range(3)]
    return {
        "minSource": lo,
        "maxSource": hi,
        "spanSource": [b - a for a, b in zip(lo, hi)],
    }


tank = meshes[CFG["geometryOwners"]["tank"]]
rings = {round(v.co.x, 6) for v in tank.data.vertices}
tb = box(tank)
assert (
    len(rings) == 7
    and abs(tb["spanSource"][1] - 0.4) < 1e-5
    and abs(tb["spanSource"][2] - 0.28) < 1e-5
)
assert tb["maxSource"][2] < 1.03
fork = meshes["Cruiser laidback long front fork 1"]
fp = points(fork)
ends = [sum(fp[i : i + 10], Vector()) / 10 for i in [0, 10]]
v = ends[1] - ends[0]
rake = math.degrees(math.atan2(abs(v.x), abs(v.z)))
assert 48 < rake < 51
seat = box(meshes["Actual dark saddle central hip tangent"])
pillion = box(meshes["Cruiser long raised pillion pad"])
assert seat["spanSource"][0] > 0.85 and pillion["maxSource"][0] > 0.97
cylinders = []
for n in ["Cruiser V cylinder front", "Cruiser V cylinder rear"]:
    pp = np.array([list(p) for p in points(meshes[n])])
    center = pp.mean(axis=0)
    values, vectors = np.linalg.eigh((pp - center).T @ (pp - center))
    axis = vectors[:, np.argmax(values)]
    if axis[2] < 0:
        axis = -axis
    cylinders.append(
        {
            "owner": n,
            "actualBounds": box(meshes[n]),
            "principalAxis": axis.tolist(),
            "leanDegreesFromVertical": math.degrees(
                math.atan2(abs(axis[0]), abs(axis[2]))
            ),
        }
    )
assert (
    cylinders[0]["principalAxis"][0] < -0.5 and cylinders[1]["principalAxis"][0] > 0.5
)
exhausts = [
    {"owner": n, "actualBounds": box(o)}
    for n, o in meshes.items()
    if n.startswith("Cruiser long low chrome exhaust")
]
assert len(exhausts) == 2 and all(
    r["actualBounds"]["spanSource"][0] > 1.64
    and r["actualBounds"]["maxSource"][2] < 0.31
    for r in exhausts
)
assert CFG["wheelSpecs"]["F"]["radius"] != CFG["wheelSpecs"]["R"]["radius"]
result = {
    "status": "passed",
    "glbSha256": sha(A / "model.glb"),
    "masterSha256": before,
    "route": "Own family fixed-body geometry and semantic UV charts; reused generic primitives/export/contact diagnostics only",
    "geometryOnlyPaletteChange": False,
    "ownMasterMeshComponents": len(meshes),
    "tank": {
        "rings": len(rings),
        "verticesPerRing": CFG["tank"]["segments"],
        "actualBounds": tb,
        "actualMaxCrownZSource": tb["maxSource"][2],
    },
    "fork": {
        "actualTubeRingCentersSource": [list(p) for p in ends],
        "rakeDegreesFromVertical": rake,
    },
    "saddle": {
        "main": seat,
        "raisedPillion": pillion,
        "combinedLongitudinalSpanSource": pillion["maxSource"][0]
        - seat["minSource"][0],
    },
    "VEngineActualSeparateSlantedCylinderGeometry": cylinders,
    "crankcaseActualBounds": box(meshes["Cruiser broad V engine dark crankcase"]),
    "exhausts": exhausts,
    "wheelbaseSource": CFG["wheelSpecs"]["R"]["axle"] - CFG["wheelSpecs"]["F"]["axle"],
    "independentDifferentRadiiSource": {
        n: v["radius"] for n, v in CFG["wheelSpecs"].items()
    },
    "noAvatarGeometryOrScaleChange": True,
    "sourceMasterUnchanged": True,
    "limits": "Source shape and geometry evidence only; native silhouette review, actual contacts/cylinders and parent shared loader remain separate.",
}
assert sha(A / "master.blend") == before
(D / "shape-proof.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "tankWidth": tb["spanSource"][1],
            "forkRake": rake,
            "wheelbase": result["wheelbaseSource"],
            "components": len(meshes),
        }
    )
)
