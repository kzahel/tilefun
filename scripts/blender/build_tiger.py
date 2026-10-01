"""Build a small skinned tiger and render four directional walk cycles in Blender.

Run with Blender --background --python, or send this file through blender_mcp.py.
Use --preview for four representative frames before the full 32-frame render.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

REPO = Path(__file__).resolve().parents[2]
RAW = REPO / "data" / "blender-tiger" / "raw"
SOURCE = REPO / "art-source" / "blender" / "tiger.blend"
RAW.mkdir(parents=True, exist_ok=True)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
PREVIEW = globals().get("PREVIEW_ONLY", False) or "--preview" in sys.argv
SIZE, FRAMES, FPS = 32, 8, 8
PALETTE = ["292334", "563247", "9b492e", "c56b32", "eb983e", "ffd06c",
           "9e8175", "d7b88c", "ffe4aa", "fff2d0", "ad6870", "ec9990"]
DIRECTIONS = [("down", 0), ("up", math.pi), ("left", -math.pi/2+.3), ("right", math.pi/2-.3)]

scene = bpy.data.scenes.new("Tiger sprite studio")
scene["tilefun_asset"] = "blender-tiger-demo"
bpy.context.window.scene = scene
engines = {v.identifier for v in scene.render.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
# Render larger, then point-sample onto the sprite grid before palette mapping.
# Eevee's filtering at 32px otherwise washes out pupils and narrow stripes.
scene.render.resolution_x = scene.render.resolution_y = SIZE * 4
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, FRAMES
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.world = bpy.data.worlds.new("Tiger ambient")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.25


def linear_color(hex_color):
    rgb = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(v/12.92 if v <= 0.04045 else ((v+0.055)/1.055)**2.4 for v in rgb) + (1,)


def material(name, colors):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    if len(colors) == 1:
        emission.inputs[0].default_value = linear_color(colors[0])
    else:
        diffuse = nodes.new("ShaderNodeBsdfDiffuse")
        rgb = nodes.new("ShaderNodeShaderToRGB")
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        for i in range(len(colors)-2):
            ramp.color_ramp.elements.new((i+1)/len(colors))
        for i, (element, color) in enumerate(zip(ramp.color_ramp.elements, colors)):
            element.position = [0, 0.25, 0.5, 0.8][i]
            element.color = linear_color(color)
        links = mat.node_tree.links
        links.new(diffuse.outputs[0], rgb.inputs[0])
        links.new(rgb.outputs[0], ramp.inputs[0])
        links.new(ramp.outputs[0], emission.inputs[0])
    mat.node_tree.links.new(emission.outputs[0], output.inputs[0])
    return mat


orange = material("Tiger orange bands", PALETTE[2:6])
cream = material("Warm cream bands", PALETTE[6:10])
ink = material("Stripes and pupils", [PALETTE[0]])
pink = material("Inner ear and nose", [PALETTE[11]])
white = material("Eye sparkle", [PALETTE[9]])
meshes = []

# Real armature; primitives have rigid skin weights, tail has blended weights.
armature = bpy.data.armatures.new("Tiger skeleton")
rig = bpy.data.objects.new("Tiger rig", armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bone_specs = {
    "root": ((0, 0, 0), (0, 0, .3), None),
    "body": ((0, 0, .65), (0, 0, 1.3), "root"),
    "head": ((0, 0, 1.3), (0, 0, 2.0), "body"),
    "leg.L": ((-.19, 0, .62), (-.19, 0, .12), "root"),
    "leg.R": ((.19, 0, .62), (.19, 0, .12), "root"),
    "arm.L": ((-.32, 0, 1.18), (-.43, 0, .75), "body"),
    "arm.R": ((.32, 0, 1.18), (.43, 0, .75), "body"),
}
tail_path = [Vector(p) for p in [(0,.23,.7), (.2,.46,.83), (.45,.57,1.07), (.54,.55,1.37), (.4,.5,1.58)]]
for i in range(4):
    bone_specs[f"tail.{i}"] = (tail_path[i], tail_path[i+1], "body" if i == 0 else f"tail.{i-1}")
for name, (head, tail, parent) in bone_specs.items():
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = head, tail
    if parent:
        bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
rig.select_set(False)
rig.show_in_front = True


def skin(obj, bone):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent = rig
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    modifier = obj.modifiers.new("Skin to tiger skeleton", "ARMATURE")
    modifier.object = rig
    meshes.append(obj)
    return obj


def ellipsoid(name, location, scale, mat, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name, obj.scale = name, scale
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return skin(obj, bone)


def surface_patch(name, points, mat, bone):
    if name.startswith(("Cheek stripe", "Forehead stripe")):
        # Project markings onto the head instead of burying flat patches in it.
        points = [(x,-.025-.36*math.sqrt(max(0,1-(x/.49)**2-((z-1.74)/.43)**2))-.025,z) for x,_,z in points]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], [tuple(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    # Close the patch so it remains visible from the side and rear.
    shell = obj.modifiers.new("Closed marking", "SOLIDIFY")
    shell.thickness = .008
    return skin(obj, bone)


ellipsoid("Round body", (0,0,.95), (.34,.27,.46), orange, "body")
ellipsoid("Cream tummy", (0,-.241,.96), (.22,.054,.3), cream, "body")
ellipsoid("Oversized head", (0,-.025,1.74), (.49,.36,.43), orange, "head")
for sign, suffix in [(-1,"L"),(1,"R")]:
    # Pointed ears, broad enough to survive at 32 pixels.
    x = sign * .33
    points = [(x-.14,-.05,1.98),(x+.14,-.05,1.98),(x+sign*.065,-.015,2.32)]
    surface_patch(f"Ear {suffix}", points, orange, "head")
    surface_patch(f"Inner ear {suffix}", [(x-.085,-.062,2.03),(x+.085,-.062,2.03),(x+sign*.045,-.04,2.23)], pink, "head")
    ellipsoid(f"Cheek {suffix}", (sign*.15,-.353,1.59), (.18,.082,.13), cream, "head")
    ellipsoid(f"Eye cream {suffix}", (sign*.18,-.38,1.83), (.13,.06,.145), cream, "head")
    ellipsoid(f"Eye {suffix}", (sign*.18,-.435,1.83), (.085,.04,.108), ink, "head")
    ellipsoid(f"Eye sparkle {suffix}", (sign*.157,-.475,1.87), (.023,.012,.026), white, "head")
    ellipsoid(f"Leg {suffix}", (sign*.19,0,.35), (.14,.15,.29), orange, f"leg.{suffix}")
    ellipsoid(f"Paw {suffix}", (sign*.19,-.095,.13), (.16,.22,.13), cream, f"leg.{suffix}")
    ellipsoid(f"Arm {suffix}", (sign*.4,-.005,.91), (.105,.13,.28), orange, f"arm.{suffix}")
    ellipsoid(f"Hand {suffix}", (sign*.43,-.03,.72), (.12,.14,.13), cream, f"arm.{suffix}")
    # Cheek stripes wrap onto each side of the spherical head.
    for i in range(2):
        z = 1.66+i*.17
        surface_patch(f"Cheek stripe {suffix} {i}", [(sign*.33,-.30,z+.05),(sign*.47,-.19,z+.08),(sign*.48,-.14,z),(sign*.33,-.31,z-.02)], ink, "head")
    for i in range(2):
        z = .89+i*.2
        surface_patch(f"Flank stripe {suffix} {i}", [(sign*.24,-.16,z+.065),(sign*.336,-.015,z+.03),(sign*.335,.12,z-.015),(sign*.24,-.16,z-.03)], ink, "body")
    for i in range(2):
        ellipsoid(f"Arm stripe {suffix} {i}", (sign*.405,-.12,.89+i*.15), (.103,.018,.034), ink, f"arm.{suffix}")

ellipsoid("Nose", (0,-.436,1.62), (.052,.035,.034), pink, "head")
surface_patch("Smile", [(-.06,-.432,1.56),(0,-.442,1.53),(.06,-.432,1.56),(.055,-.434,1.54),(0,-.445,1.51),(-.055,-.434,1.54)], ink, "head")
for x in [-.13,0,.13]:
    surface_patch("Forehead stripe", [(x-.04,-.302,1.96),(x+.04,-.302,1.96),(x+.025,-.356,1.83),(x-.018,-.356,1.83)], ink, "head")
# Rear markings make the up-facing view intentional, not a blank orange blob.
for z in [1.54,1.73,1.92]:
    y = .335*math.sqrt(max(0,1-((z-1.74)/.43)**2))-.025
    ellipsoid("Back head stripe", (0,y+.05,z), (.24,.04,.048), ink, "head")
for z in [.82,1.05,1.23]:
    ellipsoid("Back body stripe", (0,.29,z), (.23,.045,.055), ink, "body")

# Smooth skinned tube along the tail chain, with actual orange/dark face bands.
verts, faces, weights = [], [], []
rings, sides = 33, 10
for ring in range(rings):
    t = ring/(rings-1)*4
    seg = min(3,int(t))
    frac = t-seg
    p = tail_path[seg].lerp(tail_path[seg+1],frac)
    tangent = (tail_path[seg+1]-tail_path[seg]).normalized()
    u = tangent.cross(Vector((0,0,1))).normalized()
    v = tangent.cross(u).normalized()
    radius = .075*(1-.45*t/4)
    for side in range(sides):
        a = math.tau*side/sides
        verts.append(tuple(p+radius*(math.cos(a)*u+math.sin(a)*v)))
        # Blend toward the following segment at each joint.
        nxt = min(3,seg+1)
        weights.append((seg,nxt,max(0,(frac-.5)*2) if nxt != seg else 0))
for ring in range(rings-1):
    for side in range(sides):
        a = ring*sides+side
        b = ring*sides+(side+1)%sides
        faces.append((a,b,b+sides,a+sides))
faces.extend([tuple(reversed(range(sides))),tuple((rings-1)*sides+i for i in range(sides))])
mesh = bpy.data.meshes.new("Tail skinned tube")
mesh.from_pydata(verts,[],faces)
mesh.update()
tail = bpy.data.objects.new("Curved striped tail",mesh)
scene.collection.objects.link(tail)
tail.data.materials.append(orange)
tail.data.materials.append(ink)
for i, face in enumerate(mesh.polygons):
    face.use_smooth = True
    face.material_index = 1 if ((i//sides)//3)%3 == 1 else 0
tail.parent = rig
groups = [tail.vertex_groups.new(name=f"tail.{i}") for i in range(4)]
for index,(bone,nxt,w) in enumerate(weights):
    groups[bone].add([index],1-w,"REPLACE")
    if nxt != bone and w:
        groups[nxt].add([index],w,"REPLACE")
modifier = tail.modifiers.new("Flexible tail skin","ARMATURE")
modifier.object = rig
meshes.append(tail)
assert all(abs(sum(g.weight for g in vertex.groups)-1) < .0001 for vertex in mesh.vertices), "Tail weights must be normalized"

camera_data = bpy.data.cameras.new("Fixed sprite camera")
camera = bpy.data.objects.new(camera_data.name,camera_data)
scene.collection.objects.link(camera)
camera.location = (0,-8,5)
target = Vector((0,0,1.12))
camera.rotation_euler = (target-camera.location).to_track_quat("-Z","Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 2.95
scene.camera = camera
light_data = bpy.data.lights.new("Fixed upper-left softbox","AREA")
light_data.energy, light_data.size = 500, 4
light = bpy.data.objects.new(light_data.name,light_data)
scene.collection.objects.link(light)
light.location = (-3,-4,7)
light.rotation_euler = (target-light.location).to_track_quat("-Z","Y").to_euler()

# One in-place walk action. Eight sampled poses plus a closing key at nine.
# Contact feet move backward through stance; the demo moves the root separately.
for frame in range(1,FRAMES+2):
    phase = math.tau*(frame-1)/FRAMES
    body = rig.pose.bones["body"]
    body.location = (.016*math.sin(phase),.028*(1-math.cos(phase*2)),0)
    body.rotation_mode = "XYZ"
    body.rotation_euler = (0,0,.025*math.sin(phase))
    body.keyframe_insert("location",frame=frame)
    body.keyframe_insert("rotation_euler",frame=frame)
    head = rig.pose.bones["head"]
    head.rotation_mode = "XYZ"
    head.rotation_euler = (.02*math.cos(phase*2),0,-.035*math.sin(phase))
    head.keyframe_insert("rotation_euler",frame=frame)
    for side,offset in [("L",0),("R",math.pi)]:
        p = phase+offset
        leg = rig.pose.bones[f"leg.{side}"]
        # Local Y follows the vertical downward bone; local Z is forward/back.
        leg.location = (0,-.09*max(0,math.sin(p)),.13*math.cos(p))
        leg.keyframe_insert("location",frame=frame)
        arm = rig.pose.bones[f"arm.{side}"]
        arm.rotation_mode = "XYZ"
        arm.rotation_euler = (.38*math.cos(p+math.pi),0,.04*math.sin(p))
        arm.keyframe_insert("rotation_euler",frame=frame)
    for i in range(4):
        bone = rig.pose.bones[f"tail.{i}"]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (.07*math.sin(phase-i*.45),.16*math.sin(phase-i*.5),.12*math.cos(phase-i*.45))
        bone.keyframe_insert("rotation_euler",frame=frame)
action = rig.animation_data.action
action.name = "Tiger Walk - in place"
curves = list(action.fcurves) if hasattr(action,"fcurves") else [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
for curve in curves:
    for key in curve.keyframe_points:
        key.interpolation = "BEZIER"
        key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
    curve.modifiers.new("CYCLES")

# Validate real deformation rather than just keyframes on an unused skeleton.
depsgraph = bpy.context.evaluated_depsgraph_get()
scene.frame_set(1)
first = [v.co.copy() for v in tail.evaluated_get(depsgraph).data.vertices]
scene.frame_set(3)
later = [v.co.copy() for v in tail.evaluated_get(depsgraph).data.vertices]
tail_displacement = max((a-b).length for a,b in zip(first,later))
assert tail_displacement > .01, "Tail skeleton does not deform its visible mesh"
scene.frame_set(1)
rig.rotation_euler.z = 0
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.type = "MATERIAL"
# Save just this studio and its dependencies, never unrelated live-session scenes.
bpy.data.libraries.write(str(SOURCE),{scene},fake_user=True,compress=True)
# Keep the editable 3D eyes in the source. Sprite eyes are authored as stable
# pixel clusters by the packer, rather than resampled separately every pose.
for obj in meshes:
    if obj.name.startswith("Eye"):
        obj.hide_render = True
eye_anchors = {}
for direction,angle in DIRECTIONS:
    rig.rotation_euler.z = angle
    eye_anchors[direction] = []
    for frame in ([1] if PREVIEW else range(1,FRAMES+1)):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        # One head-bound anchor per view keeps the front eye spacing constant.
        # Side views expose only the near eye; the back view has no face marks.
        point = Vector((0, -.435, 1.83)) if direction in ("down", "up") else Vector((.18 if direction == "left" else -.18, -.30, 1.83))
        head_transform = rig.pose.bones["head"].matrix @ armature.bones["head"].matrix_local.inverted()
        projected = world_to_camera_view(scene, camera, rig.matrix_world @ head_transform @ point)
        eye_anchors[direction].append([math.floor(projected.x*SIZE), math.floor((1-projected.y)*SIZE)])
        scene.render.filepath = str(RAW/f"{direction}-{frame:02}.png")
        bpy.ops.render.render(write_still=True)
for obj in meshes:
    if obj.name.startswith("Eye"):
        obj.hide_render = False
rig.rotation_euler.z = 0
scene.frame_set(1)
report = {"frameWidth":SIZE,"frameHeight":SIZE,"renderWidth":SIZE*4,"frameCount":FRAMES,"fps":FPS,
          "directions":[d for d,_ in DIRECTIONS],"palette":["#"+c for c in PALETTE],
          "pivot":[16,27],"tailDeformation":round(tail_displacement,4),
          "blenderVersion":bpy.app.version_string,"bones":len(armature.bones),
          "eyeAnchors":eye_anchors,
          "source":"Original procedural tiger; Blender rig, geometry and materials"}
(RAW.parent/"render.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report))
