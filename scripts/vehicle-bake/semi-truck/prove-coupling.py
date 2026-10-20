"""Actual open rigid tractor/trailer coupling gap and low plate/frame; filled-gap control.

This measures fixed geometry only. No articulation, hitch or separate physics.
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
    "--config", type=Path, default=Path(__file__).with_name("coupling-region.json")
)
a = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
c = json.loads(a.config.read_text())
before = hashlib.sha256(a.input.read_bytes()).hexdigest()
S = 80 / 4.6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
bpy.context.view_layer.update()


def cast(origin, direction, distance=20):
    hit, p, n, face, owner, matrix = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(),
        Vector(origin) * S,
        Vector(direction),
        distance=distance * S,
    )
    return {
        "hit": hit,
        "source": list(p / S),
        "normal": list(n),
        "triangle": face,
        "owner": owner.name if owner else None,
    }


def probe():
    empty = []
    for x in c["xGapSamples"]:
        for z in c["zGapSamples"]:
            r = cast([x, -2.0, z], [0, 1, 0], 4.0)
            assert not r["hit"], (
                "Gap must be actual empty space, not a dark sticker",
                x,
                z,
                r,
            )
            empty.append({"x": x, "z": z, "clearSourceDistance": 4.0})
    rear = cast([c["gapProbeX"], 0, c["gapProbeZ"]], [-1, 0, 0])
    front = cast([c["gapProbeX"], 0, c["gapProbeZ"]], [1, 0, 0])
    assert (
        rear["hit"]
        and front["hit"]
        and rear["owner"] == front["owner"] == "Body_static"
    )
    gap = front["source"][0] - rear["source"][0]
    assert c["minimumGap"] < gap < c["maximumGap"]
    plates = []
    for x in c["plateSamples"]:
        r = cast([x, 0, 1.8], [0, 0, -1])
        assert r["hit"] and r["owner"] == "Body_static"
        assert abs(r["source"][2] - c["plateTopZ"]) < 0.015 and r["normal"][2] > 0.95
        plates.append({"x": x, **r})
    frame = cast([c["frameProbeX"], -2, 0.79], [0, 1, 0], 4.0)
    assert (
        frame["hit"]
        and frame["owner"] == "Body_static"
        and abs(frame["source"][1] + 0.635) < 0.025
    ), frame
    saddle = cast([-1.30, 0, 0.5], [0, 0, 1])
    assert (
        saddle["hit"]
        and saddle["owner"] == "Body_static"
        and abs(saddle["source"][2] - 0.88) < 0.015
    )
    return {
        "emptySideRays": empty,
        "cabRearTriangle": rear,
        "trailerFrontTriangle": front,
        "actualGap": gap,
        "lowCouplingPlate": plates,
        "realFrameBridge": frame,
        "realSaddleUnderside": saddle,
    }


baseline = probe()
bpy.ops.mesh.primitive_cube_add(size=1, location=Vector((-1.40, 0, 2.0)) * S)
o = bpy.context.object
o.name = "NEGATIVE_FALSE_DARK_SOLID_COUPLING_GAP"
o.scale = Vector((0.70, 2.4, 1.4)) * S
bpy.context.view_layer.update()
rejected = False
try:
    probe()
except AssertionError:
    rejected = True
finally:
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()
assert rejected and probe() == baseline
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "configuration": c,
    "actualCoupling": baseline,
    "controls": {"filledGapRejected": rejected, "baselineRestored": True},
    "meaning": "Actual six clear side rays, cab/trailer end hits, exposed low plate and frame bridge; one fixed visual combination only.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "actualGap": baseline["actualGap"],
            "sideRays": len(baseline["emptySideRays"]),
            "plateSamples": len(baseline["lowCouplingPlate"]),
            "controls": r["controls"],
        },
        indent=2,
    )
)
