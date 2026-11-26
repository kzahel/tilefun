"""Re-key low-footed lizards on the archived Tilefun meshes and rigs."""
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
import reptile
from wildlife_build import V, aimed, euler, solve_knee, stride, transform


# Escape stride, lift, tail sway, and the action's nose advance, rise and pitch.
MOTION = {
    "chameleon": (.235, .103, .22, .24, -.02, -.19),
    "frilled-neck-lizard": (.335, .157, .31, .055, .069, .20),
    "gecko": (.294, .127, .34, -.03, .105, .26),
    "iguana": (.291, .117, .38, .04, .145, .37),
    "newt": (.239, .083, .33, .13, -.058, -.21),
    "salamander": (.271, .092, .38, .15, -.081, -.32),
    "texas-horned-lizard": (.231, .107, .24, .044, .091, .20),
    "land-tortoise": (.170, .062, .074, .15, -.062, -.24),
    "alligator": (.284, .082, .31, .20, -.085, -.26),
    "crocodile": (.317, .105, .33, .23, -.055, -.23),
    "komodo-dragon": (.304, .119, .37, .18, -.068, -.28),
}
COLORS = {
    "chameleon": "1d251e 47794b 73a65b b7ce76 d6c69a",
    "frilled-neck-lizard": "1d251e 6b593c a58a56 dac283 d6c69a",
    "gecko": "1d251e 665134 bd9d54 e8d492 d6c69a",
    "iguana": "1d251e 35553e 53864d 92b666 d6c69a",
    "newt": "1d251e 493b34 7b5744 d67f48 d6c69a",
    "salamander": "1d251e 1d2b2e 303d3b e0be4b d6c69a",
    "texas-horned-lizard": "1d251e 75563a ab8657 e6d571 d6c69a",
    "land-tortoise": "1d251e 4b4b37 82704a b5a36c d6c69a",
    "alligator": "192523 2d3e38 46564e 6b7965 b7b28b",
    "crocodile": "182523 3c4e38 657653 8a9565 c8bf8d",
    "komodo-dragon": "222b28 575b45 817c61 a09a76 c7ba91",
}
DURATIONS = {"idle": 48, "walk": 32, "action": 25, "flee": 18}
HUNTERS = {"alligator", "crocodile", "komodo-dragon"}
TAIL_FIT = {
    "chameleon": (1.12, 1.22),
    "frilled-neck-lizard": (1.31, 1.0),
    "gecko": (1.40, 1.0),
    "iguana": (1.43, 1.0),
    "newt": (1.23, 1.24),
    "salamander": (1.20, 1.02),
    "texas-horned-lizard": (1.30, 1.0),
    "land-tortoise": (1.0, 1.0),
    "alligator": (1.28, .91),
    "crocodile": (1.39, .93),
    "komodo-dragon": (1.27, 1.02),
}


def fit_tail_and_frill(mesh, rig, species):
    length, rise = TAIL_FIT[species]
    root = reptile.TAIL[0]

    def stretch(p):
        d = p - root
        return root + V((d.x, d.y * length, d.z * rise))

    tail = mesh.vertex_groups["Part · Tapered articulated tail"].index
    frill = {g.index for g in mesh.vertex_groups if g.name.startswith("Part · Raised neck frill")}
    for vertex in mesh.data.vertices:
        groups = {group.group for group in vertex.groups}
        if tail in groups:
            vertex.co = stretch(vertex.co)
        if groups & frill:
            d = vertex.co - reptile.HEAD
            vertex.co = reptile.HEAD + V((d.x * 1.35, d.y, d.z * 1.26))
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for i in range(len(reptile.TAIL) - 1):
        bone = rig.data.edit_bones[f"tail{i}"]
        bone.head = stretch(bone.head)
        bone.tail = stretch(bone.tail)
    bpy.ops.object.mode_set(mode="OBJECT")
    reptile.TAIL = [stretch(point) for point in reptile.TAIL]


def paint_sprite_palette(mesh, species):
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    first = 54
    pixels = list(atlas.pixels)
    for i, value in enumerate(COLORS[species].split()):
        index = (first + i * 2) * 4
        rgb = [int(value[c:c + 2], 16) / 255 for c in (0, 2, 4)]
        pixels[index:index + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}
    eye = 2 * tuple(reptile.PALETTE).index("eye")
    eye_uv = ((eye % 8 + 1) / 8, (eye // 8 + .5) / 8)
    uvs = mesh.data.uv_layers.active.data
    for face in mesh.data.polygons:
        p = face.center
        v = mesh.data.vertices[face.vertices[0]]
        part = next((parts[g.group] for g in v.groups if g.group in parts), "")
        upper = face.normal.z
        shade = 3 if upper > .73 and species != "texas-horned-lizard" else 1 if upper < .06 else 2
        if all(abs(a - b) < .001 for a, b in zip(uvs[face.loop_start].uv, eye_uv)):
            shade = 0
        elif part.startswith("Raised neck frill"):
            ridge = math.cos((p.z + abs(p.x)) * 36)
            shade = 1 if ridge > .66 and upper < .81 else 3
        elif part == "Dorsal scutes":
            shade = 1 if upper < .72 else 2
        elif part.startswith("Crown horns"):
            shade = 3 if upper > .12 else 2
        elif part == "Species muzzle and hinged jaw":
            if p.y > reptile.HEAD.y + reptile.BILL * .66 and upper < .46:
                shade = 4
            elif upper > .54:
                shade = 3
        elif species == "gecko" and upper > -.25:
            shade = 1 if math.cos(p.y * 17) > .19 else 2
        elif species == "chameleon" and part == "Tapered articulated tail":
            shade = 1 if upper < .54 else 2
        elif species == "frilled-neck-lizard" and p.y < -reptile.LENGTH:
            shade = 1
        elif species == "newt":
            shade = 3 if abs(p.x) < .061 and upper > .2 else 2 if upper > .21 else 1
        elif species == "salamander":
            fleck = math.cos(p.y * 22 + abs(p.x) * 12)
            shade = 3 if p.y > -reptile.LENGTH * .75 and fleck > .18 and upper > .18 else 1
        elif species == "land-tortoise" and upper > -.15 and p.z > reptile.BODY.z:
            seams = math.cos(p.y * 25 + abs(p.x) * 14)
            shade = 3 if seams > .62 else 2 if upper > .34 else 1
        index = first + 2 * shade
        uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
        for loop in face.loop_indices:
            uvs[loop].uv = uv


def pose(species, rig, rest, clip, t):
    wave = math.tau * t
    flee = clip in ("flee", "chase")
    travel = clip == "walk" or flee
    action = math.sin(math.pi * t)**2 if clip in ("action", "feed") else 0
    threat = math.sin(math.pi * t)**2 if clip == "display" else 0
    step, height, sway, reach, lift, look = MOTION[species]
    q = euler(.065 * action + .17 * threat - .092 * flee + .038 * math.sin(wave) * travel,
              .046 * math.cos(wave) * travel, (.085 if flee else .036) * math.sin(wave))
    pivot = reptile.BODY
    body = transform(q, pivot, pivot + V((.035 * travel * math.sin(wave),
                                         .045 * action, .024 * math.cos(wave * 2) - .054 * flee + .09 * threat)))
    out = {"body": body @ rest["body"]}
    hq = q @ euler(look * action + .27 * threat, 0, .12 * math.sin(wave) * (not travel))
    head = reptile.HEAD
    head_transform = transform(hq, head, body @ head + V((0, reach * action, lift * action)))
    out["head"] = head_transform @ rest["head"]
    jaw = reptile.JAW
    bite = .39 + .20 * math.sin(wave * 2) if clip == "feed" else .35 if species == "iguana" else .24
    gape = .48 if species == "komodo-dragon" else .83
    jaw_q = hq @ euler(-bite * action - gape * threat)
    out["jaw"] = transform(jaw_q, jaw, head_transform @ jaw) @ rest["jaw"]
    for name, (hip, _, toe) in reptile.LEGS.items():
        left = name.endswith(".l")
        fore = name.startswith("front")
        phase = (0 if left != fore else .5) + (.12 if flee and fore else 0)
        distance = step if flee else step * .67
        swing = height if flee else height * .60
        advance, rise = stride(t, phase, distance, swing) if travel else (0, 0)
        outwards = 1 if left else -1
        foot = toe + V((outwards * rise * .25, advance, rise))
        up, dn, end = (f"{name}.{part}" for part in ("upper", "lower", "foot"))
        hip = body @ hip
        knee, ankle = solve_knee(hip, foot, rig.data.bones[up].length, rig.data.bones[dn].length,
                                 V((outwards, -.43 if fore else .43, 0)))
        out[up] = aimed(rest[up], hip, knee)
        out[dn] = aimed(rest[dn], knee, ankle)
        out[end] = transform(euler(-.39 * rise), toe, ankle) @ rest[end]
    cursor = body @ reptile.TAIL[0]
    for i, (root, tip) in enumerate(zip(reptile.TAIL, reptile.TAIL[1:])):
        beat = math.sin(wave * (2 if flee else 1) - i * .67)
        turn = sway * (1 if flee else .42 if travel else .21)
        endpoint = cursor + q @ (euler(.04 * beat, 0, turn * beat) @ (tip - root))
        name = f"tail{i}"
        out[name] = aimed(rest[name], cursor, endpoint)
        cursor = endpoint
    if species == "frilled-neck-lizard":
        spread = 1.19 - 1.19 * action + .24 * flee
        for side, sign in reptile.SIDES:
            name = f"frill.{side}"
            pivot = rest[name].translation
            turn = hq @ euler(.24 * action, 0, sign * spread)
            out[name] = transform(turn, pivot, head_transform @ pivot) @ rest[name]
    return out


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    reptile.configure(species)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    fit_tail_and_frill(mesh, rig, species)
    paint_sprite_palette(mesh, species)
    hunters = species in HUNTERS
    durations = {"idle": 48, "walk": 32, "feed": 25, "display": 34, "chase": 18} if hunters else DURATIONS
    expected = {"idle", "walk", "feed", "display"} if hunters else {"idle", "walk", "action"}
    assert set(bpy.data.actions.keys()) == expected
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    wildlife_build.key_actions(rig, durations, partial(pose, species))
    scene = bpy.context.scene
    scene.render.fps = wildlife_build.FPS
    scene.frame_start, scene.frame_end = 1, durations["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(durations)
    scene["Animation reference"] = f"Tilefun {species} finish-v1 sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
