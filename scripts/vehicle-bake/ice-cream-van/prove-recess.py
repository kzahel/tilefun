"""Actual exported side-recess depth/counter rays with independent false-panel and solid-deck negative controls."""

from pathlib import Path
import argparse, hashlib, json, sys
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--input", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument(
    "--config", type=Path, default=Path(__file__).with_name("serving-region.json")
)
a = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
c = json.loads(a.config.read_text())
before = hashlib.sha256(a.input.read_bytes()).hexdigest()
S = 80 / 4.6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
bpy.context.view_layer.update()


def ray(origin, direction):
    hit, point, normal, face, owner, matrix = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector(origin) * S, Vector(direction)
    )
    assert hit, "No actual triangle hit"
    return {
        "pointSource": list(point / S),
        "normal": list(normal),
        "owner": owner.name,
        "triangle": face,
    }


def backwall():
    out = []
    for x in c["xSamples"]:
        for z in c["zSamples"]:
            r = ray([x, -2, z], [0, 1, 0])
            depth = r["pointSource"][1] - c["outerY"]
            assert c["minimumDepth"] < depth < c["maximumDepth"], (
                "Side opening is not physically recessed",
                x,
                z,
                depth,
                r,
            )
            assert abs(r["pointSource"][1] - c["backY"]) < 0.01
            out.append({"x": x, "z": z, "depth": depth, **r})
    return out


def counters():
    out = []
    for x in c["counterX"]:
        for y in c["counterY"]:
            r = ray([x, y, 1.95], [0, 0, -1])
            assert abs(r["pointSource"][2] - c["counterTopZ"]) < c["depthTolerance"], (
                "False raised deck obscures real counter",
                r,
            )
            out.append({"x": x, "y": y, **r})
    return out


def negative(name, loc, scale, probe):
    bpy.ops.mesh.primitive_cube_add(size=1, location=Vector(loc) * S)
    o = bpy.context.object
    o.name = name
    o.scale = Vector(scale) * S
    bpy.context.view_layer.update()
    rejected = False
    try:
        probe()
    except AssertionError:
        rejected = True
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
    assert rejected, "Negative geometry unexpectedly passed: " + name
    return {"name": name, "rejected": rejected, "restored": True}


baseline = backwall()
floor = counters()
panel = negative(
    "NEGATIVE_false_closed_serving_sticker_panel",
    (0.725, -1.04, 1.58),
    (2.25, 0.025, 0.85),
    backwall,
)
assert backwall() == baseline
solid = negative(
    "NEGATIVE_false_solid_raised_counter_deck",
    (0.725, -0.76, 1.60),
    (2.25, 0.49, 0.10),
    counters,
)
assert counters() == floor and backwall() == baseline
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "configuration": c,
    "actualBackwallRays": baseline,
    "actualCounterRays": floor,
    "controls": {
        "falseClosedPanel": panel,
        "falseRaisedDeck": solid,
        "baselineRestored": True,
    },
    "meaning": "Actual exported triangles prove finite side depth and low counter; no pose, label or metadata readback substitutes for geometry.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "backRays": len(baseline),
            "counterRays": len(floor),
            "controls": r["controls"],
        },
        indent=2,
    )
)
