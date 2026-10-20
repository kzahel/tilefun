"""Read-only packed scene/actual GLB audit, with real cockpit ray controls."""

from pathlib import Path
import bpy
import hashlib
import json
from mathutils import Vector

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/beach-buggy/v1"
O = ROOT / "public/demos/vehicle-bake/beach-buggy/v1"
D = ROOT / "data/vehicle-bake/beach-buggy"
CFG = json.loads(Path(__file__).with_name("cockpit-region.json").read_text())
results = {}
audit = json.loads((O / "report.json").read_text())["geometry"]


def ray(x, y, scale=1):
    bpy.context.view_layer.update()
    hit, point, normal, face, owner, matrix = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(),
        Vector((x * scale, y * scale, 3 * scale)),
        Vector((0, 0, -1)),
    )
    assert hit, (x, y)
    return {
        "xySource": [x, y],
        "firstSurfaceZSource": point.z / scale,
        "owner": owner.name,
    }


def floor_samples(scale=1):
    return [ray(x, y, scale) for x in CFG["floorRaysX"] for y in CFG["floorRaysY"]]


def floor_valid(samples):
    return all(
        abs(r["firstSurfaceZSource"] - CFG["floorTopZ"]) < CFG["floorTolerance"]
        for r in samples
    )


for name in ["master.blend", "car.blend"]:
    path = A / name
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    assert tris == audit["triangles"]
    assert all(
        len(o.data.uv_layers) == 1 and o.data.uv_layers[0].name == "Semantic_palette_UV"
        for o in meshes
    )
    if name == "master.blend":
        assert len(meshes) > 30 and all("surface_owner" in o for o in meshes)
        samples = floor_samples()
        assert floor_valid(samples), samples
        assert all(
            s["owner"] == "Recessed cockpit floor visible in footwells" for s in samples
        )
        owners = [o.name for o in meshes]
        assert any(
            "Static tiny windscreen exact framed opaque glass owner" == s
            for s in owners
        )
        assert len([s for s in owners if s.startswith("Blue bucket seatback")]) == 2
        cage = [o for o in meshes if o.name.startswith("Fixed cage")]
        assert len(cage) == 6 and all(o.get("surface_owner") == o.name for o in cage)
        cage_points = {
            tuple(round(c, 6) for c in o.matrix_world @ v.co)
            for o in cage
            for v in o.data.vertices
        }
        results["staticCage"] = {
            "componentOwners": [o.name for o in cage],
            "masterFixedBodyGroup": True,
            "neverWheelChildren": True,
        }
        results["masterCockpitFloor"] = {"status": "passed", "rays": samples}
    else:
        assert len(meshes) == 5
        fixed = bpy.data.objects["Body_static"]
        fixed_points = {
            tuple(round(c, 6) for c in fixed.matrix_world @ v.co)
            for v in fixed.data.vertices
        }
        assert cage_points <= fixed_points
        assert fixed.parent.name == "BeachBuggy_Root_forward_minus_X"
        results["staticCage"]["allCageVerticesInLowFixedBody"] = True
        results["staticCage"]["cageVertexCount"] = len(cage_points)
        for wid in ["FL", "FR", "RL", "RR"]:
            ro = bpy.data.objects["Wheel_" + wid + "_Roll"]
            assert ro.parent.name == "Wheel_" + wid + "_Steer"
            assert list(ro["roll_axis_gltf"]) == [0, 0, -1]
            assert abs(ro["wheel_radius"] - 0.44 * 80 / 4.6) < 1e-10
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    results[name] = {
        "sha256": before,
        "meshObjects": len(meshes),
        "triangles": tris,
        "packedImages": [i.name for i in images],
        "oneSemanticUVLayer": True,
        "sourceUnits": "Authoring source units; exported root scales by 80/4.6.",
    }

path = O / "model.glb"
before = hashlib.sha256(path.read_bytes()).hexdigest()
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
scale = 80 / 4.6
results["actualGLBBounds"] = {
    "glbSha256": before,
    "minBlenderWorld": lo,
    "maxBlenderWorld": hi,
    "dimensionsBlenderWorld": [hi[i] - lo[i] for i in range(3)],
    "dimensionsSourceUnits": [(hi[i] - lo[i]) / scale for i in range(3)],
}
samples = floor_samples(scale)
assert floor_valid(samples), samples
rails = [ray(x, y, scale) for x, y in CFG["railRaysXY"]]
seats = [ray(x, y, scale) for x, y in CFG["seatRaysXY"]]
backs = [ray(x, y, scale) for x, y in CFG["seatbackRaysXY"]]
assert all(s["firstSurfaceZSource"] >= CFG["minimumDoorRailZ"] for s in rails), rails
depth = min(s["firstSurfaceZSource"] for s in rails) - max(
    s["firstSurfaceZSource"] for s in samples
)
assert depth >= CFG["minimumRecessDepth"], depth
assert all(0.63 < s["firstSurfaceZSource"] < 0.66 for s in seats), seats
assert all(1.04 < s["firstSurfaceZSource"] < 1.08 for s in backs), backs
outside = ray(*CFG["outsideControlXY"], scale)
assert not floor_valid([outside]), outside

# Deliberately put a solid top deck over the cockpit, without touching disk bytes.
bpy.ops.mesh.primitive_cube_add(
    size=1, location=(0.225 * scale, 0, (CFG["upperDeckNegativeZ"] - 0.01) * scale)
)
fake = bpy.context.object
fake.name = "NEGATIVE_CONTROL_opaque_upper_deck_not_candidate"
fake.scale = (1.4 * scale, 1.20 * scale, 0.02 * scale)
negative = floor_samples(scale)
assert not floor_valid(negative)
assert all(s["owner"] == fake.name for s in negative)
bpy.data.objects.remove(fake, do_unlink=True)
reset = floor_samples(scale)
assert floor_valid(reset) and reset == samples
assert hashlib.sha256(path.read_bytes()).hexdigest() == before
results["actualGLBOpenCockpit"] = {
    "status": "passed",
    "glbSha256": before,
    "rayCount": len(samples),
    "centralDownwardRays": samples,
    "doorRailRays": rails,
    "seatCushionRays": seats,
    "seatbackRays": backs,
    "minimumRecessDepthSource": depth,
    "minimumRecessDepthWorld": depth * scale,
    "controls": {
        "baselinePositivePassed": True,
        "outsideHoodRejected": True,
        "opaqueUpperDeckRejected": True,
        "upperDeckNegativeRays": negative,
        "baselineRestored": True,
        "inputBytesUnchanged": True,
    },
    "regionConfig": "scripts/vehicle-bake/beach-buggy/cockpit-region.json",
    "meaning": CFG["meaning"],
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
