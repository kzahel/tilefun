"""Split the retained crane master into working hinges without reauthoring its UVs."""
import argparse
import json
from pathlib import Path
import sys

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1:]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not any((out / name).exists() for name in ("crane.blend", "model.glb"))
source = Path(__file__).resolve().parents[1] / "v1"
recipe = json.loads((source / "recipe.json").read_text())
bpy.ops.wm.open_mainfile(filepath=str(source / "master.blend"))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
parts = {part["name"]: bpy.data.objects[part["name"]] for part in recipe["components"]}


def pivot(name, location, parent=None):
    node = bpy.data.objects.new(name, None)
    scene.collection.objects.link(node)
    node.parent = parent
    node.location = location
    bpy.context.view_layer.update()
    return node


def join(name, objects, parent):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    node = bpy.context.object
    node.name = name
    rest = node.matrix_world.copy()
    node.parent = parent
    node.matrix_world = rest
    mod = node.modifiers.new("Runtime triangles", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return node


root = pivot("MobileCrane_Root_forward_minus_X", (0, 0, 0))
slew = pivot("Crane_Slew", (2.1, 0.35, 1.22), root)
boom = pivot("Crane_Boom", (0, 0, 0.78), slew)
middle = pivot("Crane_Middle", (0, 0, 0), boom)
tip = pivot("Crane_Tip", (0, 0, 0), middle)
hook = pivot("Crane_Hook", (-3.68, 0.35, 2.29), root)
rigs = {
    "Fixed stowed crane turntable": slew,
    "Fixed low boom pedestal": slew,
    "Rigid stowed boom section 0": boom,
    "Rigid stowed boom section 1": middle,
    "Rigid stowed boom section 2": tip,
    "Fixed gray boom tip shoe": tip,
    "Fixed readable gray J hook": hook,
}
# Nest the inner members along a common beam axis and extend their hidden ends
# so both sleeves still overlap at the maximum work extension.
for name, drop, extra in (
    ("Rigid stowed boom section 1", 0.29, 1.15),
    ("Rigid stowed boom section 2", 0.58, 1.15),
    ("Fixed gray boom tip shoe", 0.58, 0),
):
    part = parts[name]
    end = min(vertex.co.x for vertex in part.data.vertices)
    for vertex in part.data.vertices:
        vertex.co.z -= drop
        if vertex.co.x > end + 0.1:
            vertex.co.x += extra
cable = parts.pop("Fixed short stowed hook cable")
bpy.data.objects.remove(cable, do_unlink=True)
for node in (slew, boom, middle, tip, hook):
    join(node.name + "_Paint", [parts.pop(name) for name in rigs if rigs[name] is node], node)
body = [parts[p["name"]] for p in recipe["components"] if p["name"] in parts and p["group"] == "body"]
join("Body_static", body, root)

for wheel in recipe["wheels"]:
    label = wheel["id"]
    steer = pivot(f"Wheel_{label}_Steer", wheel["centerBlender"], root)
    steer["steering_enabled"] = label.startswith("F")
    steer["steer_axis_gltf"] = [0, 1, 0]
    roll = pivot(f"Wheel_{label}_Roll", (0, 0, 0), steer)
    roll["wheel_radius"] = wheel["wheel_radius"]
    roll["roll_axis_gltf"] = [0, 0, -1]
    join(
        f"Wheel_{label}_tire_hub",
        [parts[p["name"]] for p in recipe["components"] if p["group"] == label],
        roll,
    )

root.scale = (recipe["exportWorldScale"],) * 3
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for node in root.children_recursive:
    node.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(out / "model.glb"), export_format="GLB", use_selection=True,
    export_extras=True, export_yup=True, export_materials="EXPORT",
)
root.scale = (1, 1, 1)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "crane.blend"))
