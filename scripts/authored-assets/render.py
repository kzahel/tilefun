"""Blender-side reusable renderer. Only the copied evaluation scene is modified."""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projection_math import raw_frame_size

OUT = Path(sys.argv[sys.argv.index("--") + 1])
recipe = json.loads((OUT / "recipe.json").read_text())
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
if not meshes:
    raise ValueError("The working file has no visible authored mesh.")
if recipe.get("atlasOverride"):
    atlas = recipe["atlasOverride"]
    path = Path(atlas["path"])
    if hashlib.sha256(path.read_bytes()).hexdigest() != atlas["sha256"]:
        raise ValueError("Atlas override changed before rendering.")
    settings = recipe["projection"]
    mat = bpy.data.materials[settings["material"]]
    tex = mat.node_tree.nodes[settings["textureNode"]]
    tex.image = bpy.data.images.load(str(path), check_existing=False)
    tex.image.pack()

# Preserve the actual atlas and all geometry. Flat emission removes new lighting
# from painted highlights. Unsupported node graphs fail instead of silently losing paint.
if recipe.get("appearance", "unlit") == "unlit":
    materials = {m for o in meshes for m in o.data.materials if m}
    for mat in materials:
        if not mat.use_nodes:
            raise ValueError(f"{mat.name}: use a node material with a Principled or Emission surface.")
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        output = next(n for n in nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output)
        surface = output.inputs["Surface"]
        if not surface.links:
            raise ValueError(f"{mat.name}: material has no surface shader.")
        shader = surface.links[0].from_node
        if shader.type == "EMISSION":
            continue
        if shader.type != "BSDF_PRINCIPLED":
            raise ValueError(f"{mat.name}: complex material needs an authored unlit version or appearance='lit'.")
        emission = nodes.new("ShaderNodeEmission")
        color = shader.inputs["Base Color"]
        if color.links:
            links.new(color.links[0].from_socket, emission.inputs["Color"])
        else:
            emission.inputs["Color"].default_value = color.default_value
        alpha = shader.inputs["Alpha"]
        if alpha.links or alpha.default_value < 1:
            mix = nodes.new("ShaderNodeMixShader")
            transparent = nodes.new("ShaderNodeBsdfTransparent")
            links.new(transparent.outputs[0], mix.inputs[1])
            links.new(emission.outputs[0], mix.inputs[2])
            if alpha.links:
                links.new(alpha.links[0].from_socket, mix.inputs[0])
            else:
                mix.inputs[0].default_value = alpha.default_value
            links.new(mix.outputs[0], surface)
        else:
            links.new(emission.outputs[0], surface)
        for node in nodes:
            if node.type == "TEX_IMAGE":
                node.interpolation = "Closest"

if not scene.camera:
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
scene.camera.data.type = "ORTHO"
scene.camera.data.sensor_fit = "HORIZONTAL"
scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
w, h = recipe["canvas"]
vertices = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
raw_w, raw_h = raw_frame_size(vertices, [v['camera'] for v in recipe['views']], (w, h))
scene.render.resolution_x, scene.render.resolution_y = raw_w*8, raw_h*8


def camera(azimuth, elevation, target, scale):
    a, e = map(math.radians, [azimuth, elevation])
    scene.camera.location = target + Vector((math.cos(a)*math.cos(e), math.sin(a)*math.cos(e), math.sin(e)))*500
    scene.camera.rotation_euler = (target-scene.camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera.data.ortho_scale = scale
    scene.camera.data.clip_end = 2000


def render(name):
    scene.render.filepath = str(OUT / (name + ".png"))
    bpy.ops.render.render(write_still=True)


for view in recipe["views"]:
    c = view["camera"]
    camera(c["azimuth"], c["elevation"], Vector((0, 0, 0)), raw_w)
    render(view["id"] + "-raw")

lower = Vector([min(v[k] for v in vertices) for k in range(3)])
upper = Vector([max(v[k] for v in vertices) for k in range(3)])
scene.render.resolution_x = scene.render.resolution_y = 256
for k in range(4):
    camera(-135 + k*90, 35, (lower+upper)/2, max(upper-lower)*1.4)
    render(f"orbit-{k}")

bpy.ops.object.select_all(action="DESELECT")
for obj in meshes:
    obj.select_set(True)
    for mat in obj.data.materials:
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image and not node.image.packed_file:
                    node.image.pack()
rig_nodes = [o for o in scene.objects if o.get("asset_rig_node")]
for obj in rig_nodes:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "asset.glb"), export_format="GLB", use_selection=True,
                         export_yup=True, export_materials="EXPORT", export_cameras=False, export_lights=False,
                         export_extras=bool(rig_nodes))
scene["review_status"] = "Offline authoring evaluation; unreviewed"
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "asset.blend"))
triangles = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
audit = {"blenderVersion": bpy.app.version_string, "meshObjects": len(meshes), "triangles": triangles,
         "rawFrame": [raw_w, raw_h],
         "bounds": [list(lower), list(upper)], "appearance": recipe.get("appearance", "unlit"),
         "meshSha256": hashlib.sha256(json.dumps([[o.name, [list(o.matrix_world @ v.co) for v in o.data.vertices]] for o in meshes]).encode()).hexdigest()}
(OUT / "audit.json").write_text(json.dumps(audit, indent=2)+"\n")
print("Source cameras, four novel angles and portable exports complete", flush=True)
