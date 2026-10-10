"""Author a compact car in an isolated Blender process; no live scene is touched.

Run --background --factory-startup --python-exit-code 1 --python this-file.
Then paint.py, then reopen car.blend with --python finish.py.
Game/source axes: X along the car (front -X), Y across, Z up, world pixels.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
# A fresh offline workspace; generated files never live beside this source code.
import os
WORKSPACE = Path(os.environ.get("TILEFUN_COMPACT_PILOT", ROOT / "data/authored-assets/compact-pilot")).resolve()
HERE = WORKSPACE / "source"
OUT = WORKSPACE / "render"
if not (HERE / "east.png").is_file():
    raise FileNotFoundError("Run compact-pilot/prepare.py first.")
if (HERE / "car.blend").exists():
    raise FileExistsError("Do not overwrite an existing pilot scene.")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# Pixel rectangles in a 512-square atlas, with generous empty gutters.
REGIONS = {
    "body-left": [16, 16, 240, 112], "body-right": [264, 16, 488, 112],
    "cabin-left": [16, 128, 240, 224], "cabin-right": [264, 128, 488, 224],
    "hood": [16, 240, 112, 328], "roof": [128, 240, 224, 328],
    "windshield": [240, 240, 336, 328], "rear-glass": [352, 240, 448, 328],
    "hatch": [16, 344, 112, 432], "front": [128, 344, 208, 424],
    "rear": [224, 344, 304, 424], "tire": [320, 344, 392, 416],
    "hub": [408, 344, 480, 416], "underbody": [16, 448, 112, 496],
    "trim": [128, 448, 208, 496], "blue": [224, 448, 304, 496],
}

material = bpy.data.materials.new("Sprite palette · cleaned UV atlas")
material.use_nodes = True
nodes = material.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.08, 0.3, 0.65, 1)
bsdf.inputs["Roughness"].default_value = 1
bsdf.inputs["Specular IOR Level"].default_value = 0

records = []
body_outlines = {}


def texcoord(region, u, v):
    x0, y0, x1, y1 = REGIONS[region]
    return ((x0 + u * (x1 - x0)) / 512, 1 - (y0 + v * (y1 - y0)) / 512)


def mesh(name, vertices, faces, face_uv, region):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    editable = bmesh.new()
    editable.from_mesh(data)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(data)
    editable.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(material)
    uv = data.uv_layers.new(name="CarAtlas")
    original_uv = {frozenset(face): dict(zip(face, coords)) for face, coords in zip(faces, face_uv)}
    for face in data.polygons:
        coords = original_uv[frozenset(face.vertices)]
        for loop in face.loop_indices:
            uv.data[loop].uv = texcoord(region, *coords[data.loops[loop].vertex_index])
    obj["uv_region"] = region
    obj["provenance"] = "Authored geometry; sprite-derived and inferred paint"
    records.append({"name": name, "region": region,
                    "vertices": [list(v.co) for v in data.vertices],
                    "faces": [list(p.vertices) for p in data.polygons],
                    "uvs": [[list(uv.data[k].uv) for k in p.loop_indices]
                            for p in data.polygons]})
    return obj


def quad(name, verts, region):
    return mesh(name, verts, [[0, 1, 2, 3]], [[(0, 1), (1, 1), (1, 0), (0, 0)]], region)


# Body sides have real arch openings; wheels are separate cylindrical geometry.
for side, label in [(-1, "left"), (1, "right")]:
    outline = [(-28, 4), (-28, 8), (-25, 10.5), (-12, 11),
               (22, 11), (26, 9.8), (28, 8), (28, 4)]
    for axle in [17, -17]:
        outline.append((axle + 5.1, 4))
        for k in range(1, 12):
            a = math.pi * k / 12
            outline.append((axle + 5.1 * math.cos(a), 4 + 5.1 * math.sin(a)))
        outline.append((axle - 5.1, 4))
    verts = [(x, side * (10 if abs(x) < 25 else 10 - (abs(x) - 25) * .7), z)
             for x, z in outline]
    body_outlines[side] = verts
    mesh("Body · " + label, verts, [list(range(len(verts)))],
         [[((x + 28) / 56, (11 - z) / 7) for x, _, z in verts]], "body-" + label)

def deck(name, sections, region):
    verts = [(x, side * width, z) for x, width, z in sections for side in [-1, 1]]
    faces = [[k * 2, k * 2 + 2, k * 2 + 3, k * 2 + 1] for k in range(len(sections) - 1)]
    start, end = sections[0][0], sections[-1][0]
    coords = [[((verts[i][0] - start) / (end - start), (verts[i][1] / 10 + 1) / 2) for i in face] for face in faces]
    mesh(name, verts, faces, coords, region)


deck("Hood", [(-28, 7.9, 8), (-25, 10, 10.5), (-12, 10, 11)], "hood")
deck("Rear hatch", [(22, 10, 11), (26, 9.3, 9.8), (28, 7.9, 8)], "hatch")
quad("Front fascia", [(-28, 7.9, 4), (-28, -7.9, 4), (-28, -7.9, 8), (-28, 7.9, 8)], "front")
quad("Rear fascia", [(28, -7.9, 4), (28, 7.9, 4), (28, 7.9, 8), (28, -7.9, 8)], "rear")
# Join the actual lower side boundary across the car, including wheel-well ceilings.
for k in range(7, len(body_outlines[-1])):
    j = (k + 1) % len(body_outlines[-1])
    quad(f"Underbody / wheel well · {k}", [body_outlines[-1][k], body_outlines[-1][j],
                                         body_outlines[1][j], body_outlines[1][k]], "underbody")
quad("Cabin floor", [(-12, -10, 11), (22, -10, 11), (22, 10, 11), (-12, 10, 11)], "blue")
for side, label in [(-1, "left"), (1, "right")]:
    verts = [(-12, side * 9.6, 11), (22, side * 9.6, 11),
             (13, side * 7.5, 20.2), (-3, side * 7.5, 20.2)]
    mesh("Cabin · " + label, verts, [[0, 1, 2, 3]],
         [[((x + 12) / 34, (20.2 - z) / 9.2) for x, _, z in verts]], "cabin-" + label)
quad("Windshield", [(-12, 9.6, 11), (-12, -9.6, 11), (-3, -7.5, 20.2), (-3, 7.5, 20.2)], "windshield")
quad("Roof", [(-3, 7.5, 20.2), (-3, -7.5, 20.2), (13, -7.5, 20.2), (13, 7.5, 20.2)], "roof")
quad("Rear windshield", [(22, -9.6, 11), (22, 9.6, 11), (13, 7.5, 20.2), (13, -7.5, 20.2)], "rear-glass")

for x in [-17, 17]:
    for side in [-1, 1]:
        ring = []
        for y in [side * 9.35, side * 11.75]:
            ring += [(x + 4.1 * math.cos(k * math.tau / 16), y,
                      4.1 + 4.1 * math.sin(k * math.tau / 16)) for k in range(16)]
        faces, uvs = [], []
        for k in range(16):
            j = (k + 1) % 16
            faces.append([k, j, j + 16, k + 16])
            uvs.append([(k / 16, 0), ((k + 1) / 16, 0), ((k + 1) / 16, 1), (k / 16, 1)])
        for offset in [0, 16]:
            faces.append(list(range(offset, offset + 16)))
            uvs.append([(.5 + .47 * math.cos(k * math.tau / 16),
                         .5 + .47 * math.sin(k * math.tau / 16)) for k in range(16)])
        mesh(f"Tire · {x} · {side}", ring, faces, uvs, "tire")
        verts = [(x + 2.35 * math.cos(k * math.tau / 16), side * 11.82,
                  4.1 + 2.35 * math.sin(k * math.tau / 16)) for k in range(16)]
        mesh(f"Hub · {x} · {side}", verts, [list(range(16))],
             [[(.5 + .47 * math.cos(k * math.tau / 16), .5 + .47 * math.sin(k * math.tau / 16))
               for k in range(16)]], "hub")

# Scene camera and neutral lighting are reusable; geometry is never frame-dependent.
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.use_denoising = False
scene.render.resolution_x = 384
scene.render.resolution_y = 384
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.world.color = (.45, .45, .45)
bpy.ops.object.camera_add(location=(-65, -85, 65))
camera = bpy.context.object
camera.name = "Inspection camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 76
scene.camera = camera
camera.rotation_euler = (Vector((0, 0, 9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
for name, position, power, size in [("Key", (-40, -60, 80), 95000, 75),
                                     ("Fill", (40, 30, 65), 65000, 80)]:
    bpy.ops.object.light_add(type="AREA", location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy = power
    light.data.shape = "DISK"
    light.data.size = size
    light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()
scene["asset_axes"] = "world pixels; front -X; cross-car Y; height Z; ground Z=0"
scene["review_status"] = "Unreviewed authored candidate; no runtime promotion"
(HERE / "geometry.json").write_text(json.dumps({"regions": REGIONS, "objects": records}, indent=2) + "\n")
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "car.blend"))
print(f"Authored {len(records)} meshes; saved editable car.blend", flush=True)
