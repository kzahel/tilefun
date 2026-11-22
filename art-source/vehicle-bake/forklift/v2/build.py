"""Split the retained forklift master into a tilt mast and a sliding carriage without reauthoring its UVs."""
import argparse
import json
from pathlib import Path
import sys

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1:]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not any((out / name).exists() for name in ("forklift.blend", "model.glb"))
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


root = pivot("Forklift_Root_forward_minus_X", (0, 0, 0))
mast = pivot("Forklift_Mast", (-1.01, 0, 0.15), root)
inner = pivot("Forklift_InnerMast", (0, 0, 0), mast)
carriage = pivot("Forklift_Carriage", (0, 0, 0), mast)


def pick(prefixes):
    return [parts.pop(name) for name in list(parts) if name.startswith(prefixes)]


# Tine tips and heels keep the authored steel UVs. Narrow the spacing
# to the two channels beneath both sizes of the yard's wooden skids.
scale = recipe["exportWorldScale"]
for side in (-1, 1):
    for prefix in ("STATIC actual low narrow forward fork blade ", "STATIC fork vertical heel "):
        part = parts[prefix + str(side)]
        transform = part.matrix_world
        inverse = transform.inverted()
        is_blade = "blade" in prefix
        for vertex in part.data.vertices:
            point = transform @ vertex.co
            point.y = side * 3.15 / scale + (point.y - side * 0.32) * 0.76
            if is_blade:
                point.z = 0.35 / scale + (point.z - 0.1) * (0.82 / (0.08 * scale))
            elif point.z < 0.15:
                point.z = 0.58 / scale
            vertex.co = inverse @ point

join("FixedMast_Paint", pick(("STATIC tall twin mast rail", "STATIC mast crossbar")), mast)
join("InnerRails_Paint", pick(("STATIC mast gray inner runner",)), inner)
join(
    "Carriage_Paint",
    pick(("STATIC low fork carriage", "STATIC fork vertical heel", "STATIC actual low narrow forward fork blade")),
    carriage,
)
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
bpy.ops.wm.save_as_mainfile(filepath=str(out / "forklift.blend"))
