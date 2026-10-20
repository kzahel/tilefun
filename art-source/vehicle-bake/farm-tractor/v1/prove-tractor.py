"""Actual narrow hood, tall enclosed cab/canopy, rounded rear crowns and fixed hitch; negative/reset."""

import argparse, hashlib, json, sys
from pathlib import Path
import bpy
from mathutils import Vector

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--input", type=Path, required=True)
p.add_argument("--output", type=Path, required=True)
a = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
before = hashlib.sha256(a.input.read_bytes()).hexdigest()
S = 80 / 4.6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
bpy.context.view_layer.update()
body = bpy.data.objects["Body_static"]


def ray(o, d):
    hit, v, n, f, obj, m = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector(o) * S, Vector(d)
    )
    assert hit and obj.name == "Body_static", (o, obj)
    return {"point": list(v / S), "normal": list(n), "triangle": f}


def probe():
    hood = ray([-1.1, 0, 2], [0, 0, -1])
    assert abs(hood["point"][2] - 1.43) < 0.001
    sides = [ray([-1.0, s * 1.3, 1.20], [0, -s, 0]) for s in [-1, 1]]
    assert all(abs(abs(v["point"][1]) - 0.43) < 0.001 for v in sides)
    cab = ray([-0.5, 0, 1.95], [1, 0, 0])
    assert abs(cab["point"][0] + 0.04) < 0.001
    roof = ray([0.5, 0, 3], [0, 0, -1])
    assert abs(roof["point"][2] - 2.62) < 0.001
    crowns = [ray([1, s * 0.83, 1.9], [0, 0, -1]) for s in [-1, 1]]
    assert all(abs(v["point"][2] - 1.60) < 0.001 for v in crowns)
    hitch = ray([2.5, 0, 0.44], [-1, 0, 0])
    assert abs(hitch["point"][0] - 1.95) < 0.001
    return {
        "narrowHoodTop": hood,
        "hoodSides": sides,
        "cabFront": cab,
        "canopyTop": roof,
        "rearCrownSurfaces": crowns,
        "fixedRearDrawbar": hitch,
    }


baseline = probe()
original = {v.index: v.co.copy() for v in body.data.vertices}
inverse = body.matrix_world.inverted()


def restore():
    for i, v in original.items():
        body.data.vertices[i].co = v
    body.data.update()
    bpy.context.view_layer.update()


def control(predicate, transform):
    count = 0
    for v in body.data.vertices:
        q = body.matrix_world @ v.co / S
        if predicate(q):
            v.co = inverse @ (transform(q) * S)
            count += 1
    body.data.update()
    bpy.context.view_layer.update()
    assert count
    fail = False
    try:
        probe()
    except AssertionError:
        fail = True
    finally:
        restore()
    assert fail and probe() == baseline
    return {"rejected": True, "baselineRestored": True, "changedVertices": count}


controls = {
    "lowCabAndCanopy": control(lambda q: q.z > 2.35, lambda q: Vector((q.x, q.y, 2.0))),
    "tooWideHood": control(
        lambda q: q.x < -0.4 and 0.8 < q.z < 1.5 and 0.3 < abs(q.y) < 0.5,
        lambda q: Vector((q.x, q.y * 1.5, q.z)),
    ),
    "displacedFixedHitch": control(
        lambda q: q.x > 1.67 and q.z < 0.55 and abs(q.y) < 0.4,
        lambda q: q + Vector((0, 1, 0)),
    ),
}
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "actualGeometry": baseline,
    "controls": controls,
    "meaning": "Real exported triangles prove long narrow hood, tall cab/canopy, rear rounded fenders and fixed drawbar. No farm-tool attachment physics, steering-pose, suspension or animated equipment claim.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(json.dumps({"status": "passed", "controls": controls}, indent=2))
