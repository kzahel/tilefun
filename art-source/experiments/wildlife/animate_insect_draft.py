"""Re-key archived insects from the native sprite poses and escape timing."""
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
import insect
from wildlife_build import V, aimed, euler, stride, transform


SPRITE_ACCENTS = {
    "cricket": ("29332d", "c2b88f", "4d4b39"),
    "grasshopper": ("29332d", "dbd4aa", "4d6840"),
    "ladybug": ("29332d", "e7dfc7", "b74735"),
    "stag-beetle": ("29332d", "d2bd8b", "745b3f"),
    "ant": ("1f1c19", "b96e39", "603623"),
    "earwig": ("151b17", "918058", "675844"),
    "leaf-insect": ("443a32", "aacb71", "638858"),
    "roly-poly": ("151b17", "b9a477", "675844"),
}


def pulse(t, start, end):
    progress = max(0, min(1, (t - start) / (end - start)))
    return math.sin(math.pi * progress) ** 2


def hop_pose(rig, rest, clip, t):
    if clip in {"idle", "action"}:
        return insect.pose(rig, rest, clip, t)
    startled = clip == "flee"
    load = pulse(t, 0, .28 if startled else .38)
    kick = pulse(t, .15 if startled else .24, .71 if startled else .80)
    land = pulse(t, .65, 1)
    pitch = -.17 * load + (.36 if startled else .24) * kick - .12 * land
    rise = (.125 if startled else .088) * kick - .060 * load - .035 * land
    body_q = euler(pitch)
    body = transform(body_q, insect.BODY, insect.BODY + V((0, -.055 * load, rise)))
    out = {"body": body @ rest["body"]}
    head = insect.HEAD
    abdomen = insect.ABDOMEN
    head_q = body_q @ euler(.23 * load - .14 * kick)
    abd_q = body_q @ euler(.26 * load - .30 * kick)
    out["head"] = transform(head_q, head, body @ head) @ rest["head"]
    out["abdomen"] = transform(abd_q, abdomen, body @ abdomen) @ rest["abdomen"]
    for side, sign in insect.SIDES:
        name = f"antenna.{side}"
        root, _ = insect.antenna(side)
        antenna_q = head_q @ euler(-.47 * kick + .14 * load, 0, sign * .17 * kick)
        antenna_root = transform(head_q, head, body @ head) @ root
        out[name] = transform(antenna_q, root, antenna_root) @ rest[name]
        for i in range(insect.LEG_COUNT):
            hip, knee, foot = (insect.point(side, i, j) for j in range(3))
            upper, lower = f"leg.{side}.{i}.up", f"leg.{side}.{i}.down"
            if i == 2:
                knee = body @ knee + V((0, -.17 * kick + .11 * load, .10 * load - .22 * kick))
                reach = (.48 if startled else .30) * kick
                foot += V((sign * -.11 * kick, -reach, .12 * kick))
            else:
                knee = body @ knee + V((0, .059 * kick, .035 * kick))
                foot += V((sign * -.06 * kick, .12 * kick, .13 * kick))
            out[upper] = aimed(rest[upper], body @ hip, knee)
            out[lower] = aimed(rest[lower], knee, foot)
    return out


def beetle_pose(rig, rest, clip, t):
    if clip in {"idle", "action"}:
        return insect.pose(rig, rest, clip, t)
    escape = clip == "flee"
    wave = math.tau * t
    roll = (.13 if escape else .041) * math.sin(wave)
    q = euler(.20 if escape else .046, roll)
    bob = (.058 if escape else .026) * math.sin(wave)
    body = transform(q, insect.BODY, insect.BODY + V((0, 0, .076 + bob)))
    out = {"body": body @ rest["body"]}
    out["head"] = body @ rest["head"]
    abd = insect.ABDOMEN
    abdomen = transform(q @ euler(-.11 if escape else .06), abd, body @ abd)
    out["abdomen"] = abdomen @ rest["abdomen"]
    for side, sign in insect.SIDES:
        antenna = f"antenna.{side}"
        root, _ = insect.antenna(side)
        out[antenna] = transform(q @ euler(-.31 if escape else -.08), root, body @ root) @ rest[antenna]
        case = f"case.{side}"
        root = rest[case].translation
        cover = (.93 if escape else .62) + .055 * math.sin(wave)
        out[case] = transform(q @ euler(-cover, 0, sign * cover * .69), root, abdomen @ root) @ rest[case]
        jaw = f"jaw.{side}"
        if jaw in rest:
            root, _ = insect.weapon(side)
            out[jaw] = transform(q @ euler(0, 0, sign * .14 * escape), root, body @ root) @ rest[jaw]
        for i in range(insect.LEG_COUNT):
            hip, knee, foot = (insect.point(side, i, j) for j in range(3))
            upper, lower = f"leg.{side}.{i}.up", f"leg.{side}.{i}.down"
            tuck = -.20 if escape else -.09
            knee = body @ (knee + V((sign * tuck * .54, -.08, .042)))
            foot = body @ (foot + V((sign * tuck, -.14, .22 if escape else .11)))
            out[upper] = aimed(rest[upper], body @ hip, knee)
            out[lower] = aimed(rest[lower], knee, foot)
        root, tip = insect.wing_config(side)
        stern = -.12 if escape else -.32
        beat = math.cos(wave * (3 if escape else 2) + sign * .15 * escape)
        direction = V((sign * .85, stern, (.96 if escape else .75) * beat)).normalized()
        wing = f"wing.{side}"
        out[wing] = aimed(rest[wing], body @ root, body @ (root + direction * (tip - root).length))
    return out


def fit_hopper(mesh, species):
    groups = mesh.vertex_groups
    abdomen = groups["Part · Distinct abdomen sculpture"].index
    for vertex in mesh.data.vertices:
        if any(group.group == abdomen for group in vertex.groups):
            p = vertex.co
            p.x *= .76 if species == "cricket" else .86
            p.y = insect.ABDOMEN.y + (p.y - insect.ABDOMEN.y) * 1.16


def ground_pose(rig, rest, clip, t):
    if clip != "flee":
        return insect.pose(rig, rest, clip, t)
    wave = math.tau * t
    plated = insect.STYLE == "plates"
    raised_forceps = insect.STYLE == "forceps"
    leaf = insect.STYLE == "leaf"
    pitch = .052 + .076 * math.sin(wave)
    q = euler(pitch, (.044 if plated else .082) * math.sin(wave))
    body = transform(q, insect.BODY, insect.BODY + V((0, .038 * math.sin(wave), -.064)))
    out = {"body": body @ rest["body"]}
    hq = q @ euler(.18 if raised_forceps else -.09, 0, .091 * math.cos(wave))
    head = transform(hq, insect.HEAD, body @ insect.HEAD)
    out["head"] = head @ rest["head"]
    aq = q @ euler(-.32 if raised_forceps else .15 if plated else .076 * math.sin(wave),
                  0, .09 * math.cos(wave))
    abdomen = transform(aq, insect.ABDOMEN, body @ insect.ABDOMEN)
    out["abdomen"] = abdomen @ rest["abdomen"]
    for side, sign in insect.SIDES:
        name = f"antenna.{side}"
        a, _ = insect.antenna(side)
        out[name] = transform(hq @ euler(-.22, 0, sign * .20 * math.sin(wave)), a, head @ a) @ rest[name]
        name = f"jaw.{side}"
        if name in rest:
            a, _ = insect.weapon(side)
            parent, angle = (abdomen, aq) if raised_forceps else (head, hq)
            grip = .28 if raised_forceps else .13
            out[name] = transform(angle @ euler(0, 0, sign * grip), a, parent @ a) @ rest[name]
        for pair in range(insect.LEG_COUNT):
            a, mid, end = (insect.point(side, pair, joint) for joint in range(3))
            phase = (.5 if sign > 0 else 0) + pair * (.18 if plated else .31)
            stride_length = .112 if plated else .158 if leaf else .229
            advance, lift = stride((t * 2) % 1, phase, stride_length, .060 if plated else .094)
            knee = body @ mid + V((0, .44 * advance, .38 * lift))
            foot = end + V((0, advance, lift))
            up, down = f"leg.{side}.{pair}.up", f"leg.{side}.{pair}.down"
            out[up] = aimed(rest[up], body @ a, knee)
            out[down] = aimed(rest[down], knee, foot)
    return out


def paint_sprite_accents(mesh, species):
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    palette_start = 58
    pixels = list(atlas.pixels)
    for i, value in enumerate(SPRITE_ACCENTS[species]):
        index = (palette_start + i * 2) * 4
        rgb = [int(value[offset:offset + 2], 16) / 255 for offset in (0, 2, 4)]
        pixels[index:index + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}
    uvs = mesh.data.uv_layers.active.data
    for face in mesh.data.polygons:
        vertex = mesh.data.vertices[face.vertices[0]]
        part = next((parts[g.group] for g in vertex.groups if g.group in parts), "")
        upper = face.normal.z
        shade = None
        if part.startswith("Eye and antenna"):
            shade = 0
        elif part.startswith("Wing"):
            shade = 1
        elif part.startswith("Leg"):
            shade = 0 if upper < .51 or (species == "cricket" and part.endswith("2")) else 2
        elif part == "Distinct abdomen sculpture" and insect.MOVE == "hop":
            shade = 1 if face.center.z < insect.ABDOMEN.z - .09 else 0 if upper > .10 else 2
        elif part == "Distinct abdomen sculpture" and upper < -.12:
            shade = 1
        elif species == "ladybug" and part in {"Head", "Thorax"}:
            shade = 0 if upper < .40 else 2
        elif insect.MOVE in {"walk", "crawl"}:
            if part == "Distinct abdomen sculpture" and species in {"earwig", "roly-poly"}:
                band = math.cos(face.center.y * (22 if species == "roly-poly" else 31))
                shade = 1 if band > .30 and upper > -.04 else 2 if upper > -.35 else 0
            elif part == "Distinct abdomen sculpture" and species == "leaf-insect":
                ridge = math.cos(face.center.y * 23 + abs(face.center.x) * 14)
                shade = 1 if ridge > .3 and upper > .06 else 2
            elif part == "Distinct abdomen sculpture" and species == "ant":
                shade = 2 if upper > .49 else 0
            elif part in {"Thorax", "Head"}:
                shade = 2 if upper > .15 else 0
        if shade is not None:
            index = palette_start + shade * 2
            uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
            for loop in face.loop_indices:
                uvs[loop].uv = uv


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    insect.configure(f"{species}:2")
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    if insect.MOVE == "hop":
        fit_hopper(mesh, species)
    paint_sprite_accents(mesh, species)
    assert set(bpy.data.actions.keys()) == {"idle", insect.MOVE, "action"}
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    durations = {**insect.DURATIONS, "flee": 18}
    pose = {"hop": hop_pose, "fly": beetle_pose}.get(insect.MOVE, ground_pose)
    wildlife_build.key_actions(rig, durations, pose)
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
