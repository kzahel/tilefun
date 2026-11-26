"""Fit foraging mammal drafts to their sprite silhouettes and footfalls."""
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
from wildlife_build import V, aimed, euler, solve_knee, stride, transform


# Measured from the side-on sprite: body length, nose dip and forward reach,
# the forelimb's digging lift, and the difference in escape stride and lift.
PROFILES = {
    "aardvark": (1.12, .31, .12, .19, .42, .16),
    "giant-anteater": (1.34, .27, .19, .10, .45, .15),
    "armadillo": (1.09, .22, .09, .12, .31, .094),
    "pangolin": (1.27, .18, .13, .07, .29, .086),
    "panda": (1.03, .18, .10, .10, .35, .106),
    "capybara": (1.06, .20, .13, .07, .35, .101),
    "red-panda": (1.13, .20, .11, .12, .39, .131),
    "skunk": (1.04, .18, .05, .11, .36, .121),
    "koala": (1.04, .22, .09, .12, .31, .113),
    "echidna": (1.05, .20, .14, .06, .26, .083),
    "binturong": (1.12, .17, .09, .08, .36, .11),
    "kinkajou": (1.16, .24, .14, .10, .37, .13),
    "aye-aye": (1.09, .20, .10, .22, .32, .11),
    "sloth": (1.02, .11, .13, .16, .19, .065),
}
DURATIONS = {"idle": 48, "walk": 32, "action": 24, "flee": 18}
SPRITE_COLORS = {
    "aardvark": "252c2b 806952 9a8263 bca485",
    "giant-anteater": "252c2b 383b39 676259 939083 c8c2a8",
    "armadillo": "252c2b 595f5b 797d74 a3a69a",
    "pangolin": "252c2b 69543d 856a48 ac895b",
    "panda": "1e2927 353930 e9e5ce f8f0da",
    "capybara": "242c31 705b41 9d8055 c1a36a",
    "red-panda": "242c31 343b3c a85d3e d58e57 e6d9b9",
    "skunk": "242c31 242e34 343c40 515a5e e5dfc9",
    "koala": "242c31 5f6866 8c9693 bac2b9 ded8be",
    "echidna": "1e2826 514c3b 817154 d4c29a",
    "binturong": "1e2826 2e3833 454a43 696d5c b4b198",
    "kinkajou": "1e2826 725d3e b39a5b d1b879 e3d0a0",
    "aye-aye": "23282a 464241 6b6660 938a7a b3a68e",
    "sloth": "29271f 5c4d3b 8b7456 ad966f d4c098",
}


def fit_draft(mesh, rig, species):
    length = PROFILES[species][0]
    rig.scale.y *= length
    tip_extensions = {
        "aardvark": (.07, .21, 1.27, 0),
        "giant-anteater": (.22, .20, .45, -.085),
        "armadillo": (.06, .17, .47, -.085),
        "pangolin": (.11, .32, .18, -.085),
        "panda": (-.085, -.31, .92, 0),
        "capybara": (-.10, -.80, .34, -.093),
        "red-panda": (.05, .44, 1.09, .025),
        "skunk": (-.05, .26, .45, -.064),
        "koala": (-.08, -.32, 1.24, .025),
        "echidna": (.18, -.32, .11, -.104),
        "binturong": (.04, 1.18, .57, -.061),
        "kinkajou": (-.037, .57, .60, -.046),
        "aye-aye": (.023, .61, 1.21, .017),
        "sloth": (-.10, -.83, .15, -.046),
    }
    snout, tail, ears, ear_drop = tip_extensions[species]
    head = mesh.vertex_groups["Part · Neck and distinctive head"].index
    rump = mesh.vertex_groups["Part · Species body and coat"].index
    tail_part = mesh.vertex_groups["Part · Tail and tuft"].index
    ear_roots = {
        mesh.vertex_groups[f"Part · Ear {side}"].index: pivot
        for side, pivot in hoofed.EARS.items()
    }
    for vertex in mesh.data.vertices:
        p = vertex.co
        groups = {group.group for group in vertex.groups}
        if head in groups:
            progress = max(0, min(1, (p.y - hoofed.HEAD.y) / hoofed.SNOUT))
            p.y += snout * progress**2
            p.x *= 1 - .27 * progress
            if species in {"panda", "koala", "capybara"}:
                p.x *= 1.17
            if species == "echidna":
                p.x *= 1 - .54 * progress
        if tail_part in groups:
            progress = max(0, hoofed.TAIL.y - p.y)
            p.y -= tail * progress
            if species == "giant-anteater":
                p.z = hoofed.TAIL.z + (p.z - hoofed.TAIL.z) * .72 - .08 * progress
                p.x *= 1.28
            if species == "pangolin":
                p.x *= 1.45
                p.z = hoofed.TAIL.z + (p.z - hoofed.TAIL.z) * 1.30
            if species == "binturong":
                p.x *= 1.22
                p.z += progress * progress * .40
            if species in {"red-panda", "kinkajou"}:
                p.z += .10 * progress
            if species == "skunk":
                p.x *= 1.26
        if species == "aardvark" and rump in groups:
            p.z += .13 * max(0, (p.z - hoofed.BODY.z) / hoofed.DEPTH) * max(0, .4 - p.y)
        if rump in groups and p.z < hoofed.BODY.z:
            clearance = .27 if species in {"armadillo", "pangolin"} else .20
            p.z += (hoofed.BODY.z - p.z) * clearance
        for group, pivot in ear_roots.items():
            if group in groups:
                p.z = pivot.z + (p.z - pivot.z) * ears
                p.x = pivot.x + (p.x - pivot.x) * (.53 if species == "aardvark" else .66)
                p.z += ear_drop


def paint_sprite_patterns(mesh, species):
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    colors = SPRITE_COLORS[species].split()
    pixels = list(atlas.pixels)
    for i, swatch in enumerate(colors):
        rgb = [int(swatch[offset:offset + 2], 16) / 255 for offset in (0, 2, 4)]
        pixels[i * 8:i * 8 + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()
    uvs = mesh.data.uv_layers.active.data
    parts = {group.index: group.name.removeprefix("Part · ") for group in mesh.vertex_groups
             if group.name.startswith("Part · ")}
    for face in mesh.data.polygons:
        vertex = mesh.data.vertices[face.vertices[0]]
        part = next((parts[g.group] for g in vertex.groups if g.group in parts), "")
        p = face.center
        upper = face.normal.z
        leg = part.startswith("Articulated leg")
        head = part == "Neck and distinctive head"
        tail = part == "Tail and tuft"
        body = part == "Species body and coat"
        shade = 3 if upper > .48 else 1 if upper < -.18 else 2
        if head and (p.y > hoofed.HEAD.y + hoofed.SNOUT or
                     (abs(p.x) > hoofed.WIDTH * .47 and p.z > hoofed.HEAD.z + .059)):
            shade = 0
        elif species == "aardvark":
            if leg and p.z < .26:
                shade = 1
            elif tail and upper < .5:
                shade = 1
        elif species == "giant-anteater":
            stripe = p.y - .95 * (p.z - hoofed.BODY.z)
            if (body or leg) and .10 < stripe < .59:
                shade = 1
            elif (body or leg) and .59 <= stripe < .83:
                shade = 4
            elif tail:
                shade = 2 if upper > .05 else 1
        elif species == "armadillo":
            if body and p.z > hoofed.BODY.z:
                band = math.cos(21 * p.y + 3.2 * abs(p.x))
                shade = 1 if band > .57 else 3 if upper > .05 else 2
            elif tail or leg:
                shade = 2 if upper > .5 else 1
        elif species == "pangolin" and (body or tail) and upper > -.55:
            row = math.floor((p.y + .08 * math.cos(p.x * 15)) / .088)
            tip = math.cos(26 * p.x + math.pi * row)
            shade = 1 if tip > .63 and upper < .70 else 3 if (row % 3 != 1) else 2
        elif species == "panda":
            if leg or part.startswith("Ear ") or (body and .24 < p.y < .61):
                shade = 1
            elif head and abs(p.x) > .10 and hoofed.HEAD.z - .03 < p.z < hoofed.HEAD.z + .18:
                shade = 0
        elif species == "capybara" and leg and p.z < .30:
            shade = 1
        elif species == "red-panda":
            if leg or (body and upper < -.1):
                shade = 1
            elif tail:
                shade = 1 if math.cos((p.y + p.z * .3) * 25) > .22 else 2
            elif head and p.y > hoofed.HEAD.y + .1:
                shade = 4 if upper < .20 or abs(p.x) > .13 else 2
            elif part.startswith("Ear ") and upper > .34:
                shade = 4
        elif species == "skunk":
            blaze = .07 < abs(p.x) < .21 and upper > .10
            if (body and blaze) or (head and abs(p.x) < .058 and upper > .16):
                shade = 4
            elif tail and (upper > .14 or p.z > hoofed.TAIL.z + .25):
                shade = 4
            elif leg:
                shade = 1
        elif species == "koala":
            if part.startswith("Ear "):
                shade = 4 if face.normal.y > .28 else 2
            elif head and p.y > hoofed.HEAD.y + hoofed.SNOUT * .71:
                shade = 0
        elif species == "echidna":
            if "quill" in part.lower():
                shade = 1 if math.cos(p.y * 25 + p.z * 19) > .24 else 3
            elif head and p.y > hoofed.HEAD.y + .11:
                shade = 1
        elif species == "binturong" and (body or tail):
            fleck = math.cos(p.y * 48 + p.z * 61 + abs(p.x) * 45)
            shade = 3 if fleck > .68 and upper > .03 else 1 if upper < .21 else 2
        elif species == "kinkajou":
            if tail and p.y < hoofed.TAIL.y - .62:
                shade = 1
            elif head and p.y > hoofed.HEAD.y + .18 and upper < .52:
                shade = 1
        elif species == "aye-aye":
            if leg and p.z < .27:
                shade = 0 if upper < .30 else 1
            elif part.startswith("Ear ") and face.normal.y > .25:
                shade = 1
        elif species == "sloth" and head and p.y > hoofed.HEAD.y + .07:
            shade = 1 if abs(p.x) > .097 and p.z > hoofed.HEAD.z + .025 else 4
        index = shade * 2
        uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
        for loop in face.loop_indices:
            uvs[loop].uv = uv


def pose(species, rig, rest, clip, t):
    if clip == "idle":
        return hoofed.pose(rig, rest, clip, t)

    _, nose_dip, reach, dig_lift, escape_stride, escape_lift = PROFILES[species]
    wave = math.tau * t
    action = clip == "action"
    flee = clip == "flee"
    digging = math.sin(math.pi * t) ** 2 if action else 0
    contact = digging * (.83 + .17 * math.sin(3 * wave))
    bound = max(0, math.sin(wave + .18)) ** 2 if flee else 0
    walk_bob = .024 * math.cos(2 * wave) if clip == "walk" else 0
    pitch = .08 * math.sin(wave) * flee - .13 * contact
    q = euler(pitch, .044 * math.sin(wave) * (not action), 0)
    body_pivot = hoofed.BODY
    body_z = walk_bob + escape_lift * .47 * bound - .044 * digging
    body = transform(q, body_pivot, body_pivot + V((0, .046 * contact, body_z)))
    result = {"body": body @ rest["body"]}

    head_pivot = hoofed.HEAD
    head_q = q @ euler(-nose_dip * contact + .09 * flee, 0, .058 * math.sin(wave) * digging)
    head = transform(head_q, head_pivot, body @ head_pivot + V((0, reach * contact, -.17 * contact)))
    result["head"] = head @ rest["head"]
    tail_pivot = hoofed.TAIL
    tail_q = q @ euler(-.13 * digging - .22 * flee, 0, (.11 + .16 * flee) * math.sin(wave))
    result["tail"] = transform(tail_q, tail_pivot, body @ tail_pivot) @ rest["tail"]
    for side, sign in hoofed.SIDES:
        name = f"ear.{side}"
        pivot = hoofed.EARS[side]
        ear_q = head_q @ euler(-.24 * flee + .075 * math.sin(wave + sign), 0, 0)
        result[name] = transform(ear_q, pivot, head @ pivot) @ rest[name]

    for name, (hip, _, foot) in hoofed.LEGS.items():
        fore = name.startswith("fore")
        left = name.endswith(".l")
        if action:
            scratch = contact * max(0, math.sin(wave * 2 + (0 if left else math.pi))) if fore else 0
            advance, lift = reach * scratch, dig_lift * scratch
        else:
            phase = (0 if left else .5) + (.32 if fore else 0)
            if flee and species in {"aardvark", "giant-anteater"}:
                phase = (.16 if fore else .58) + (0 if left else .18)
            distance = escape_stride if flee else escape_stride * .68
            height = escape_lift if flee else escape_lift * .57
            advance, lift = stride(t, phase, distance, height)
        upper, lower, toe = (f"{name}.{part}" for part in ("upper", "lower", "hoof"))
        hip = body @ hip
        target = foot + V((0, advance, lift))
        knee, ankle = solve_knee(hip, target, rig.data.bones[upper].length,
                                 rig.data.bones[lower].length, V((0, -1 if fore else 1, 0)))
        result[upper] = aimed(rest[upper], hip, knee)
        result[lower] = aimed(rest[lower], knee, ankle)
        result[toe] = transform(euler(-.72 * lift), V((0, 0, 0)), ankle)
    return result


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    hoofed.configure(species)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    fit_draft(mesh, rig, species)
    paint_sprite_patterns(mesh, species)
    assert set(bpy.data.actions.keys()) == {"idle", "walk", "action"}
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    wildlife_build.key_actions(rig, DURATIONS, partial(pose, species))
    scene = bpy.context.scene
    scene.render.fps = wildlife_build.FPS
    scene.frame_start, scene.frame_end = 1, DURATIONS["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(DURATIONS)
    scene["Animation reference"] = f"Tilefun {species} finish-v1 sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
