"""Actual exported scoop wall, V interior and four fixed links; physical negative/reset controls."""

import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--input", type=Path, required=True)
p.add_argument("--output", type=Path, required=True)
p.add_argument(
    "--config", type=Path, default=Path(__file__).with_name("equipment-region.json")
)
a = p.parse_args(sys.argv[sys.argv.index("--") + 1 :])
c = json.loads(a.config.read_text())
S = 80 / 4.6
before = hashlib.sha256(a.input.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(a.input.resolve()))
bpy.context.view_layer.update()
body = bpy.data.objects["Body_static"]


def ray(o, d):
    hit, v, n, f, obj, m = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(), Vector(o) * S, Vector(d)
    )
    assert hit and obj.name == "Body_static", (
        "Missing fixed equipment triangle",
        o,
        hit,
        obj,
    )
    return {"point": list(v / S), "normal": list(n), "triangle": f}


def blade():
    points = [body.matrix_world @ v.co / S for v in body.data.vertices]
    bladepts = [v for v in points if v.x < -3.18 and abs(v.y) > 1.40]
    ground = min(v.z for v in bladepts)
    assert 0.12 < ground < 0.18, ground
    samples = []
    for y in [-1, 0, 1]:
        for z in [0.36, 0.60, 0.82, 1.05]:
            front = ray([-4.4, y, z], [1, 0, 0])
            back = ray([-3.20 if z < 0.54 else -3.08, y, z], [-1, 0, 0])
            thickness = back["point"][0] - front["point"][0]
            assert 0.085 < thickness < 0.095, (
                "Physical wall required",
                y,
                z,
                thickness,
            )
            samples.append(
                {"y": y, "z": z, "front": front, "back": back, "thickness": thickness}
            )
    low = ray([-4.4, 0, 0.16], [1, 0, 0])
    mid = ray([-4.4, 0, 0.72], [1, 0, 0])
    high = ray([-4.4, 0, 1.16], [1, 0, 0])
    bow = mid["point"][0] - (low["point"][0] + high["point"][0]) / 2
    assert bow > 0.23, ("Curved scoop must not become flat", bow)
    return {"groundClearance": ground, "wallPairs": samples, "scoopBow": bow}


def hopper():
    samples = [ray([1.70, y, 3], [0, 0, -1]) for y in [-0.70, 0, 0.70]]
    assert abs(samples[1]["point"][2] - 1.34) < 0.001, samples
    assert all(s["point"][2] > 2.05 for s in [samples[0], samples[2]]), samples
    assert all(s["point"][2] < 2.20 for s in samples), samples
    bars = [ray([x, 0, 3], [0, 0, -1]) for x in c["topBars"]]
    assert all(abs(s["point"][2] - 2.65) < 0.001 for s in bars), bars
    return {
        "vInterior": samples,
        "topBars": bars,
        "depthBelowBars": 2.65 - samples[1]["point"][2],
    }


def mounts():
    samples = []
    for y in c["mountYs"]:
        for upper in [False, True]:
            z = 1.4 if upper else 0.15
            d = [0, 0, -1 if upper else 1]
            hit = ray([-3.23, y, z], d)
            assert abs(hit["point"][2] - (0.962 if upper else 0.420)) < 0.025, hit
            samples.append({"y": y, "upper": upper, "hit": hit})
    return samples


baseline = {"blade": blade(), "hopper": hopper(), "fourMounts": mounts()}
original = {v.index: v.co.copy() for v in body.data.vertices}
inverse = body.matrix_world.inverted()


def restore():
    for i, v in original.items():
        body.data.vertices[i].co = v
    body.data.update()
    bpy.context.view_layer.update()


def mutate(predicate, transform):
    count = 0
    for v in body.data.vertices:
        q = body.matrix_world @ v.co / S
        if predicate(q):
            v.co = inverse @ (transform(q) * S)
            count += 1
    body.data.update()
    bpy.context.view_layer.update()
    assert count > 0
    return count


def rejected(probe):
    failed = False
    try:
        probe()
    except AssertionError:
        failed = True
    finally:
        restore()
    assert (
        failed
        and {"blade": blade(), "hopper": hopper(), "fourMounts": mounts()} == baseline
    )
    return True


controls = {}
mutate(
    lambda q: q.x < -3.18 and abs(q.y) > 1.40,
    lambda q: Vector((-3.5 + 0.055 * q.y, q.y, q.z)),
)
controls["flattenedScoopRejected"] = rejected(blade)
mutate(lambda q: q.x < -3.18 and abs(q.y) > 1.40, lambda q: q - Vector((0, 0, 0.2)))
controls["groundClippingBladeRejected"] = rejected(blade)
mutate(
    lambda q: -0.71 < q.x < 2.96 and abs(q.y) < 0.98 and q.z > 1.33,
    lambda q: Vector((q.x, q.y, 2.6)),
)
controls["flattenedVInteriorRejected"] = rejected(hopper)
# Remove only one mount cross-section from its actual ray, retaining other equipment.
mutate(
    lambda q: -3.35 < q.x < -3.07 and -0.57 < q.y < -0.43 and 0.83 < q.z < 0.98,
    lambda q: q + Vector((0, 0.4, 0)),
)
controls["displacedMountRejected"] = rejected(mounts)
controls["baselineRestored"] = True
assert hashlib.sha256(a.input.read_bytes()).hexdigest() == before
r = {
    "status": "passed",
    "glbSha256": before,
    "inputBytesUnchanged": True,
    "configuration": c,
    "actualEquipment": baseline,
    "controls": controls,
    "meaning": "Physical triangles at unchanged origin prove a solid curved wall and ground clearance, deep open V interior with three spanning top bars, and all four fixed mounting links. Rigid/stowed only; no operational animation claim.",
}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(r, indent=2) + "\n")
print(
    json.dumps(
        {"status": "passed", "controls": controls, "bladePairs": 12, "mounts": 4},
        indent=2,
    )
)
