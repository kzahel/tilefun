"""Make a narrower, taller crate from the retained wooden pallet source."""
import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Matrix

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
out = parser.parse_args(sys.argv[sys.argv.index("--") + 1:]).output.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not any((out / name).exists() for name in ("crate.blend", "crate.glb"))
source = Path(__file__).resolve().parents[1] / "pallet-v1" / "pallet.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0

# Keep the origin under the load and match its 19 × 15 × 18 collision box.
scale = Matrix.Diagonal((19 / 24, 15 / 17, 18 / 12, 1))
for part in bpy.context.scene.objects:
    part.matrix_world = scale @ part.matrix_world
bpy.context.view_layer.update()

bpy.ops.wm.save_as_mainfile(filepath=str(out / "crate.blend"))
bpy.ops.export_scene.gltf(filepath=str(out / "crate.glb"), export_format="GLB", export_yup=True)
