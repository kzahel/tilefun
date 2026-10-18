"""Independently inspect the saved lion, not the builder's claimed results.

Run Blender --background animal.blend --python-exit-code 1 --python audit.py.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

SCRIPT_SOURCE = Path(__file__).resolve().parent
ROOT = SCRIPT_SOURCE.parents[3]
scratch = "--workspace" in sys.argv
WORK = ROOT / sys.argv[sys.argv.index("--workspace")+1] if scratch else ROOT / "data/predators-132/lion"
SOURCE = WORK / "source" if scratch else SCRIPT_SOURCE
OUT = WORK / "public" if scratch else ROOT / "public/demos/wildlife-v2/lion/hunt-v1"
guide = json.loads((WORK / "projected-guides.json").read_text())
assert hashlib.sha256((SOURCE / "animal.blend").read_bytes()).hexdigest() == guide["blendSha256"]
scene = bpy.context.scene
root, body, head = [bpy.data.objects[n] for n in ["ROOT-ground-anchor", "BODY-weight-transfer", "HEAD-follow"]]
assert scene.camera.data.type == "ORTHO"
assert abs(scene.camera.data.ortho_scale-9.6) < 1e-5
links = contacts = travel = 0
error = 0
for name, expected in guide["meshLocalGeometrySha256"].items():
    obj = bpy.data.objects[name]
    assert tuple(obj.scale) == (1, 1, 1)
    assert hashlib.sha256(json.dumps([list(v.co) for v in obj.data.vertices]).encode()).hexdigest() == expected
    assert hashlib.sha256(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode()).hexdigest() == guide["meshTopologySha256"][name]


def project(point):
    p = world_to_camera_view(scene, scene.camera, point)
    return [p.x*96, (1-p.y)*96, p.z]


for record in guide["records"]:
    root.rotation_euler.z = math.radians(guide["cameraContract"]["modelYawDegrees"][record["facing"]])
    scene.frame_set(record["frame"])
    bpy.context.view_layer.update()
    assert tuple(root.location) == (0, 0, 0)
    if record["clip"] == "walk":
        assert abs(head.rotation_euler.x+body.rotation_euler.x) < 1e-6
    for name, points in record["limbsWorld"].items():
        for j, length in enumerate(record["limbLengths"][name]):
            a, b = Vector(points[j]), Vector(points[j+1])
            assert abs((b-a).length-length) < 1e-6
            obj = bpy.data.objects[f"{name}-{j}"]
            for local, target in [(Vector((0, 0, -length/2)), a), (Vector((0, 0, length/2)), b)]:
                assert (obj.matrix_world @ local - root.matrix_world @ target).length < 3e-6
            links += 1
        paw = bpy.data.objects[f"{name}-paw"]
        contact = record["contacts"][name]
        actual = paw.matrix_world @ Vector((0, 0, -.11))
        assert (actual-root.matrix_world @ Vector(contact["world"])).length < 3e-6
        if contact["planted"]:
            assert abs(actual.z) < 1e-6
            contacts += 1
            if record["clip"] == "walk":
                expected = guide["hips"][name][1]+guide["rootTravelUnitsPerCycle"]*.375
                assert abs(contact["world"][1]+guide["rootTravelUnitsPerCycle"]*contact["phase"]-expected) < 1e-6
                travel += 1
        else:
            assert actual.z > .001
    for name, volume in record["volumes"].items():
        obj = bpy.data.objects[name]
        assert tuple(obj.scale) == (1, 1, 1)
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        assert min(p.z for p in points) >= -1e-6, (name, record["clip"], record["index"])
        pp = [project(p) for p in points]
        bounds = [min(p[0] for p in pp), min(p[1] for p in pp), max(p[0] for p in pp), max(p[1] for p in pp)]
        error = max(error, max(abs(a-b) for a, b in zip(bounds, volume["bbox"])))
        assert error < 1e-5
    for name, obj in [("head", head), ("body", body), ("shoulder", bpy.data.objects["shoulder"]), ("pelvis", bpy.data.objects["pelvis"])]:
        assert max(abs(a-b) for a, b in zip(project(obj.matrix_world.translation), record[name])) < 1e-5

motion = {}
for facing in guide["cameraContract"]["modelYawDegrees"]:
    records = [r for r in guide["records"] if r["facing"] == facing and r["clip"] == "walk"]
    motion[facing] = {}
    for name in ["body", "head", "shoulder", "pelvis"]:
        values = [r[name][1] for r in records]
        motion[facing][name] = round(max(values)-min(values), 5)
        assert motion[facing][name] > .85
        assert max(round(v) for v in values)-min(round(v) for v in values) >= 1
    transfer = [r["shoulder"][1]-r["pelvis"][1] for r in records]
    assert max(transfer)-min(transfer) > .3
report = {"identity": "lion-hunt-v1", "poses": len(guide["records"]),
          "fixedLengthLinkChecks": links, "plantedGroundContacts": contacts,
          "stanceTravelCompensationChecks": travel, "maxProjectionError": error,
          "nativeProjectedMotionRangePx": motion,
          "status": "Saved-source integrity passes; visual observations and human approval separate."}
(OUT / "source-audit.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
print(json.dumps(report))
