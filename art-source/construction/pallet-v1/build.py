"""Author a 24 × 17 × 12 world-pixel pallet with its origin under the load."""
import argparse
from pathlib import Path
import sys

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1:]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not any((out / name).exists() for name in ("pallet.blend", "pallet.glb"))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0


def unlit(name, rgb):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*rgb, 1)
    output = nodes.new("ShaderNodeOutputMaterial")
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material


wood = unlit("Honey wood face", (0.54, 0.29, 0.111))
endgrain = unlit("Amber end grain", (0.39, 0.163, 0.059))
top = unlit("Light hand-planed timber", (0.78, 0.48, 0.213))
skid = unlit("Dark skid and frame", (0.255, 0.117, 0.049))
band = unlit("Cargo straps", (0.111, 0.107, 0.082))
eye = unlit("Lift eye", (0.26, 0.29, 0.3))


def box(name, x, y, z, sides):
    cx, cy, cz = ((a + b) / 2 for a, b in (x, y, z))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    part = bpy.context.object
    part.name = name
    part.dimensions = (x[1] - x[0], y[1] - y[0], z[1] - z[0])
    for material in dict.fromkeys(sides):
        part.data.materials.append(material)
    for face in part.data.polygons:
        face.material_index = part.data.materials.find(
            sides[0 if face.normal.z > 0.5 else 1 if abs(face.normal.x) > 0.5 else 2].name
        )
    return part


for y in (-6.6, 0, 6.6):
    box("Pallet runner", (-12, 12), (y - 1.55, y + 1.55), (0, 1.8), (wood, skid, skid))
for x in (-9.8, -4.9, 0, 4.9, 9.8):
    box("Pallet top slat", (x - 2.2, x + 2.2), (-8.5, 8.5), (1.8, 2.7), (top, endgrain, wood))

box("Plywood load", (-10.35, 10.35), (-7.4, 7.4), (2.7, 10.5), (top, endgrain, wood))
for x in (-10.42, 10.42):
    for y in (-6.3, 6.3):
        box("Corner frame", (x - 0.42, x + 0.42), (y - 0.75, y + 0.75), (2.7, 10.7), (top, wood, skid))
for y in (-7.48, 7.48):
    for z in (3.5, 6.05, 8.55):
        box("Board seam", (-10.31, 10.31), (y - 0.08, y + 0.08), (z, z + 0.25), (skid, skid, skid))

for x in (-5.9, 5.9):
    for y in (-7.63, 7.63):
        box("Vertical strap", (x - 0.65, x + 0.65), (y - 0.10, y + 0.10), (2.35, 10.65), (band, band, band))
    box("Top strap", (x - 0.65, x + 0.65), (-7.7, 7.7), (10.5, 10.65), (band, band, band))
for x in (-1.35, 1.35):
    box("Lift-eye foot", (x - 0.28, x + 0.28), (-0.5, 0.5), (10.5, 12), (eye, eye, eye))
box("Lift eye", (-1.62, 1.62), (-0.45, 0.45), (11.5, 12), (eye, eye, eye))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.wm.save_as_mainfile(filepath=str(out / "pallet.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(out / "pallet.glb"),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
)
