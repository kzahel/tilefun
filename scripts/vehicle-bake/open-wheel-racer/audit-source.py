"""Read-only packed scene/actual GLB audit, with real cockpit ray controls."""

from pathlib import Path
import bpy
import hashlib
import json
from mathutils import Vector

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/open-wheel-racer/v1"
O = ROOT / "public/demos/vehicle-bake/open-wheel-racer/v1"
D = ROOT / "data/vehicle-bake/open-wheel-racer"
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
        assert all(s["owner"] == "Actual recessed cockpit floor" for s in samples)
        owners = [o.name for o in meshes]
        assert any("Small static framed opaque blue windscreen" == s for s in owners)
        assert len([s for s in owners if s.startswith("Fixed dark seatback")]) == 1
        results["masterCockpitFloor"] = {"status": "passed", "rays": samples}
    else:
        assert len(meshes) == 5
        for wid in ["FL", "FR", "RL", "RR"]:
            ro = bpy.data.objects["Wheel_" + wid + "_Roll"]
            assert ro.parent.name == "Wheel_" + wid + "_Steer"
            assert list(ro["roll_axis_gltf"]) == [0, 0, -1]
            assert (
                abs(ro["wheel_radius"] - (0.39 if wid[0] == "F" else 0.45) * 80 / 4.6)
                < 1e-10
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
assert all(0.46 < s["firstSurfaceZSource"] < 0.49 for s in seats), seats
assert all(0.84 < s["firstSurfaceZSource"] < 0.91 for s in backs), backs
outside = ray(*CFG["outsideControlXY"], scale)
assert not floor_valid([outside]), outside

# Deliberately put a solid top deck over the cockpit, without touching disk bytes.
bpy.ops.mesh.primitive_cube_add(
    size=1, location=(0.15 * scale, 0, (CFG["upperDeckNegativeZ"] - 0.01) * scale)
)
fake = bpy.context.object
fake.name = "NEGATIVE_CONTROL_opaque_upper_deck_not_candidate"
fake.scale = (0.82 * scale, 0.58 * scale, 0.02 * scale)
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
    "regionConfig": "scripts/vehicle-bake/open-wheel-racer/cockpit-region.json",
    "meaning": CFG["meaning"],
}
# Actual imported GLB: arm/upright tips just short of each wheel's inner face.
# Region excludes undertray/body and wings; it contains the declared suspension tips.
bpy.context.view_layer.update()
fixed = bpy.data.objects["Body_static"]
body_vertices = [fixed.matrix_world @ v.co for v in fixed.data.vertices]
gaps = []
for wid in ["FL", "FR", "RL", "RR"]:
    roll = bpy.data.objects["Wheel_" + wid + "_Roll"]
    center = roll.matrix_world.translation
    tire = [o for o in roll.children_recursive if o.type == "MESH"][0]
    wheel_vertices = [tire.matrix_world @ v.co for v in tire.data.vertices]
    side = -1 if center.y < 0 else 1
    inner = min(side * v.y for v in wheel_vertices)
    tips = [
        v
        for v in body_vertices
        if abs(v.x - center.x) < 0.36 * scale
        and abs(v.z - center.z) < 0.18 * scale
        and inner - 0.09 * scale < side * v.y < inner
    ]
    assert tips, wid
    gap = inner - max(side * v.y for v in tips)
    assert 0.05 < gap < 1.0, (wid, gap)
    assert all(side * v.y < inner for v in tips)
    xrange = [
        min(v.x for v in wheel_vertices) / scale,
        max(v.x for v in wheel_vertices) / scale,
    ]
    assert xrange[1] < -0.28 or xrange[0] > 0.58, (wid, xrange)
    gaps.append(
        {
            "wheelLongitudinalRangeSource": xrange,
            "wheelOutsideCockpitLongitudinalRange": True,
            "wheel": wid,
            "radiusWorld": roll["wheel_radius"],
            "innerFaceOutwardYWorld": inner,
            "tipCandidateVertices": len(tips),
            "actualAxialGapWorld": gap,
            "subpixelWorldGap": True,
        }
    )
results["actualGLBSuspensionAttachment"] = {
    "status": "passed",
    "glbSha256": before,
    "gaps": gaps,
    "meaning": "Declared actual fixed-tip region near each imported roll center; nearest fixed arm/upright vertex ends below1world pixel short of the real rotating inner tire face. Full cylinder/body proof separately qualifies every fixed triangle and all neutral rolls.",
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
