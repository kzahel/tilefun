"""Small Blender fixtures for verifying occlusion and overlapping UVs."""
from pathlib import Path
import sys

import bpy

out = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
target = bpy.data.materials.new("Projection target")
target.use_nodes = True
occluder = bpy.data.materials.new("Occluder")


def plane(name, radius, z, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-radius, -radius, z), (radius, -radius, z),
                      (radius, radius, z), (-radius, radius, z)], [], [[0, 1, 2, 3]])
    mesh.materials.append(material)
    uv = mesh.uv_layers.new()
    for loop, value in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = value
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


plane("Observed plane", 4, 0, target)
cover = plane("Cover", 20, 5, occluder)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "occluded.blend"))
cover.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=str(out / "visible.blend"))
plane("Second UV owner", 4, 2, target)
bpy.ops.wm.save_as_mainfile(filepath=str(out / "overlap.blend"))
