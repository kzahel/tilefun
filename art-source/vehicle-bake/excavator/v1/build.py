"""Build the excavator's editable source, UV palette and game-sized GLB."""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not any((out / file).exists() for file in ("model.glb", "excavator.blend", "atlas.png"))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0

PALETTE = json.loads(Path(__file__).with_name("family.json").read_text())["palette"]
ATLAS_WIDTH = 8 * len(PALETTE)
atlas = bpy.data.images.new("Excavator palette", width=ATLAS_WIDTH, height=8, alpha=True)
row = [channel for rgb in PALETTE.values() for _ in range(8) for channel in (*[c / 255 for c in rgb], 1)]
atlas.pixels[:] = row * 8
atlas.filepath_raw = str(out / "atlas.png")
atlas.file_format = "PNG"
atlas.save()
atlas.pack()
atlas.filepath_raw = "//atlas.png"
swatch = {key: ((index + 0.5) / len(PALETTE), 0.5) for index, key in enumerate(PALETTE)}

mat = bpy.data.materials.new("Excavator painted metal / nearest")
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
image = nodes.new("ShaderNodeTexImage")
image.image = atlas
image.interpolation = "Closest"
output = nodes.new("ShaderNodeOutputMaterial")
mat.node_tree.links.new(image.outputs["Color"], output.inputs["Surface"])


def paint(obj, color):
    obj.data.materials.append(mat)
    uv = obj.data.uv_layers.new(name="Paint")
    for face in obj.data.polygons:
        key = color(face.normal, face.center) if callable(color) else color
        for loop in face.loop_indices:
            uv.data[loop].uv = swatch[key]
    return obj


def mesh(name, vertices, faces, color):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return paint(obj, color)


def section(name, profile, left, right, color):
    """Extrude a counterclockwise perimeter in the X/Z plane along Y."""
    edges = zip(profile, profile[1:] + profile[:1])
    if sum(x * next_z - next_x * z for (x, z), (next_x, next_z) in edges) < 0:
        profile = list(reversed(profile))
    n = len(profile)
    faces = [tuple(range(n)), tuple(reversed(range(n, n * 2)))]
    faces += [(i, i + n, (i + 1) % n + n, (i + 1) % n) for i in range(n)]
    return mesh(name, [(x, y, z) for y in (left, right) for x, z in profile], faces, color)


def box(name, x, y, z, color):
    return section(name, [(x[0], z[0]), (x[1], z[0]), (x[1], z[1]), (x[0], z[1])], *y, color)


def panel(color, top="goldLight", underside="goldDark"):
    return lambda normal, center: (
        top if normal.z > 0.25 else underside if normal.z < -0.25 else color
    )


def tube(name, start, end, radius, color, sides=12):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=sides, radius=radius, depth=direction.length,
        location=(Vector(start) + Vector(end)) / 2,
        rotation=direction.to_track_quat("Z", "Y").to_euler(),
    )
    obj = bpy.context.object
    obj.name = name
    # Blender primitives begin with a UV map. The palette owns the active chart.
    obj.data.uv_layers.remove(obj.data.uv_layers.active)
    return paint(obj, color)


def combine(name, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


root = empty("Excavator_Root")
box("Track frame", (-31, 31), (-14, 14), (5, 16), panel("tread", "steel", "ink"))
outer = [(-35, 5), (-29, 0), (29, 0), (35, 5), (35, 12), (29, 16), (-29, 16), (-35, 12)]
inner = [(-31, 6), (-27, 3), (27, 3), (32, 6), (32, 11), (27, 13), (-27, 13), (-31, 11)]
for side in (-1, 1):
    for band in ((13.8, 16.2), (21.4, 25)):
        left, right = sorted(v * side for v in band)
        for i in range(len(outer)):
            j = (i + 1) % len(outer)
            section("Crawler rail", [outer[i], outer[j], inner[j], inner[i]], left, right,
                    panel("tread", "pad", "ink"))
    for x in range(-28, 29, 4):
        shoe = (x - 0.62, x + 0.62)
        box("Upper track pad", shoe, sorted((13.8 * side, 25.5 * side)), (16, 17), "pad")
        box("Lower track pad", shoe, sorted((21.4 * side, 25.5 * side)), (0, 0.8), "pad")
    for x in (-8, 8):
        tube("Idler", (x, 16.3 * side, 6), (x, 21.25 * side, 6), 4, "pad")
tube("Turntable", (0,0,15), (0,0,21), 13.6, "ink", 16)
base_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for part in base_parts:
    part.parent = root

for x, axle in ((-22, "F"), (22, "R")):
    for y, side in ((18.6, "L"), (-18.6, "R")):
        sign = 1 if y > 0 else -1
        wheel = axle + side
        steer = empty(f"Wheel_{wheel}_Steer", root)
        steer.location = (x, y, 6)
        roll = empty(f"Wheel_{wheel}_Roll", steer)
        roll["wheel_radius"] = 6.0
        roll["roll_axis_gltf"] = [0, 0, -1]
        obj = combine(f"Crawler_wheel_{wheel}", [
            tube("Road wheel", (x, y - 1.55, 6), (x, y + 1.55, 6), 6, "rubber"),
            tube("Hub", (x, y + 1.55*sign, 6), (x, y + 1.85*sign, 6), 4.5, "steel"),
            tube("Hub center", (x, y + 1.85*sign, 6), (x, y + 2.2*sign, 6), 2.4, "ink", 8),
            tube("Hub paint mark", (x, y + 1.85*sign, 9), (x, y + 2.0*sign, 9), 0.8, "cream", 8),
        ])
        obj.parent = roll
        obj.location = (0,0,0)


def group(name, parent, location, angle=0):
    node = empty(name, parent)
    node.location = location
    node.rotation_euler.y = math.radians(angle)
    return node


cab = group("Excavator_Slew", root, (0, 0, 0))
section("Counterweight", [(-11, 20), (22, 20), (29, 24), (29, 31), (23, 35), (-11, 35)],
        -19, 19, panel("gold"))
box("Slew deck", (-21, 25), (-19.3, 19.3), (19, 22.85), panel("goldShade"))
for x in range(7, 23, 3):
    for side in (-1, 1):
        box("Engine cooling slot", (x, x + 0.9), sorted((side*19, side*19.15)), (27, 32), "ink")
cab_profile = [(-22, 23), (4, 23), (4, 47), (-16, 47), (-22, 40)]
section("Operator cab", cab_profile, -17.75, -3.5, "ink")
box("Cab skirt", (-22, 4), (-18, -3.5), (23, 27), "goldShade")
section("Door glass", [(-20, 28), (-3, 28), (-3, 44), (-15, 44), (-20, 38)],
        -18.05, -17.75, "glass")
box("Side reflection", (-15,-4), (-18.22,-18.05), (40.25, 41.7), "glassLight")
box("Cab windshield", (-22.22, -22), (-16, -5), (28.2,39.1), "glass")
box("Rear cab glass", (4,4.18), (-16,-5), (30,43), "glassDark")
box("Cab roof", (-18,5.5), (-19,-2.5), (46,48.5), panel("goldShade"))
box("Handhold", (-5, -0.5), (-18.43,-18.15), (28,29), "steel")
box("Side step", (-11, -1), (-22, -17.5), (20,21), "steel")
tube("Amber beacon base",(0, -11,48.5),(0,-11,49.7),1.9,"ink",8)
tube("Amber beacon",(0,-11,49.7),(0,-11,51.5),1.5,"goldLight",8)
tube("Exhaust stack",(15,12,34),(15,12,41),1.4,"tread",8)
box("Boom mount",(-15,-6),(-3.7,12),(20,29),panel("goldShade"))
cab_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.parent]
for part in cab_parts:
    part.parent = cab

boom = group("Excavator_Boom", cab, (-10,0,24), 58)
section("Boom", [(-43,-2.8),(-43,2.7),(-24,4),(-8,3.7),(0,4.5),(3,0),
                 (0,-4.3),(-16,-5.2),(-30,-4.5)], -2.9, 2.9, panel("gold"))
tube("Boom ram body",(-4,0,-5),(-24,0,-7),1.8,"goldShade")
tube("Boom chrome rod",(-23,0,-7),(-39,0,-4),1.15,"chrome")
for x in (0,-43):
    tube("Boom joint cap",(x,-3.45,0),(x,3.45,0),2,"goldShade")
boom_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.parent]
for part in boom_parts:
    part.parent = boom

stick = group("Excavator_Stick", boom, (-43,0,0), -112)
section("Dipper stick", [(-32,-1.7),(-32,1.7),(-12,3.3),(0,3),(3,0),(0,-3.1),(-16,-3)],
        -2.05, 2.05, panel("gold"))
tube("Stick ram",(-1,0,4),(-17,0,5),1.4,"goldShade",10)
tube("Stick piston",(-16,0,5),(-30,0,3),0.85,"chrome",10)
for x in (0,-32):
    tube("Stick joint cap",(x,-2.7,0),(x,2.7,0),1.6,"steel",10)
stick_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.parent]
for part in stick_parts:
    part.parent = stick

bucket = group("Excavator_Bucket", stick, (-32,0,0), -35)
for side in (-1,1):
    section("Bucket cheek",[(-15,0),(-13,5),(-9,8),(-4,7),(0,3),(0,-1),(-6,-2)],
            *sorted((side*7.5,side*8.4)), panel("tread","steel","ink"))
section("Curved bucket back",[(-15,0),(-13,5),(-9,8),(-4,7),(0,3),(-1,2),
                               (-5,5.4),(-9,6.5),(-12,4.1),(-14,-0.2)],
        -7.5,7.5,panel("tread","steel","ink"))
for y in (-6,-2,2,6):
    box("Bucket tooth",(-16.4,-13.6),(y-0.7,y+0.7),(-0.8,0.5),"chrome")
bucket_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.parent]
for part in bucket_parts:
    part.parent = bucket

load = section("Excavator_Load",[(-13,0.9),(-10,4.7),(-7,5.7),(-3,3),(-3,1)],
               -6.2,6.2,panel("goldDark","goldShade","ink"))
load.parent = bucket
load["tilefun_role"] = "bucket_load"
bpy.ops.wm.save_as_mainfile(filepath=str(out / "excavator.blend"))
for name, parts in (
    ("Crawler chassis",base_parts), ("Slewing cab",cab_parts), ("Main boom",boom_parts),
    ("Dipper",stick_parts), ("Bucket shell",bucket_parts),
):
    combine(name,parts)
bpy.ops.export_scene.gltf(filepath=str(out / "model.glb"), export_extras=True)
