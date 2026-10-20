"""Pack each paint variant into its inherited editable source scene (no re-export).

blender --background --threads 4 --python paint-source-blender.py
The reviewed GLBs are patched from the original binary, not re-exported here.
"""

import hashlib
import json
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art-source/vehicle-bake/paint-study/v1"
study = json.loads((SOURCE / "study.json").read_text())
assert not (SOURCE / "retained.json").exists(), "Frozen paint source"
bpy.context.preferences.filepaths.save_version = 0
for row in study["candidates"]:
    directory = SOURCE / row["id"]
    recipe = json.loads((directory / "recipe.json").read_text())
    destination = directory / "car.blend"
    assert not (ROOT / row["directory"] / "review-manifest.json").exists(), "Frozen review source"
    source = ROOT / recipe["baseBlend"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == recipe["baseBlendSha256"]
    bpy.ops.wm.open_mainfile(filepath=str(source))
    image = bpy.data.images.load(str(directory / "atlas.png"), check_existing=False)
    image.pack()
    replaced = 0
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE":
                node.image = image
                replaced += 1
    assert replaced > 0, "Source lacks editable texture material"
    for other in list(bpy.data.images):
        if other != image and not other.users:
            bpy.data.images.remove(other)
    bpy.context.scene["paint_scheme_id"] = recipe["palette"]["id"]
    bpy.context.scene["paint_base_sha256"] = recipe["baseSha256"]
    bpy.context.scene["paint_source_note"] = "Inherited source geometry; texture-only variant. Exact reviewed GLB is binary-preserving atlas replacement."
    bpy.ops.wm.save_as_mainfile(filepath=str(destination), compress=True)
    print("PACKED_PAINT", row["id"], flush=True)
