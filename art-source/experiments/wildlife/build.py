"""Build an editable model and portable animation clips for one Tilefun animal."""
from importlib import import_module
import json
from pathlib import Path
import struct
import sys

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "cat"))
from build import CatSurface, V, aimed, euler, mix, rows, smooth, solve_knee, stride, transform

FPS = 24


def armature(name, joints):
    data = bpy.data.armatures.new(name + " skeleton")
    rig = bpy.data.objects.new(name + " Rig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone_name, head, tail, parent in joints:
        bone = data.edit_bones.new(bone_name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.data.display_type = "STICK"
    return rig


def key_actions(rig, durations, pose, animate_scale=False):
    animation = rig.animation_data_create()
    rest = {bone.name: bone.matrix_local for bone in rig.data.bones}
    for name, frames in durations.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        animation.action = action
        prev = {}
        for frame in range(frames + 1):
            world = pose(rig, rest, name, frame / frames)
            for bone in rig.pose.bones:
                parent = bone.parent
                parents = (dict(parent_matrix=world[parent.name], parent_matrix_local=rest[parent.name])
                           if parent else {})
                local = bone.bone.convert_local_to_pose(
                    world[bone.name], rest[bone.name], invert=True, **parents
                )
                position, rotation, scale = local.decompose()
                if bone.name in prev:
                    rotation.make_compatible(prev[bone.name])
                prev[bone.name] = rotation.copy()
                bone.rotation_mode = "QUATERNION"
                bone.location = position
                bone.rotation_quaternion = rotation
                bone.keyframe_insert("location", frame=frame + 1, group=bone.name)
                bone.keyframe_insert("rotation_quaternion", frame=frame + 1, group=bone.name)
                if animate_scale:
                    bone.scale = scale
                    bone.keyframe_insert("scale", frame=frame + 1, group=bone.name)
        for curve in action.layers[0].strips[0].channelbags[0].fcurves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"
        animation.action = None
    animation.action = bpy.data.actions["idle"]


def run(species_id, destination, *args):
    # Make helper functions available under a stable name to species modules.
    sys.modules["wildlife_build"] = sys.modules[__name__]
    species = import_module(species_id.replace("-", "_"))
    for option in args:
        if option in ("--rollout", "--grazers"):
            if option == "--grazers":
                species.configure_grazers()
            else:
                species.configure_rollout()
        else:
            species.configure(option)
    output = Path(destination).resolve()
    output.mkdir(parents=True, exist_ok=True)
    config_path = output / "config.json"
    selected_clips = (json.loads(config_path.read_text()).get("exportClips")
                      if config_path.is_file() else None)
    if selected_clips:
        species.DURATIONS = {clip: species.DURATIONS[clip] for clip in selected_clips}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.view_settings.view_transform = "Standard"
    rig = armature(species.NAME, species.joints())
    mesh = species.surface().make(rig, species.PALETTE, species.NAME)
    key_actions(rig, species.DURATIONS, species.pose, getattr(species, "ANIMATES_SCALE", False))
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, species.DURATIONS["idle"] + 1
    scene.frame_set(1)
    scene["Animation clips"] = ", ".join(species.DURATIONS)
    scene["Axis convention"] = "Blender +Y forward, Z up. glTF -Z forward, Y up."
    rig.select_set(False)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                view = area.spaces.active
                view.shading.type = "MATERIAL"
                view.region_3d.view_distance = 4.3
                view.region_3d.view_location = (0, 0, .72)
                view.region_3d.view_rotation = euler(1.13, 0, .69)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "model.blend"))
    glb_path = output / "model.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path), export_format="GLB", export_yup=True,
        export_texcoords=True, export_animation_mode="ACTIONS",
        export_frame_range=False, export_def_bones=True, export_leaf_bone=False,
    )
    blob = glb_path.read_bytes()
    length, = struct.unpack_from("<I", blob, 12)
    gltf = json.loads(blob[20:20 + length])
    primitives = [p for m in gltf["meshes"] for p in m["primitives"]]
    clips = {a["name"]: len(a["channels"]) for a in gltf["animations"]}
    assert clips.keys() == species.DURATIONS.keys(), clips
    assert len(gltf["skins"]) == len(gltf["images"]) == 1
    assert "KHR_materials_unlit" in gltf["extensionsUsed"]
    assert gltf["samplers"][0]["magFilter"] == 9728
    report = {
        "animal": species.NAME, "blender": bpy.app.version_string,
        "triangles": sum(gltf["accessors"][p["indices"]]["count"] // 3 for p in primitives),
        "primitives": len(primitives), "materials": len(gltf["materials"]),
        "texture": [8, 8], "glbBytes": len(blob), "bones": len(rig.data.bones),
        "clipSeconds": {name: frames / FPS for name, frames in species.DURATIONS.items()},
    }
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    run(*sys.argv[sys.argv.index("--") + 1:])
