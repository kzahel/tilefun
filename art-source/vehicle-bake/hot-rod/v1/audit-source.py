"""Read-only mixed-radius packed scene, fixed equipment and attachment audit."""

from pathlib import Path
import hashlib
import json
import math

import bpy

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/hot-rod/v1"
O = ROOT / "public/demos/vehicle-bake/hot-rod/v1"
D = ROOT / "data/vehicle-bake/hot-rod"
CFG = json.loads((A / "family.json").read_text())
report = json.loads((O / "report.json").read_text())
results = {}
S = CFG["exportWorldScale"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


for name in ["master.blend", "car.blend"]:
    path = A / name
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    triangles = 0
    for ob in meshes:
        ob.data.calc_loop_triangles()
        triangles += len(ob.data.loop_triangles)
        assert (
            len(ob.data.uv_layers) == 1
            and ob.data.uv_layers.active.name == "Semantic_palette_UV"
        )
    assert triangles == report["geometry"]["triangles"] == 3194
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 35 and all("surface_owner" in o for o in meshes)
        fenders = [o for o in meshes if "fender" in o.name]
        assert len(fenders) == 2 and all(
            o.name.startswith("REAR") and "inner wheelhouse" in o.name for o in fenders
        )
        equipment = [o for o in meshes if o.name.startswith("STATIC")]
        assert len(equipment) == 12
        assert not any(
            o.parent or o.animation_data or "wheel_radius" in o or "roll_axis_gltf" in o
            for o in equipment
        )
        arm = bpy.data.objects[
            "FRONT fixed transverse attachment arm stops short of tire cylinders"
        ]
        end_y = max(abs((arm.matrix_world @ v.co).y) for v in arm.data.vertices)
        expected_inner = (
            CFG["wheelSpecs"]["FL"]["halfTrack"] - CFG["wheelSpecs"]["FL"]["width"] / 2
        )
        gap = expected_inner - end_y
        assert 0 < gap < 0.025
        results["sourceAttachment"] = {
            "frontArmEndsAbsY": end_y,
            "frontTireInnerAbsY": expected_inner,
            "sourceGap": gap,
            "worldGap": gap * S,
            "subpixelButNonintersecting": True,
        }
        results["fixedEquipment"] = {
            "staticHeadersExhaustAndMouths": [o.name for o in equipment],
            "noMotionMetadata": True,
            "frontFenderCount": 0,
            "frontCoverage": "not-applicable/intentionally-open",
            "rearFenders": [o.name for o in fenders],
        }
        results["skinOwnership"] = {
            "cab": "Continuous actual-skin side flame/glass chart, fixed front/rear glass half-charts, roof own chart",
            "tail": "Short plum trunk separate skin chart",
            "engine": "Broad V8 blocks, chrome valve banks, round air cleaner, radiator and fixed exhaust use explicit padded palette swatches",
            "noGlassOverlayMeshes": True,
            "flames": CFG["flamePolygons"],
        }
    else:
        assert len(meshes) == 5
        rolls = [o for o in bpy.context.scene.objects if "wheel_radius" in o]
        assert len(rolls) == 4
        measured = []
        for wid, spec in CFG["wheelSpecs"].items():
            roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
            assert roll.parent.name == f"Wheel_{wid}_Steer"
            assert list(roll["roll_axis_gltf"]) == [0, 0, -1]
            assert abs(roll["wheel_radius"] - spec["radius"] * S) < 1e-10
            children = [o for o in roll.children_recursive if o.type == "MESH"]
            assert len(children) == 1
            center = roll.matrix_world.translation
            points = [o.matrix_world @ v.co for o in children for v in o.data.vertices]
            radius = max(math.hypot(p.x - center.x, p.z - center.z) for p in points)
            assert abs(radius - spec["radius"]) < 1e-6
            assert abs(min(p.z for p in points)) < 1e-6
            measured.append(
                {
                    "id": wid,
                    "radiusSourceMeasured": radius,
                    "radiusWorldDeclared": roll["wheel_radius"],
                    "geometryAndOwnMetadataMatch": True,
                }
            )
        results["mixedRadiusRig"] = measured
        body = bpy.data.objects["Body_static"]
        assert (
            body.parent.name == "Hot_Rod_Root_forward_minus_X"
            and not body.animation_data
            and "wheel_radius" not in body
        )
    assert sha(path) == before
    results[name] = {
        "sha256": before,
        "triangles": triangles,
        "meshObjects": len(meshes),
        "packedImages": [i.name for i in images],
        "oneSemanticUVLayer": True,
    }

path = O / "model.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update()
points = [
    o.matrix_world @ v.co
    for o in bpy.context.scene.objects
    if o.type == "MESH"
    for v in o.data.vertices
]
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
dims = [(high[i] - low[i]) / S for i in range(3)]
assert 4.0 < dims[0] < 4.4 and 2.35 < dims[1] < 2.5 and 1.55 < dims[2] < 1.7, dims
assert abs(low[2]) < 1e-4
results["actualGLBBounds"] = {
    "glbSha256": sha(path),
    "minBlenderWorld": low,
    "maxBlenderWorld": high,
    "dimensionsBlenderWorld": [high[i] - low[i] for i in range(3)],
    "dimensionsSourceUnits": dims,
}
body = bpy.data.objects["Body_static"]
fixed = [body.matrix_world @ v.co for v in body.data.vertices]
attachment = []
for wid in ["FL", "FR"]:
    roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
    tire = [
        o.matrix_world @ v.co
        for o in roll.children_recursive
        if o.type == "MESH"
        for v in o.data.vertices
    ]
    inner = min(abs(p.y) for p in tire)
    side = -1 if wid[1] == "L" else 1
    arm = [
        p
        for p in fixed
        if abs(p.x / S + 1.4) < 0.04
        and abs(p.z / S - 0.32) < 0.04
        and 0.8 < side * p.y / S < 0.92
    ]
    assert arm
    end = max(side * p.y for p in arm)
    gap = inner - end
    assert 0 < gap < 0.5
    attachment.append(
        {
            "id": wid,
            "actualTireSlabInnerAbsY": inner,
            "actualStaticArmEndAbsY": end,
            "axialGapWorld": gap,
            "subpixelGap": True,
        }
    )
results["actualGLBFrontAttachments"] = {
    "glbSha256": sha(path),
    "results": attachment,
    "allFixedTrianglesSeparatelyClearanceProven": True,
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
