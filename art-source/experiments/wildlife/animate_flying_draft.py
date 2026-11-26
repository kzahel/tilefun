"""Animate archived nectar visitors, dragonflies and bats from their sprite poses."""
from importlib.util import module_from_spec, spec_from_file_location
import math
from functools import partial
from pathlib import Path
import sys

import bpy


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("wildlife_build", HERE / "build.py")
wildlife_build = module_from_spec(spec)
sys.modules["wildlife_build"] = wildlife_build
spec.loader.exec_module(wildlife_build)
import fabled
import insect
from wildlife_build import V, aimed, euler, transform


COLORS = {
    "bee": "29332d 6b5938 b38a38 e3b85a e7e2c9",
    "dragonfly": "29332d 4c6968 6e8b81 9b5444 c8d7cc",
    "butterfly": "39382d 534231 d78332 e8a35e eadcb7",
    "bat": "20282b 493f39 76634f 9a8064 b19a77",
}


def paint_sprite_wings(mesh, species):
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    first = 54
    pixels = list(atlas.pixels)
    for i, value in enumerate(COLORS[species].split()):
        index = (first + i * 2) * 4
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
        p = face.center
        upper = face.normal.z
        wing = part.startswith(("Wing", "Flight surface"))
        shade = 0 if upper < .14 else 2
        if species == "bat":
            if wing:
                vein = abs(math.sin(abs(p.x) * 10.4 + (p.y + .2) * 2.6))
                shade = 0 if vein < .20 else 1 if upper < .47 else 2
            elif p.z > fabled.HEAD.z + .18:
                shade = 1 if upper < .34 else 3
            elif part.startswith("back."):
                shade = 1
        elif wing:
            if species == "butterfly":
                edge = abs(p.x) * .61 + abs(p.y + .33)
                shade = 4 if edge > .60 and math.cos(p.y * 19) > .3 else 0 if edge > .42 else 2
            else:
                shade = 4
        elif part.startswith("Eye and antenna"):
            shade = 3 if species == "dragonfly" and p.y < .79 and p.z > .37 else 0
        elif part.startswith("Leg"):
            shade = 1 if upper > .52 else 0
        elif part == "Distinct abdomen sculpture":
            band = math.cos(p.y * (21 if species == "dragonfly" else 18))
            shade = 0 if band > .24 else 3 if species == "bee" and upper > .46 else 2
        elif species == "bee" and upper > .54:
            shade = 3
        index = first + 2 * shade
        uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
        for loop in face.loop_indices:
            uvs[loop].uv = uv


def wing_parts(mesh, name):
    marker = mesh.vertex_groups[f"Part · Wing {name}"].index
    ids = {v.index for v in mesh.data.vertices if any(g.group == marker for g in v.groups)}
    neighbors = {i: set() for i in ids}
    for edge in mesh.data.edges:
        first, second = edge.vertices
        if first in ids and second in ids:
            neighbors[first].add(second)
            neighbors[second].add(first)
    components = []
    while ids:
        remaining = [ids.pop()]
        component = []
        while remaining:
            current = remaining.pop()
            component.append(mesh.data.vertices[current])
            fresh = neighbors[current] & ids
            remaining.extend(fresh)
            ids -= fresh
        components.append(component)
    return sorted(components, key=lambda group: sum(v.co.y for v in group) / len(group))


def rig_rear_wings(mesh, rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for side, sign in insect.SIDES:
        root, tip = insect.wing_config(side)
        offset = V((sign * .07, -.23, .047))
        rear = rig.data.edit_bones.new(f"rear-wing.{side}")
        rear.head, rear.tail = root + offset, tip + offset
        rear.parent = rig.data.edit_bones["body"]
    bpy.ops.object.mode_set(mode="OBJECT")
    for side, _ in insect.SIDES:
        rear, *fore = wing_parts(mesh, side)
        assert len(fore) == 2
        back = mesh.vertex_groups.new(name=f"rear-wing.{side}")
        indices = [v.index for v in rear]
        mesh.vertex_groups[f"wing.{side}"].remove(indices)
        back.add(indices, 1, "REPLACE")


def insect_pose(species, rig, rest, clip, t):
    sip = clip == "sip"
    escape = clip == "flee"
    flying = sip or escape or clip == insect.MOVE
    wave = math.tau * t
    beat_count = 3 if escape and species == "dragonfly" else 2 if escape or sip else 1
    out = insect.pose(rig, rest, insect.MOVE if flying else clip, (t * beat_count) % 1)
    body = out["body"] @ rest["body"].inverted()
    if species in {"dragonfly", "butterfly"}:
        for side, sign in insect.SIDES:
            name = f"rear-wing.{side}"
            bone = rig.data.bones[name]
            if flying:
                beat = math.cos(wave * beat_count * (2 if species == "dragonfly" else 1) - .66)
                direction = V((sign * .90, -.35 if species == "dragonfly" else -.46, .73 * beat))
            else:
                direction = bone.tail_local - bone.head_local
            out[name] = aimed(rest[name], body @ bone.head_local,
                              body @ (bone.head_local + direction.normalized() * bone.length))
    if sip:
        dip = .75 + .24 * math.sin(math.pi * t)**2
        pivot = out["head"].translation
        nose = transform(euler(-.34 * dip), pivot, pivot + V((0, .094 * dip, -.136 * dip)))
        for name in ("head", "antenna.l", "antenna.r"):
            out[name] = nose @ out[name]
        for side, _ in insect.SIDES:
            for i in range(insect.LEG_COUNT):
                up, down = f"leg.{side}.{i}.up", f"leg.{side}.{i}.down"
                hip, knee, foot = (insect.point(side, i, j) for j in range(3))
                knee = body @ knee + V((0, -.045, .033))
                out[up] = aimed(rest[up], body @ hip, knee)
                out[down] = aimed(rest[down], knee, body @ foot + V((0, -.074, .043)))
    if escape:
        pivot = out["body"].translation
        q = euler(.18 + .065 * math.sin(wave), .23 * math.sin(wave + .31))
        bank = transform(q, pivot, pivot + V((0, .035 * math.sin(wave), .10)))
        out = {name: bank @ matrix for name, matrix in out.items()}
    return out


def bat_pose(rig, rest, clip, t):
    if clip == "idle":
        return fabled.pose(rig, rest, clip, t)
    escape = clip == "flee"
    fold = math.sin(math.pi * t)**2 if clip == "action" else 0
    wave = math.tau * t
    out = fabled.pose(rig, rest, "fly" if escape else clip, (t * (2 if escape else 1)) % 1)
    body = out["body"] @ rest["body"].inverted()
    for side, (root, elbow, tip) in fabled.WINGS.items():
        sign = 1 if side == "l" else -1
        beat = math.cos(wave * (2 if escape else 1))
        spread = 1 - fold * .85
        lift = .23 + .77 * beat if escape else .74 * beat
        arm = V((sign * (.27 + .68 * spread), -.69 * fold - .09, lift * spread + .22 * fold))
        fingers = V((sign * (.16 + .70 * spread), -.31 - .46 * fold,
                     (lift + .19 * math.sin(wave)) * spread - .23 * fold))
        middle = root + arm.normalized() * (elbow - root).length
        end = middle + fingers.normalized() * (tip - elbow).length
        out[f"wing.{side}"] = aimed(rest[f"wing.{side}"], body @ root, body @ middle)
        out[f"tip.{side}"] = aimed(rest[f"tip.{side}"], body @ middle, body @ end)
    if escape:
        pivot = out["body"].translation
        tilt = transform(euler(.21, .14 * math.sin(wave)), pivot, pivot + V((0, 0, .12)))
        out = {name: tilt @ matrix for name, matrix in out.items()}
    return out


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    if species == "bat":
        fabled.configure(species)
        durations = {name: fabled.DURATIONS[name] for name in ("idle", "fly", "action")}
        pose = bat_pose
    else:
        insect.configure(f"{species}:2")
        durations = dict(insect.DURATIONS)
        pose = partial(insect_pose, species)
        if species in {"dragonfly", "butterfly"}:
            rig_rear_wings(mesh, rig)
    paint_sprite_wings(mesh, species)
    assert set(bpy.data.actions.keys()) == set(durations)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    durations["flee"] = 18
    wildlife_build.key_actions(rig, durations, pose)
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
