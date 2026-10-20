"""Run unchanged four-wheel clearance, then add four own collision/reset controls."""

from pathlib import Path
import hashlib
import json
import math
import runpy
import sys

import bpy
from mathutils import Vector

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/forklift"
model = ROOT / "public/demos/vehicle-bake/forklift/v1/model.glb"
before = hashlib.sha256(model.read_bytes()).hexdigest()
saved = sys.argv[:]
sys.argv = [
    str(ROOT / "scripts/vehicle-bake/clearance.py"),
    "--",
    str(ROOT / "art-source/vehicle-bake/forklift/v1/evidence/clearance-input.json"),
    str(D / "clearance-final.json"),
]
helper = runpy.run_path(sys.argv[0], run_name="forklift_shared_clearance")
sys.argv = saved
assert helper["reports"][0]["status"] == "passed"
rolls = [o for o in bpy.context.scene.objects if "wheel_radius" in o]
assert {o.name for o in rolls} == {f"Wheel_{w}_Roll" for w in ["FL", "FR", "RL", "RR"]}
moving = {o for r in rolls for o in r.children_recursive if o.type == "MESH"}
fixed = []
for ob in bpy.context.scene.objects:
    if ob.type != "MESH" or ob in moving:
        continue
    ob.data.calc_loop_triangles()
    vv = [ob.matrix_world @ v.co for v in ob.data.vertices]
    fixed += [[vv[i] for i in f.vertices] for f in ob.data.loop_triangles]
controls = []
for roll in rolls:
    vv = [
        o.matrix_world @ v.co
        for o in roll.children_recursive
        if o.type == "MESH"
        for v in o.data.vertices
    ]
    center = roll.matrix_world.translation.copy()
    low, high = min(p.y for p in vv), max(p.y for p in vv)
    radius = max(math.hypot(p.x - center.x, p.z - center.z) for p in vv)

    def gap(triangles):
        result = math.inf
        for tri in triangles:
            poly = helper["clip"](helper["clip"](tri, 1, low, 1), 1, high, -1)
            if poly:
                result = min(
                    result, helper["radial_distance"](poly, center, [0, 2]) - radius
                )
        return result

    baseline = gap(fixed)
    assert baseline > 1e-5
    tri = max(fixed, key=lambda t: (t[1] - t[0]).cross(t[2] - t[0]).length)
    delta = center - sum(tri, Vector()) / 3
    controlled = gap(fixed + [[p + delta for p in tri]])
    assert controlled <= 1e-5
    assert gap(fixed) == baseline
    controls.append(
        {
            "wheel": roll.name,
            "allFixedTriangles": len(fixed),
            "minimumBaselineGapWorld": baseline,
            "negativeFixtureAddedTriangles": 1,
            "controlledGapWorld": controlled,
            "collisionRejected": True,
            "baselineRestoredExact": True,
            "noCandidateTrianglesRemoved": True,
        }
    )
assert hashlib.sha256(model.read_bytes()).hexdigest() == before
out = {
    "status": "passed",
    "glbSha256": before,
    "standardFourWheelToolchain": True,
    "perWheelCollisionControls": controls,
    "allFourNegativeResetPassed": True,
    "inputBytesUnchanged": True,
}
(D / "clearance-controls.json").write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out, indent=2))
