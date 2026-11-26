"""Apply species-specific planted and pursuit poses to archived ground hunters."""
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
import hoofed
from wildlife_build import V


COATS = {
    "brown-bear": "251e1a 34271f 69452e 92613d b48253 c8a579",
    "polar-bear": "1e2927 292f29 797b69 e9e5d1 fff5dc d1cbb4",
    "coyote": "2c3330 514235 786948 9d865e c7b387 e1d0a5",
    "wolf": "252f30 333b3d 565f5e 77817c adb1a0 d1c7aa",
    "fossa": "242c31 614c39 614c39 9d6745 c79362 ded0a8",
    "honey-badger": "222c30 222c30 343e40 343e40 d5d3b9 ded0a8",
    "mongoose": "242c31 63563f 63563f 8f7853 b9a174 ded0a8",
    "white-nosed-coati": "242c31 65513b 65513b a17b4a cfad70 ded0a8",
}
MOTION = {
    "brown-bear": (.49, .23, .34),
    "polar-bear": (.52, .24, .37),
    "coyote": (.49, .17, .42),
    "wolf": (.49, .19, .47),
    "fossa": (.43, .19, .34),
    "honey-badger": (.37, .18, .26),
    "mongoose": (.42, .20, .39),
    "white-nosed-coati": (.43, .23, .35),
}
SHORT_EARS = {"fossa": .61, "honey-badger": .25, "mongoose": .38, "white-nosed-coati": .40}
DURATIONS = {"idle": 48, "walk": 32, "feed": 26, "display": 30, "chase": 19}


def fit_stance(mesh, rig, species):
    clearance = .22 if species == "polar-bear" else .19 if species == "brown-bear" else .076

    def lengthen(point):
        amount = min(1, max(0, (point.z - .115) / (hoofed.LEG - .05)))
        return point + V((0, 0, clearance * amount))

    for vertex in mesh.data.vertices:
        vertex.co = lengthen(vertex.co)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in rig.data.edit_bones:
        bone.head = lengthen(bone.head)
        bone.tail = lengthen(bone.tail)
    bpy.ops.object.mode_set(mode="OBJECT")
    hoofed.BODY = lengthen(hoofed.BODY)
    hoofed.HEAD = lengthen(hoofed.HEAD)
    hoofed.TAIL = lengthen(hoofed.TAIL)
    hoofed.EARS = {side: lengthen(pivot) for side, pivot in hoofed.EARS.items()}
    hoofed.LEGS = {name: tuple(lengthen(p) for p in points) for name, points in hoofed.LEGS.items()}


def refine_draft(mesh, species):
    bear = species.endswith("bear")
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    first = 52
    pixels = list(atlas.pixels)
    for i, value in enumerate(COATS[species].split()):
        index = (first + i * 2) * 4
        rgb = [int(value[c:c + 2], 16) / 255 for c in (0, 2, 4)]
        pixels[index:index + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}

    def part_of(vertex):
        return next((parts[g.group] for g in vertex.groups if g.group in parts), "")

    for vertex in mesh.data.vertices:
        p = vertex.co
        part = part_of(vertex)
        if part == "Neck and distinctive head" and p.y > hoofed.HEAD.y:
            reach = p.y - hoofed.HEAD.y
            p.y += reach * (.43 if species == "polar-bear" else .37 if bear else .23)
            p.x *= 1 - min(.24, reach * .36)
        elif part == "Species body and coat" and p.z > hoofed.BODY.z:
            bump = math.exp(-((p.y - .39) / .43)**2)
            shoulder = -.06 if species == "honey-badger" else .15
            p.z += shoulder * bump * (p.z - hoofed.BODY.z) / hoofed.DEPTH
        elif part == "Tail and tuft" and not bear:
            p.x *= 1.10
            distance = max(0, hoofed.TAIL.y - p.y)
            p.y -= .27 * distance
            if species != "white-nosed-coati":
                p.z -= .16 * distance
        elif part.startswith("Ear ") and not bear:
            pivot = hoofed.EARS[part[-1]]
            p.z = pivot.z + (p.z - pivot.z) * SHORT_EARS.get(species, 1.27)

    eye = 2 * tuple(hoofed.PALETTE).index("ink")
    dark_uv = ((eye % 8 + 1) / 8, (eye // 8 + .5) / 8)
    uvs = mesh.data.uv_layers.active.data
    for face in mesh.data.polygons:
        p = face.center
        upper = face.normal.z
        part = part_of(mesh.data.vertices[face.vertices[0]])
        shade = 4 if upper > .55 else 2 if upper < .04 else 3
        if part.startswith("Articulated leg"):
            shade = 1 if p.z < .24 and upper < .54 else 2 if p.z < .34 else shade
        elif part == "Tail and tuft" and not bear:
            if species == "white-nosed-coati":
                shade = 1 if math.cos((p.y - p.z) * 20) > .21 else 3
            elif p.y < hoofed.TAIL.y - .43:
                shade = 1
        elif part == "Neck and distinctive head":
            nose = p.y > hoofed.HEAD.y + hoofed.SNOUT * 1.04
            eye = all(abs(a - b) < .001 for a, b in zip(uvs[face.loop_start].uv, dark_uv))
            shade = 0 if nose or eye else 5 if p.y > hoofed.HEAD.y + .16 else shade
            if not (nose or eye):
                if species == "honey-badger":
                    shade = 4 if p.z > hoofed.HEAD.z + .08 else 1
                elif species == "mongoose" and p.z < hoofed.HEAD.z + .06:
                    shade = 2 if p.y < hoofed.HEAD.y + .28 else 1
                elif species == "white-nosed-coati" and p.y < hoofed.HEAD.y + .21:
                    shade = 2
        elif part.startswith("Ear ") and face.normal.y > .27:
            shade = 2
        elif not bear and part == "Species body and coat":
            if species == "honey-badger":
                shade = 4 if upper >= .3 else 1
            elif upper < -.37 and species != "fossa":
                shade = 5
        index = first + 2 * shade
        uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
        for loop in face.loop_indices:
            uvs[loop].uv = uv


def pose(motion, rig, rest, clip, t):
    if clip == "display":
        return hoofed.pose(rig, rest, clip, t)
    grazer_clip = {"feed": "action", "chase": "flee"}.get(clip, clip)
    return hoofed.grazer_pose(rig, rest, grazer_clip, t, motion)


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    hoofed.configure(species)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    fit_stance(mesh, rig, species)
    refine_draft(mesh, species)
    assert set(bpy.data.actions.keys()) == {"idle", "walk", "feed", "display"}
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    wildlife_build.key_actions(rig, DURATIONS, partial(pose, MOTION[species]))
    scene = bpy.context.scene
    scene.render.fps = wildlife_build.FPS
    scene.frame_start, scene.frame_end = 1, DURATIONS["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(DURATIONS)
    scene["Animation reference"] = f"Tilefun {species} active sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
