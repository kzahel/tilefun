"""Build the bulldozer's editable source, UV palette and game-sized GLB."""
import argparse
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not any((out / file).exists() for file in ("model.glb", "bulldozer.blend", "atlas.png"))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0

PALETTE = json.loads(Path(__file__).with_name("family.json").read_text())["palette"]
ATLAS_WIDTH = 8 * len(PALETTE)
atlas = bpy.data.images.new("Bulldozer palette", width=ATLAS_WIDTH, height=8, alpha=True)
row = [channel for rgb in PALETTE.values() for _ in range(8) for channel in (*[c / 255 for c in rgb], 1)]
atlas.pixels[:] = row * 8
atlas.filepath_raw = str(out / "atlas.png")
atlas.file_format = "PNG"
atlas.save()
atlas.pack()
atlas.filepath_raw = "//atlas.png"
swatch = {key: ((index + 0.5) / len(PALETTE), 0.5) for index, key in enumerate(PALETTE)}

mat = bpy.data.materials.new("Bulldozer painted metal / nearest")
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


box("Belly pan", (-31, 40), (-13, 13), (6, 17), panel("tread", "pad", "ink"))
box("Rear counterweight", (27, 43), (-17.75, 17.75), (12.5, 23), panel("goldShade"))
box("Rear bumper", (40, 44), (-18, 18), (9, 13), "ink")
box("Side deck", (-30, 37), (-20, 20), (15.5, 18.875), panel("gold"))
section("Tapered engine hood", [(-34, 18), (1, 18), (1, 29), (-26, 29), (-34, 25)],
        -13, 13, panel("gold"))
box("Recessed radiator", (-34.4, -34), (-10, 10), (18.3, 24.9), "ink")
for z in (19.1, 20.8, 22.5, 24.2):
    box("Radiator slat", (-34.6, -34.4), (-8, 8), (z, z + 0.55), "steel")
for side in (-1, 1):
    y = sorted((13 * side, 13.32 * side))
    box("Hood stripe", (-29, -2), y, (21, 22.6), "goldDark")
    for x in (-27, -24, -21, -18, -15):
        box("Engine vent", (x, x + 1.25), y, (23.5, 26.5), "ink")
    for i in range(2):
        box("Cab steps", (8, 15), sorted(((19 + 2 * i) * side, (22 + 2 * i) * side)),
            (12 - 3 * i, 13 - 3 * i), "steel")
    box("Rear tail lamp", (43, 43.6), sorted((11 * side, 16 * side)), (18.5, 21.5), "red")
    box("Front work light", (-34.8, -34.4), sorted((10.2 * side, 12.9 * side)),
        (22.5, 25.2), "cream")

section("Cab base", [(0, 18), (31, 18), (31, 28), (1, 28)], -14, 14, panel("gold"))
section("Cab window frame", [(1, 27), (31, 27), (29, 42), (5, 42)], -13.75, 13.75, "ink")
for side in (-1, 1):
    y = sorted((13.75 * side, 14.02 * side))
    section("Door glass", [(3.7, 28.8), (19.5, 28.8), (19.5, 40), (6, 40)],
            *y, "glass")
    box("Rear quarter glass", (21, 28), y, (28.8, 40), "glassDark")
    box("Side window reflection", (7, 18.8), sorted((14.02 * side, 14.08 * side)),
        (36.4, 38.1), "glassLight")
    box("Cab door handle", (16, 19.5), sorted((14 * side, 14.25 * side)), (26, 26.9), "ink")


def end_glass(name, x_at_z, y, low, high, color, facing):
    points = [(x_at_z(z), sy, z) for sy, z in [(-y, low), (y, low), (y, high), (-y, high)]]
    mesh(name, points, [(0, 1, 2, 3) if facing > 0 else (3, 2, 1, 0)], color)


end_glass("Windshield", lambda z: 1 + (z - 27) * 4 / 15 - 0.12, 11.7, 29, 40, "glass", -1)
end_glass("Windshield reflection", lambda z: 1 + (z - 27) * 4 / 15 - 0.16,
          11.1, 36.4, 38.1, "glassLight", -1)
end_glass("Rear window", lambda z: 31 - (z - 27) * 2 / 15 + 0.12, 10.9, 29, 40, "glassDark", 1)
box("Roof cap", (2.5, 32), (-15.6, 15.6), (41.4, 44), panel("goldShade"))
box("Roof gutter", (2, 32.5), (-15.8, 15.8), (40.7, 41.4), "goldDark")
tube("Exhaust", (-11, 10, 28), (-11, 10, 39.6), 1.45, "tread", 8)
tube("Exhaust cap", (-11, 10, 39.5), (-11, 10, 40.2), 1.9, "ink", 8)

# Two continuous tread rails on each side frame four exposed, rolling road wheels.
outer = [(-34, 4), (-28, 0), (29, 0), (36, 5), (36, 11), (29, 16), (-27, 16), (-34, 11)]
inner = [(-30, 5.5), (-26, 2.8), (27, 2.8), (32.8, 6), (32.8, 10), (27, 13), (-25, 13), (-30, 10)]
for side in (-1, 1):
    for band in ((16.2, 18.1), (22.35, 25.4)):
        left, right = sorted(v * side for v in band)
        for i in range(len(outer)):
            j = (i + 1) % len(outer)
            section("Tread rail", [outer[i], outer[j], inner[j], inner[i]], left, right,
                    panel("tread", "pad", "ink"))
    for x in range(-25, 31, 5):
        shoe = (x - 0.8, x + 0.8)
        box("Upper tread shoe", shoe, sorted((16.2 * side, 26 * side)), (16, 16.8), "pad")
        bottom_bands = ((16.2, 26),) if abs(x) <= 10 else ((16.2, 18.1), (22.35, 26))
        for band in bottom_bands:
            box("Lower tread shoe", shoe, sorted(v * side for v in band), (0, 0.8), "pad")
    for x in (-31, -28, 31, 34):
        box("Tread corner rib", (x - 0.85, x + 0.85), sorted((24.9 * side, 26 * side)),
            (5.3, 10.5), "pad")
    box("Track carrier", (-25, 26), sorted((14 * side, 17.6 * side)), (4, 12), "tread")
    for x in (-8, 8):
        tube("Idler hub", (x, 18.2 * side, 7), (x, 22.2 * side, 7), 4, "pad")

# Curved moldboard with four height bands, a worn cutting edge and braced push arms.
section("Moldboard", [(-49, 3), (-46, 3), (-41, 7), (-39, 12), (-40, 19), (-43, 23),
                      (-46, 23), (-44, 18), (-43, 12), (-45, 7)], -29.5, 29.5,
        lambda n, c: "goldLight" if n.z > 0.5 else "goldShade" if c.z < 10 else "gold")
box("Cutting edge", (-49.5, -46.125), (-32, 32), (2, 4.6), panel("steel", "chrome", "ink"))
box("Top blade lip", (-46.5, -42.5), (-30, 30), (22.2, 24), panel("goldShade"))
for side in (-1, 1):
    y = sorted((29 * side, 32 * side))
    section("Blade cheek", [(-49.5, 4.4), (-41, 4.4), (-37, 9), (-39, 18), (-44, 22)],
            *y, panel("goldShade"))
    y = sorted((25 * side, 28 * side))
    section("Push arm", [(-43, 7.2), (8, 10), (8, 13.6), (-24, 12), (-43, 10.7)],
            *y, panel("goldShade"))
    tube("Hydraulic cylinder", (-12, side * 15, 25), (-29, side * 23.8, 16.9), 2.15, "goldShade")
    tube("Hydraulic piston", (-28.5, side * 23.5, 17), (-41, side * 26.5, 11), 1.15, "chrome")
    tube("Push arm pin", (6, side * 27.9, 12), (6, side * 28.7, 12), 2, "goldLight")
for y in range(-27, 28, 9):
    box("Cutting edge fastener", (-49.8, -49.45), (y - 0.7, y + 0.7), (3.15, 4.15), "ink")

root = empty("Bulldozer_Root")
body_parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for part in body_parts:
    part.parent = root

for x, axle in ((-22, "F"), (23, "R")):
    for y, side in ((20.2, "L"), (-20.2, "R")):
        sign = 1 if y > 0 else -1
        wheel = axle + side
        center = (x, y, 6)
        steer = empty(f"Wheel_{wheel}_Steer", root)
        steer.location = center
        roll = empty(f"Wheel_{wheel}_Roll", steer)
        roll["wheel_radius"] = 6.0
        roll["roll_axis_gltf"] = [0, 0, -1]
        parts = [
            tube(f"Road wheel {wheel}", (x, y - 1.45, 6), (x, y + 1.45, 6), 6, "rubber"),
            tube(f"Wheel rim {wheel}", (x, y + 1.45 * sign, 6), (x, y + 1.72 * sign, 6), 4.8, "goldShade"),
            tube(f"Axle cap {wheel}", (x, y + 1.72 * sign, 6), (x, y + 1.94 * sign, 6), 2.3, "goldLight", 8),
            tube(f"Rim mark {wheel}", (x, y + 1.72 * sign, 9.5), (x, y + 1.84 * sign, 9.5), 0.65, "cream", 8),
        ]
        # Joining keeps the first part's transform; the roll pivot remains at the hub.
        obj = combine(f"Road_wheel_{wheel}", parts)
        obj.parent = roll
        obj.location = (0, 0, 0)

bpy.ops.wm.save_as_mainfile(filepath=str(out / "bulldozer.blend"))
combine("Bulldozer_body", body_parts)
bpy.ops.export_scene.gltf(filepath=str(out / "model.glb"), export_extras=True)
