import json
import math
import os
import struct
import sys

import bmesh
import bpy
from mathutils import Vector

PALETTE = {
    "#": "554d42",
    "s": "807464",
    "m": "ab9c83",
    "l": "c8ba9e",
    "c": "ded1b5",
    "w": "eee4cb",
    "p": "b88580",
    "d": "956d6e",
    "k": "302d2c",
}
# Each tile is eight texels square. Rows are painted from top to bottom.
# The side projection puts the head at the right. The back projection puts it
# at the top. The two dark patches meet where the shoulder turns into the neck.
TILES = {
    "flank": (
        "cccccmlm",
        "lccccmss",
        "llcclss#",
        "mllcm###",
        "mmllm###",
        "smmmm##s",
        "ssmmmsss",
        "#####sss",
    ),
    "back": (
        "mms##smm",
        "mls##slm",
        "llms#sml",
        "llssssll",
        "llccccll",
        "lcccccll",
        "llcccclm",
        "mlllllmm",
    ),
    "cheek": (
        "mllccllm",
        "mlllcclm",
        "smllllmm",
        "ssmmmmll",
        "#ssmmmcl",
        "##ssmclc",
        "###sslcw",
        "####sslc",
    ),
    "muzzle": (
        "cccwwccc",
        "ccwwwwcc",
        "cwwwwccl",
        "cwwwcccl",
        "lcccclll",
        "ssslllss",
        "####ssss",
        "########",
    ),
    "ear": (
        "sss##sss",
        "ssppdsss",
        "spppddss",
        "sppppdss",
        "spppddss",
        "sdpddsss",
        "sdddssms",
        "ssssmmms",
    ),
    "ear-back": (
        "sss##sss",
        "smmmmmss",
        "smlllmss",
        "smlmmmss",
        "smlmmmss",
        "smmmmmss",
        "ssmmmsss",
        "ssssmmss",
    ),
    "cream": (
        "cccwwccc",
        "ccwwwwcc",
        "cwwwwccl",
        "cwwcccll",
        "ccccllll",
        "llcllmmm",
        "lmmmmsss",
        "mmssssss",
    ),
    "paw": (
        "llllmmmm",
        "mllllmmm",
        "mmmmssss",
        "mmmsmmlm",
        "ssssmmll",
        "sssssmml",
        "#s#sssms",
        "####ssss",
    ),
    "belly": (
        "llllllll",
        "cllccllc",
        "cclcclcc",
        "lccllcll",
        "lmmllmml",
        "mmsmmmsm",
        "ssmsssms",
        "ssssssss",
    ),
    "dark": ("kkkkkkkk",) * 8,
    "edge": ("########",) * 8,
}
ATLAS_SIZE = 32
TILE_SIZE = 8


def make_atlas():
    atlas = bpy.data.images.new(
        "Rabbit 32px palette", ATLAS_SIZE, ATLAS_SIZE, alpha=False
    )
    atlas.colorspace_settings.name = "sRGB"
    pixels = [0.0, 0.0, 0.0, 1.0] * (ATLAS_SIZE * ATLAS_SIZE)
    origins = {}
    for index, (name, rows) in enumerate(TILES.items()):
        left = index % 4 * TILE_SIZE
        bottom = index // 4 * TILE_SIZE
        origins[name] = (left, bottom)
        for row, letters in enumerate(rows):
            for column, letter in enumerate(letters):
                encoded = bytes.fromhex(PALETTE[letter])
                offset = 4 * (
                    (bottom + TILE_SIZE - row - 1) * ATLAS_SIZE + left + column
                )
                pixels[offset : offset + 3] = [channel / 255 for channel in encoded]
    atlas.pixels = pixels
    atlas.pack()
    return atlas, origins


def surface_paint(name, region, normal):
    if region == 5:
        return "edge", (1, 2)
    if region == 4:
        return "dark", (1, 2)
    if name.startswith("EAR_"):
        return ("ear" if normal.y > 0.40 else "ear-back"), (0, 2)
    if name == "TAIL":
        return "cream", (1, 2)
    if name == "HEAD":
        return ("muzzle" if region == 2 else "cheek"), (
            (1, 2) if abs(normal.x) > 0.45 else (0, 2)
        )
    if name == "BODY":
        if normal.z > 0.55:
            return "back", (0, 1)
        if region == 2:
            return "belly", (1, 2)
        return "flank", (1, 2) if abs(normal.x) > 0.45 else (0, 2)
    return "paw", (1, 2)


out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(out, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
mat = bpy.data.materials.new("Rabbit pixel paint")
mat.use_nodes = True
bs = mat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Roughness"].default_value = 1
atlas, tile_origins = make_atlas()
paint = mat.node_tree.nodes.new("ShaderNodeTexImage")
paint.image = atlas
paint.interpolation = "Closest"
mat.use_backface_culling = True
color_node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
color_node.layer_name = "Color"
tint = mat.node_tree.nodes.new("ShaderNodeMixRGB")
tint.blend_type = "MULTIPLY"
tint.inputs[0].default_value = 1
mat.node_tree.links.new(paint.outputs["Color"], tint.inputs[1])
mat.node_tree.links.new(color_node.outputs["Color"], tint.inputs[2])
mat.node_tree.links.new(tint.outputs["Color"], bs.inputs["Base Color"])
light = Vector((-0.55, 0.25, 0.8)).normalized()
root = bpy.data.objects.new("RABBIT_ROOT", None)
bpy.context.collection.objects.link(root)
parts = []


def mesh(name, verts, faces, regions, pivot):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    if not name.startswith(("FRONT_", "HIND_")):
        # Reversed outer faces make a narrow depth-tested contour in the same draw.
        exterior = [tuple(v.co + v.normal * 0.065) for v in me.vertices]
        faces = [tuple(face.vertices) for face in me.polygons]
        outer_faces = [tuple(i + len(verts) for i in reversed(face)) for face in faces]
        new_verts = [tuple(v.co) for v in me.vertices]
        me.clear_geometry()
        me.from_pydata(new_verts + exterior, [], faces + outer_faces)
        me.update()
        regions = regions + [5] * len(outer_faces)
    uv = me.uv_layers.new(name="Pixel paint")
    colors = me.color_attributes.new(name="Color", type="FLOAT_COLOR", domain="CORNER")
    bounds = [
        (min(v[axis] for v in verts), max(v[axis] for v in verts)) for axis in range(3)
    ]
    for face, region in zip(me.polygons, regions):
        face.use_smooth = False
        tile, axes = surface_paint(name, region, face.normal)
        origin = tile_origins[tile]
        incidence = face.normal.dot(light)
        shade = (
            1 if region == 5 or incidence > 0.2 else 0.83 if incidence > -0.4 else 0.66
        )
        for index in face.loop_indices:
            vertex = me.vertices[me.loops[index].vertex_index].co
            texel = []
            for corner, axis in enumerate(axes):
                low, high = bounds[axis]
                fraction = max(0, min(1, (vertex[axis] - low) / (high - low)))
                texel.append(
                    (origin[corner] + 0.5 + (TILE_SIZE - 1) * fraction) / ATLAS_SIZE
                )
            uv.data[index].uv = texel
            colors.data[index].color = (shade, shade, shade, 1)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    ob.parent = root
    ob.location = pivot
    for v in me.vertices:
        v.co -= Vector(pivot)
    parts.append(ob)
    return ob


# Closed, faceted latitude solids; append allows eyes/nose to belong to HEAD.
def solid(v, f, c, center, scale, n=10, rings=5, color=1, belly=False):
    start = len(v)
    x, y, z = center
    a, b, d = scale
    v.append((x, y, z - d))
    for j in range(1, rings + 1):
        t = math.pi * j / (rings + 1)
        for i in range(n):
            q = 2 * math.pi * i / n
            v.append(
                (
                    x + a * math.sin(t) * math.cos(q),
                    y + b * math.sin(t) * math.sin(q),
                    z - d * math.cos(t),
                )
            )
    top = len(v)
    v.append((x, y, z + d))
    for i in range(n):
        f.append((start, start + 1 + (i + 1) % n, start + 1 + i))
        c.append(color)
    for j in range(rings - 1):
        for i in range(n):
            k = start + 1 + j * n + i
            h = start + 1 + j * n + (i + 1) % n
            f.append((k, h, h + n, k + n))
            c.append(
                2
                if belly and j < 2 and math.sin(2 * math.pi * (i + 0.5) / n) > 0.3
                else color
            )
    for i in range(n):
        f.append((top, top - n + i, top - n + (i + 1) % n))
        c.append(color)


def blob(name, center, scale, n=8, rings=3, color=1, belly=False):
    v = []
    f = []
    c = []
    solid(v, f, c, center, scale, n, rings, color, belly)
    return mesh(name, v, f, c, center)


blob("BODY", (0, -0.27, 0.63), (0.62, 0.88, 0.59), 12, 5, 1, True)
v = []
f = []
c = []
solid(v, f, c, (0, 0.45, 0.93), (0.42, 0.48, 0.37), 10, 4, 1)
solid(v, f, c, (0, 0.78, 0.82), (0.30, 0.24, 0.18), 8, 2, 2)
for s in (-1, 1):
    solid(v, f, c, (s * 0.344, 0.67, 1.04), (0.072, 0.072, 0.071), 6, 2, 4)
solid(v, f, c, (0, 1.013, 0.86), (0.065, 0.035, 0.040), 6, 1, 4)
head = mesh("HEAD", v, f, c, (0, 0.26, 0.91))
ears = []
for s, label in ((1, "L"), (-1, "R")):
    # Six-sided tapered ear with a broad forward-facing russet panel.
    v = []
    f = []
    c = []
    for z, w, dy in (
        (1.17, 0.11, 0),
        (1.44, 0.17, -0.04),
        (1.76, 0.14, -0.11),
        (1.92, 0.08, -0.18),
    ):
        for x, y in (
            (-1, -0.45),
            (-1, 0.45),
            (-0.65, 1),
            (0.65, 1),
            (1, 0.45),
            (1, -0.45),
        ):
            v.append(
                (
                    s * (0.22 + (z - 1.17) * 0.16) + x * w,
                    0.39 + dy + y * 0.14 + s * x * 0.05,
                    z - (0.10 if s < 0 else 0),
                )
            )
    f.append(tuple(reversed(range(6))))
    c.append(1)
    for j in range(3):
        for i in range(6):
            k = j * 6 + i
            h = j * 6 + (i + 1) % 6
            f.append((k, h, h + 6, k + 6))
            c.append(3 if i == 2 and j > 0 else 1)
    f.append(tuple(range(18, 24)))
    c.append(1)
    ears.append(
        mesh("EAR_" + label, v, f, c, (s * 0.22, 0.39, 1.17 - (0.10 if s < 0 else 0)))
    )
    blob("FRONT_" + label, (s * 0.25, 0.53, 0.17), (0.16, 0.30, 0.17), 8, 3, 2)
    blob("HIND_" + label, (s * 0.45, -0.53, 0.30), (0.26, 0.45, 0.30), 10, 3, 0)
blob("TAIL", (0, -1.12, 0.57), (0.20, 0.23, 0.19), 8, 3, 2)
# Match the sprite's crouched proportions at the oblique gameplay angle.
for ob in parts:
    ob.location.x *= 0.82
    ob.location.y *= 1.12
    for vertex in ob.data.vertices:
        vertex.co.x *= 0.82
        vertex.co.y *= 1.12
# Center entire model's horizontal bounding rectangle, ground at zero.
points = [o.matrix_basis @ v.co for o in parts for v in o.data.vertices]
lo = Vector(tuple(min(v[i] for v in points) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in points) for i in range(3)))
shift = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
for ob in parts:
    ob.location += shift
for ear in ears:
    ear.parent = head
    ear.location -= head.location
for ob in parts:
    ob.data.calc_loop_triangles()
tri = sum(len(o.data.loop_triangles) for o in parts)
assert tri <= 1150, tri
assert len(parts) == 9
bpy.context.view_layer.update()
points = [o.matrix_world @ v.co for o in parts for v in o.data.vertices]
bounds = [
    [min(v[i] for v in points) for i in range(3)],
    [max(v[i] for v in points) for i in range(3)],
]
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for ob in parts:
    ob.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "rabbit.blend"))
bpy.ops.export_scene.gltf(
    filepath=os.path.join(out, "rabbit.glb"),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_attributes=True,
    export_vertex_color="ACTIVE",
)
p = os.path.join(out, "rabbit.glb")
with open(p, "rb") as h:
    data = h.read()
    length, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20 : 20 + length])
pr = [p for m in gltf["meshes"] for p in m["primitives"]]
export_tri = sum(gltf["accessors"][p["indices"]]["count"] // 3 for p in pr)
assert export_tri == tri
assert len(gltf["materials"]) == len(gltf["images"]) == len(gltf["textures"]) == 1
assert all({"COLOR_0", "TEXCOORD_0"} <= p["attributes"].keys() for p in pr)
report = {
    "blender_version": bpy.app.version_string,
    "triangles": tri,
    "primitives": len(pr),
    "materials": len(gltf["materials"]),
    "atlas_dimensions": list(atlas.size),
    "glb_bytes": len(data),
    "blender_bounds": bounds,
    "dimensions": [bounds[1][i] - bounds[0][i] for i in range(3)],
    "parts": [o.name for o in parts],
    "axis": "Blender +Y forward Z up; glTF -Z forward Y up",
}
with open(os.path.join(out, "report.json"), "w") as h:
    json.dump(report, h, indent=2)
print(json.dumps(report))
