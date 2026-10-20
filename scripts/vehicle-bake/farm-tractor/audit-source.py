"""Read-only packed-scene and actual GLB surface UV/bounds audit."""

from pathlib import Path
import bpy
import hashlib
import json
import struct
import zlib
import sys
import math
from mathutils import Vector
from mathutils.geometry import barycentric_transform

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / (
    "data/vehicle-bake/farm-tractor/replay/source"
    if "--scratch" in sys.argv
    else "art-source/vehicle-bake/farm-tractor/v1"
)
O = ROOT / (
    "data/vehicle-bake/farm-tractor/replay/public"
    if "--scratch" in sys.argv
    else "public/demos/vehicle-bake/farm-tractor/v1"
)
D = ROOT / "data/vehicle-bake/farm-tractor"
CFG = json.loads(Path(__file__).with_name("family.json").read_text())
REGION = json.loads(Path(__file__).with_name("surface-regions.json").read_text())
audit = json.loads((O / "report.json").read_text())["geometry"]
results = {}

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
        assert len(meshes) > 20 and all("surface_owner" in o for o in meshes)
        assert (
            len(
                [
                    o
                    for o in meshes
                    if o.name.startswith("REAR real rounded green fender")
                ]
            )
            == 2
        )
        assert not any("front fender" in o.name.lower() for o in meshes)
        assert (
            len([o for o in meshes if o.name.startswith("Rear chevron rolling tread")])
            == 64
        )
        assert bpy.data.objects["Tall enclosed cab actual blue glass skin"]
        assert bpy.data.objects["Long narrow green hood actual yellow stripe skin"]
        assert bpy.data.objects["Overhanging green canopy roof"]
        assert bpy.data.objects["Fixed rear drawbar no hitch physics"]
    else:
        assert len(meshes) == 5
        for wid, spec in CFG["wheelSpecs"].items():
            ro = bpy.data.objects["Wheel_" + wid + "_Roll"]
            st = ro.parent
            assert st.name == "Wheel_" + wid + "_Steer"
            assert st["steering_enabled"] == (wid[0] == "F")
            assert list(ro["roll_axis_gltf"]) == [0, 0, -1]
            assert abs(ro["wheel_radius"] - spec["radius"] * 80 / 4.6) < 1e-10
            center = ro.matrix_world.translation
            vertices = [
                o.matrix_world @ v.co
                for o in ro.children_recursive
                if o.type == "MESH"
                for v in o.data.vertices
            ]
            actual = max(math.hypot(v.x - center.x, v.z - center.z) for v in vertices)
            assert abs(actual - spec["radius"]) < 1e-6, (wid, actual)
            assert abs(min(v.z for v in vertices)) < 1e-6
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
actualWheels = []
for wid, spec in CFG["wheelSpecs"].items():
    roll = bpy.data.objects["Wheel_" + wid + "_Roll"]
    center = roll.matrix_world.translation
    vertices = [
        o.matrix_world @ v.co
        for o in roll.children_recursive
        if o.type == "MESH"
        for v in o.data.vertices
    ]
    radius = max(math.hypot(v.x - center.x, v.z - center.z) for v in vertices)
    assert abs(radius - spec["radius"] * scale) < 0.0001
    assert abs(min(v.z for v in vertices)) < 0.0001
    actualWheels.append(
        {
            "id": wid,
            "actualRadiusWorld": radius,
            "declaredRadiusWorld": roll["wheel_radius"],
            "actualGroundMin": min(v.z for v in vertices),
            "geometryMatchesOwnMetadata": True,
        }
    )
results["actualGLBMixedRadii"] = actualWheels

# Read the constructor's explicit RGBA/filter-zero PNG without external packages.
png = (O / "atlas.png").read_bytes()
data = bytearray()
cursor = 8
while cursor < len(png):
    size = struct.unpack_from(">I", png, cursor)[0]
    kind = png[cursor + 4 : cursor + 8]
    if kind == b"IDAT":
        data.extend(png[cursor + 8 : cursor + 8 + size])
    cursor += 12 + size
raw = zlib.decompress(data)
assert all(raw[y * 2049] == 0 for y in range(512))


def probe(spec):
    hit, point, normal, face, owner, matrix = bpy.context.scene.ray_cast(
        bpy.context.evaluated_depsgraph_get(),
        Vector(spec["origin"]) * scale,
        Vector(spec["direction"]),
    )
    assert hit and owner.name == "Body_static", (spec["id"], hit, owner)
    local = owner.matrix_world.inverted() @ point
    poly = owner.data.polygons[face]
    assert len(poly.vertices) == 3
    vertices = [owner.data.vertices[i].co for i in poly.vertices]
    uvs = [
        Vector((*owner.data.uv_layers.active.data[i].uv, 0)) for i in poly.loop_indices
    ]
    uv = barycentric_transform(local, *vertices, *uvs)
    x = max(0, min(511, int(uv.x * 512)))
    y = max(0, min(511, int((1 - uv.y) * 512)))
    offset = y * 2049 + 1 + x * 4
    rgb = list(raw[offset : offset + 3])
    roles = [k for k, c in CFG["palette"].items() if c == rgb]
    assert any(k in spec["roles"] for k in roles), (spec["id"], uv, rgb, roles)
    return {
        "id": spec["id"],
        "hitSource": list(point / scale),
        "triangle": face,
        "interpolatedUV": list(uv)[:2],
        "atlasPixel": [x, y],
        "rgb": rgb,
        "roles": roles,
        "owner": owner.name,
    }


samples = [probe(s) for s in REGION["rays"]]
assert hashlib.sha256(path.read_bytes()).hexdigest() == before
results["actualGLBSemanticSurfaces"] = {
    "status": "passed",
    "glbSha256": before,
    "rayCount": len(samples),
    "samples": samples,
    "regionConfig": "scripts/vehicle-bake/farm-tractor/surface-regions.json",
    "meaning": REGION["meaning"],
    "inputBytesUnchanged": True,
}
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
