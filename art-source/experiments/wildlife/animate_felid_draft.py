"""Add a distinct pursuit action to an editable campaign felid."""
from importlib.util import module_from_spec, spec_from_file_location
import math
from pathlib import Path
import sys

import bpy


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("wildlife_cat", HERE.parent / "cat" / "build.py")
cat = module_from_spec(spec)
spec.loader.exec_module(cat)


# Forepaw reach, rear extension, suspension and body travel are measured
# separately so the cheetah extends farther than the stockier jaguar.
CHASE = {
    "bobcat": (.87, .91, .91, .88),
    "lynx": (.95, 1.04, 1.14, 1.0),
    "cheetah": (1.32, 1.38, 1.27, 1.31),
    "jaguar": (1.05, 1.07, .73, .83),
    "leopard": (1.10, 1.16, 1.10, 1.05),
    "lion": (1.12, 1.09, .81, .89),
    "tiger": (1.17, 1.14, .95, 1.03),
    "panther": (1.09, 1.13, .92, 1.02),
}
TAIL_SLOPE = {"bobcat": .34, "lynx": .39, "cheetah": .72, "jaguar": .66,
              "leopard": .69, "lion": .56, "tiger": .63, "panther": .68}
SHAPE = {
    "bobcat": (.99, .93, -.07, .35),
    "lynx": (1.08, .94, -.08, .57),
    "cheetah": (.82, .84, -.13, -.36),
    "jaguar": (1.11, .90, -.11, -.42),
    "leopard": (.86, .86, -.13, -.43),
    "lion": (1.10, 1.00, -.09, -.68),
    "tiger": (1.13, .95, -.09, -.51),
    "panther": (.75, .78, -.13, -.60),
}
COATS = {
    "bobcat": "29342d 5d4533 6e513b b38854 d6b580 e4d2ac cfb071",
    "lynx": "2e3531 5a5144 6b5e4c a79678 c7b99b e8dcc5 bcba6a",
    "cheetah": "292f2b 39392a 6b512f d6b16d efd092 f2dfb7 8e973f",
    "jaguar": "2d302b 594126 664429 c99445 e6bb73 efcf9b d0b34f",
    "leopard": "30362c 5d452a 664827 cca255 ebc98b ead3a9 ced18c",
    "lion": "432e23 573a29 a16939 c89953 e2bd76 f0deb0 c4b576",
    "tiger": "342a25 342a25 a95129 d58138 eaaa53 f1ddb3 c7bd6f",
    "panther": "171e23 171e23 29333b 414d56 606c75 414d56 d8bc64",
}
DURATIONS = {"Idle": 48, "Walk": 21, "Feed": 24, "Display": 29, "Chase": 20}


def configure_pose(rig, species):
    cat.VARIANT = species
    chain = [rig.data.bones[cat.tail_name(i)] for i in range(5)]
    cat.TAIL = [bone.head_local.copy() for bone in chain] + [chain[-1].tail_local.copy()]
    fore, hind, rise_scale, lean_scale = CHASE[species]
    cat.FLEE_BODY = [
        (t, rise * rise_scale, lean * lean_scale, pitch * rise_scale, head * .81)
        for t, rise, lean, pitch, head in cat.FLEE_BODY
    ]
    cat.FLEE_FORE = [(t, offset * fore, lift * rise_scale, roll) for t, offset, lift, roll in cat.FLEE_FORE]
    cat.FLEE_HIND = [(t, offset * hind, lift * rise_scale, roll) for t, offset, lift, roll in cat.FLEE_HIND]


def key_poses(rig, species):
    animation = rig.animation_data_create()
    for clip, frames in DURATIONS.items():
        action = bpy.data.actions.new(clip.lower())
        action.use_fake_user = True
        animation.action = action
        previous = {}
        for i in range(frames + 1):
            cat.pose_cat(rig, "Flee" if clip == "Chase" else clip, i / frames,
                         previous, TAIL_SLOPE[species])
            for bone in rig.pose.bones:
                bone.keyframe_insert("location", frame=i + 1, group=bone.name)
                bone.keyframe_insert("rotation_quaternion", frame=i + 1, group=bone.name)
        for curve in action.layers[0].strips[0].channelbags[0].fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        animation.action = None
    animation.action = bpy.data.actions["idle"]


def fit_sprite_head(mesh, species):
    width, height, drop, ear = SHAPE[species]
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}
    for vertex in mesh.data.vertices:
        part = next((parts[g.group] for g in vertex.groups if g.group in parts), "")
        if part.startswith(("Head", "Ear", "Eye", "Nose", "Lower")):
            delta = vertex.co - cat.HEAD_ORIGIN
            z = delta.z * height + drop
            if part.startswith("Ear"):
                z += max(0, delta.z - .16) * ear
            vertex.co = cat.HEAD_ORIGIN + cat.V((delta.x * width, delta.y * height, z))
        elif species == "lion" and part == "Layered lion mane":
            delta = vertex.co - cat.HEAD_ORIGIN
            vertex.co = cat.HEAD_ORIGIN + cat.V((delta.x * 1.17, delta.y * 1.08, delta.z * 1.17))


def coat_marking(species, p):
    if species == "tiger":
        return math.cos(p.y * 23 + abs(p.x) * 5 - p.z * 2.6) > .38
    if species in {"lion", "panther"}:
        return False
    mx = (p.y * 6.8 + p.z * 2.2) % 1 - .5
    my = (p.z * 7.5 + abs(p.x) * 2.6 + math.floor(p.y * 6.8) * .43) % 1 - .5
    radius = mx * mx + my * my
    return .042 < radius < .125 if species in {"jaguar", "leopard"} else radius < .072


def repaint_draft(mesh, species):
    atlas = next(node.image for node in mesh.data.materials[0].node_tree.nodes
                 if node.type == "TEX_IMAGE")
    first = 48
    pixels = list(atlas.pixels)
    for i, value in enumerate(COATS[species].split()):
        index = (first + i * 2) * 4
        rgb = [int(value[offset:offset + 2], 16) / 255 for offset in (0, 2, 4)]
        pixels[index:index + 8] = [*rgb, 1] * 2
    atlas.pixels[:] = pixels
    atlas.pack()
    uvs = mesh.data.uv_layers.active.data
    parts = {g.index: g.name.removeprefix("Part · ") for g in mesh.vertex_groups
             if g.name.startswith("Part · ")}
    for face in mesh.data.polygons:
        vertex = mesh.data.vertices[face.vertices[0]]
        part = next((parts[g.group] for g in vertex.groups if g.group in parts), "")
        p = face.center
        upper = face.normal.z
        shade = 4 if upper > .53 else 2 if upper < -.12 else 3
        if part in {"Body", "fore.L", "fore.R", "hind.L", "hind.R"}:
            if p.z < .26:
                shade = 1 if upper < .40 else 2
            elif p.z > .40 and (upper < .53 or species == "tiger"):
                if coat_marking(species, p):
                    shade = 1
                elif upper < -.45 and p.z > .48:
                    shade = 5
        elif part.startswith("Ear"):
            tip = {"bobcat": 1.43, "lynx": 1.45, "cheetah": 1.40}.get(species, 1.44)
            shade = 0 if p.z > tip else 2 if face.normal.y > .1 else 3
        elif part == "Head":
            if p.z < .97:
                shade = 5 if upper < .24 else 3
            if species == "cheetah" and p.y > 1.01 and .12 < abs(p.x) < .23 and .95 < p.z < 1.11:
                shade = 0
        elif part in {"Nose and muzzle", "Lower jaw"}:
            shade = 0 if p.y > 1.21 and p.z > .88 else 5
        elif part == "Tail":
            if species in {"bobcat", "lynx"}:
                shade = 0 if p.y < cat.TAIL[3].y else 3
            elif species in {"cheetah", "leopard", "tiger"}:
                shade = 1 if math.cos(p.y * 19) > .2 or p.y < cat.TAIL[3].y else 3
            else:
                shade = 1 if p.y < cat.TAIL[3].y else 3
        elif part in {"Layered lion mane", "Lion tail tuft"}:
            shade = 1 if upper > .08 else 0
        elif part.startswith("Eye"):
            continue
        index = first + 2 * shade
        uv = ((index % 8 + 1) / 8, (index // 8 + .5) / 8)
        for loop in face.loop_indices:
            uvs[loop].uv = uv


def main():
    species, source, destination = sys.argv[sys.argv.index("--") + 1:]
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()), use_scripts=False)
    rig, = (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    mesh, = (obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    assert set(bpy.data.actions.keys()) == {"Idle", "Walk", "Feed", "Display"}
    configure_pose(rig, species)
    fit_sprite_head(mesh, species)
    repaint_draft(mesh, species)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    key_poses(rig, species)
    scene = bpy.context.scene
    scene.frame_set(1)
    scene["Animation clips"] = "idle, walk, feed, display, chase"
    scene["Animation reference"] = f"Tilefun {species} roster-v2 sprite sheet"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(output / "model.glb"), export_format="GLB", export_yup=True,
        export_animation_mode="ACTIONS", export_frame_range=False, export_def_bones=True,
        export_leaf_bone=False, export_texcoords=True,
    )


if __name__ == "__main__":
    main()
