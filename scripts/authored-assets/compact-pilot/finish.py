"""Load saved authored source, bind external atlas, export and render actual views."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
# A fresh offline workspace; generated files never live beside this source code.
import os
WORKSPACE = Path(os.environ.get("TILEFUN_COMPACT_PILOT", ROOT / "data/authored-assets/compact-pilot")).resolve()
HERE = WORKSPACE / "source"
OUT = WORKSPACE / "render"
scene = bpy.context.scene
mat = bpy.data.materials["Sprite palette · cleaned UV atlas"]
nodes = mat.node_tree.nodes
tex = nodes.new("ShaderNodeTexImage")
tex.name = "Clean atlas"
tex.image = bpy.data.images.load(str(OUT / "car-atlas.png"), check_existing=True)
tex.interpolation = "Closest"
bsdf = nodes.get("Principled BSDF")
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
draft = nodes.new("ShaderNodeTexImage")
draft.name = "Draft projection · reference only"
draft.image = bpy.data.images.load(str(OUT / "projected-atlas.png"), check_existing=True)
draft.interpolation = "Closest"
tex.image.pack()
draft.image.pack()

bpy.ops.object.select_all(action="DESELECT")
meshes = [o for o in scene.objects if o.type == "MESH"]
for obj in meshes:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "car.glb"), export_format="GLB", use_selection=True,
                          export_yup=True, export_materials="EXPORT", export_cameras=False,
                          export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "car.blend"))


def camera(azimuth, elevation, scale=76):
    a, e = math.radians(azimuth), math.radians(elevation)
    target = Vector((0, 0, 9))
    scene.camera.location = target + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * 110
    scene.camera.rotation_euler = (target - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera.data.ortho_scale = scale


def render(name):
    scene.render.filepath = str(OUT / (name + ".png"))
    bpy.ops.render.render(write_still=True)


for name, a, e in [("front", 180, 0), ("rear", 0, 0), ("side-left", -90, 0),
                    ("side-right", 90, 0), ("top", -90, 90), ("oblique", -135, 35),
                    ("source-east", -90, 45), ("source-west", 90, 45),
                    ("source-north", 0, 55), ("source-south", 180, 55)]:
    camera(a, e)
    render(name)

# Preserve a true mesh-rendered projected draft for comparison with clean paint.
camera(-135, 35)
mat.node_tree.links.new(draft.outputs["Color"], bsdf.inputs["Base Color"])
render("draft-oblique")
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

# Geometry-only evidence, with texture disconnected.
link = bsdf.inputs["Base Color"].links[0]
mat.node_tree.links.remove(link)
bsdf.inputs["Base Color"].default_value = (.38, .44, .52, 1)
render("clay-oblique")
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

scene.cycles.samples = 64
scene.render.resolution_x = 256
scene.render.resolution_y = 256
for k in range(24):
    camera(-135 + k * 15, 35)
    render(f"orbit-{k:02d}")

camera(-135, 35)
scene.render.resolution_x = 384
scene.render.resolution_y = 384
scene.cycles.samples = 128
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "car.blend"))
print("Saved textured Blender source, portable GLB and 36 actual mesh renders", flush=True)
