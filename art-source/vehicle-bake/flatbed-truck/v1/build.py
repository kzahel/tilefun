"""Original orange work cab and exposed gray flat-platform truck; own geometry and semantic UV ownership.
Deterministic Blender 5.2 --background --factory-startup --threads 4.
Retained source replay: -- --scratch. Never replaces a completed revision.
"""

import bpy, bmesh, math, json, sys, shutil, struct, zlib
from pathlib import Path
from mathutils import Vector

ROOT = next(
    p
    for p in Path(__file__).resolve().parents
    if (p / "AGENTS.md").is_file() and (p / "public").is_dir()
)
CFG = json.loads(Path(__file__).with_name("family.json").read_text())
SCRATCH = "--scratch" in sys.argv
A = ROOT / (
    "data/vehicle-bake/flatbed-truck/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/flatbed-truck/v1"
)
O = ROOT / (
    "data/vehicle-bake/flatbed-truck/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/flatbed-truck/v1"
)
D = ROOT / "data/vehicle-bake/flatbed-truck"
for p in (A, O, D, A / "evidence"):
    p.mkdir(parents=True, exist_ok=True)
if (O / "report.json").exists():
    assert (
        json.loads((O / "report.json").read_text()).get("status") != "complete"
    ), "Finished revision immutable"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
S = CFG["exportWorldScale"]
P = CFG["palette"]
keys = list(P)


def png(path, w, h, pixels):
    def chunk(k, v):
        return (
            struct.pack(">I", len(v))
            + k
            + v
            + struct.pack(">I", zlib.crc32(k + v) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\0" + pixels[y * w * 4 : (y + 1) * w * 4] for y in range(h))
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def framed(u, v, u0, u1, v0, v1):
    if u0 <= u <= u1 and v0 <= v <= v1:
        if min(u - u0, u1 - u) < 0.065 or min(v - v0, v1 - v) < 0.065:
            return "ink"
        f = (v - v0) / (v1 - v0)
        return (
            "glassGlint" if 0.68 < f < 0.79 else "glassLight" if f > 0.44 else "glass"
        )
    return None


def polygon_inside(x, z, poly):
    # Convex cab pane; inward edge distance bounds a continuous dark frame.
    crosses = []
    distances = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        dx = b[0] - a[0]
        dz = b[1] - a[1]
        c = dx * (z - a[1]) - dz * (x - a[0])
        crosses.append(c)
        distances.append(abs(c) / math.hypot(dx, dz))
    return all(c >= 0 for c in crosses) or all(c <= 0 for c in crosses), min(distances)


def pane(x, z, x0, x1, z0, z1):
    if x0 < x < x1 and z0 < z < z1:
        if min(x - x0, x1 - x, z - z0, z1 - z) < 0.060:
            return "ink"
        return (
            "glassGlint"
            if 0.66 < (z - z0) / (z1 - z0) < 0.77
            else "glassLight" if z > (z0 + z1) / 2 else "glass"
        )


def side_paint(x, z):
    role = "paintLight" if z > 2.18 else "paint" if z > 0.90 else "paintShadow"
    inside, distance = polygon_inside(
        x, z, [(-2.99, 1.24), (-1.09, 1.24), (-1.09, 2.21), (-2.72, 2.21)]
    )
    if inside:
        return (
            "ink"
            if distance < 0.060
            else (
                "glassGlint"
                if 1.90 < z < 1.98
                else "glassLight" if z > 1.72 else "glass"
            )
        )
    if (abs(x + 1.02) < 0.022 and 0.44 < z < 2.24) or (
        -2.94 < x < -1.02 and abs(z - 0.46) < 0.023
    ):
        return "paintDeep"
    if -1.34 < x < -1.15 and 1.04 < z < 1.10:
        return "ink"
    return role


def end_paint(y, z, rear):
    role = "paintLight" if z > 2.18 else "paint" if z > 0.90 else "paintShadow"
    if rear:
        c = pane(y, z, -0.72, 0.72, 1.48, 2.12)
        if c:
            return c
        if abs(y) < 0.88 and 1.36 < z < 1.40:
            return "paintDeep"
    else:
        if abs(y) < 0.59 and 0.58 < z < 0.88:
            return "silver" if abs(z - 0.64) < 0.014 or abs(z - 0.82) < 0.014 else "ink"
        if 0.68 < abs(y) < 0.91 and 0.85 < z < 1.07:
            return (
                "ink"
                if min(abs(y) - 0.68, 0.91 - abs(y), z - 0.85, 1.07 - z) < 0.026
                else "cream"
            )
    return role


def wind_paint(y, z):
    c = pane(y, z, -0.88, 0.88, 1.26, 2.24)
    return c if c else "paint"


def deck_paint(x, y):
    if abs(y) > 0.105 * 10:
        return "deckEdge"
    if any(abs(y - line) < 0.026 for line in [-0.55, 0, 0.55]):
        return "deckSeam"
    return "deckLight" if int((y + 1.1) / 0.55) % 2 else "deck"


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 176:
            k = side_paint(-3.25 + 2.5 * (x + 0.5) / 512, 0.24 + 2.31 * (y + 0.5) / 176)
        elif y < 256:
            k = end_paint(
                -1.25 + 2.5 * ((x % 256) + 0.5) / 256,
                0.24 + 2.31 * (y - 176 + 0.5) / 80,
                x >= 256,
            )
        elif y < 336:
            k = wind_paint(
                -1.25 + 2.5 * (x + 0.5) / 512, 0.24 + 2.31 * (y - 256 + 0.5) / 80
            )
        elif y < 432:
            k = deck_paint(
                -0.95 + 4.15 * (x + 0.5) / 512, -1.2 + 2.4 * (y - 336 + 0.5) / 96
            )
        elif y < 464:
            k = "paintLight"
        elif y < 480:
            yy = -1.2 + 2.4 * (x + 0.5) / 512
            k = (
                ("ink" if int((yy + 1.2) * 15) % 2 else "paintLight")
                if 0.58 < abs(yy) < 1.02
                else "deckLight"
            )
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("FlatbedTruck_palette_unlit_nearest")
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
out = nodes.new("ShaderNodeOutputMaterial")
tex = nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(A / "atlas.png"))
tex.interpolation = "Closest"
tex.extension = "EXTEND"
mat.node_tree.links.new(tex.outputs["Color"], out.inputs["Surface"])
mat.diffuse_color = (0.22, 0.64, 0.67, 1)
groups = {}
component_stats = []


def mesh(name, verts, faces, roles, group="body"):
    m = bpy.data.meshes.new(name)
    m.from_pydata(verts, [], faces)
    m.update()
    o = bpy.data.objects.new(name, m)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    uv = m.uv_layers.new(name="Semantic_palette_UV")
    attr = m.attributes.new("paint_role", "INT", "FACE")
    for f in m.polygons:
        k = roles[f.index] if isinstance(roles, list) else roles
        idx = keys.index(k)
        attr.data[f.index].value = idx
        # Padded constant-colour UV islands. Each face retains semantic ownership.
        cx = (idx % 16) * 32 + 16
        cy = 480 + (idx // 16) * 16 + 8
        for j, li in enumerate(f.loop_indices):
            a = 2 * math.pi * j / len(f.loop_indices)
            uv.data[li].uv = (
                (cx + 6 * math.cos(a)) / 512,
                1 - (cy + 3 * math.sin(a)) / 512,
            )
    bm = bmesh.new()
    bm.from_mesh(m)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(m)
    bm.free()
    o["surface_owner"] = name
    groups.setdefault(group, []).append(o)
    m.calc_loop_triangles()
    component_stats.append(
        {
            "name": name,
            "group": group,
            "triangles": len(m.loop_triangles),
            "paintRoles": sorted(set(roles if isinstance(roles, list) else [roles])),
        }
    )
    return o


def cube(name, loc, scale, role="silver", group="body", bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Restrained rounded trim", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    vv = [tuple(o.matrix_world @ v.co) for v in o.data.vertices]
    ff = [list(p.vertices) for p in o.data.polygons]
    bpy.data.objects.remove(o, do_unlink=True)
    return mesh(name, vv, ff, role, group)


def curve_tube(name, pts, r, role, group="body", sides=4):
    vv = []
    for i, p in enumerate(pts):
        tangent = Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(0, i - 1)])
        tangent.normalize()
        a = tangent.cross(Vector((0, 0, 1)))
        if a.length < 0.01:
            a = tangent.cross(Vector((0, 1, 0)))
        a.normalize()
        b = tangent.cross(a).normalized()
        for j in range(sides):
            vv.append(
                tuple(
                    Vector(p)
                    + r
                    * (
                        a * math.cos(j * 2 * math.pi / sides)
                        + b * math.sin(j * 2 * math.pi / sides)
                    )
                )
            )
    ff = []
    for i in range(len(pts) - 1):
        for j in range(sides):
            ff.append(
                (
                    i * sides + j,
                    i * sides + (j + 1) % sides,
                    (i + 1) * sides + (j + 1) % sides,
                    (i + 1) * sides + j,
                )
            )
    ff.extend(
        [
            tuple(range(sides - 1, -1, -1)),
            tuple((len(pts) - 1) * sides + j for j in range(sides)),
        ]
    )
    return mesh(name, vv, ff, role, group)


def chart(o, kind):
    uv = o.data.uv_layers.active.data
    for f in o.data.polygons:
        for li in f.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index].co
            if f.center.x < -2.7 and f.center.z > 1.18 and f.normal.x < -0.3:
                u = (v.y + 1.25) / 2.5
                py = 256 + (v.z - 0.24) / 2.31 * 80
            elif f.center.x > -0.98 and f.normal.x > 0.7:
                u = (256 + (v.y + 1.25) / 2.5 * 256) / 512
                py = 176 + (v.z - 0.24) / 2.31 * 80
            elif f.center.x < -3.0 and f.normal.x < -0.7:
                u = ((v.y + 1.25) / 2.5 * 256) / 512
                py = 176 + (v.z - 0.24) / 2.31 * 80
            elif abs(f.normal.y) > 0.65:
                u = (v.x + 3.25) / 2.5
                py = (v.z - 0.24) / 2.31 * 176
            elif f.normal.z > 0.5:
                u = (v.x + 3.25) / 2.5
                py = 432 + (v.y + 1.25) / 2.5 * 32
            else:
                u = (v.x + 3.25) / 2.5
                py = (v.z - 0.24) / 2.31 * 176
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=CFG["arch"]["segments"],
            radius=CFG["arch"]["cutRadius"],
            depth=1.55 - CFG["arch"]["pocketInnerY"],
            location=(
                axle,
                side * (1.55 + CFG["arch"]["pocketInnerY"]) / 2,
                CFG["wheelRadius"],
            ),
            rotation=(math.pi / 2, 0, 0),
        )
        cutter = bpy.context.object
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new(
            "Actual local tire opening through body and floor", "BOOLEAN"
        )
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    o.data.update()


def disk(name, center, normal, r, role, segments=12, depth=0.035, group="body"):
    c = Vector(center)
    n = Vector(normal).normalized()
    u = n.cross(Vector((0, 0, 1)))
    if u.length < 0.01:
        u = n.cross(Vector((0, 1, 0)))
    u.normalize()
    v = n.cross(u)
    verts = []
    for dep, rad in [(0, r), (depth, r * 0.83)]:
        for j in range(segments):
            verts.append(
                tuple(
                    c
                    + n * dep
                    + rad
                    * (
                        u * math.cos(2 * math.pi * j / segments)
                        + v * math.sin(2 * math.pi * j / segments)
                    )
                )
            )
    faces = []
    for j in range(segments):
        faces.append(
            (j, (j + 1) % segments, segments + (j + 1) % segments, segments + j)
        )
    faces.append(tuple(segments + j for j in range(segments)))
    return mesh(name, verts, faces, role, group)


# Own short closed orange work cab. Deck and frame are separate real thin components, never a stretched tall body.
sec = CFG["bodySection"]
vv = []
ff = []
ns = len(sec)
for x, w, h in CFG["bodyStations"]:
    for y, z in sec:
        vv.append((x, y * w, 0.32 + (h - 0.32) * z))
for i in range(len(CFG["bodyStations"]) - 1):
    for j in range(ns):
        ff.append(
            (
                i * ns + j,
                i * ns + (j + 1) % ns,
                (i + 1) * ns + (j + 1) % ns,
                (i + 1) * ns + j,
            )
        )
ff.extend(
    [
        tuple(range(ns - 1, -1, -1)),
        tuple((len(CFG["bodyStations"]) - 1) * ns + j for j in range(ns)),
    ]
)
body = mesh("Own short orange closed work cab", vv, ff, "paint")
pocket(body, CFG["axles"][0])
chart(body, "work-cab")

deck = CFG["flatDeck"]
platform = cube(
    "Actual exposed thin flat platform",
    (
        (deck["xRange"][0] + deck["xRange"][1]) / 2,
        0,
        (deck["bottomZ"] + deck["topZ"]) / 2,
    ),
    (
        deck["xRange"][1] - deck["xRange"][0],
        deck["width"],
        deck["topZ"] - deck["bottomZ"],
    ),
    "deckEdge",
    bevel=0.018,
)
for poly in platform.data.polygons:
    if poly.normal.z > 0.65:
        for li in poly.loop_indices:
            v = platform.data.vertices[platform.data.loops[li].vertex_index].co
            platform.data.uv_layers.active.data[li].uv = (
                (v.x + 0.95) / 4.15,
                1 - (336 + (v.y + 1.2) / 2.4 * 96) / 512,
            )
for y in [-0.56, 0.56]:
    cube(
        "Dark longitudinal underframe rail " + str(y),
        (0.0, y, 0.79),
        (5.88, 0.14, 0.22),
        "frame",
        bevel=0.012,
    )
for x in [-0.62, 0.70, 2.85]:
    cube(
        "Dark fixed deck crossmember " + str(x),
        (x, 0, 0.96),
        (0.14, 1.30, 0.13),
        "frame",
        bevel=0.012,
    )
    for y in [-0.56, 0.56]:
        cube(
            "Fixed platform support " + str((x, y)),
            (x, y, 1.055),
            (0.14, 0.14, 0.21),
            "deckEdge",
        )


# Broad lower fender shoulders join the side stripe without separate raised caps.
f = CFG["fender"]
n = f["segments"]
r = CFG["wheelRadius"]
for axle in CFG["axles"]:
    for side in [-1, 1]:
        vv = []
        ff = []
        rr = []
        for y, rad in zip(f["lateralStations"], f["shoulderRadii"]):
            for j in range(n + 1):
                t = math.pi * j / n
                vv.append((axle + rad * math.cos(t), side * y, r + rad * math.sin(t)))
        for k in range(len(f["lateralStations"]) - 1):
            for j in range(n):
                ff.append(
                    (
                        k * (n + 1) + j,
                        k * (n + 1) + j + 1,
                        (k + 1) * (n + 1) + j + 1,
                        (k + 1) * (n + 1) + j,
                    )
                )
                rr.append(
                    ("paintLight" if k == 1 else "paint" if k < 3 else "paintDeep")
                    if axle < 0
                    else ("deckLight" if k == 1 else "deck" if k < 3 else "deckSeam")
                )
        base = len(vv)
        for j in range(n + 1):
            t = math.pi * j / n
            vv.append(
                (
                    axle + f["archRadius"] * math.cos(t),
                    side * f["lateralStations"][-1],
                    r + f["archRadius"] * math.sin(t),
                )
            )
        last = len(f["lateralStations"]) - 1
        for j in range(n):
            ff.append(
                (last * (n + 1) + j, last * (n + 1) + j + 1, base + j + 1, base + j)
            )
            rr.append("paintDeep" if axle < 0 else "deckSeam")
        mesh(
            "Integrated truck arch guard " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )

cube(
    "Gray front work-truck bumper",
    (-3.095, 0, 0.43),
    (0.11, 2.10, 0.18),
    "deckLight",
    bevel=0.025,
)
rear = cube(
    "Rear gray bumper with small hazard paint",
    (3.105, 0, 0.73),
    (0.12, 2.10, 0.18),
    "deckLight",
    bevel=0.018,
)
for poly in rear.data.polygons:
    if poly.normal.x > 0.7:
        for li in poly.loop_indices:
            v = rear.data.vertices[rear.data.loops[li].vertex_index].co
            rear.data.uv_layers.active.data[li].uv = (
                (v.y + 1.2) / 2.4,
                1 - (464 + (v.z - 0.62) / 0.24 * 16) / 512,
            )
for y in [-0.93, 0.93]:
    cube("Small rear red lamp " + str(y), (3.12, y, 0.945), (0.07, 0.15, 0.11), "ruby")

for side in [-1, 1]:
    # Small fixed mirrors do not become invented gameplay equipment.
    curve_tube(
        "Fixed cab mirror stalk " + str(side),
        [(-2.78, side * 0.98, 1.43), (-2.82, side * 1.16, 1.49)],
        0.025,
        "ink",
        sides=4,
    )
    cube(
        "Compact fixed blue mirror " + str(side),
        (-2.82, side * 1.17, 1.63),
        (0.17, 0.065, 0.24),
        "ink",
        bevel=0.025,
    )
    cube(
        "Mirror glass owner " + str(side),
        (-2.72, side * 1.17, 1.63),
        (0.025, 0.055, 0.16),
        "glass",
    )

# Wheel topology has an exact circular envelope and genuinely centered pivots.
r = CFG["wheelRadius"]
width = CFG["wheelWidth"]
nr = 20
for axle in CFG["axles"]:
    for side in [-1, 1]:
        wid = ("F" if axle < 0 else "R") + ("L" if side < 0 else "R")
        group = wid
        vv = []
        ff = []
        rr = []
        rings = [
            (-width / 2, r * 0.84),
            (-width * 0.36, r),
            (width * 0.36, r),
            (width / 2, r * 0.84),
        ]
        for y, rad in rings:
            for j in range(nr):
                t = 2 * math.pi * j / nr
                vv.append((rad * math.sin(t), y, rad * math.cos(t)))
        for k in range(3):
            for j in range(nr):
                ff.append(
                    (
                        k * nr + j,
                        k * nr + (j + 1) % nr,
                        (k + 1) * nr + (j + 1) % nr,
                        (k + 1) * nr + j,
                    )
                )
                rr.append("tireLight" if k != 1 else "tire")
        for k in [0, 3]:
            ff.append(tuple(k * nr + j for j in range(nr)))
            rr.append("tire")
        mesh("Wheel rubber " + wid, vv, ff, rr, group)
        # Symmetric pressed-steel wheel and smooth dome hub; hubs remain inside radius.
        for s in [side]:
            disk(
                "Wheel rim " + wid + str(s),
                (0, s * (width / 2 + 0.003), 0),
                (0, s, 0),
                0.30,
                "rim",
                segments=12,
                depth=0.012,
                group=group,
            )
            disk(
                "Chrome hub " + wid + str(s),
                (0, s * (width / 2 + 0.017), 0),
                (0, s, 0),
                0.20,
                "silver",
                segments=12,
                depth=0.037,
                group=group,
            )
            disk(
                "Hub glint " + wid + str(s),
                (-0.035, s * (width / 2 + 0.055), 0.035),
                (0, s, 0),
                0.067,
                "white",
                segments=8,
                depth=0.002,
                group=group,
            )

# Boolean cutters may add UV layers; retain one explicit chart on every mesh.
for obs in groups.values():
    for o in obs:
        for layer in list(o.data.uv_layers):
            if layer.name != "Semantic_palette_UV":
                o.data.uv_layers.remove(layer)
        o.data.uv_layers.active_index = 0
        o.data.uv_layers[0].active_render = True
# Record evaluated component topology after local pocket booleans.
for stat in component_stats:
    obj = next(o for obs in groups.values() for o in obs if o.name == stat["name"])
    obj.data.calc_loop_triangles()
    stat["triangles"] = len(obj.data.loop_triangles)
# Keep correctly placed named components in an editable semantic source master.
tex.image.pack()
scene.view_settings.view_transform = "Standard"
# An explicitly unused palette planning image is retained, not a projected draft.
draft = bpy.data.images.new(
    "Unused family palette planning draft", width=512, height=512
)
draft.pixels = [
    c / 255
    for y in range(512)
    for x in range(512)
    for c in (*P[keys[min(len(keys) - 1, (y // 64) * 8 + x // 64)]], 255)
]
draft.filepath_raw = str(A / "palette-draft.png")
draft.file_format = "PNG"
draft.save()
draft.pack()
draft.use_fake_user = True
camera_data = bpy.data.cameras.new("Fixed family study camera")
camera = bpy.data.objects.new("Fixed family study camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -12 * math.cos(math.radians(50)), 12 * math.sin(math.radians(50)))
camera.rotation_euler = (-camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 12.6
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.max_bounces = 0
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
for group, obs in groups.items():
    if group != "body":
        axle = CFG["axles"][0 if group[0] == "F" else 1]
        side = -1 if group[1] == "L" else 1
        for o in obs:
            o.location = (axle, side * CFG["halfTrack"], r)
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
for group, obs in groups.items():
    if group != "body":
        for o in obs:
            o.location = (0, 0, 0)
root = bpy.data.objects.new("FlatbedTruck_Root_forward_minus_X", None)
scene.collection.objects.link(root)
wheels = []
for group, obs in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    if group == "body":
        o.name = "Body_static"
        o.parent = root
    else:
        axle = CFG["axles"][0 if group[0] == "F" else 1]
        side = -1 if group[1] == "L" else 1
        c = Vector((axle, side * CFG["halfTrack"], r))
        st = bpy.data.objects.new(f"Wheel_{group}_Steer", None)
        scene.collection.objects.link(st)
        st.parent = root
        st.location = c
        st["steering_enabled"] = group[0] == "F"
        st["steer_axis_gltf"] = [0, 1, 0]
        ro = bpy.data.objects.new(f"Wheel_{group}_Roll", None)
        scene.collection.objects.link(ro)
        ro.parent = st
        ro["wheel_radius"] = r * S
        ro["roll_axis_gltf"] = [0, 0, -1]
        o.name = f"Wheel_{group}_tire_hub"
        o.parent = ro
        o.location = (0, 0, 0)
        wheels.append(
            {
                "id": group,
                "centerBlender": list(c),
                "centerExport": [c.x * S, c.z * S, -c.y * S],
                "radiusBlender": r,
                "wheel_radius": r * S,
            }
        )
    # Stable explicit triangulation is also used by the standard Blender glTF exporter.
    mod = o.modifiers.new("Explicit runtime triangulation", "TRIANGULATE")
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)
root.scale = (S,) * 3
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for o in root.children_recursive:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(O / "model.glb"),
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_materials="EXPORT",
)
shutil.copy2(O / "model.glb", A / "model.glb")
root.scale = (1, 1, 1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(A / "car.blend"))
recipe = {
    **CFG,
    "components": component_stats,
    "wheels": wheels,
    "method": CFG["paintMethod"],
    "masterMeaning": "Editable semantic component master at runtime topology; no separate high-poly/decimation claim.",
    "sourceDependencies": [
        "scripts/vehicle-bake/flatbed-truck/" + f
        for f in [
            "build.py",
            "family.json",
            "coverage-region.json",
            "surface-regions.json",
            "deck-region.json",
            "review.json",
        ]
    ],
    "sharedComponents": [
        "Blender glTF exporter (same selected-root/y-up/extras/material contract as coupe)",
        "scripts/vehicle-bake/catalog.py:audit_glb",
        "scripts/vehicle-bake/clearance.py",
        "Compiled shared viewer.js / CarMeshAsset / CarPixelOutline / wheel-rig.mjs",
    ],
}
(A / "recipe.json").write_text(json.dumps(recipe, indent=2) + "\n")
shutil.copy2(A / "recipe.json", O / "recipe.json")
(A / "paint-ownership.json").write_text(
    json.dumps(
        {
            "method": CFG["paintMethod"],
            "palette": P,
            "semanticOwners": {
                "orangeCabSides": {
                    "atlasPixelRect": [0, 0, 512, 176],
                    "meaning": "Actual short closed cab skin, coherent blue glass, dark frame and door seam; no overlay",
                },
                "cabFrontAndRear": {"atlasPixelRect": [0, 176, 512, 256]},
                "cabWindshield": {"atlasPixelRect": [0, 256, 512, 336]},
                "flatPlatformTop": {
                    "component": "Actual exposed thin flat platform",
                    "atlasPixelRect": [0, 336, 512, 432],
                    "meaning": "Real flat top with three broad longitudinal panel seams; no recessed bed, cargo or invented depth",
                },
                "cabRoof": {"atlasPixelRect": [0, 432, 512, 464]},
                "rearBumperHazards": {"atlasPixelRect": [0, 464, 512, 480]},
                "thinDeckEdges": {
                    "meaning": "Actual platform vertical/beveled edges have separate padded gray ownership"
                },
                "underframeAndGuards": {
                    "meaning": "Two dark longitudinal rails, fixed crossmembers/supports and four rounded open guards; front orange, rear gray"
                },
                "wheels": {
                    "meaning": "Four independent tire/rim/hub surfaces; no guard paint on tire surfaces"
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Original authored semantic UVs including unseen surfaces; no projected source or high-to-low transfer claim.",
            "outerInk": "Shared exterior pass RGB58,58,80; no geometry outline shell.",
        },
        indent=2,
    )
    + "\n"
)

for file in [
    "build.py",
    "family.json",
    "coverage-region.json",
    "surface-regions.json",
    "deck-region.json",
    "review.json",
]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
report = {
    "status": "draft",
    "artReviewStatus": "agent-QA-in-progress; run153 appearance wait waived",
    "family": "flatbed-truck",
    "route": "flatbed-truck",
    "revision": "v1",
    "method": CFG["paintMethod"],
    "geometry": audit,
    "exportWorldScale": S,
    "wheels": wheels,
    "atlasSize": [512, 512],
    "sourceBlend": (A / "car.blend").relative_to(ROOT).as_posix(),
    "masterBlend": (A / "master.blend").relative_to(ROOT).as_posix(),
    "recipe": (A / "recipe.json").relative_to(ROOT).as_posix(),
    "render": CFG["render"],
    "renderThreads": 4,
    "driverPresentation": "No visible animated driver; existing ordinary driving semantics hide the driver inside vehicles. No new rider gameplay.",
    "equipment": "Static orange work cab and genuinely empty thin flat platform, dark underframe and fixed guards; no cargo/towing/animated equipment.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
