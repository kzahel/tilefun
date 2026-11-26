"""Preserve the archived task clips and add the separate escape gait."""
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
import primate
from wildlife_build import V, aimed, euler, solve_knee, transform


COATS = {
    "fox": "292b32 3b2d2b 985032 ce7337 e99a4d f0dbb3",
    "hedgehog": "242c31 554d42 8d7455 b09a75 d0b895 d0b895",
    "porcupine": "242c31 3f3d38 695c4f 99856c d2c7a6 d2c7a6",
    "meerkat": "252c2b 67583f 67583f a99463 c4b383 ded4ad",
    "raccoon": "242c31 414849 414849 8c8c80 b8b7a5 d8d4bd",
    "red-squirrel": "3b3029 874b30 874b30 b56839 db9551 e7d3a8",
    "beaver": "242c31 4b4136 4b4136 76583d a47e50 ded8be",
    "capuchin-monkey": "252927 4e4034 67503a a58b60 d8be94 e7d9b5",
}
MOTION = {
    "fox": (.42, .22, .47),
    "hedgehog": (.24, .11, .18),
    "porcupine": (.34, .12, .23),
    "meerkat": (.31, .17, .38),
    "raccoon": (.35, .16, .30),
    "red-squirrel": (.30, .16, .29),
    "beaver": (.29, .13, .22),
    "capuchin-monkey": (.38, .17, .33),
}
SENTINEL = {"rear": 26, "scan": 42, "alarm": 24, "lower": 26}


def repaint(mesh, species):
    first = 52
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    coordinates = list(atlas.pixels)
    for index, value in enumerate(COATS[species].split()):
        marker = (first + index * 2) * 4
        rgb = [int(value[c:c + 2], 16) / 255 for c in (0, 2, 4)]
        coordinates[marker:marker + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = coordinates
    atlas.pack()
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}
    uvs = mesh.data.uv_layers.active.data
    for face in mesh.data.polygons:
        point = face.center
        vertex = mesh.data.vertices[face.vertices[0]]
        part = next((parts[group.group] for group in vertex.groups if group.group in parts), "")
        upper = face.normal.z
        head = part == "Neck and distinctive head"
        tail = part == "Tail and tuft"
        leg = part.startswith("Articulated leg")
        if species == "capuchin-monkey":
            shade = 4 if upper > .62 else 2 if upper < -.17 else 3
            if "head" in part.lower() and point.z > primate.HEAD.z + .10:
                shade = 1
            elif "head" in part.lower() and point.y > primate.HEAD.y:
                shade = 5
            elif "limb" in part.lower():
                shade = 2
        else:
            shade = 4 if upper > .58 else 2 if upper < -.17 else 3
            if leg:
                shade = 1 if point.z < .29 else 2
            elif head and point.y > hoofed.HEAD.y + hoofed.SNOUT * .99:
                shade = 0
            elif head and abs(point.x) > .11 and hoofed.HEAD.z < point.z < hoofed.HEAD.z + .14:
                shade = 0 if species in {"raccoon", "meerkat"} else 2
            elif head and upper < .14 and point.y > hoofed.HEAD.y:
                shade = 5
            elif "quill" in part.lower():
                shade = 1 if species == "hedgehog" else 4 if upper > .56 else 2
            elif tail and species == "raccoon":
                shade = 1 if math.cos((point.y + point.z * .25) * 26) > .16 else 3
            elif tail and species == "fox" and point.y < hoofed.TAIL.y - .58:
                shade = 5
            elif tail and species == "beaver":
                shade = 1
            elif part.startswith("Ear ") and point.z > hoofed.HEAD.z + .22:
                shade = 1
        index = first + shade * 2
        uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
        for loop in face.loop_indices:
            uvs[loop].uv = uv


def sentinel_pose(rig, rest, clip, t):
    wave = math.tau * t
    progress = t * t * (3 - 2 * t)
    stand = progress if clip == "rear" else 1 - progress if clip == "lower" else 1
    attention = .21 * math.sin(wave) if clip == "scan" else .07 * math.sin(2 * wave)
    q = euler(1.13 * stand, attention * .12, 0)
    root = hoofed.BODY + V((0, -.48, -.22))
    body = transform(q, root, root + V((0, -.06 * stand, .03 * stand)))
    out = {"body": body @ rest["body"]}
    head_q = q @ euler(-.93 * stand, 0, attention)
    head = transform(head_q, hoofed.HEAD, body @ hoofed.HEAD)
    out["head"] = head @ rest["head"]
    for side, sign in hoofed.SIDES:
        name = f"ear.{side}"
        pivot = hoofed.EARS[side]
        out[name] = transform(head_q @ euler(.06 * math.sin(wave + sign)), pivot, head @ pivot) @ rest[name]
    for name, (hip, _, foot) in hoofed.LEGS.items():
        fore = name.startswith("fore")
        lift = (.46 + (.068 * math.sin(3 * wave) if clip == "alarm" else 0)) * stand if fore else 0
        target = foot + V((0, -.38 * stand * fore, lift))
        upper, lower, toe = (f"{name}.{part}" for part in ("upper", "lower", "hoof"))
        shoulder = body @ hip
        knee, ankle = solve_knee(shoulder, target, rig.data.bones[upper].length,
                                 rig.data.bones[lower].length, V((0, -1 if fore else 1, 0)))
        out[upper] = aimed(rest[upper], shoulder, knee)
        out[lower] = aimed(rest[lower], knee, ankle)
        out[toe] = transform(euler(-.43 * lift), foot, ankle) @ rest[toe]
    tail = hoofed.TAIL
    tail_q = q @ euler(.68 * stand, 0, .10 * math.sin(wave))
    out["tail"] = transform(tail_q, tail, body @ tail) @ rest["tail"]
    return out


def escape_pose(species, rig, rest, t):
    if species == "capuchin-monkey":
        primate.ROLLOUT_MOTION = MOTION[species]
        return primate.rollout_pose(rig, rest, "flee", t)
    out = hoofed.grazer_pose(rig, rest, "flee", t, MOTION[species])
    if species == "red-squirrel":
        bound = hoofed.pose(rig, rest, "hop", t)
        gather = math.sin(math.pi * t) ** 2
        for name in ("body", "head", "tail"):
            out[name] = out[name].lerp(bound[name], .52 * gather)
    body = out["body"] @ rest["body"].inverted()
    for name in rest.keys() - out.keys():
        out[name] = body @ rest[name]
    return out


def new_pose(species, rig, rest, clip, t):
    if clip == "flee":
        return escape_pose(species, rig, rest, t)
    return sentinel_pose(rig, rest, clip, t)


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    module = primate if species == "capuchin-monkey" else hoofed
    module.configure(species)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    repaint(mesh, species)
    additions = {"flee": 18}
    if species == "meerkat":
        for name in SENTINEL:
            bpy.data.actions.remove(bpy.data.actions[name])
        additions.update(SENTINEL)
    if species == "red-squirrel":
        bpy.data.actions["hop"].name = "bound"
    wildlife_build.key_actions(rig, additions, partial(new_pose, species))
    scene = bpy.context.scene
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(sorted(bpy.data.actions.keys()))
    scene["Animation reference"] = f"Tilefun {species} active sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
