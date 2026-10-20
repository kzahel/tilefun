"""Read-only measurement of immutable Explorer upright GLB and contact profile."""

from pathlib import Path
import json, hashlib, bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-bake/dirt-motorcycle"
D.mkdir(parents=True, exist_ok=True)
A = R / "art-source/vehicle-riders/explorer-upright/v1"
profile = R / "art-source/vehicle-riders/profiles/upright-v1.json"
inputs = [profile, *[A / n for n in ["rider.glb", "recipe.json", "report.json"]]]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
pins = {p.relative_to(R).as_posix(): sha(p) for p in inputs}
P = json.loads(profile.read_text())
family_path = Path(__file__).with_name("family.json")
mount = json.loads(family_path.read_text())["riderMountSource"]
scale = 80 / 4.6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(A / "rider.glb"))
bpy.context.view_layer.update()
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assert len(meshes) == 1
ob = meshes[0]
pp = [ob.matrix_world @ v.co for v in ob.data.vertices]
ob.data.calc_loop_triangles()
tree = BVHTree.FromPolygons(
    pp, [tuple(t.vertices) for t in ob.data.loop_triangles], all_triangles=True
)
contacts = []
for name, target in P["contacts"].items():
    socket = bpy.data.objects["Socket_" + name]
    p = socket.matrix_world.translation.copy()
    assert (p - Vector(target)).length < 1e-5
    near, normal, i, d = tree.find_nearest(p)
    contacts.append(
        {
            "name": name,
            "actualSocketLocalWorld": list(p),
            "actualSocketLocalSource": [c / scale for c in p],
            "closestActualRiderSurfaceWorld": list(near),
            "distanceToActualRiderSurfaceWorld": d,
        }
    )
low = [min(p[i] for p in pp) / scale for i in range(3)]
high = [max(p[i] for p in pp) / scale for i in range(3)]
legs = [p for p in pp if p.z / scale < -0.10]
gap = min(abs(p.y) / scale for p in legs)
result = {
    "status": "measured-read-only",
    "inputHashes": pins,
    "worldScale": scale,
    "riderTriangleCount": len(ob.data.loop_triangles),
    "localSourceMin": low,
    "localSourceMax": high,
    "localSourceSpan": [high[i] - low[i] for i in range(3)],
    "actualContactSockets": contacts,
    "minimumLegInnerHalfGapBelowHipPoint10Source": gap,
    "familyInput": {
        "path": family_path.relative_to(R).as_posix(),
        "sha256": sha(family_path),
    },
    "candidateSingleMountSource": mount,
    "candidateHipBottomSeatTopSource": mount[2]
    + P["contacts"]["hip_saddle"][2] / scale,
    "candidateCrownZSource": mount[2] + high[2],
    "limits": "Anatomy measurement only; actual bike/rider clearances and contacts remain to prove.",
}
assert {p.relative_to(R).as_posix(): sha(p) for p in inputs} == pins
(D / "rider-measurements.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
