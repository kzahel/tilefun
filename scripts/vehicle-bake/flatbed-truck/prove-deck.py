"""Actual flat-platform triangle heights/thickness with obstruction and flatten controls.

This proves an exposed planar deck, not recessed-bed interior depth.
"""

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
    "--config", type=Path, default=Path(__file__).with_name("deck-region.json")
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
    assert hit, ("Actual platform triangle required", origin)
    return {
        "source": list(p / S),
        "normal": list(normal),
        "triangle": face,
        "owner": owner.name,
    }


def probe():
    samples = []
    for x in c["xSamples"]:
        for y in c["ySamples"]:
            top = ray([x, y, 3.0], [0, 0, -1])
            bottom = ray([x, y, 1.095], [0, 0, 1])
            assert top["owner"] == bottom["owner"] == "Body_static"
            assert abs(top["source"][2] - c["topZ"]) < c["heightTolerance"], (
                "Deck must remain flat and exposed",
                top,
            )
            assert abs(bottom["source"][2] - c["bottomZ"]) < c["heightTolerance"]
            thickness = top["source"][2] - bottom["source"][2]
            assert c["minimumThickness"] < thickness < c["maximumThickness"], (
                "Thin physical deck required",
                thickness,
            )
            assert top["normal"][2] > 0.95 and bottom["normal"][2] < -0.95
            samples.append(
                {
                    "x": x,
                    "y": y,
                    "thickness": thickness,
                    "top": top,
                    "underside": bottom,
                }
            )
    return samples


baseline = probe()
bpy.ops.mesh.primitive_cube_add(size=1, location=Vector((1.0, 0, 1.6)) * S)
obstruction = bpy.context.object
obstruction.name = "NEGATIVE_RAISED_FALSE_DECK_OBSTRUCTION"
obstruction.scale = Vector((2.8, 1.8, 0.5)) * S
bpy.context.view_layer.update()
raised_rejected = False
try:
    probe()
except AssertionError:
    raised_rejected = True
finally:
    bpy.data.objects.remove(obstruction, do_unlink=True)
    bpy.context.view_layer.update()
assert raised_rejected and probe() == baseline
original = {v.index: v.co.copy() for v in body.data.vertices}
inverse = body.matrix_world.inverted()
flattened = 0
for v in body.data.vertices:
    p = body.matrix_world @ v.co
    if -0.86 < p.x / S < 3.08 and 1.125 < p.z / S < 1.245 and abs(p.y / S) < 1.105:
        p.z = 1.24 * S
        v.co = inverse @ p
        flattened += 1
body.data.update()
bpy.context.view_layer.update()
flat_rejected = False
try:
    probe()
except AssertionError:
    flat_rejected = True
finally:
    for index, point in original.items():
        body.data.vertices[index].co = point
    body.data.update()
    bpy.context.view_layer.update()
assert flat_rejected and flattened > 0 and probe() == baseline
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "configuration": c,
    "actualFlatDeck": baseline,
    "controls": {
        "raisedObstructionRejected": raised_rejected,
        "zeroThicknessDeckRejected": flat_rejected,
        "flattenedVertices": flattened,
        "baselineRestored": True,
    },
    "meaning": "Nine actual exported top/underside ray pairs prove empty flat platform elevation and real thin edges. No recessed-bed or open-interior depth is claimed.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "samples": len(baseline),
            "minimumThickness": min(v["thickness"] for v in baseline),
            "controls": r["controls"],
        },
        indent=2,
    )
)
