"""Actual low fixed boom/pod/caps geometry and raised-boom/extended-cap reset controls."""

import argparse
import hashlib
import json
from pathlib import Path
import sys
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--input", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument(
    "--config", type=Path, default=Path(__file__).with_name("stow-region.json")
)
a = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
c = json.loads(a.config.read_text())
before = hashlib.sha256(a.input.read_bytes()).hexdigest()
S = 80 / 4.6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
bpy.context.view_layer.update()
body = bpy.data.objects["Body_static"]


def ray(origin, direction):
    hit, p, n, face, owner, matrix = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector(origin) * S, Vector(direction)
    )
    assert hit and owner == body, (
        "Actual fixed equipment triangle required",
        origin,
        hit,
        owner,
    )
    return {
        "source": list(p / S),
        "normal": list(n),
        "triangle": face,
        "owner": owner.name,
    }


def probe():
    points = [
        o.matrix_world @ v.co / S
        for o in bpy.context.scene.objects
        if o.type == "MESH"
        for v in o.data.vertices
    ]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    assert (
        hi[2] <= c["maximumHeight"]
        and max(abs(lo[1]), abs(hi[1])) <= c["maximumAbsWidth"]
        and hi[0] - lo[0] <= c["maximumSpanLength"]
    ), ("Equipment must remain low and stowed", lo, hi)
    sections = []
    for s in c["boomSamples"]:
        top = ray([s["x"], 0.35, 4], [0, 0, -1])
        assert abs(top["source"][2] - s["topZ"]) < 0.015 and top["normal"][2] > 0.95
        left = ray([s["x"], -2.5, s["probeZ"]], [0, 1, 0])
        right = ray([s["x"], 2.5, s["probeZ"]], [0, -1, 0])
        width = right["source"][1] - left["source"][1]
        assert abs(width - s["width"]) < 0.015, (
            "Actual nested section width",
            s,
            width,
        )
        sections.append(
            {"x": s["x"], "top": top, "left": left, "right": right, "width": width}
        )
    assert sections[0]["width"] > sections[1]["width"] > sections[2]["width"]
    pod = []
    for x, y, z in c["podRoof"]:
        h = ray([x, y, 4], [0, 0, -1])
        assert abs(h["source"][2] - z) < 0.015
        pod.append(h)
    caps = []
    for x in c["outriggerXs"]:
        for side in [-1, 1]:
            h = ray([x, side * 2.5, 0.94], [0, -side, 0])
            assert abs(h["source"][1] - side * c["outriggerOuterY"]) < 0.015
            caps.append({"x": x, "side": side, **h})
    hook = ray([-3.68, -2.5, 2.18], [0, 1, 0])
    assert abs(hook["source"][1] - 0.35) < 0.06
    cable = ray([-3.613, -2.5, 2.46], [0, 1, 0])
    assert abs(cable["source"][1] - 0.35) < 0.03
    return {
        "boundsSource": {"min": lo, "max": hi},
        "threeSteppedSections": sections,
        "offsetOperatorPod": pod,
        "fourStowedCaps": caps,
        "actualGrayHook": hook,
        "actualFixedCable": cable,
    }


baseline = probe()
original = {v.index: v.co.copy() for v in body.data.vertices}
inverse = body.matrix_world.inverted()
raised = 0
for v in body.data.vertices:
    p = body.matrix_world @ v.co
    if -3.5 < p.x / S < -1.5 and 0.10 < p.y / S < 0.60 and p.z / S > 2.35:
        p.z += S
        v.co = inverse @ p
        raised += 1
body.data.update()
bpy.context.view_layer.update()
rejected = False
try:
    probe()
except AssertionError:
    rejected = True
finally:
    for i, p in original.items():
        body.data.vertices[i].co = p
    body.data.update()
    bpy.context.view_layer.update()
assert rejected and raised > 0 and probe() == baseline
bpy.ops.mesh.primitive_cube_add(size=1, location=Vector((3.28, 1.95, 0.94)) * S)
o = bpy.context.object
o.name = "NEGATIVE_FALSE_EXTENDED_OUTRIGGER_CAP"
o.scale = Vector((0.38, 0.50, 0.28)) * S
bpy.context.view_layer.update()
extended_rejected = False
try:
    probe()
except AssertionError:
    extended_rejected = True
finally:
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
assert extended_rejected and probe() == baseline
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "configuration": c,
    "actualStowedEquipment": baseline,
    "controls": {
        "raisedActualBoomRejected": rejected,
        "raisedVertices": raised,
        "extendedCapRejected": extended_rejected,
        "baselineRestored": True,
    },
    "meaning": "Actual exported low nested section widths/heights, offset closed pod, four short cap ends and real fixed hook/cable. Fixed/stowed visual state only; no working crane animation or gameplay qualified.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "sections": len(baseline["threeSteppedSections"]),
            "caps": len(baseline["fourStowedCaps"]),
            "boundsSource": baseline["boundsSource"],
            "controls": r["controls"],
        },
        indent=2,
    )
)
