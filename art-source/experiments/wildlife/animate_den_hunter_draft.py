"""Finish pursuit and sleep actions on the archived den hunters."""
from functools import partial
from importlib.util import module_from_spec, spec_from_file_location
import math
from pathlib import Path
import sys

import bpy


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("wildlife_build", HERE / "build.py")
wildlife_build = module_from_spec(spec)
sys.modules["wildlife_build"] = wildlife_build
spec.loader.exec_module(wildlife_build)
import arthropod
import fabled


COLORS = {
    "griffin": "282633 665044 a37a4e cfaa6b e8e4cf d6a34b 665044",
    "small-dragon": "202b30 284f4c 428569 7cb88b f4ead0 875073 e0a955",
    "t-rex": "202a24 384a35 688852 9ab774 f4ead0 8e703f efa946",
    "giant-spider": "211e30 383149 62506d 9d7e9e b55e70 e8b557",
}
FLIERS = {"griffin", "small-dragon"}


def repaint(mesh, species):
    palette = COLORS[species].split()
    first = 50
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    pixels = list(atlas.pixels)
    for i, value in enumerate(palette):
        index = (first + i * 2) * 4
        rgb = [int(value[c:c + 2], 16) / 255 for c in (0, 2, 4)]
        pixels[index:index + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}
    uvs = mesh.data.uv_layers.active.data
    for face in mesh.data.polygons:
        p = face.center
        vertex = mesh.data.vertices[face.vertices[0]]
        part = next((parts[g.group] for g in vertex.groups if g.group in parts), "")
        upper = face.normal.z
        shade = None
        if species == "giant-spider":
            if part.startswith("Leg"):
                shade = 0 if upper < .67 else 1
            elif p.y < -.19 and p.z > .53:
                shade = 4 if abs(p.x) < .12 and -.62 < p.y < -.29 else 2
            elif p.y > .43:
                shade = 5 if p.y > .59 and p.z > .47 else 2
        elif species == "small-dragon":
            if part.startswith("Flight surface"):
                spar = abs(math.sin(abs(p.x) * 12 + p.y * 8))
                shade = 6 if spar < .23 else 5
            else:
                shade = 3 if upper > .51 else 1 if upper < -.26 else 2
                if abs(p.x) < .15 and p.y > fabled.HEAD.y and p.z > fabled.HEAD.z + .17:
                    shade = 6
        elif species == "griffin":
            shade = 3 if upper > .38 else 2
            if part.startswith("Flight surface"):
                shade = 1 if abs(p.x) > .96 and math.cos(p.y * 18) > .15 else 3 if upper > .01 else 2
            elif part.startswith("Articulated neck"):
                shade = 5 if p.y > fabled.HEAD.y + .26 else 4
            elif part.startswith("front."):
                shade = 5 if p.z < .46 else 3
            elif part == "Tapered tail" and p.y < -fabled.DIMS[1] * 1.17:
                shade = 1
        elif species == "t-rex":
            shade = 3 if upper > .48 else 1 if upper < -.10 else 2
            if part.startswith("Articulated neck") and p.y > 1.2:
                shade = 4 if abs(p.x) < .38 and p.z < fabled.JAW.z else shade
        if shade is not None:
            index = first + 2 * shade
            uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
            for loop in face.loop_indices:
                uvs[loop].uv = uv


def pose(module, rig, rest, clip, t):
    return module.pose(rig, rest, "fly" if clip == "flight" else clip, t)


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    module = arthropod if species == "giant-spider" else fabled
    module.configure(species)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    repaint(mesh, species)
    durations = {name: module.DURATIONS[name] for name in ("idle", "walk", "feed", "display", "sleep")}
    expected = set(durations)
    if species in FLIERS:
        expected.add("fly")
        durations["flight"] = module.DURATIONS["fly"]
    assert set(bpy.data.actions.keys()) == expected
    durations["chase"] = 18
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    wildlife_build.key_actions(rig, durations, partial(pose, module))
    scene = bpy.context.scene
    scene.render.fps = wildlife_build.FPS
    scene.frame_start, scene.frame_end = 1, durations["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(durations)
    scene["Animation reference"] = f"Tilefun {species} fierce-v1 sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
