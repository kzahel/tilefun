"""Independently inspect the saved Blender scene, UVs, triangles and contact."""
import hashlib
import json
import math
import struct
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[3]
# A fresh offline workspace; generated files never live beside this source code.
import os
WORKSPACE = Path(os.environ.get("TILEFUN_COMPACT_PILOT", ROOT / "data/authored-assets/compact-pilot")).resolve()
HERE = WORKSPACE / "source"
OUT = WORKSPACE / "render"
reference = json.loads((HERE / "geometry.json").read_text())
objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assert len(objects) == len(reference["objects"])
triangles = 0
positions = []
contacts = []
for obj in objects:
    assert tuple(obj.scale) == (1, 1, 1), obj.name
    expected = next(row for row in reference["objects"] if row["name"] == obj.name)
    assert len(obj.data.vertices) == len(expected["vertices"])
    for a, b in zip(obj.data.vertices, expected["vertices"]):
        assert max(abs(a.co[k] - b[k]) for k in range(3)) < 1e-5, obj.name
    obj.data.calc_loop_triangles()
    for tri in obj.data.loop_triangles:
        assert tri.area > 1e-6, obj.name
        triangles += 1
    assert len(obj.data.uv_layers) == 1
    for coord in obj.data.uv_layers.active.data:
        assert all(math.isfinite(v) and 0 <= v <= 1 for v in coord.uv), obj.name
    positions += [tuple(obj.matrix_world @ v.co) for v in obj.data.vertices]
    if obj.name.startswith("Tire"):
        low = min(v.co.z for v in obj.data.vertices)
        assert abs(low) < 1e-5
        contacts.append({"wheel": obj.name, "groundZ": low})
assert len(contacts) == 4
assert min(p[2] for p in positions) >= -1e-5
assert all(i.packed_file for i in bpy.data.images if i.name.endswith(".png"))
blob = (OUT / "car.glb").read_bytes()
magic, version, length = struct.unpack_from("<III", blob)
assert magic == 0x46546C67 and version == 2 and length == len(blob)
json_len, chunk_type = struct.unpack_from("<II", blob, 12)
assert chunk_type == 0x4E4F534A
glb = json.loads(blob[20:20 + json_len])
glb_triangles = sum(glb["accessors"][p["indices"]]["count"] // 3
                    for mesh in glb["meshes"] for p in mesh["primitives"])
assert glb_triangles == triangles
assert len(glb["images"]) == 1 and "bufferView" in glb["images"][0]
assert len(glb["materials"]) == 1
result = {"savedSceneMeshes": len(objects), "triangles": triangles,
          "uvAtlas": [512, 512], "embeddedGlbImages": len(glb["images"]),
          "visualBounds": [[min(p[k] for p in positions) for k in range(3)],
                           [max(p[k] for p in positions) for k in range(3)]],
          "contacts": contacts, "glbBytes": len(blob),
          "carBlendSha256": hashlib.sha256((HERE / "car.blend").read_bytes()).hexdigest(),
          "checks": "Saved scene matches authored vertices; finite UVs; nonzero triangles; four ground contacts; self-contained GLB",
          "limits": "Integrity checks do not establish human art acceptance or exact source-camera registration"}
(OUT / "audit.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result), flush=True)
