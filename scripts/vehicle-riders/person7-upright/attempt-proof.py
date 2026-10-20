"""Measure the failed Explorer-profile actual GLB; never shift targets or stretch limbs."""

from pathlib import Path
import bpy, json, hashlib, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
final = "--final" in sys.argv
D = (
    R
    / "data/vehicle-riders/person7-upright"
    / ("final-explorer-attempt" if final else "explorer-profile-attempt")
)
inputs = D / ("source" if final else "inputs")
P = json.loads((inputs / "explorer-upright-v1.json").read_text())
C = json.loads((inputs / "rider.json").read_text())
recipe = json.loads((D / "public/recipe.json").read_text())
source = []
bpy.ops.wm.open_mainfile(filepath=str(D / "source/master.blend"))
for o in bpy.context.scene.objects:
    if o.type == "MESH":
        source.extend(
            (o.matrix_world @ v.co * C["worldScale"], o.name) for v in o.data.vertices
        )
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(D / "public/rider.glb"))
bpy.context.view_layer.update()
mesh = next(o for o in bpy.context.scene.objects if o.type == "MESH")
mesh.data.calc_loop_triangles()
vv = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
kd = KDTree(len(source))
for i, (v, n) in enumerate(source):
    kd.insert(v, i)
kd.balance()
components = {}
for tri in mesh.data.loop_triangles:
    ts = [vv[i] for i in tri.vertices]
    common = set.intersection(
        *[{source[i][1] for co, i, d in kd.find_range(v, 0.001)} for v in ts]
    )
    assert common
    components.setdefault(sorted(common)[0], []).append(ts)


def tree(ts):
    return BVHTree.FromPolygons(
        [p for t in ts for p in t],
        [tuple(3 * i + j for j in range(3)) for i in range(len(ts))],
        all_triangles=True,
    )


rows = []
deltas = []
for n, target in P["contacts"].items():
    actual = bpy.data.objects["Socket_" + n].matrix_world.translation.copy()
    target = Vector(target)
    error = (actual - target).length
    owner = (
        "Person7 trouser pelvis"
        if n == "hip_saddle"
        else ("Person7 gripping palm " if n.startswith("hand") else "Person7 boot ")
        + ("left" if "left" in n else "right")
    )
    near, _, _, surfaceDistance = tree(components[owner]).find_nearest(actual)
    if n.startswith("hand"):
        pv = [p for t in components[owner] for p in t]
        center = Vector(
            [(min(p[i] for p in pv) + max(p[i] for p in pv)) / 2 for i in range(3)]
        )
        centerError = (center - actual).length
        assert centerError < 1e-5
    else:
        assert surfaceDistance < 1e-5
    rows.append(
        {
            "name": n,
            "actualGLBAnchorWorld": list(actual),
            "immutableExplorerTargetWorld": list(target),
            "missWorld": error,
            "failsContactTolerance": error > 0.0001,
            "actualContactOwner": owner,
            "closestActualSurfaceWorld": list(near),
            "closestActualSurfaceDistanceWorld": surfaceDistance,
        }
    )
    deltas.append(target - actual)
assert len(rows) == 5 and all(r["failsContactTolerance"] for r in rows)
shift = sum(deltas, Vector()) / 5
residual = [
    (
        Vector(r["actualGLBAnchorWorld"])
        + shift
        - Vector(r["immutableExplorerTargetWorld"])
    ).length
    for r in rows
]
assert max(residual) > 1
assert all(
    max(
        abs(a - b)
        for a, b in zip(r["actualLengthsSource"], r["fixedBoneLengthsSource"])
    )
    < 1e-6
    for r in recipe["fixedLengthIK"]
)
report = {
    "status": "FAILED-Explorer-upright-v1-fit-no-stretch",
    "humanApproval": False,
    "actualBikePresent": False,
    "riderSha256": hashlib.sha256((D / "public/rider.glb").read_bytes()).hexdigest(),
    "immutableGlobalProfileSha256": hashlib.sha256(
        (inputs / "explorer-upright-v1.json").read_bytes()
    ).hexdigest(),
    "actualGLBContacts": rows,
    "fixedLengthIK": recipe["fixedLengthIK"],
    "fixedPerson7Anatomy": C["anatomy"],
    "sameAnatomyAsFinalProposedPerson7Profile": final,
    "boneLengthsPreserved": True,
    "bestCommonTranslationWorld": list(shift),
    "remainingErrorsAfterCommonTranslationWorld": residual,
    "rootTranslationCannotMeetAllFive": True,
    "interpretation": "With this fixed inferred upright template and joint roots, short Person7 chains cannot span Explorer targets. Actual GLB extends chains to their geometric maximum without lengthening; this failed straightened pose is not proposed as final pose. Global profile bytes unchanged. A separately named Person7 profile is proposed for this template.2D does not prove unique3D dimensions; other inferred anatomy or torso-leaning poses are not ruled out.",
    "fixtureAndAll32NativeAttemptViews": "Retained under ignored data/vehicle-riders/person7-upright/explorer-profile-attempt/ only.",
}
(D / "failed-fit.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps({"status": report["status"], "misses": [r["missWorld"] for r in rows]})
)
