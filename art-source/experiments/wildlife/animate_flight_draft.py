"""Key the four common bird actions on the exact editable campaign draft.

Run in Blender with -- SPECIES ARCHIVED_BLEND OUTPUT_DIRECTORY.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

import bpy


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("wildlife_build", HERE / "build.py")
wildlife_build = module_from_spec(spec)
sys.modules["wildlife_build"] = wildlife_build
spec.loader.exec_module(wildlife_build)
import bird


def paint_sprite_markings(mesh, species):
    """Use the draft's packed palette on the surfaces seen at gameplay zoom."""
    parts = {group.index: group.name.removeprefix("Part · ") for group in mesh.vertex_groups
             if group.name.startswith("Part · ")}
    palette = tuple(bird.PALETTE)
    uvs = mesh.data.uv_layers.active.data

    def swatch(color):
        index = 2 * palette.index(color)
        return ((index % 8 + 1) / 8, (index // 8 + .5) / 8)

    for face in mesh.data.polygons:
        vertex = mesh.data.vertices[face.vertices[0]]
        part = next((parts[g.group] for g in vertex.groups if g.group in parts), "")
        point = face.center
        wing = part.startswith("Layered wing ")
        toes = part.startswith("Leg and toes ") and point.z < .13
        tail = part == "Tail feather fan"
        color = None
        if species == "sparrow":
            if part == "Sculpted bill":
                color = "ink"
            elif part == "Neck, face and eye patches" and point.z > bird.HEAD.z + .095:
                color = "mantle" if face.normal.z > .72 else "ink"
            elif part == "Neck, face and eye patches" and point.y > bird.HEAD.y + .045 and point.z < bird.HEAD.z - .07:
                color = "ink"
            elif wing and -.48 < point.y - bird.BODY.y < -.35 and face.normal.z > .10:
                color = "mask"
        elif species == "dove" and ((wing and face.normal.z < .33) or (tail and face.normal.z < -.12)):
            color = "feet"
        elif species == "pigeon":
            wing_depth = bird.BODY.y - point.y
            if wing and (.30 < wing_depth < .39 or .52 < wing_depth < .62):
                color = "ink"
            elif (wing or tail) and wing_depth > .72:
                color = "ink"
            elif part == "Sculpted bill" and point.y > bird.HEAD.y + .22:
                color = "light"
        elif species == "parrot":
            if part == "Species body and plumage" and uvs[face.loop_start].uv[:] == swatch("accent"):
                color = "mantle" if face.normal.z > -.26 else "ink"
            elif (wing or tail) and face.normal.z < .32 and abs(face.normal.x) > .46:
                color = "accent"
        if toes and species != "parrot":
            color = "bill"
        if color:
            uv = swatch(color)
            for loop in face.loop_indices:
                uvs[loop].uv = uv


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (ob for ob in bpy.context.scene.objects if ob.type == "ARMATURE")
    mesh, = (ob for ob in bpy.context.scene.objects if ob.type == "MESH")
    bird.configure_flight_rollout(species)
    paint_sprite_markings(mesh, species)
    assert set(bpy.data.actions.keys()) == {"idle", "fly", "action"}
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    wildlife_build.key_actions(rig, bird.DURATIONS, bird.pose)
    scene = bpy.context.scene
    scene.render.fps = wildlife_build.FPS
    scene.frame_start, scene.frame_end = 1, bird.DURATIONS["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(bird.DURATIONS)
    scene["Animation reference"] = f"Tilefun {species} finish-v1 sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
