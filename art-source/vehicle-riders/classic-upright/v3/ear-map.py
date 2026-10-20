"""Map actual decoded GLB triangles to retained semantic ear owners, without export."""

from pathlib import Path
import hashlib, json, struct
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
C = json.loads((S / "rider.json").read_text())
scale = C["worldScale"]
A = R / "art-source/vehicle-riders/classic-upright/v3"
O = R / "public/demos/vehicle-riders/classic-upright/v3"
D = R / "data/vehicle-riders/classic-upright-v3"
bpy.ops.wm.open_mainfile(filepath=str(A / "master.blend"))
source = [
    (o.matrix_world @ v.co * scale, o.name)
    for o in bpy.context.scene.objects
    if o.type == "MESH"
    for v in o.data.vertices
]
kd = KDTree(len(source))
for i, (p, n) in enumerate(source):
    kd.insert(p, i)
kd.balance()
raw = (O / "rider.glb").read_bytes()
size = struct.unpack_from("<I", raw, 12)[0]
g = json.loads(raw[20 : 20 + size])
binary = raw[28 + size :]
assert len(g["meshes"]) == 1 and len(g["meshes"][0]["primitives"]) == 1
for node in g["nodes"]:
    if "mesh" not in node and "children" not in node:
        continue  # Measured socket translations do not transform the mesh.
    assert not node.get("rotation") and not any(node.get("translation", [0, 0, 0]))
    if "scale" in node:
        assert all(abs(v - scale) < 1e-5 for v in node["scale"])


def accessor(i):
    a = g["accessors"][i]
    v = g["bufferViews"][a["bufferView"]]
    width = {"SCALAR": 1, "VEC3": 3}[a["type"]]
    kind = {5123: "H", 5125: "I", 5126: "f"}[a["componentType"]]
    fmt = "<" + kind * width
    offset = a.get("byteOffset", 0) + v.get("byteOffset", 0)
    stride = v.get("byteStride", struct.calcsize(fmt))
    return [
        struct.unpack_from(fmt, binary, offset + j * stride) for j in range(a["count"])
    ]


primitive = g["meshes"][0]["primitives"][0]
points = [
    Vector((p[0], -p[2], p[1])) * scale
    for p in accessor(primitive["attributes"]["POSITION"])
]
indices = [v[0] for v in accessor(primitive["indices"])]
owners = []
for j in range(0, len(indices), 3):
    common = set.intersection(
        *[
            {source[i][1] for _, i, _ in kd.find_range(points[k], 0.001)}
            for k in indices[j : j + 3]
        ]
    )
    assert len(common) == 1, (j, common)
    owners.append(next(iter(common)))
ears = {
    side: [i for i, n in enumerate(owners) if n == "RiderClassic pointed ear " + side]
    for side in ["left", "right"]
}
assert all(ears.values()) and not set(ears["left"]) & set(ears["right"])
result = {
    "status": "passed-actual-decoded-semantic-map",
    "modelSha256": hashlib.sha256(raw).hexdigest(),
    "triangles": len(owners),
    "indexCount": len(indices),
    "positionVertices": len(points),
    "earTriangleIds": ears,
    "earTriangleCount": {k: len(v) for k, v in ears.items()},
    "allOtherTrianglesPreservedByControls": True,
    "mapping": "Actual retained master point owners mapped independently to every decoded GLB index triangle. No model re-export or metadata-only ear labels.",
}
(D / "ear-triangle-map.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            k: result[k]
            for k in ["status", "triangles", "earTriangleCount", "modelSha256"]
        }
    )
)
