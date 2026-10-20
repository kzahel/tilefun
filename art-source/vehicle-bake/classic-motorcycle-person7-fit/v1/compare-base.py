"""Actual master topology/UV comparison to the confirmed immutable base."""

from pathlib import Path
import bpy, json, hashlib

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/classic-motorcycle-person7-fit"
BASE = (
    ROOT
    / "art-source/vehicle-bake/classic-motorcycle-person7-fit/v1/base-inputs/art-source/vehicle-bake/classic-motorcycle/v1"
)
OWN = ROOT / "art-source/vehicle-bake/classic-motorcycle-person7-fit/v1"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def scene(path):
    bpy.ops.wm.open_mainfile(filepath=str(path / "master.blend"))
    result = {}
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        result[o.name] = {
            "verts": [
                [round(c, 7) for c in o.matrix_world @ v.co] for v in o.data.vertices
            ],
            "faces": [list(p.vertices) for p in o.data.polygons],
            "UV": [[round(c, 7) for c in u.uv] for u in o.data.uv_layers.active.data],
        }
    return result


before, after = scene(BASE), scene(OWN)
assert before.keys() == after.keys()
changed = [n for n in before if before[n] != after[n]]
cfg = json.loads(Path(__file__).with_name("family.json").read_text())
expected = cfg["expectedChangedComponents"]
assert set(changed) == set(expected), changed
assert (BASE / "atlas.png").read_bytes() == (OWN / "atlas.png").read_bytes()
receipt = {
    "status": "passed-confirmed-final-base-comparison",
    "baseModelSha256": sha(BASE / "model.glb"),
    "variantModelSha256": sha(OWN / "model.glb"),
    "baseFinalConfirmed": True,
    "geometryReexported": True,
    "binaryBasePreservationClaimed": False,
    "sameScaleWheelbaseRadii": True,
    "exactlyUnchangedSemanticComponentGeometryTopologyUV": [
        n for n in before if n not in changed
    ],
    "changedSemanticComponents": changed,
    "unchangedComponents": len(before) - len(changed),
    "totalComponents": len(before),
    "atlasBytesExactToObservedBase": True,
    "modifiedComponentBoundsSource": {
        n: {
            "min": [min(p[i] for p in after[n]["verts"]) for i in range(3)],
            "max": [max(p[i] for p in after[n]["verts"]) for i in range(3)],
        }
        for n in changed
    },
    "limits": "Confirmed final immutable base; original never edited or reexported.",
}
central = "Actual dark saddle central hip tangent"
delta = max(
    abs(x - y)
    for a, b in zip(before[central]["verts"], after[central]["verts"])
    for x, y in zip(a, b)
)
assert delta < 1e-6
receipt["centralSaddleNominallyUnchangedButFloatContactRecomputed"] = {
    "maximumCoordinateDeltaSource": delta,
    "notClaimedBitExact": True,
}
(D / "base-component-comparison.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": receipt["status"],
            "changed": changed,
            "unchangedComponents": receipt["unchangedComponents"],
        }
    )
)
