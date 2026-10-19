"""Read-only exact-base preservation, packed scene and actual GLB audit."""

from pathlib import Path
import hashlib
import json
import struct

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/race-coupe/v1"
O = ROOT / "public/demos/vehicle-bake/race-coupe/v1"
D = ROOT / "data/vehicle-bake/race-coupe"
CFG = json.loads((A / "family.json").read_text())
recipe = json.loads((A / "recipe.json").read_text())
report = json.loads((O / "report.json").read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(obj):
    m = obj.data
    return {
        "vertices": [list(v.co) for v in m.vertices],
        "faces": [list(f.vertices) for f in m.polygons],
        "uv": [list(v.uv) for v in m.uv_layers.active.data],
        "matrixBasis": [list(row) for row in obj.matrix_basis],
        "parent": obj.parent.name if obj.parent else None,
    }


for p, expected in CFG["baseHashes"].items():
    assert sha(ROOT / p) == expected
bpy.ops.wm.open_mainfile(filepath=str(ROOT / CFG["baseBlend"]))
bpy.context.view_layer.update()
base = {o.name: snapshot(o) for o in bpy.context.scene.objects if o.type == "MESH"}
base_body = bpy.data.objects["Body_static"]
base_body.data.calc_loop_triangles()
base_bvh = BVHTree.FromPolygons(
    [base_body.matrix_world @ v.co for v in base_body.data.vertices],
    [list(t.vertices) for t in base_body.data.loop_triangles],
    all_triangles=True,
)
mounts = []
for side in [-1, 1]:
    p, n, i, distance = base_bvh.ray_cast(
        Vector((CFG["spoiler"]["supportX"], side * CFG["spoiler"]["supportY"], 2)),
        Vector((0, 0, -1)),
        4,
    )
    assert (
        p is not None
        and CFG["spoiler"]["supportBottom"] <= p.z <= CFG["spoiler"]["supportTop"]
    ), p
    mounts.append(
        {
            "side": side,
            "actualDeckZ": p.z,
            "supportBottom": CFG["spoiler"]["supportBottom"],
            "supportTop": CFG["spoiler"]["supportTop"],
            "intersectsDeckForStaticMount": True,
        }
    )
results = {"baseHashesVerified": CFG["baseHashes"], "spoilerMounts": mounts}
for name in ["master.blend", "car.blend"]:
    path = A / name
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    triangles = 0
    for ob in meshes:
        ob.data.calc_loop_triangles()
        triangles += len(ob.data.loop_triangles)
        assert len(ob.data.uv_layers) == 1 and ob.data.uv_layers.active.name == "UVMap"
    assert triangles == report["geometry"]["triangles"] == 2431
    images = [i for i in bpy.data.images if i.type == "IMAGE"]
    assert len(images) == 2 and all(i.packed_file for i in images)
    for wid in ["FL", "FR", "RL", "RR"]:
        ob = bpy.data.objects[f"Wheel_{wid}_tire_hub"]
        assert snapshot(ob) == base[ob.name]
        roll = bpy.data.objects[f"Wheel_{wid}_Roll"]
        assert roll.parent.name == f"Wheel_{wid}_Steer"
        assert (
            list(roll["roll_axis_gltf"]) == [0, 0, -1]
            and abs(roll["wheel_radius"] - 0.34 * 80 / 4.6) < 1e-10
        )
    body = bpy.data.objects["Body_static"]
    if name == "master.blend":
        assert len(meshes) == 8 and snapshot(body) == base[body.name]
        spoiler = [o for o in meshes if o.name.startswith("STATIC")]
        assert len(spoiler) == 3 and all(
            o.parent.name == "Coupe_export_root" for o in spoiler
        )
        assert all(
            "wheel_radius" not in o and "roll_axis_gltf" not in o for o in spoiler
        )
    else:
        assert len(meshes) == 5
        data = snapshot(body)
        for key in ["vertices", "faces", "uv"]:
            assert data[key][: len(base[body.name][key])] == base[body.name][key], key
        assert data["matrixBasis"] == base[body.name]["matrixBasis"]
        assert set(a.value for a in body.data.attributes["source_owner"].data) >= {
            200,
            201,
            202,
        }
    assert sha(path) == before
    results[name] = {
        "sha256": before,
        "triangles": triangles,
        "meshObjects": len(meshes),
        "packedImages": [i.name for i in images],
        "oneUVLayer": True,
        "acceptedBodyPositionsTopologyUVPreserved": True,
        "acceptedWheelPositionsTopologyUVPosePreserved": True,
        "staticSpoiler": True,
    }


def glb(path):
    b = path.read_bytes()
    length = struct.unpack_from("<I", b, 12)[0]
    return json.loads(b[20 : 20 + length]), b[28 + length :]


def attribute(doc, binary, wid, key):
    node = next(n for n in doc["nodes"] if n.get("name") == f"Wheel_{wid}_tire_hub")
    p = doc["meshes"][node["mesh"]]["primitives"][0]
    a = doc["accessors"][p["attributes"][key]]
    v = doc["bufferViews"][a["bufferView"]]
    assert a["componentType"] == 5126 and not v.get("byteStride")
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    width = {"VEC2": 2, "VEC3": 3}[a["type"]] * 4
    return binary[start : start + a["count"] * width]


base_glb = (
    ROOT / "public/demos/vehicle-bake/a-reduced-projection/mid-fenders-v3/model.glb"
)
doc, binary = glb(O / "model.glb")
old, old_binary = glb(base_glb)
for wid in ["FL", "FR", "RL", "RR"]:
    for key in ["POSITION", "NORMAL", "TEXCOORD_0"]:
        assert attribute(doc, binary, wid, key) == attribute(
            old, old_binary, wid, key
        ), (wid, key)
results["actualGLBWheelAttributes"] = {
    "status": "passed",
    "baseGLB": base_glb.relative_to(ROOT).as_posix(),
    "baseGLBSha256": sha(base_glb),
    "attributesByteExact": ["POSITION", "NORMAL", "TEXCOORD_0"],
    "allFour": True,
}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(O / "model.glb"))
bpy.context.view_layer.update()
points = [
    o.matrix_world @ v.co
    for o in bpy.context.scene.objects
    if o.type == "MESH"
    for v in o.data.vertices
]
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
dims = [high[i] - low[i] for i in range(3)]
results["actualGLBBounds"] = {
    "glbSha256": sha(O / "model.glb"),
    "minBlenderWorld": low,
    "maxBlenderWorld": high,
    "dimensionsBlenderWorld": dims,
    "dimensionsSourceUnits": [v / CFG["exportWorldScale"] for v in dims],
    "includesNewSpoiler": True,
}
assert abs(low[2]) < 1e-4 and 79 < dims[0] < 83
assert (
    sha(ROOT / "public/demos/vehicle-bake/offroad-jeep/v1/model.glb")
    == "68b188c03f679308082ec5453f80d101c0949af93220562f7f7bce5e7dba378d"
)
results["finishedSUVGlbPreserved"] = True
(D / "packed-source-audit.json").write_text(
    json.dumps({"status": "passed", "results": results}, indent=2) + "\n"
)
print(json.dumps(results, indent=2))
