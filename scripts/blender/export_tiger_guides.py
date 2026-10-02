"""Export four integer-grid pose guides from the saved tiger rig, without saving it.

blender --background art-source/blender/tiger.blend --python scripts/blender/export_tiger_guides.py
"""
import json
import math
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

REPO = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
assert scene.get("tilefun_asset") == "blender-tiger-demo"
directions = [("down", 0), ("up", math.pi), ("left", -math.pi/2+.3), ("right", math.pi/2-.3)]
guides = {}


def project(point):
    p = world_to_camera_view(scene, scene.camera, rig.matrix_world @ point)
    return [round(p.x*32), round((1-p.y)*32)]


def skin_point(bone, point):
    return project(rig.pose.bones[bone].matrix @ rig.data.bones[bone].matrix_local.inverted() @ Vector(point))


for direction, angle in directions:
    rig.rotation_euler.z = angle
    guides[direction] = []
    for frame in (1, 3, 5, 7):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        guides[direction].append({
            "blenderFrame": frame,
            "head": skin_point("head", (0, -.025, 1.74)),
            "body": skin_point("body", (0, 0, .95)),
            "feet": [skin_point(f"leg.{side}", (sign*.19, -.095, .13)) for side,sign in (("L",-1),("R",1))],
            "hands": [skin_point(f"arm.{side}", (sign*.43, -.03, .72)) for side,sign in (("L",-1),("R",1))],
            "tail": [project(rig.pose.bones[f"tail.{i}"].head) for i in range(4)] + [project(rig.pose.bones["tail.3"].tail)],
        })
output = REPO/"art-source"/"pixel-tiger"/"pose-guides.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"source": "art-source/blender/tiger.blend", "grid": 32, "frames": [1,3,5,7], "directions": guides},indent=2)+"\n",encoding="utf-8")
print("Exported tiger guides:", output)
