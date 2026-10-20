"""Read-only Blender source inventory for the shared-depth investigation.

blender --background --factory-startup --disable-autoexec --python
  scripts/instrumentation/inspect-3d-sources.py -- --output data/3d-investigation/source-audit.json
Add --trial-export for disposable GLB exports beside the report.
No source saves, renders or production-asset writes.
"""
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [
    "art-source/blender/tiger.blend",
    "art-source/wildlife-v2/tiger/pilot-v1/animal.blend",
    "art-source/wildlife-v2/rabbit/behavior-v1/rabbit.blend",
    "art-source/vehicle-riders/explorer-upright/v1/low.blend",
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def glb_summary(path):
    data = path.read_bytes()
    length, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + length])
    primitives = [part for mesh in doc.get("meshes", []) for part in mesh["primitives"]]
    return {
        "bytes": len(data), "sha256": sha(path), "meshes": len(doc.get("meshes", [])),
        "primitives": len(primitives), "skins": len(doc.get("skins", [])),
        "animations": [{"name": clip.get("name"), "channels": len(clip["channels"])} for clip in doc.get("animations", [])],
        "materials": len(doc.get("materials", [])), "images": len(doc.get("images", [])),
        "materialBaseColors": [{"name": material.get("name"),
                                 "rgba": material.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1]),
                                 "emissive": material.get("emissiveFactor", [0, 0, 0])}
                                for material in doc.get("materials", [])],
        "extensionsUsed": doc.get("extensionsUsed", []),
        "triangles": sum(doc["accessors"][part["indices"]]["count"] // 3 for part in primitives if "indices" in part),
    }


def inspect(relative, output, trial_export):
    path = ROOT / relative
    before = sha(path)
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    visible = [obj for obj in meshes if not obj.hide_render]
    frame = scene.frame_current
    scene.frame_set(scene.frame_start)
    graph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    for obj in visible:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    frames = sorted({scene.frame_start, (scene.frame_start + scene.frame_end) // 2, scene.frame_end})
    samples = []
    armatures = [obj for obj in scene.objects if obj.type == "ARMATURE"]
    bone_samples = []
    for f in frames:
        scene.frame_set(f)
        bpy.context.view_layer.update()
        samples.append({obj.name: tuple(round(v, 7) for row in obj.matrix_world for v in row) for obj in visible})
        bone_samples.append({obj.name: tuple(round(v, 7) for bone in obj.pose.bones for row in bone.matrix for v in row) for obj in armatures})
    changed = [obj.name for obj in visible if len({s[obj.name] for s in samples}) > 1]
    materials = {material for obj in visible for material in obj.data.materials if material}
    node_types = sorted({node.bl_idname for material in materials if material.node_tree for node in material.node_tree.nodes})
    images = [image for image in bpy.data.images if image.type == "IMAGE" and image.users]
    camera = scene.camera
    result = {
        "source": relative, "sourceSha256": before, "bytes": path.stat().st_size,
        "sceneMeshes": len(meshes), "renderVisibleMeshes": len(visible),
        "renderVisibleEvaluatedTriangles": triangles,
        "hiddenMeshNames": [obj.name for obj in meshes if obj.hide_render],
        "uvMappedVisibleMeshes": sum(bool(obj.data.uv_layers) for obj in visible),
        "visibleMaterials": len(materials), "materialNodeTypes": node_types,
        "usedImages": [{"name": image.name, "width": image.size[0], "height": image.size[1],
                        "packed": bool(image.packed_file)} for image in images],
        "armatures": [{"name": obj.name, "bones": len(obj.data.bones)} for obj in armatures],
        "armatureModifiedMeshes": sum(any(mod.type == "ARMATURE" for mod in obj.modifiers) for obj in visible),
        "otherModifierTypes": sorted({mod.type for obj in visible for mod in obj.modifiers if mod.type != "ARMATURE"}),
        "actions": len(bpy.data.actions),
        "animatedObjects": sum(bool(obj.animation_data and (obj.animation_data.action or obj.animation_data.nla_tracks)) for obj in scene.objects),
        "sampledFrames": frames, "meshesWithChangedWorldMatrixInSamples": len(changed),
        "armaturesWithChangedPoseInSamples": sum(len({sample[obj.name] for sample in bone_samples}) > 1 for obj in armatures),
        "savedFrame": frame,
        "frameRange": [scene.frame_start, scene.frame_end], "fps": scene.render.fps / scene.render.fps_base,
        "camera": None if not camera else {"type": camera.data.type, "orthoScale": camera.data.ortho_scale},
        "renderSize": [scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage],
        "sourceUnchanged": sha(path) == before,
    }
    if trial_export:
        scene.frame_set(scene.frame_start)
        target = output.parent / (relative.removeprefix("art-source/").replace("/", "--").removesuffix(".blend") + ".glb")
        assert not target.exists(), "Use a fresh ignored output directory for trial exports"
        try:
            bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", use_visible=True,
                                      export_cameras=False, export_lights=False, export_animations=True,
                                      export_frame_range=True, export_force_sampling=True)
            result["trialExport"] = {"status": "exported, unqualified", "artifact": target.name, **glb_summary(target)}
        except Exception as error:
            result["trialExport"] = {"status": "failed", "error": str(error)}
    result["sourceUnchanged"] = sha(path) == before
    assert result["sourceUnchanged"]
    return result


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--trial-export", action="store_true")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
output = (ROOT / args.output).resolve()
assert output.is_relative_to(ROOT / "data"), "Raw inspection evidence belongs in ignored data/"
output.parent.mkdir(parents=True, exist_ok=True)
report = {"schema": "tilefun-3d-source-inspection-v1", "blender": bpy.app.version_string,
          "scope": "Four representative sources; optional scratch exports, no art/runtime qualification",
          "inspectorSha256": sha(Path(__file__)), "sources": [inspect(source, output, args.trial_export) for source in SOURCES]}
output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
print("SOURCE_INSPECTION_OK", len(report["sources"]), str(args.output))
