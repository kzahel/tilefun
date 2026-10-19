"""Read-only packed-source audit, run in background Blender after final build."""

from pathlib import Path
import bpy, json, hashlib
from mathutils import Vector

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/pickup/v1"
D = ROOT / "data/vehicle-bake/pickup"
results = {}
for name in ["master.blend", "car.blend"]:
    path = A / name
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH"]
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert images and all(i.packed_file for i in images)
    assert (
        tris
        == json.loads(
            (ROOT / "public/demos/vehicle-bake/pickup/v1/report.json").read_text()
        )["geometry"]["triangles"]
    )
    assert all(
        len(o.data.uv_layers) == 1 and o.data.uv_layers[0].name == "Semantic_palette_UV"
        for o in meshes
    )
    if name == "master.blend":
        assert len(meshes) > 20 and all("surface_owner" in o for o in meshes)
        bpy.context.view_layer.update()
        rays = []
        for x in [0.80, 1.20, 1.80, 2.20]:
            for y in [-0.35, 0, 0.35]:
                hit, point, normal, face, owner, matrix = scene.ray_cast(
                    bpy.context.evaluated_depsgraph_get(),
                    Vector((x, y, 3)),
                    Vector((0, 0, -1)),
                )
                assert hit and abs(point.z - 0.71) < 1e-5, (x, y, point)
                assert owner.name.startswith("Recessed cargo floor")
                rays.append(
                    {"xy": [x, y], "firstSurfaceZ": point.z, "owner": owner.name}
                )
        results["openBedGeometry"] = {
            "status": "passed",
            "centralDownwardRays": rays,
            "floorTopZ": 0.71,
            "railTopZ": 1.2775,
            "recessDepth": 0.5675,
            "cabRearX": 0.32,
            "cargoFrontX": 0.42,
            "cabBedGap": 0.10,
            "meaning": "Twelve central cargo rays reach the recessed floor, not roof, glass or a solid deck; side wheelhouses and walls are separate real geometry.",
        }
    else:
        assert len(meshes) == 5
        for wid in ["FL", "FR", "RL", "RR"]:
            roll = bpy.data.objects["Wheel_" + wid + "_Roll"]
            assert roll.parent.name == "Wheel_" + wid + "_Steer"
            assert (
                list(roll["roll_axis_gltf"]) == [0, 0, -1]
                and abs(roll["wheel_radius"] - 0.46 * 80 / 4.6) < 1e-10
            )
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    results[name] = {
        "sha256": before,
        "meshObjects": len(meshes),
        "triangles": tris,
        "packedImages": [i.name for i in images],
        "oneSemanticUVLayer": True,
        "sourceUnits": "Authoring source units; exported root scales by 80/4.6.",
    }
# Actual exported physical bounds, not config estimates.
path = ROOT / "public/demos/vehicle-bake/pickup/v1/model.glb"
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
results["actualGLBBounds"] = {
    "glbSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "minBlenderWorld": lo,
    "maxBlenderWorld": hi,
    "dimensionsBlenderWorld": [hi[i] - lo[i] for i in range(3)],
    "dimensionsSourceUnits": [(hi[i] - lo[i]) / (80 / 4.6) for i in range(3)],
}
scale = 80 / 4.6
actual_bed_rays = []
for x in [0.80, 1.20, 1.80, 2.20]:
    for y in [-0.35, 0, 0.35]:
        hit, point, normal, face, owner, matrix = bpy.context.scene.ray_cast(
            bpy.context.evaluated_depsgraph_get(),
            Vector((x * scale, y * scale, 3 * scale)),
            Vector((0, 0, -1)),
        )
        assert hit and abs(point.z / scale - 0.71) < 1e-5
        assert owner.name == "Body_static"
        actual_bed_rays.append(
            {"xySource": [x, y], "firstSurfaceZSource": point.z / scale}
        )
results["actualGLBOpenBed"] = {
    "status": "passed",
    "glbSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "centralDownwardRays": actual_bed_rays,
    "rayCount": len(actual_bed_rays),
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
