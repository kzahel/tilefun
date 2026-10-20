"""Measure actual solid over-cab pod thickness and protrusion; flatten/reset control."""

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
    "--config", type=Path, default=Path(__file__).with_name("pod-region.json")
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
    hit, p, normal, face, owner, matrix = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector(origin) * S, Vector(direction)
    )
    assert hit and owner == body, (origin, hit, owner)
    return {"source": list(p / S), "normal": list(normal), "triangle": face}


def probe():
    samples = []
    for x in c["xSamples"]:
        for y in c["ySamples"]:
            top = ray([x, y, 4], [0, 0, -1])
            bottom = ray([x, y, 2.22], [0, 0, 1])
            thickness = top["source"][2] - bottom["source"][2]
            assert thickness > c["minimumThickness"], (
                "Pod must be solid volume",
                x,
                y,
                thickness,
            )
            assert top["normal"][2] > 0.5 and bottom["normal"][2] < -0.5
            samples.append(
                {
                    "x": x,
                    "y": y,
                    "thickness": thickness,
                    "top": top,
                    "underside": bottom,
                }
            )
    pod = ray([-4.5, 0, 2.60], [1, 0, 0])
    cab = ray([-4.5, 0, 1.75], [1, 0, 0])
    protrusion = cab["source"][0] - pod["source"][0]
    assert protrusion > c["minimumFrontProtrusion"], (
        "Pod must project beyond actual cab",
        protrusion,
    )
    return {
        "samples": samples,
        "frontPod": pod,
        "frontCab": cab,
        "protrusion": protrusion,
    }


baseline = probe()
original = {v.index: v.co.copy() for v in body.data.vertices}
world_to_local = body.matrix_world.inverted()
flattened = 0
for v in body.data.vertices:
    p = body.matrix_world @ v.co
    if p.x / S < -1.70 and p.z / S > 2.19:
        p.z = 2.24 * S
        v.co = world_to_local @ p
        flattened += 1
body.data.update()
bpy.context.view_layer.update()
rejected = False
try:
    probe()
except AssertionError:
    rejected = True
finally:
    for index, point in original.items():
        body.data.vertices[index].co = point
    body.data.update()
    bpy.context.view_layer.update()
assert rejected and flattened > 0, "Flattened false pod must fail"
assert probe() == baseline, "Restored actual triangle intersections must match"
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "configuration": c,
    "actualVolume": baseline,
    "controls": {
        "flattenedPodRejected": rejected,
        "flattenedVertices": flattened,
        "baselineRestored": True,
    },
    "meaning": "Actual top/underside/front triangles prove positive solid pod thickness and a genuine over-cab projection. No painted rectangle can satisfy these rays.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "minimumThickness": min(s["thickness"] for s in baseline["samples"]),
            "frontProtrusion": baseline["protrusion"],
            "controls": r["controls"],
        },
        indent=2,
    )
)
