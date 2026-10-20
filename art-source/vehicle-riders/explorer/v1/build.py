"""Original static seated Explorer component template; local hip origin, no vehicle loft.
Blender5.2 factory background four threads. -- --scratch writes fresh replay only.
"""

from pathlib import Path
import bpy, bmesh, json, math, sys, struct, zlib, shutil, hashlib
from mathutils import Vector

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
C = json.loads((S / "rider.json").read_text())
I = json.loads((S / "identity.json").read_text())
D = R / "data/vehicle-riders/explorer"
scratch = "--scratch" in sys.argv
A = (
    D / "replay-final/source"
    if scratch
    else R / "art-source/vehicle-riders/explorer/v1"
)
O = (
    D / "replay-final/public"
    if scratch
    else R / "public/demos/vehicle-riders/explorer/v1"
)
for p in [A, O, D]:
    p.mkdir(parents=True, exist_ok=True)
if (O / "report.json").exists():
    assert not json.loads((O / "report.json").read_text()).get("sourceImmutable", False)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scale = C["worldScale"]
hip = Vector(C["hipSocketSource"])
palette = {k: tuple(bytes.fromhex(v[1:])) for k, v in I["palette"].items()}
keys = list(palette)


def png(p, w, h, pix):
    def ch(k, v):
        return (
            struct.pack(">I", len(v))
            + k
            + v
            + struct.pack(">I", zlib.crc32(k + v) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\0" + pix[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    p.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + ch(b"IDAT", zlib.compress(raw, 9))
        + ch(b"IEND", b"")
    )


pixels = bytearray(256 * 256 * 4)
for y in range(256):
    for x in range(256):
        role = "t"
        if y < 88 and x < 248:
            chart = "front" if x < 88 else "back" if x < 176 else "profile"
            x0 = 0 if x < 88 else 88 if x < 176 else 176
            rows = I["32"][chart]
            row = min(len(rows) - 1, y // 8)
            col = min(len(rows[row]) - 1, (x - x0) // 8)
            role = rows[row][col]
            role = "h" if role == "." and y < 32 else "s" if role == "." else role
        elif y >= 224:
            role = keys[min(len(keys) - 1, (x // 16))]
        pixels[(y * 256 + x) * 4 : (y * 256 + x + 1) * 4] = bytes((*palette[role], 255))
png(A / "atlas.png", 256, 256, pixels)
shutil.copyfile(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Explorer_original10color_opaque_unlit")
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
out = nodes.new("ShaderNodeOutputMaterial")
tex = nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(A / "atlas.png"))
tex.interpolation = "Closest"
tex.extension = "EXTEND"
mat.node_tree.links.new(tex.outputs["Color"], out.inputs["Surface"])
parts = []
stats = []


def mesh(name, verts, faces, role):
    m = bpy.data.meshes.new(name)
    m.from_pydata([tuple(Vector(v) - hip) for v in verts], [], faces)
    m.update()
    o = bpy.data.objects.new(name, m)
    scene.collection.objects.link(o)
    m.materials.append(mat)
    uv = m.uv_layers.new(name="Seated_semantic_UV")
    attr = m.attributes.new("paint_role", "INT", "FACE")
    for f in m.polygons:
        k = role[f.index] if isinstance(role, list) else role
        idx = keys.index(k)
        attr.data[f.index].value = idx
        for j, li in enumerate(f.loop_indices):
            uv.data[li].uv = (
                (idx * 16 + 8 + 3 * math.cos(j * 2 * math.pi / len(f.loop_indices)))
                / 256,
                1 - (240 + 3 * math.sin(j * 2 * math.pi / len(f.loop_indices))) / 256,
            )
    bm = bmesh.new()
    bm.from_mesh(m)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(m)
    bm.free()
    o["semantic_owner"] = name
    o["static_seated_component"] = True
    parts.append(o)
    return o


def box(name, center, dims, role, bevel=0.02, segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.object
    o.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Rounded character solid", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
    v = [tuple(o.matrix_world @ p.co) for p in o.data.vertices]
    f = [tuple(p.vertices) for p in o.data.polygons]
    bpy.data.objects.remove(o, do_unlink=True)
    return mesh(name, v, f, role)


def ellipsoid(name, center, radii, role, segments=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=center
    )
    o = bpy.context.object
    o.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    v = [tuple(o.matrix_world @ p.co) for p in o.data.vertices]
    f = [tuple(p.vertices) for p in o.data.polygons]
    bpy.data.objects.remove(o, do_unlink=True)
    return mesh(name, v, f, role)


def limb(name, a, b, ra, rb, role, sides=8):
    a = Vector(a)
    b = Vector(b)
    n = (b - a).normalized()
    u = n.cross(Vector((0, 0, 1)))
    if u.length < 0.1:
        u = n.cross(Vector((0, 1, 0)))
    u.normalize()
    v = n.cross(u).normalized()
    verts = []
    for p, r in [(a, ra), (b, rb)]:
        for j in range(sides):
            verts.append(
                tuple(
                    p
                    + r
                    * (
                        u * math.cos(j * 2 * math.pi / sides)
                        + v * math.sin(j * 2 * math.pi / sides)
                    )
                )
            )
    faces = [
        (j, (j + 1) % sides, sides + (j + 1) % sides, sides + j) for j in range(sides)
    ]
    faces.extend(
        [tuple(range(sides - 1, -1, -1)), tuple(sides + j for j in range(sides))]
    )
    return mesh(name, verts, faces, role)


# Bent pelvis/thighs/shins are authored in seated coordinates, not a standing pose transform.
box(
    "Seated dark trouser pelvis",
    (0.50, -0.322, 0.725),
    (0.29, 0.33, 0.159),
    "b",
    0.045,
    2,
)
for side in [-1, 1]:
    y = -0.322 + side * 0.115
    limb(
        "Bent trouser thigh " + str(side),
        (0.47, y, 0.755),
        (0.10, y, 0.675),
        0.066,
        0.058,
        "b",
    )
    ellipsoid(
        "Actual bent knee " + str(side),
        (0.10, y, 0.675),
        (0.067, 0.063, 0.065),
        "b",
        8,
        5,
    )
    limb(
        "Bent trouser shin " + str(side),
        (0.10, y, 0.675),
        (-0.015, y, 0.505),
        0.055,
        0.044,
        "b",
    )
    box(
        "Brown boot solid sole " + str(side),
        (-0.08, y, 0.439),
        (0.24, 0.14, 0.044),
        "k",
        0.014,
    )
    box(
        "Brown boot upper toe " + str(side),
        (-0.07, y, 0.480),
        (0.22, 0.13, 0.060),
        "b",
        0.018,
    )
# Slight forward-leaning teal jacket, broad collar/zip and canvas straps.
torso = box(
    "Teal seated jacket torso",
    (0.455, -0.322, 1.005),
    (0.30, 0.40, 0.47),
    "t",
    0.065,
    2,
)
for p in torso.data.vertices:
    p.co.x -= (p.co.z - (1.005 - hip.z)) * 0.14
box("Jacket dark waist seam", (0.48, -0.322, 0.793), (0.28, 0.365, 0.055), "d", 0.020)
box("Jacket dark front zip", (0.282, -0.322, 1.005), (0.022, 0.035, 0.34), "k", 0.007)
box("Jacket front collar", (0.294, -0.322, 1.201), (0.043, 0.17, 0.075), "d", 0.015)
for side in [-1, 1]:
    shoulder = (0.42, -0.322 + side * 0.195, 1.16)
    elbow = (0.18, -0.322 + side * 0.223, 0.94)
    grip = (-0.06, -0.322 + side * 0.14, 0.80)
    limb("Bent teal upper sleeve " + str(side), shoulder, elbow, 0.073, 0.061, "t")
    ellipsoid(
        "Actual sleeve elbow " + str(side), elbow, (0.064, 0.063, 0.063), "d", 8, 5
    )
    wrist = (0.012, -0.322 + side * 0.16, 0.846)
    limb("Bent teal forearm " + str(side), elbow, wrist, 0.060, 0.043, "t")
    ellipsoid(
        "Warm hand gripping actual rim " + str(side),
        grip,
        (0.060, 0.046, 0.052),
        "p",
        8,
        5,
    )
    # Canvas straps on true jacket surface; actual small solids, not billboards.
    limb(
        "Canvas shoulder strap " + str(side),
        (0.30, -0.322 + side * 0.145, 1.19),
        (0.292, -0.322 + side * 0.145, 0.93),
        0.018,
        0.018,
        "a",
        6,
    )
# The pack ends above the fixed roadster seatback top (1.013), no hidden penetration.
box("Raised canvas backpack", (0.675, -0.322, 1.19), (0.17, 0.29, 0.24), "a", 0.035, 2)
box(
    "Canvas pack dark bottom pocket",
    (0.774, -0.322, 1.155),
    (0.045, 0.24, 0.11),
    "b",
    0.018,
)
box(
    "Canvas backpack center seam",
    (0.799, -0.322, 1.20),
    (0.012, 0.022, 0.16),
    "k",
    0.005,
)
ellipsoid("Warm neck", (0.409, -0.322, 1.242), (0.077, 0.085, 0.10), "p", 8, 5)
# Original volumetric head with source-derived, view-independent per-face identity UV charts.
head = box(
    "Explorer rounded head face UV owner",
    (0.405, -0.322, 1.456),
    (0.40, 0.47, 0.48),
    "p",
    0.075,
    2,
)
uv = head.data.uv_layers.active.data
for f in head.data.polygons:
    for li in f.loop_indices:
        v = head.data.vertices[head.data.loops[li].vertex_index].co + hip
        if f.normal.x < -0.70:
            u = (v.y - (-0.557)) / 0.47
            px = u * 88
            py = (1.696 - v.z) / 0.48 * 88
        elif f.normal.x > 0.70:
            u = (v.y - (-0.557)) / 0.47
            px = 88 + u * 88
            py = (1.696 - v.z) / 0.48 * 88
        elif abs(f.normal.y) > 0.70:
            u = (v.x - 0.205) / 0.40
            px = 176 + u * 72
            py = (1.696 - v.z) / 0.48 * 88
        else:
            continue
        uv[li].uv = (
            max(0.002, min(0.968, px / 256)),
            1 - max(0.002, min(0.342, py / 256)),
        )
box(
    "Short swept brown hair crown",
    (0.425, -0.322, 1.654),
    (0.42, 0.48, 0.125),
    "l",
    0.055,
    2,
)
box("Short brown fringe", (0.210, -0.355, 1.575), (0.035, 0.29, 0.09), "h", 0.016)
box("Warm small nose", (0.188, -0.322, 1.405), (0.065, 0.095, 0.085), "p", 0.022)
for side in [-1, 1]:
    ellipsoid(
        "Warm ear " + str(side),
        (0.407, -0.322 + side * 0.235, 1.425),
        (0.055, 0.040, 0.070),
        "s",
        8,
        5,
    )
tex.image.pack()
scene.view_settings.view_transform = "Standard"
for o in parts:
    o.data.calc_loop_triangles()
    stats.append(
        {
            "name": o.name,
            "triangles": len(o.data.loop_triangles),
            "semanticOwner": o["semantic_owner"],
        }
    )
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
low = bpy.context.object
low.name = "Explorer_static_seated"
low["presentation_status"] = "prototype-not-production"
root = bpy.data.objects.new("Explorer_HipOrigin_forward_minus_X", None)
scene.collection.objects.link(root)
low.parent = root
for name, point in C["riderContactSocketsSource"].items():
    e = bpy.data.objects.new("Socket_" + name, None)
    scene.collection.objects.link(e)
    e.parent = root
    e.location = Vector(point) - hip
    e["contact_semantics"] = name
mod = low.modifiers.new("Explicit seated topology triangulation", "TRIANGULATE")
bpy.context.view_layer.objects.active = low
bpy.ops.object.modifier_apply(modifier=mod.name)
root.scale = (scale,) * 3
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for o in root.children_recursive:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(O / "rider.glb"),
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_materials="EXPORT",
)
# Canonicalize only triangle index ordering/cyclic starts. Blender's stable geometry
# exporter can visit equivalent opaque triangles in a different order across runs.
# Vertex, normal, UV, image buffers and every triangle's winding stay byte untouched.
path = O / "rider.glb"
glb = bytearray(path.read_bytes())
json_size = struct.unpack_from("<I", glb, 12)[0]
document = json.loads(glb[20 : 20 + json_size])
bin_start = 28 + json_size
for model in document["meshes"]:
    for primitive in model["primitives"]:
        accessor = document["accessors"][primitive["indices"]]
        view = document["bufferViews"][accessor["bufferView"]]
        kind = {5123: "H", 5125: "I"}[accessor["componentType"]]
        count = accessor["count"]
        offset = bin_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        indices = struct.unpack_from("<" + str(count) + kind, glb, offset)
        triangles = []
        for i in range(0, count, 3):
            a, b, c = indices[i : i + 3]
            triangles.append(min((a, b, c), (b, c, a), (c, a, b)))
        canonical = [v for tri in sorted(triangles) for v in tri]
        struct.pack_into("<" + str(count) + kind, glb, offset, *canonical)
path.write_bytes(glb)
shutil.copyfile(O / "rider.glb", A / "rider.glb")
root.scale = (1,) * 3
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(A / "low.blend"))
recipe = {
    "status": "prototype-not-production",
    "humanApproval": False,
    "template": "Own static seated component anatomy; actual bent hips/knees/elbows, no vehicle loft or standing-pose squash",
    "config": C,
    "palette": I["palette"],
    "components": stats,
    "semanticUV": "Source-derived front/back/profile head patterns on actual volumetric head faces; all jacket/pack/limb/boot geometry uses padded role swatches",
    "masterMeaning": "Editable named semantic components at runtime topology; no skeletal animation/high-to-low claim",
    "sourceDependencies": ["build.py", "rider.json", "identity.json"],
    "scratchInputDependencies": [],
    "deterministicIndexOrder": "Winding-preserving cyclic-start and triangle-order canonicalization after export; vertex/normal/UV/image buffers untouched. Opaque static single mesh; geometry unchanged.",
}
for base in [A, O]:
    (base / "recipe.json").write_text(json.dumps(recipe, indent=2) + "\n")
for n in ["build.py", "rider.json", "identity.json"]:
    shutil.copyfile(S / n, A / n)
low.data.calc_loop_triangles()
g = {
    "triangles": len(low.data.loop_triangles),
    "meshes": 1,
    "materials": 1,
    "textures": 1,
    "atlas": [256, 256],
    "glbBytes": (O / "rider.glb").stat().st_size,
    "sha256": hashlib.sha256((O / "rider.glb").read_bytes()).hexdigest(),
}
(O / "report.json").write_text(
    json.dumps(
        {
            "status": "prototype-not-production",
            "sourceStage": "draft",
            "sourceImmutable": False,
            "humanApproval": False,
            "geometry": g,
            "limits": [
                "One static seated Explorer and one roadster seat only; no production/27-avatar/AI/fallback qualification",
                "Existing standing/promoted characters and normal vehicle runtime unchanged",
            ],
        },
        indent=2,
    )
    + "\n"
)
print(json.dumps(g))
