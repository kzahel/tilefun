"""Key four grounded or flying bird actions on the exact editable campaign draft.

Run in Blender with -- SPECIES ARCHIVED_BLEND OUTPUT_DIRECTORY.
"""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
spec = spec_from_file_location("wildlife_build", HERE / "build.py")
wildlife_build = module_from_spec(spec)
sys.modules["wildlife_build"] = wildlife_build
spec.loader.exec_module(wildlife_build)
import bird

SEABIRD_LENGTH = {
    "atlantic-puffin": 1.13,
    "blue-footed-booby": 1.34,
    "great-frigatebird": 1.45,
    "pelican": 1.55,
}


def part_vertices(mesh, name):
    group = mesh.vertex_groups[f"Part · {name}"].index
    return [vertex for vertex in mesh.data.vertices if any(g.group == group for g in vertex.groups)]


def articulate_bill(rig, mesh, species):
    bill = part_vertices(mesh, "Sculpted bill")
    root_y = min(v.co.y for v in bill)
    tip_y = max(v.co.y for v in bill)
    root_z = (min(v.co.z for v in bill) + max(v.co.z for v in bill)) / 2
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    jaw = rig.data.edit_bones.new("jaw")
    jaw.head = (0, root_y, root_z)
    jaw.tail = (0, tip_y, root_z)
    jaw.parent = rig.data.edit_bones["head"]
    bpy.ops.object.mode_set(mode="OBJECT")
    jaw_group = mesh.vertex_groups.new(name="jaw")
    head_group = mesh.vertex_groups["head"]
    for vertex in bill:
        progress = (vertex.co.y - root_y) / (tip_y - root_y)
        seam = root_z + (.042 if species == "pelican" else -.012) - .02 * progress
        lower = min(1, max(0, (seam - vertex.co.z) / .045))
        weight = lower * min(1, progress * 5)
        if weight > 0:
            jaw_group.add([vertex.index], weight, "REPLACE")
            head_group.add([vertex.index], 1 - weight, "REPLACE")


def fork_frigatebird_tail(mesh):
    feathers = part_vertices(mesh, "Tail feather fan")
    assert len(feathers) % 3 == 0
    count = len(feathers) // 3
    for index, vertex in enumerate(feathers):
        offset = vertex.co - bird.TAIL
        if index // count == 1:
            vertex.co.y = bird.TAIL.y + offset.y * .56
        else:
            sign = 1 if offset.x > 0 else -1
            spread = (-offset.y / bird.TAIL_LEN) ** 2
            vertex.co += Vector((sign * .18 * spread, offset.y * .43, 0))
    mesh.data.update()


def extend_kiwi_bill(mesh):
    bill = part_vertices(mesh, "Sculpted bill")
    root_y = min(vertex.co.y for vertex in bill)
    for vertex in bill:
        reach = vertex.co.y - root_y
        vertex.co.x *= 1.2
        vertex.co.y += .34 * reach
        vertex.co.z -= .17 * reach
    mesh.data.update()


def detail_cassowary(mesh, rig):
    for vertex in part_vertices(mesh, "Crown or crest"):
        vertex.co.z += .23 * max(0, vertex.co.z - bird.HEAD.z)
    for side in ("l", "r"):
        center = rig.data.bones[f"foot.{side}"].head_local.x
        for vertex in part_vertices(mesh, f"Leg and toes {side}"):
            vertex.co.x = center + 1.30 * (vertex.co.x - center)
    mesh.data.update()


def paint_sprite_markings(mesh, species):
    """Use the draft's packed palette on the surfaces seen at gameplay zoom."""
    parts = {group.index: group.name.removeprefix("Part · ") for group in mesh.vertex_groups
             if group.name.startswith("Part · ")}
    palette = tuple(bird.PALETTE)
    uvs = mesh.data.uv_layers.active.data

    def swatch(color):
        if color == "casque":
            return (7 / 8, 7.5 / 8)
        index = 2 * palette.index(color)
        return ((index % 8 + 1) / 8, (index // 8 + .5) / 8)

    if species == "cassowary":
        material = mesh.data.materials[0]
        atlas = next(node.image for node in material.node_tree.nodes if node.type == "TEX_IMAGE")
        pixels = list(atlas.pixels)
        pixels[-8:] = [194 / 255, 173 / 255, 116 / 255, 1] * 2
        atlas.pixels[:] = pixels
        atlas.pack()

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
        elif species == "atlantic-puffin" and part == "Sculpted bill":
            color = "accent" if point.y < bird.HEAD.y + .26 and point.z < bird.HEAD.z else "bill"
        elif species == "blue-footed-booby" and toes:
            color = "feet"
        elif species == "great-frigatebird" and part == "Sculpted bill":
            color = "bill" if face.normal.z > -.4 else "mantle"
        elif species == "pelican":
            if wing and point.y < bird.BODY.y - .31:
                color = "ink" if face.normal.z < .14 else "accent"
            elif part == "Sculpted bill" and point.z < bird.HEAD.z - .06:
                color = "feet" if face.normal.z < -.36 else "bill"
            elif toes:
                color = "ink"
        elif species == "cassowary":
            if part == "Crown or crest":
                color = "casque"
            elif part == "Neck, face and eye patches" and point.z < bird.HEAD.z - .19 and point.y > bird.HEAD.y - .11:
                color = "accent"
        elif species == "emu" and part == "Neck, face and eye patches" and point.z < bird.HEAD.z - .16:
            color = "mask"
        elif species == "ostrich":
            if wing or tail:
                color = "breast" if face.normal.z > -.34 else "light"
            elif part == "Species body and plumage" and uvs[face.loop_start].uv[:] == swatch("breast"):
                color = "mantle" if face.normal.z > -.31 else "ink"
            elif toes or part == "Neck, face and eye patches":
                color = "mask"
        if toes and species in {"dove", "sparrow", "pigeon"}:
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
    travel = "walk" if species in bird.GROUND_POSES else "fly"
    configure = bird.configure_ground_rollout if travel == "walk" else bird.configure_flight_rollout
    configure(species)
    rig.scale.y *= SEABIRD_LENGTH.get(species, 1)
    if species in {"pelican", "blue-footed-booby"}:
        articulate_bill(rig, mesh, species)
    if species == "great-frigatebird":
        fork_frigatebird_tail(mesh)
    if species == "kiwi":
        extend_kiwi_bill(mesh)
    if species == "cassowary":
        detail_cassowary(mesh, rig)
    paint_sprite_markings(mesh, species)
    assert set(bpy.data.actions.keys()) == {"idle", travel, "action"}
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
