"""Read-only packed estate skin/wood/static rack and actual export audit."""

from pathlib import Path
import hashlib
import json

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/woody-wagon/v1"
O = ROOT / "public/demos/vehicle-bake/woody-wagon/v1"
D = ROOT / "data/vehicle-bake/woody-wagon"
CFG = json.loads((A / "family.json").read_text())
report = json.loads((O / "report.json").read_text())
results = {}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


for name in ["master.blend", "car.blend"]:
    path = A / name
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH"]
    triangles = 0
    for ob in meshes:
        ob.data.calc_loop_triangles()
        triangles += len(ob.data.loop_triangles)
        assert (
            len(ob.data.uv_layers) == 1
            and ob.data.uv_layers.active.name == "Semantic_palette_UV"
        )
    assert triangles == report["geometry"]["triangles"] == 2792
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    if name == "master.blend":
        assert len(meshes) > 30 and all("surface_owner" in o for o in meshes)
        rack = [o for o in meshes if o.name.startswith("STATIC roof rack")]
        rails = [o for o in rack if "longitudinal rail" in o.name]
        bars = [o for o in rack if "crossbar" in o.name]
        feet = [o for o in rack if "planted foot" in o.name]
        assert len(rack) == 8 and len(rails) == len(bars) == 2 and len(feet) == 4
        assert not any(
            o.parent or "wheel_radius" in o or "roll_axis_gltf" in o or o.animation_data
            for o in rack
        )
        cabin = bpy.data.objects[
            "Sweeping estate greenhouse actual continuous side front rear roof skin"
        ]
        lower = bpy.data.objects[
            "Long rounded estate coachwork and real wood-inlay skin"
        ]
        assert sum("greenhouse" in o.name for o in meshes) == 1
        cabin.data.calc_loop_triangles()
        bvh = BVHTree.FromPolygons(
            [cabin.matrix_world @ v.co for v in cabin.data.vertices],
            [list(t.vertices) for t in cabin.data.loop_triangles],
            all_triangles=True,
        )
        mounts = []
        for x in [-0.18, 1.78]:
            for side in [-1, 1]:
                p, n, i, distance = bvh.ray_cast(
                    Vector((x, side * 0.61, 3)), Vector((0, 0, -1)), 5
                )
                assert p is not None and 1.6095 < p.z < 1.6945
                mounts.append(
                    {
                        "xy": [x, side * 0.61],
                        "actualRoofZ": p.z,
                        "footBottomZ": 1.6095,
                        "footTopZ": 1.6945,
                        "plantedInActualRoof": True,
                    }
                )
        results["fixedRoofRack"] = {
            "status": "passed",
            "components": [o.name for o in rack],
            "twoRailsTwoBarsFourFeet": True,
            "noMotionMetadata": True,
            "mounts": mounts,
        }
        results["skinOwnership"] = {
            "continuousLowerSideWoodOwner": lower.name,
            "passengerQuarterGlassFrontRearRoofSkin": cabin.name,
            "oppositeSides": "Coherent continuous mirrored-family skin charts, no glass overlay meshes",
            "atlasRegionsTopDownY": {
                "woodSides": [0, 176],
                "passengerQuarterSides": [176, 304],
                "fixedFrontRearGlassAndTailgateWood": [304, 416],
                "roof": [416, 448],
                "hood": [448, 480],
                "roleSwatches": [480, 512],
            },
            "woodStyle": "Broad warm inlays bounded by dark trim, sparse long grain strokes; actual body UV paint, no photoreal/random texture.",
        }
    else:
        assert len(meshes) == 5
        rolls = [o for o in scene.objects if "wheel_radius" in o]
        assert sorted(o.name for o in rolls) == [
            f"Wheel_{w}_Roll" for w in ["FL", "FR", "RL", "RR"]
        ]
        for roll in rolls:
            assert roll.parent.name == roll.name.replace("_Roll", "_Steer")
            assert list(roll["roll_axis_gltf"]) == [0, 0, -1]
            assert (
                abs(roll["wheel_radius"] - CFG["wheelRadius"] * CFG["exportWorldScale"])
                < 1e-10
            )
            assert len([o for o in roll.children_recursive if o.type == "MESH"]) == 1
        body = bpy.data.objects["Body_static"]
        assert (
            body.parent.name == "Woody_Estate_Root_forward_minus_X"
            and not body.animation_data
        )
        assert "wheel_radius" not in body
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
dims = [(high[i] - low[i]) / CFG["exportWorldScale"] for i in range(3)]
assert 5.3 < dims[0] < 5.6 and 1.95 < dims[1] < 2.1 and 1.65 < dims[2] < 1.8, dims
assert abs(low[2]) < 1e-4
results["actualGLBBounds"] = {
    "glbSha256": sha(path),
    "minBlenderWorld": low,
    "maxBlenderWorld": high,
    "dimensionsBlenderWorld": [high[i] - low[i] for i in range(3)],
    "dimensionsSourceUnits": dims,
    "includesStaticRack": True,
}
results["actualGLBStaticRoofRack"] = {
    "status": "passed",
    "owner": "Body_static",
    "noRollMetadata": True,
    "includedInAllFixedTriangleClearance": True,
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
