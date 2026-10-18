"""Species-specific brown-bear pose source. Run in background Blender; no external art.

Geometry is editable, rigid-volume keyed pieces, not a runtime skinned GLB.
Evaluated guides go to ignored data; retained revisions must never be overwritten.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

SCRIPT_SOURCE = Path(__file__).resolve().parent
ROOT = SCRIPT_SOURCE.parents[3]
scratch = "--workspace" in sys.argv
WORK = ROOT / sys.argv[sys.argv.index("--workspace")+1] if scratch else ROOT / "data/predators-132/brown-bear"
SOURCE = WORK / "source" if scratch else SCRIPT_SOURCE
SOURCE.mkdir(parents=True, exist_ok=True)
assert not (SOURCE / "receipt.json").exists(), "Registered source is immutable; use --workspace for replay."
WORK.mkdir(parents=True, exist_ok=True)
CAMERA = json.loads((ROOT / "art-source/wildlife-v2/camera.json").read_text())
SIZE, ANCHOR, STRIDE, SOLE = 96, (48, 72), .84, .11
CLIPS = {"idle": (1, 1), "walk": (10, 12), "sniff": (30, 8), "display": (50, 8)}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = scene.render.resolution_y = SIZE * 4
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = False
scene.view_settings.view_transform = "Standard"
meshes, stripe_specs = [], []


def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    return m


coat = material("warm ochre coat", (0.572549, 0.380392, 0.239216))
cream = material("ivory underside and muzzle", (0.784314, 0.647059, 0.47451))
ink = material("charcoal stripes", (0.203922, 0.152941, 0.121569))
rose = material("muted nose", (0.188235, 0.14902, 0.117647))
eye = material("amber eye", (0.145098, 0.117647, 0.101961))


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


root = empty("ROOT-ground-anchor")
body = empty("BODY-weight-transfer", root)
head = empty("HEAD-follow", body, (0, 1.30, 1.78))
jaw = empty("JAW-hinge", head, (0, .19, -.14))


def sphere(name, center, radii, mat=coat, parent=body):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.parent, obj.location = parent, center
    obj.data.materials.append(mat)
    meshes.append(obj)
    return obj


def segment(name, length, radius, mat=coat, parent=body):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius,
                                  radius2=radius * .80, depth=length)
    obj = bpy.context.object
    obj.name, obj.parent = name, parent
    obj.data.materials.append(mat)
    meshes.append(obj)
    return obj


def key(obj, frame):
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_quaternion" if obj.rotation_mode == "QUATERNION"
                        else "rotation_euler", frame=frame)


def place(obj, a, b, frame):
    obj.location = (a + b) / 2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    key(obj, frame)


torso = sphere("torso", (0, -.13, 1.31), (.78, 1.00, .62))
shoulder = sphere("shoulder", (0, .62, 1.40), (.74, .62, .69))
pelvis = sphere("pelvis", (0, -.91, 1.30), (.69, .55, .61))
sphere("belly-cream", (0, -.05, 1.045), (.58, .87, .22), coat)
sphere("chest-cream", (0, .90, 1.22), (.47, .32, .40), coat)
sphere("neck", (0, 1.01, 1.57), (.54, .48, .55))
sphere("skull", (0, 0, 0), (.55, .48, .45), parent=head)
for side in [-1, 1]:
    sphere(f"cheek-{side}", (side * .29, .23, -.13), (.23, .29, .22), cream, head)
    sphere(f"muzzle-{side}", (side * .13, .42, -.14), (.22, .26, .17), cream, head)
    sphere(f"eye-{side}", (side * .315, .315, .09), (.058, .04, .053), eye, head)
    sphere(f"ear-{side}", (side * .36, -.06, .32), (.16, .11, .14), ink, head)
    sphere(f"ear-spot-{side}", (side * .36, -.135, .34), (.066, .027, .083), cream, head)
sphere("nose", (0, .65, -.08), (.105, .055, .065), rose, head)
sphere("lower-jaw", (0, .13, -.075), (.30, .23, .09), cream, jaw)

# Unstriped species; markings stay absent in every source pose.
HIPS = {"HL": [-.52, -.85, 1.13], "FL": [-.53, .65, 1.19],
        "HR": [.52, -.85, 1.13], "FR": [.53, .65, 1.19]}
LANDS = {"HL": 0, "FL": 4, "HR": 6, "FR": 10}
LENGTHS = {n: ([.64, .62, .18] if n[0] == "H" else [.61, .60, .18]) for n in HIPS}
legs, paws, muscles = {}, {}, {}
for name in HIPS:
    legs[name] = [segment(f"{name}-{j}", length, [.23, .17, .12][j])
                  for j, length in enumerate(LENGTHS[name])]
    paws[name] = sphere(f"{name}-paw", (0, 0, 0), (.26, .33, SOLE))
    muscles[name] = sphere(f"{name}-haunch", (0, 0, 0), (.26, .28, .33))
tail = [segment(f"tail-{j}", .29, .13 - j * .007,
                coat) for j in range(1)]

bpy.ops.object.camera_add()
cam = bpy.context.object
cam.name, cam.data.type = "CAMERA-contract", "ORTHO"
cam.data.ortho_scale, cam.data.shift_y = SIZE / 10, (ANCHOR[1] - SIZE / 2) / SIZE
cam.location = CAMERA["cameraLocationAtDistance10"]
cam.rotation_euler = (-cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam


def solve(a, b, l1, l2, name):
    axis = b - a
    distance = axis.length
    assert abs(l1 - l2) < distance < l1 + l2, (name, distance)
    direction = axis / distance
    along = (l1*l1 - l2*l2 + distance*distance) / (2*distance)
    hint = Vector((0, 1 if name[0] == "H" else -1, 0))
    bend = (hint - direction * hint.dot(direction)).normalized()
    return a + along*direction + math.sqrt(l1*l1 - along*along)*bend


def pose(clip, index, frame):
    phase = index / 12 if clip == "walk" else 0
    amount = [0, .25, .65, 1, 1, .65, .25, 0][index] if clip in ["sniff", "display"] else 0
    body.location = (.022 * math.sin(math.tau*phase), 0,
                     .085 * (1 - math.cos(2*math.tau*phase))) if clip == "walk" else (0, 0, 0)
    body.rotation_euler.x = math.radians(1.8) * math.sin(math.tau*phase) if clip == "walk" else 0
    key(body, frame)
    head.location = (0, 1.30 + (.08*amount if clip == "sniff" else 0),
                     1.78 + (-.16*amount if clip == "sniff" else .10*amount if clip == "display" else 0))
    head.rotation_euler.x = -body.rotation_euler.x + (math.radians(-9)*amount if clip == "sniff" else 0)
    key(head, frame)
    jaw.rotation_euler.x = math.radians(26) * amount if clip == "display" else 0
    key(jaw, frame)
    bpy.context.view_layer.update()
    basis = body.matrix_basis.copy()
    inverse = basis.inverted()
    joints, contacts = {}, {}
    for name, hip in HIPS.items():
        q = (phase - LANDS[name]/12) % 1 if clip == "walk" else .375
        planted = q <= .75
        advance = STRIDE*.375 - STRIDE*q if planted else -STRIDE*.375 + STRIDE*.75*(q-.75)/.25
        lift = 0 if planted else .19*math.sin(math.pi*(q-.75)/.25)
        foot = Vector((hip[0], hip[1] + advance, SOLE + lift))
        ankle = foot + Vector((0, -.09, math.sqrt(.18**2 - .09**2)))
        foot, ankle = inverse @ foot, inverse @ ankle
        a = Vector(hip)
        knee = solve(a, ankle, *LENGTHS[name][:2], name)
        points = [a, knee, ankle, foot]
        for obj, first, last in zip(legs[name], points, points[1:]):
            place(obj, first, last, frame)
        paws[name].location = foot
        paws[name].rotation_euler.x = -body.rotation_euler.x
        key(paws[name], frame)
        muscles[name].location = a.lerp(knee, .32)
        muscles[name].rotation_euler.x = math.atan2(knee.y-a.y, a.z-knee.z) * .55
        key(muscles[name], frame)
        joints[name] = [list(basis @ p) for p in points]
        contact = basis @ foot - Vector((0, 0, SOLE))
        contacts[name] = {"world": list(contact), "planted": planted, "phase": q}
    tip = Vector((0, -1.31, 1.47))
    tail_points = [list(basis @ tip)]
    for j, obj in enumerate(tail):
        yaw = .18*math.sin(math.tau*phase - j*.3) + .08*amount
        pitch = math.radians(-45 + j*12)
        delta = Vector((math.sin(yaw)*math.cos(pitch), -math.cos(yaw)*math.cos(pitch), math.sin(pitch))) * .29
        end = tip + delta
        place(obj, tip, end, frame)
        tip = end
        tail_points.append(list(basis @ tip))
    return {"clip": clip, "index": index, "frame": frame, "limbsWorld": joints,
            "limbLengths": LENGTHS, "contacts": contacts, "tailWorld": tail_points,
            "actionAmount": amount}


records = [pose(clip, i, start+i) for clip, (start, count) in CLIPS.items() for i in range(count)]
for clip in ["walk", "sniff", "display"]:
    pose(clip, 0, CLIPS[clip][0]+CLIPS[clip][1])
for obj in bpy.data.objects:
    if obj.animation_data and obj.animation_data.action:
        for layer in obj.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:
                            point.interpolation = "LINEAR"
scene.frame_start, scene.frame_end = 1, 58
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "animal.blend"))


def project(p):
    q = world_to_camera_view(scene, cam, p)
    return [round(q.x*SIZE, 5), round((1-q.y)*SIZE, 5), round(q.z, 5)]


def hull(points):
    points = sorted(set(tuple(p) for p in points))
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    low, high = [], []
    for result, seq in [(low, points), (high, reversed(points))]:
        for p in seq:
            while len(result) > 1 and cross(result[-2], result[-1], p) <= 0:
                result.pop()
            result.append(p)
    return low[:-1] + high[:-1]


guide = {"identity": "brown-bear-hunt-v1-geometry-01", "cameraContract": CAMERA,
         "canvas": [SIZE, SIZE], "anchor": list(ANCHOR), "orthoScale": SIZE/10,
         "shiftY": cam.data.shift_y, "rootTravelUnitsPerCycle": STRIDE,
         "footfallLandPose": LANDS, "hips": HIPS, "soleHeight": SOLE,
         "stanceFraction": .75, "records": [],
         "meshLocalGeometrySha256": {}, "meshTopologySha256": {}}
for obj in meshes:
    guide["meshLocalGeometrySha256"][obj.name] = hashlib.sha256(json.dumps([list(v.co) for v in obj.data.vertices]).encode()).hexdigest()
    guide["meshTopologySha256"][obj.name] = hashlib.sha256(json.dumps([list(p.vertices) for p in obj.data.polygons]).encode()).hexdigest()
for facing, yaw in CAMERA["modelYawDegrees"].items():
    root.rotation_euler.z = math.radians(yaw)
    for record in records:
        scene.frame_set(record["frame"])
        bpy.context.view_layer.update()
        r = json.loads(json.dumps(record))
        r["facing"] = facing
        for name, obj in [("head", head), ("body", body), ("shoulder", shoulder),
                          ("pelvis", pelvis), ("jaw", jaw)]:
            r[name] = project(obj.matrix_world.translation)
        r["tail"] = [project(root.matrix_world @ Vector(p)) for p in r["tailWorld"]]
        r["projectedContacts"] = {n: project(root.matrix_world @ Vector(c["world"])) for n, c in r["contacts"].items()}
        r["volumes"], r["stripes"] = {}, []
        for obj in meshes:
            points = [obj.matrix_world @ v.co for v in obj.data.vertices]
            pp = [project(p) for p in points]
            r["volumes"][obj.name] = {
                "hull": hull([p[:2] for p in pp]),
                "bbox": [min(p[0] for p in pp), min(p[1] for p in pp), max(p[0] for p in pp), max(p[1] for p in pp)],
                "depthRange": [min(p[2] for p in pp), max(p[2] for p in pp)],
                "worldZ": [min(p.z for p in points), max(p.z for p in points)],
                "material": obj.data.materials[0].name,
            }
        for spec in stripe_specs:
            obj = bpy.data.objects[spec["mesh"]]
            points = [obj.matrix_world @ Vector(p) for p in spec["points"]]
            visible = [(obj.matrix_world.to_3x3() @ Vector(n)).dot(cam.location-p) > 0
                       for n, p in zip(spec["normals"], points)]
            r["stripes"].append({"mesh": obj.name, "points": [project(p) for p in points], "visible": visible})
        guide["records"].append(r)
        if "--render-guides" in sys.argv and (record["clip"] == "idle" or record["index"] in [0, 3, 6, 9]):
            scene.render.filepath = str(WORK / f"guide-{facing}-{record['clip']}-{record['index']}.png")
            bpy.ops.render.render(write_still=True)
guide["blendSha256"] = hashlib.sha256((SOURCE / "animal.blend").read_bytes()).hexdigest()
(WORK / "projected-guides.json").write_text(json.dumps(guide, separators=(",", ":"))+"\n", encoding="utf-8", newline="\n")
print("BROWN_BEAR_BUILD_OK", len(meshes), len(guide["records"]))
