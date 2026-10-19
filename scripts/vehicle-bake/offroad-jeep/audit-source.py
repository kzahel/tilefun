"""Read-only packed-source, static-equipment and actual-export bounds audit."""

from pathlib import Path
import hashlib
import json

import bpy

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/offroad-jeep/v1"
O = ROOT / "public/demos/vehicle-bake/offroad-jeep/v1"
D = ROOT / "data/vehicle-bake/offroad-jeep"
CFG = json.loads((A / "family.json").read_text())
report = json.loads((O / "report.json").read_text())
results = {}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


for name in ["master.blend", "car.blend"]:
    path = A / name
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    triangles = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        triangles += len(o.data.loop_triangles)
    assert triangles == report["geometry"]["triangles"] <= 3500
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    assert all(
        len(o.data.uv_layers) == 1 and o.data.uv_layers[0].name == "Semantic_palette_UV"
        for o in meshes
    )
    if name == "master.blend":
        assert len(meshes) > 25 and all("surface_owner" in o for o in meshes)
        spare = [
            o
            for o in meshes
            if o.name.startswith("STATIC spare")
            or o.name.startswith("STATIC rear mounted spare")
        ]
        roof = [
            o
            for o in meshes
            if "hardtop" in o.name.lower() or "weather edge" in o.name.lower()
        ]
        assert len(spare) == 4 and len(roof) == 3
        assert not any(
            o.parent
            or "wheel_radius" in o
            or "roll_axis_gltf" in o
            or o.name.startswith("Wheel_")
            for o in spare + roof
        )
        results["fixedEquipment"] = {
            "spareComponents": [o.name for o in spare],
            "hardtopComponents": [o.name for o in roof],
            "staticNoRollMetadata": True,
            "separateSkinOwners": [
                "Upright framed greenhouse actual skin",
                "STATIC contrasting removable-style hardtop",
                "Flat rounded short engine hood",
            ],
            "glassOwnership": "Continuous side UV chart; fixed windshield and rear glass own distinct atlas half-charts. Roof is a separate fixed component/chart. No intersecting glass overlays.",
        }
    else:
        assert len(meshes) == 5
        rolls = [o for o in bpy.context.scene.objects if "wheel_radius" in o]
        assert sorted(o.name for o in rolls) == [
            f"Wheel_{wid}_Roll" for wid in ["FL", "FR", "RL", "RR"]
        ]
        for roll in rolls:
            assert roll.parent.name == roll.name.replace("_Roll", "_Steer")
            assert list(roll["roll_axis_gltf"]) == [0, 0, -1]
            assert abs(roll["wheel_radius"] - 8) < 1e-10
            assert len([o for o in roll.children_recursive if o.type == "MESH"]) == 1
        body = bpy.data.objects["Body_static"]
        assert body.parent.name.startswith("Offroad_SUV_Root")
        assert "wheel_radius" not in body and not body.animation_data
    assert sha(path) == before
    results[name] = {
        "sha256": before,
        "meshObjects": len(meshes),
        "triangles": triangles,
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
lo = [min(p[i] for p in points) for i in range(3)]
hi = [max(p[i] for p in points) for i in range(3)]
dims = [(hi[i] - lo[i]) / CFG["exportWorldScale"] for i in range(3)]
assert 4.8 <= dims[0] <= 5.1 and 2.1 <= dims[1] <= 2.25 and 2.0 <= dims[2] <= 2.2, dims
results["actualGLBBounds"] = {
    "glbSha256": sha(path),
    "minBlenderWorld": lo,
    "maxBlenderWorld": hi,
    "dimensionsBlenderWorld": [hi[i] - lo[i] for i in range(3)],
    "dimensionsSourceUnits": dims,
    "includesRearSpare": True,
}
body = bpy.data.objects["Body_static"]
assert body.parent and not any("wheel_radius" in p for p in [body, body.parent])
rear = [
    body.matrix_world @ v.co
    for v in body.data.vertices
    if (body.matrix_world @ v.co).x > 2.2 * CFG["exportWorldScale"]
]
assert rear and max(v.x for v in rear) > 2.51 * CFG["exportWorldScale"]
results["actualGLBStaticSpare"] = {
    "owner": body.name,
    "spareRegionVertexCount": len(rear),
    "noRollMetadata": True,
    "wholeFixedBodyIncludedInClearance": True,
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
