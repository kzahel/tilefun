"""Build the playground's editable art and game meshes from the collider layout."""
import argparse
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1:]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parents[3]
geometry = json.loads((root / "src/entities/PhysicsPlaygroundGeometry.json").read_text())
colors = {
    "track": "#437A83", "frame": "#234753", "rail": "#E9AB3E",
    "exit": "#52927E", "exitRail": "#89BC8E", "deck": "#3C6875",
    "dark": "#263B45", "line": "#E8E7C4", "steel": "#4B5E71",
    "steelLight": "#BAC8C7", "steelBlue": "#459CA2",
}

def material(name, shade=1):
    key = f"{name} {shade:.2f}"
    old = bpy.data.materials.get(key)
    if old:
        return old
    result = bpy.data.materials.new(key)
    rgb = bytes.fromhex(colors[name][1:])
    result.diffuse_color = tuple(shade * ((v / 255 + 0.055) / 1.055) ** 2.4 for v in rgb) + (1,)
    result.use_nodes = True
    nodes = result.node_tree.nodes
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = result.diffuse_color
    output = nodes.new("ShaderNodeOutputMaterial")
    result.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return result

def prism(name, x, y, bottom, top, paint):
    # The shared cargo loader turns Blender's XY plane by 180 degrees.
    verts = [(-x[i], -side, heights[i]) for heights in (bottom, top) for i in (0, 1) for side in y]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for face, shade in zip(mesh.polygons, (0.46, 1, 0.78, 0.65, 0.63, 0.82), strict=True):
        face.material_index = len(mesh.materials)
        mesh.materials.append(material(paint, shade))
    part = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(part)
    return part

def flat(name, x, y, height, paint):
    return prism(name, x, y, [height - 0.05] * 2, [height] * 2, paint)

def export(name):
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f"{name}.blend"))
    bpy.ops.export_scene.gltf(filepath=str(out / f"{name}.glb"), export_format="GLB", export_yup=True)

for key, spec in geometry.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    name = key.removeprefix("construction-")
    bpy.context.scene.name = name
    for piece in spec["pieces"]:
        prism(piece["paint"].title(), **piece)
    if name == "seesaw":
        for y in (-18.5, 18.5):
            flat("Lane edge", [-65, 65], [y - 0.55, y + 0.55], 4.06, "line")
        for x in (-54, -38, -22, -6, 10, 26, 42, 58):
            flat("Lane dash", [x, x + 7], [-0.5, 0.5], 4.06, "line")
        for x in (-62, 62):
            flat("Threshold", [x - 1, x + 1], [-18, 18], 4.07, "rail")
        for y in (-21.01, 21.01):
            prism("Deck reinforcement", [-61, 61], [y - 0.05, y + 0.05],
                  [1.4, 1.4], [2.0, 2.0], "frame")
    elif name in ("marble-track", "marble-chute"):
        for piece in spec["pieces"]:
            if piece["paint"] not in ("track", "exit"):
                continue
            x0, x1 = piece["x"]
            z0, z1 = piece["top"]
            for side in (-1, 1):
                prism("Guide stripe", [x0, x1], [side * 11 - 0.46, side * 11 + 0.46],
                      [z0, z1], [z0 + 0.08, z1 + 0.08], "line")
        if name == "marble-chute":
            for x in (-17, -12, 12, 17):
                for side in (-1, 1):
                    flat("Lift marking", [x, x + 1.8], [side * 14.5 - 1.12, side * 14.5 + 1.12],
                         12.56, "line")
    export(name)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=8, location=(0, 0, 8))
ball = bpy.context.object
ball.name = "Steel marble"
axis = Vector((0.4, 1, 0.78)).normalized()
light = Vector((0.15, 0.45, 1)).normalized()
for polygon in ball.data.polygons:
    tilt = abs(polygon.center.dot(axis)) / 8
    paint = "steelBlue" if tilt < 0.19 else "steelLight" if tilt < 0.34 else "steel"
    shade = 0.55 + round(max(0, polygon.normal.dot(light)) * 5) * 0.14
    surface = material(paint, shade)
    if ball.data.materials.find(surface.name) < 0:
        ball.data.materials.append(surface)
    polygon.material_index = ball.data.materials.find(surface.name)
    polygon.use_smooth = True
export("wrecking-ball")
