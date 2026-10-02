"""Render the existing tiger scene without modifying or saving the .blend.

blender --background art-source/blender/tiger.blend --python-exit-code 1 --python scripts/blender/render_tiger_reference.py
Then run preview_character_stages.py --pack-reference to retain the PNG sheet.
"""
import math
from pathlib import Path

import bpy

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "data" / "blender-tiger" / "comparison-reference"
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
assert scene.get("tilefun_asset") == "blender-tiger-demo"
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
scene.render.resolution_x = scene.render.resolution_y = 128
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
# Original editable geometry includes the eyes; no pixel patches or palette pass.
for obj in scene.objects:
    if obj.name.startswith("Eye"):
        obj.hide_render = False
for direction, angle in (("down", 0), ("up", math.pi),
                         ("left", -math.pi / 2 + .3), ("right", math.pi / 2 - .3)):
    rig.rotation_euler.z = angle
    for frame in (1, 3, 5, 7):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        scene.render.filepath = str(OUT / f"{direction}-{frame:02}.png")
        bpy.ops.render.render(write_still=True)
print("Rendered original tiger geometry, camera, lighting and 3D eyes; source not saved")
