"""Blender-side packed texture and inherited editable mesh/UV/hierarchy proof."""
import hashlib
import json
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art-source/vehicle-bake/paint-study/v1"


def snapshot():
    result = []
    for obj in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        row = {"name": obj.name, "type": obj.type,
               "parent": obj.parent.name if obj.parent else None,
               "matrix": [list(v) for v in obj.matrix_local],
               "properties": {k: obj[k] for k in obj.keys() if k != "_RNA_UI"}}
        if obj.type == "MESH":
            mesh = obj.data
            row["vertices"] = [list(v.co) for v in mesh.vertices]
            row["faces"] = [list(p.vertices) for p in mesh.polygons]
            row["uvs"] = [[list(v.uv) for v in uv.data] for uv in mesh.uv_layers]
        result.append(row)
    return hashlib.sha256(json.dumps(result, sort_keys=True,
        default=lambda v: v.to_list() if hasattr(v, "to_list") else v.to_dict()).encode()).hexdigest()


bases = {}
results = []
for row in json.loads((SOURCE / "study.json").read_text())["candidates"]:
    directory = SOURCE / row["id"]
    recipe = json.loads((directory / "recipe.json").read_text())
    if row["family"] not in bases:
        bpy.ops.wm.open_mainfile(filepath=str(ROOT / recipe["baseBlend"]))
        bases[row["family"]] = snapshot()
    bpy.ops.wm.open_mainfile(filepath=str(directory / "car.blend"))
    assert snapshot() == bases[row["family"]], "Source mesh/UV/hierarchy changed"
    textures = [node.image for material in bpy.data.materials if material.use_nodes
                for node in material.node_tree.nodes if node.type == "TEX_IMAGE"]
    assert textures and all(image.packed_file for image in textures)
    assert all(hashlib.sha256(bytes(image.packed_file.data)).hexdigest() == recipe["atlasSha256"] for image in textures)
    results.append({"id": row["id"], "status": "passed", "sourceGeometryUVHierarchySha256": bases[row["family"]],
                    "packedAtlasSha256": recipe["atlasSha256"]})
path = ROOT / "data/vehicle-bake/paint-study-v1/packed-source-qa.json"
path.write_text(json.dumps({"status": "passed", "results": results}, indent=2) + "\n")
print("PACKED_SOURCE_QA", len(results), flush=True)
