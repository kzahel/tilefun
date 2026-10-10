"""Independent fresh-process audit of saved pet scenes and evaluated poses."""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[3]
pet_id = sys.argv[sys.argv.index("--") + 1]
source = ROOT / f"art-source/wildlife-v2/{pet_id}/draft-v1"
output = ROOT / f"public/demos/wildlife-v2/{pet_id}/draft-v1"
guides = json.loads((source / "projected-guides.json").read_text())
scene = bpy.context.scene
root = bpy.data.objects["ROOT-ground-anchor"]
body = bpy.data.objects["BODY-weight-transfer"]
head = bpy.data.objects["HEAD-follow"]
size = guides["canvas"][0]
sole = .055 if pet_id.startswith("cat") else .07
stride = guides["rootTravelUnitsPerCycle"]
contacts = links = travel_checks = 0
projection_error = 0
for name, expected in guides["meshLocalGeometrySha256"].items():
    obj = bpy.data.objects[name]
    assert tuple(obj.scale) == (1, 1, 1)
    assert hashlib.sha256(json.dumps([list(v.co) for v in obj.data.vertices]).encode()).hexdigest() == expected
    assert hashlib.sha256(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode()).hexdigest() == guides["meshTopologySha256"][name]


def project(point):
    q = world_to_camera_view(scene, scene.camera, point)
    return [q.x * size, (1-q.y) * size, q.z]


for record in guides["records"]:
    root.rotation_euler.z = math.radians(guides["cameraContract"]["modelYawDegrees"][record["facing"]])
    scene.frame_set(record["frame"])
    bpy.context.view_layer.update()
    # Stabilized skull follows translation without shrinking or turning.
    assert abs(head.rotation_euler.x + body.rotation_euler.x) < 1e-6
    for name, points in record["limbsWorld"].items():
        for index, length in enumerate(record["limbLengths"][name]):
            a, b = Vector(points[index]), Vector(points[index+1])
            assert abs((b-a).length-length) < 1e-6
            obj = bpy.data.objects[f"{name}-{index}"]
            assert (obj.matrix_world @ Vector((0, 0, length/2)) - root.matrix_world @ b).length < 3e-6
            links += 1
        paw = bpy.data.objects[f"{name}-paw"]
        contact = record["contacts"][name]
        actual = paw.matrix_world @ Vector((0, 0, -sole))
        assert (actual - root.matrix_world @ Vector(contact["world"])).length < 3e-6
        assert min((paw.matrix_world @ v.co).z for v in paw.data.vertices) >= -1e-6
        if contact["planted"]:
            assert abs(actual.z) < 1e-6
            contacts += 1
            if record["clip"] == "walk":
                # Authored stance target cancels matching linear preview travel.
                baseline = -.35 if name[0] == "H" else .40
                if pet_id.startswith("dog"):
                    baseline = -.46 if name[0] == "H" else .46
                assert abs(contact["world"][1] + stride*contact["phase"] - (baseline + stride*.375)) < 1e-6
                travel_checks += 1
        else:
            assert actual.z > 0
    for name, volume in record["volumes"].items():
        obj = bpy.data.objects[name]
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        assert min(p.z for p in points) >= -1e-6, (name, record["clip"], record["index"])
        projected = [project(p) for p in points]
        bounds = [min(p[0] for p in projected), min(p[1] for p in projected), max(p[0] for p in projected), max(p[1] for p in projected)]
        projection_error = max(projection_error, max(abs(a-b) for a, b in zip(bounds, volume["bbox"])))
        assert projection_error < 1e-5
    for landmark, obj in [("body", body), ("head", head), ("shoulder", bpy.data.objects["shoulder"]), ("pelvis", bpy.data.objects["pelvis"])]:
        assert max(abs(a-b) for a, b in zip(project(obj.matrix_world.translation), record[landmark])) < 1e-5

motion = {}
for facing in guides["cameraContract"]["modelYawDegrees"]:
    walk = [r for r in guides["records"] if r["facing"] == facing and r["clip"] == "walk"]
    motion[facing] = {}
    for landmark in ["body", "shoulder", "pelvis", "head"]:
        values = [r[landmark][1] for r in walk]
        motion[facing][landmark] = round(max(values)-min(values), 5)
        assert motion[facing][landmark] > .85, (facing, landmark, motion[facing])
    # Rigid pitch makes fore/hind-quarter transfer distinct from uniform bouncing.
    transfer = [r["shoulder"][1]-r["pelvis"][1] for r in walk]
    assert max(transfer)-min(transfer) > .2
report = {
    "identity": f"{pet_id}-draft-v1", "poses": len(guides["records"]),
    "fixedLengthLinkChecks": links, "plantedGroundContacts": contacts,
    "stanceTravelCompensationChecks": travel_checks, "maxProjectionError": projection_error,
    "nativeProjectedMotionRangePx": motion,
    "status": "Integrity passes; agent visual observations and human review are separate.",
}
(output / "source-audit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
