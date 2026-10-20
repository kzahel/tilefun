"""Read-only actual unchanged-bike/configured rider fit, not a profile-vector refusal."""

from pathlib import Path
import json, hashlib
import bpy
from mathutils import Vector, Matrix
import numpy as np
from mathutils.kdtree import KDTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/classic-motorcycle-player-fit"
B = ROOT / "art-source/vehicle-bake/classic-motorcycle-player-fit/v1/base-inputs"
A = B / "art-source/vehicle-bake/classic-motorcycle/v1"
O = A
CFG = json.loads(Path(__file__).with_name("family.json").read_text())
S = CFG["exportWorldScale"]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rider_source = ROOT / CFG["rider"]["glbPath"]
assert sha(rider_source) == CFG["rider"]["glbSha256"]
# Retain the actual triangle/closed-volume diagnostic in this family's source.
proof = Path(__file__).with_name("prove-fit.py").read_text()
functions = proof[proof.index("def triangles(") : proof.index("\ninputs =")]
exec(
    "from collections import Counter, defaultdict\nimport math\nfrom mathutils.bvhtree import BVHTree\nfrom mathutils.geometry import intersect_ray_tri\n"
    + functions
)
bpy.ops.wm.open_mainfile(filepath=str(A / "master.blend"))
source = [
    (o.matrix_world @ v.co * S, o.name)
    for o in bpy.context.scene.objects
    if o.type == "MESH"
    and not (
        "tire" in o.name
        or "wheel rim" in o.name
        or "wheel hub" in o.name
        or "phase index" in o.name
    )
    for v in o.data.vertices
]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(O / "model.glb"))
bpy.context.view_layer.update()
bt = triangles(bpy.data.objects["Body_static"])
kd = KDTree(len(source))
for i, (p, n) in enumerate(source):
    kd.insert(p, i)
kd.balance()
owners = []
for t in bt:
    common = set.intersection(
        *[{source[i][1] for _, i, _ in kd.find_range(p, 0.001)} for p in t]
    )
    assert common
    owners.append(sorted(common)[0])
parts = {n: [t for t, o in zip(bt, owners) if o == n] for n in sorted(set(owners))}
original = {
    n: bpy.data.objects["BikeSocket_" + n].matrix_world.translation.copy()
    for n in [
        "hip_saddle",
        "hand_left_grip",
        "hand_right_grip",
        "foot_left_support",
        "foot_right_support",
    ]
}
TARGETS = original
bpy.ops.import_scene.gltf(filepath=str(rider_source))
root = bpy.data.objects[CFG["rider"]["rootName"]]
rider = bpy.data.objects[CFG["rider"]["meshName"]]
bpy.context.view_layer.update()
local = {
    n: bpy.data.objects[
        CFG["rider"]["socketPrefix"] + n
    ].matrix_world.translation.copy()
    for n in original
}
least = sum((original[n] - local[n] for n in original), Vector()) / 5
# Symmetric fixed orientation; exact least-squares translation of all five observed anchors.
assert abs(least.y) < 1e-5
saddle = tree(
    [t for name, ts in parts.items() if "central hip tangent" in name for t in ts]
)
x = max(-0.075 * S, min(0.555 * S, least.x))
hit = saddle.ray_cast(Vector((x, 0, 3 * S)), Vector((0, 0, -1)), 4 * S)[0]
assert hit is not None
hip_mount = Vector((x, 0, hit.z - local["hip_saddle"].z))
rest_world = root.matrix_world.copy()
observed_local = np.array([list(local[n]) for n in original])
observed_bike = np.array([list(original[n]) for n in original])
lc, bc = observed_local.mean(axis=0), observed_bike.mean(axis=0)
u, singular, vt = np.linalg.svd((observed_local - lc).T @ (observed_bike - bc))
rotation = vt.T @ u.T
if np.linalg.det(rotation) < 0:
    vt[-1] *= -1
    rotation = vt.T @ u.T
rigid_rotation = Matrix(rotation.tolist()).to_4x4()
rigid_mount = Vector((bc - rotation @ lc).tolist())
rows = []
for label, mount, orientation in [
    ("unconstrained-five-anchor-least-squares", least, Matrix.Identity(4)),
    ("best-five-anchor-fit-with-actual-saddle-contact", hip_mount, Matrix.Identity(4)),
    (
        "minimum-five-anchor-proper-rigid-fit-without-saddle-constraint",
        rigid_mount,
        rigid_rotation,
    ),
]:
    root.matrix_world = Matrix.Translation(mount) @ orientation @ rest_world
    bpy.context.view_layer.update()
    rt = triangles(rider)
    rbvh = tree(rt)
    contacts = []
    for name, control in original.items():
        actual = bpy.data.objects[
            CFG["rider"]["socketPrefix"] + name
        ].matrix_world.translation.copy()
        contact_parts = {
            n: ts
            for n, ts in parts.items()
            if (
                "saddle" in n.lower()
                if name == "hip_saddle"
                else (
                    "Actual palm wrapped grip "
                    + ("left" if "left" in name else "right")
                    in n
                    if name.startswith("hand")
                    else "Actual sole tangent foot peg "
                    + ("left" if "left" in name else "right")
                    in n
                )
            )
        }
        surface = tree([t for ts in contact_parts.values() for t in ts])
        near, _, _, distance = surface.find_nearest(actual)
        rider_distance = rbvh.find_nearest(control)[3]
        contacts.append(
            {
                "name": name,
                "riderAnchorWorld": list(actual),
                "unchangedBikeAnchorWorld": list(control),
                "anchorErrorWorld": (actual - control).length,
                "nearestActualRelevantBikeSurfaceWorld": list(near),
                "anchorToRelevantBikeSurfaceWorld": distance,
                "unchangedBikeAnchorToActualRiderSurfaceWorld": rider_distance,
                "actualOwners": list(contact_parts),
            }
        )
    fit = fit_assessment(parts, rt)
    rows.append(
        {
            "mountLabel": label,
            "mountSource": list(mount / S),
            "singleMountRotationEulerDegrees": [
                math.degrees(v) for v in orientation.to_euler()
            ],
            "contacts": contacts,
            "actualGeometryFit": fit,
            "fiveAnchorSquaredErrorWorld": sum(
                c["anchorErrorWorld"] ** 2 for c in contacts
            ),
        }
    )
    assert any(c["anchorErrorWorld"] > 1 for c in contacts)
selected = rows[1]
receipt = {
    "status": "unchanged-classic-controls-fail-configured-rider-fit",
    "immutableFinalBaseSha256": sha(O / "model.glb"),
    "immutableRiderSha256": sha(rider_source),
    "profile": "unchanged configured measured profile",
    "selectedUsableMountTranslationOnly": True,
    "properRigidLeastSquaresControlAlsoTested": True,
    "bodyAndLimbsUnchanged": True,
    "scaleUnchanged": True,
    "actualBikeAndRiderTrianglesTested": True,
    "mountSearch": "Analytic minimum all-five-anchor translation at common upright orientation; actual-saddle-contact constrained version; and exact proper-rigid Kabsch minimum allowing orientation. All three actual mounted GLB geometries assessed for surface/volume fit. Saddle-contact upright mount is retained for visual controls; unconstrained proper-rigid control also fails physical contacts/intersections.",
    "attempts": rows,
    "selectedAttempt": selected["mountLabel"],
    "selectedMountSource": selected["mountSource"],
    "limits": "Confirmed final immutable base; actual unchanged geometry and rider tested.",
}
(D / "unchanged-controls-fit.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": receipt["status"],
            "mount": receipt["selectedMountSource"],
            "errors": [round(c["anchorErrorWorld"], 4) for c in selected["contacts"]],
            "intersectionOwners": [
                r["bikeComponent"]
                for r in selected["actualGeometryFit"]["inappropriateIntersections"]
            ],
            "containmentOwners": [
                r["bikeComponent"]
                for r in selected["actualGeometryFit"]["inappropriateContainments"]
            ],
        }
    ),
    flush=True,
)
