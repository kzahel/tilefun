"""Fit a COPY of compact v3 geometry and author rigid wheel pivots.

Blender --background v3/car.blend --python this.py -- NEW_OUT config.json
The input revision is never saved. No skeleton is needed for these rigid parts.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Matrix, Vector

out, config_path = map(Path, sys.argv[sys.argv.index("--")+1:])
out, config_path = out.resolve(), config_path.resolve()
out.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[2]
config = json.loads(config_path.read_text())
before = {o.name: [list(o.matrix_world @ v.co) for v in o.data.vertices] for o in bpy.context.scene.objects if o.type == "MESH"}
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if len(meshes) != 55 or any(o.parent for o in meshes):
    raise ValueError("Select an unrigged compact-v3 COPY with 55 meshes.")
old_axles = [-17, 17]
axles = config["axles"]
# Shared body/well vertices have identical positions; remap them consistently.
well_offsets = {}
for obj in meshes:
    if obj.name.startswith("Body ·"):
        for index, vertex in enumerate(obj.data.vertices):
            if index >= 8:
                axle = 1 if index <= 20 else 0
                well_offsets[tuple(round(c, 6) for c in vertex.co)] = axles[axle]-old_axles[axle]

for obj in meshes:
    if obj.name.startswith(("Tire ·", "Hub ·", "Raised fender ·", "Window and frame ·")):
        continue
    for vertex in obj.data.vertices:
        old = vertex.co.copy()
        delta = well_offsets.get(tuple(round(c, 6) for c in old), 0)
        x, y, z = old
        x += delta
        if abs(old.x+28) < 1e-5:
            x = config["frontTip"]["x"]
            y = math.copysign(config["frontTip"]["width"], y)
            z = config["frontTip"]["top"] if old.z > 6 else config["frontTip"]["bottom"]
        elif abs(old.x-28) < 1e-5:
            x = config["rearTipX"]
        if abs(old.z-10.5) < 1e-5 and abs(old.x+25) < 1e-5:
            z = config["hoodShoulderHeight"]
        if abs(old.z-11) < 1e-5:
            z = config["bodyDeckHeight"]
        if abs(old.x-13) < 1e-5 and abs(old.z-20.2) < 1e-5:
            x = config["roofRearX"]
        if abs(old.z-4) < 1e-5 and abs(old.x) < 27:
            z = config["sillHeight"]
        vertex.co = (x, y, z)

# Refit window panel depth while preserving the same traced source outline.
refinement = json.loads((root/config["windowRefinement"]).read_text())
cameras = json.loads((root/config["referenceCameraPreset"]).read_text())["cameras"]
plane = config["windowPlane"]
for side, label, direction in [(-1, "left", "east"), (1, "right", "west")]:
    camera = cameras[direction]
    sy = camera["horizontalScale"]*camera["verticalStretch"]
    e = math.radians(camera["elevation"])
    for part, points in refinement["windowOutlinesEast"].items():
        if side == 1:
            points = [[64-u, v+1] for u, v in points]
        obj = bpy.data.objects[f"Window and frame · {label} · {part}"]
        for vertex, (u, v) in zip(obj.data.vertices, points):
            x = (u-camera["origin"][0])/(camera["horizontalScale"] if side == -1 else -camera["horizontalScale"])
            z = (camera["origin"][1]+sy*math.sin(e)*(plane["widthIntercept"]+plane["outset"])-v)/(sy*(math.cos(e)+math.sin(e)*plane["widthPerHeight"]))
            vertex.co = (x, side*(plane["widthIntercept"]-plane["widthPerHeight"]*z+plane["outset"]), z)

for obj in meshes:
    if obj.name.startswith("Raised fender ·"):
        axle = 0 if obj.name.endswith("-17") else 1
        for v in obj.data.vertices:
            v.co.x += axles[axle]-old_axles[axle]

def node(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj["asset_rig_node"] = True
    return obj

car = node("CarRoot")
body = node("Body", car)
wheels = []
for axle, prefix in enumerate(["F", "R"]):
    for side, suffix in [(-1, "L"), (1, "R")]:
        ident = prefix+suffix
        center = Vector((axles[axle], side*config["wheelHalfWidthCenter"], config["wheelRadius"]))
        steer = node(f"Wheel_{ident}_Steer", car, center)
        spin = node(f"Wheel_{ident}_Roll", steer)
        spin["wheel_radius"] = config["wheelRadius"]
        spin["roll_axis_gltf"] = [0.0, 0.0, -1.0]
        spin["roll_angle_from_forward_distance"] = "-distance/radius; front is -X"
        steer["steer_axis_gltf"] = [0.0, 1.0, 0.0]
        steer["steering_enabled"] = axle == 0
        names = [f"Tire · {old_axles[axle]} · {side}", f"Hub · {old_axles[axle]} · {side}"]
        for name in names:
            obj = bpy.data.objects[name]
            for v in obj.data.vertices:
                v.co.x += axles[axle]-old_axles[axle]
                v.co -= center
            obj.parent = spin
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.location = (0, 0, 0)
        wheels.append({"id": ident, "steer": steer.name, "roll": spin.name, "meshes": names,
                       "centerBlender": list(center), "radius": config["wheelRadius"],
                       "rollAxisBlender": [0, 1, 0], "rollAxisGltf": [0, 0, -1], "front": axle == 0})
for obj in meshes:
    if obj.parent is None:
        obj.parent = body
bpy.context.view_layer.update()
for wheel in wheels:
    tire = bpy.data.objects[wheel["meshes"][0]]
    assert abs(min((tire.matrix_world @ v.co).z for v in tire.data.vertices)) < 1e-5
    # Rotation must preserve the axle center; the body parent must remain fixed.
    spin = bpy.data.objects[wheel["roll"]]
    center = spin.matrix_world.translation.copy()
    spin.rotation_euler.y = math.pi/2
    bpy.context.view_layer.update()
    assert (spin.matrix_world.translation-center).length < 1e-5
    spin.rotation_euler.y = 0
bpy.context.view_layer.update()
assert all(min((o.matrix_world @ v.co).z for v in o.data.vertices) >= -1e-5 for o in meshes)
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene["review_status"] = "Unreviewed fitted compact with four independent rigid wheels; no gameplay integration"
bpy.ops.wm.save_as_mainfile(filepath=str(out/"car.blend"))
(out/"rig.json").write_text(json.dumps({"root": car.name, "body": body.name, "wheels": wheels,
    "configSha256": hashlib.sha256(config_path.read_bytes()).hexdigest(), "wheelRadiusUnchanged": True,
    "geometryChanges": ["Sloping lower nose", "Longer rear roof edge", "Higher deck/cabin join", "Lower sill", "Adjusted axle positions"],
    "meshObjects": len(meshes), "inferred": "Body fit and rigid steering pivots are authored hypotheses; steering clearance is not qualified."}, indent=2)+"\n")
print("Fitted body profile and four centered steer/roll tire+hub assemblies", flush=True)
