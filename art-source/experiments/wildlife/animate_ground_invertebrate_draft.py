"""Refit the sprite colors and movement of archived segmented or soft-bodied animals."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

import bpy


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("wildlife_build", HERE / "build.py")
wildlife_build = module_from_spec(spec)
sys.modules["wildlife_build"] = wildlife_build
spec.loader.exec_module(wildlife_build)
import arthropod
import insect
import serpentine
import softbody


# Colors follow the existing mesh's paint slots, including shell ridges,
# snake diamonds, spider dorsal marks, and dark eyes.
PROFILES = {
    "king-cobra": (serpentine, "slither", "151d19 35392b 62663f 929367 bfb77a 151d19"),
    "gaboon-viper": (serpentine, "slither", "171c18 514238 bba475 d1bd8e d6c8a4 171c18"),
    "snail": (softbody, "crawl", "171c18 514238 bba475 d1bd8e d1bd8e 9b5154"),
    "millipede": (serpentine, "walk", "151b17 443a32 675844 918058 918058 151b17"),
    "worm": (serpentine, "crawl", "514238 9b5154 a98170 d1a98c d1a98c 514238"),
    "centipede": (serpentine, "walk", "262621 623e31 9d4f36 bf7853 d2ad7c 1e211d"),
    "praying-mantis": (insect, "walk", "232b26 344e35 648452 9da766 687a51 bbc69a 232b26 a9b784"),
    "scorpion": (arthropod, "walk", "252622 544437 84654a ae8a5b cfab7c 252622"),
    "spider": (arthropod, "walk", "242324 4d3d36 71604f 9a8064 b4a184 242324"),
}
HUNTERS = {"gaboon-viper", "centipede", "praying-mantis", "scorpion", "spider"}


def paint(mesh, colors):
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    pixels = list(atlas.pixels)
    for i, swatch in enumerate(colors.split()):
        rgb = [int(swatch[c:c + 2], 16) / 255 for c in (0, 2, 4)]
        pixels[i * 8:i * 8 + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    module, travel, colors = PROFILES[species]
    module.configure(species)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    paint(mesh, colors)
    durations = {"idle": 48, travel: module.DURATIONS[travel]}
    if species in HUNTERS:
        durations.update(feed=25, display=31, chase=17)
    else:
        durations.update(action=25, flee=18)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    wildlife_build.key_actions(rig, durations, module.pose)
    scene = bpy.context.scene
    scene.render.fps = wildlife_build.FPS
    scene.frame_start, scene.frame_end = 1, durations["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(durations)
    scene["Animation reference"] = f"Tilefun {species} active sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
