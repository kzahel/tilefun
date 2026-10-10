"""Render actual rigid wheel rotation; the body and camera remain fixed.

Blender --background evaluated.blend --python this.py -- NEW_OUTPUT rig.json
Frames are an isolated mechanical preview, not a driven gameplay simulation.
"""
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

out, rig_path = map(Path, sys.argv[sys.argv.index("--")+1:])
out, rig_path = out.resolve(), rig_path.resolve()
out.mkdir(parents=True, exist_ok=False)
rig = json.loads(rig_path.read_text())
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 256
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.camera.data.type = "ORTHO"
scene.camera.data.ortho_scale = 80
target = Vector((0, 0, 10))
scene.camera.location = Vector((-65, -85, 65))
scene.camera.rotation_euler = (target-scene.camera.location).to_track_quat("-Z", "Y").to_euler()
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
body = bpy.data.objects[rig["body"]]
bpy.context.view_layer.update()
fixed = {o.name: [list(o.matrix_world @ v.co) for v in o.data.vertices] for o in body.children if o.type == "MESH"}
centers = {w["roll"]: list(bpy.data.objects[w["roll"]].matrix_world.translation) for w in rig["wheels"]}
for frame in range(24):
    angle = -frame*math.tau/24
    for wheel in rig["wheels"]:
        bpy.data.objects[wheel["roll"]].rotation_euler.y = angle
    bpy.context.view_layer.update()
    assert all([list(o.matrix_world @ v.co) for v in o.data.vertices] == fixed[o.name] for o in body.children if o.type == "MESH")
    assert all(list(bpy.data.objects[name].matrix_world.translation) == center for name, center in centers.items())
    scene.render.filepath = str(out/f"frame-{frame:02}.png")
    bpy.ops.render.render(write_still=True)
(out/"animation.json").write_text(json.dumps({"frames": 24, "bodyFixed": True, "centersFixed": True,
    "pose": "All four wheels rotate one revolution at fixed car/camera position", "spinAxisBlender": [0, 1, 0],
    "drivingRule": "angle=-signedForwardDistance/radius; signedForwardDistance positive along -X", "radius": 4.1,
    "note": "Stationary mechanical proof. Steering clearance and gameplay drive integration remain unqualified."}, indent=2)+"\n")
