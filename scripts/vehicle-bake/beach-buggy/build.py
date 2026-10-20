"""Original sunny orange beach dune buggy; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/beach-buggy/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/beach-buggy/v1"
)
O = ROOT / (
    "data/vehicle-bake/beach-buggy/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/beach-buggy/v1"
)
D = ROOT / "data/vehicle-bake/beach-buggy"
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


def buggy_side(x, z):
    if abs(z - 0.49) < 0.018 and -0.60 < x < 0.94:
        return "paintDeep"
    return (
        "paintLight"
        if z > 0.78
        else "paint" if z > 0.55 else "paintMid" if z > 0.38 else "paintShadow"
    )


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        u = (x + 0.5) / 512
        if y < 160:
            k = buggy_side(-1.95 + 3.9 * u, 0.22 + 1.05 * (y + 0.5) / 160)
        elif y < 288:
            yy = -1.05 + 2.1 * (y - 160 + 0.5) / 128
            k = "paintLight" if abs(yy) < 0.50 else "paint"
            if abs(yy) < 0.024:
                k = "paintMid"
        elif y < 384:
            yy = -1.05 + 2.1 * (y - 288 + 0.5) / 96
            k = "paintLight" if abs(yy) < 0.45 else "paint"
            if 0.76 < u < 0.91 and abs(yy) < 0.38 and int((u - 0.76) * 90) % 3 == 0:
                k = "paintDeep"
        elif y < 464:
            v = (y - 384 + 0.5) / 80
            k = (
                "ink"
                if u < 0.043 or u > 0.957 or v < 0.10 or v > 0.90
                else (
                    "glassGlint"
                    if 0.68 < v < 0.78
                    else "glassLight" if v > 0.44 else "glass"
                )
            )
        elif y < 480:
            k = "seatLight" if 0.16 < u < 0.84 else "seatBlue"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)
shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("BeachBuggy_palette_unlit_nearest")
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


def role_uv(o, f, role):
    idx = keys.index(role)
    for li in f.loop_indices:
        o.data.uv_layers.active.data[li].uv = (
            ((idx % 16) * 32 + 16) / 512,
            1 - (480 + (idx // 16) * 16 + 8) / 512,
        )


def chart(o, kind):
    uv = o.data.uv_layers.active.data
    for f in o.data.polygons:
        if kind == "body":
            c = f.center
            inner = -0.535 < c.x < 0.985 and abs(c.y) < 0.635 and 0.375 < c.z < 0.97
            if inner:
                role_uv(
                    o, f, "bedFloor" if f.normal.z > 0.5 and c.z < 0.52 else "bedWall"
                )
                continue
        for li in f.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index].co
            if kind == "windscreen":
                # Front/back surface uses identical bounded glass; narrow slab edges ink.
                if abs(f.normal.x) > 0.5:
                    u = (v.y + 0.70) / 1.40
                    py = 384 + (v.z - 0.94) / 0.35 * 80
                else:
                    continue
            elif f.normal.z > 0.45 and f.center.z > 0.60:
                u = (v.x + 1.95) / 3.9
                py = (
                    (160 + (v.y + 1.05) / 2.1 * 128)
                    if f.center.x < -0.50
                    else (288 + (v.y + 1.05) / 2.1 * 96)
                )
            else:
                u = (v.x + 1.95) / 3.9
                py = (v.z - 0.22) / 1.05 * 160
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=1.0,
            location=(axle, side * 1.07, CFG["wheelRadius"]),
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


# Original short, wide rounded tub: own station layout and transverse section.
sec = [
    (-0.78, 0.20),
    (-0.96, 0.33),
    (-1, 0.57),
    (-0.97, 0.82),
    (-0.86, 0.97),
    (-0.56, 1.02),
    (0, 1.025),
    (0.56, 1.02),
    (0.86, 0.97),
    (0.97, 0.82),
    (1, 0.57),
    (0.96, 0.33),
    (0.78, 0.20),
]
vv = [
    (x, y * w, 0.25 + (h - 0.25) * z) for x, w, h in CFG["bodyStations"] for y, z in sec
]
ns = len(sec)
ff = []
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
body = mesh("Own short rounded orange buggy tub with genuine cockpit", vv, ff, "paint")
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.225, 0, 1.385))
cutter = bpy.context.object
cutter.scale = (1.51, 1.24, 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mod = cutter.modifiers.new("Rounded open tub corners", "BEVEL")
mod.width = 0.10
mod.segments = 2
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active = body
mod = body.modifiers.new("Real empty two-seat cockpit", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.solver = "EXACT"
mod.object = cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter, do_unlink=True)
for axle in CFG["axles"]:
    pocket(body, axle)
chart(body, "body")
for side in [-1, 1]:
    cube(
        "Dark inner tub panel " + str(side),
        (0.20, side * 0.585, 0.66),
        (1.23, 0.025, 0.43),
        "bedWall",
    )
    cube(
        "Rounded orange cockpit rail " + str(side),
        (0.22, side * 0.645, 0.925),
        (1.27, 0.085, 0.065),
        "paintLight",
        bevel=0.025,
    )
cube(
    "Dark dashboard across actual front cockpit",
    (-0.475, 0, 0.84),
    (0.105, 1.17, 0.22),
    "bedWall",
)
cube("Orange dashboard cap", (-0.475, 0, 0.954), (0.13, 1.19, 0.042), "paintMid")
cube(
    "Recessed cockpit floor visible in footwells",
    (0.17, 0, 0.390),
    (1.18, 1.12, 0.024),
    "bedFloor",
)
cube("Narrow low center tunnel", (0.28, 0, 0.448), (0.86, 0.075, 0.092), "bedRib")
for side in [-1, 1]:
    cube(
        "Blue bucket seat cushion " + str(side),
        (0.33, side * 0.322, 0.535),
        (0.55, 0.48, 0.18),
        "seatBlue",
        bevel=0.065,
    )
    cube(
        "Light blue cushion center " + str(side),
        (0.30, side * 0.322, 0.633),
        (0.38, 0.345, 0.025),
        "seatLight",
    )
    back = cube(
        "Blue bucket seatback " + str(side),
        (0.67, side * 0.322, 0.81),
        (0.15, 0.49, 0.48),
        "seatBlue",
        bevel=0.06,
    )
    cube(
        "Blue seatback center face " + str(side),
        (0.579, side * 0.322, 0.82),
        (0.025, 0.34, 0.30),
        "seatLight",
    )
    cube(
        "Dark seatback top seam " + str(side),
        (0.67, side * 0.322, 1.055),
        (0.12, 0.38, 0.025),
        "seatDark",
    )
# Static compact blue windscreen is a closed framed slab, with opaque unlit glass.
vv = []
for dx in [-0.013, 0.013]:
    vv.extend(
        [
            (-0.57 + dx, -0.70, 0.94),
            (-0.57 + dx, 0.70, 0.94),
            (-0.40 + dx, 0.655, 1.29),
            (-0.40 + dx, -0.655, 1.29),
        ]
    )
ff = [
    (0, 1, 2, 3),
    (7, 6, 5, 4),
    (0, 4, 5, 1),
    (1, 5, 6, 2),
    (2, 6, 7, 3),
    (3, 7, 4, 0),
]
wind = mesh("Static tiny windscreen exact framed opaque glass owner", vv, ff, "ink")
chart(wind, "windscreen")
# Fixed black roll cage: actual body vertices, never wheel children.
for x in [-0.48, 0.79]:
    pts = [
        (x, -0.62, 0.91),
        (x, -0.62, 1.46),
        (x, -0.57, 1.58),
        (x, -0.45, 1.615),
        (x, 0.45, 1.615),
        (x, 0.57, 1.58),
        (x, 0.62, 1.46),
        (x, 0.62, 0.91),
    ]
    curve_tube("Fixed cage transverse hoop " + str(x), pts, 0.035, "ink", sides=6)
for side in [-1, 1]:
    curve_tube(
        "Fixed cage roof side rail " + str(side),
        [(-0.48, side * 0.54, 1.60), (0.79, side * 0.54, 1.60)],
        0.032,
        "ink",
        sides=6,
    )
    curve_tube(
        "Fixed cage rear brace " + str(side),
        [(0.79, side * 0.57, 1.52), (1.47, side * 0.48, 0.93)],
        0.030,
        "ink",
        sides=6,
    )
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
                rr.append("paintLight" if k == 1 else "paint" if k < 3 else "paintMid")
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
            rr.append("paintDeep")
        mesh("Broad integrated buggy fender " + str(axle) + " " + str(side), vv, ff, rr)


# Quiet gray round lamps, compact bumpers and unlettered rear vents.
for x in [-1.90, 1.90]:
    cube(
        "Small gray bumper " + str(x),
        (x, 0, 0.42),
        (0.10, 1.29, 0.10),
        "rim",
        bevel=0.025,
    )
for side in [-1, 1]:
    disk(
        "Gray headlamp rim " + str(side),
        (-1.76, side * 0.53, 0.83),
        (-1, 0, 0.1),
        0.15,
        "ink",
        segments=12,
        depth=0.025,
    )
    disk(
        "Gray headlamp lens " + str(side),
        (-1.79, side * 0.53, 0.834),
        (-1, 0, 0.1),
        0.115,
        "silver",
        segments=12,
        depth=0.012,
    )
    disk(
        "Small red rear lamp " + str(side),
        (1.805, side * 0.46, 0.71),
        (1, 0, 0),
        0.065,
        "ruby",
        segments=10,
        depth=0.018,
    )
# Static steering ring sits wholly inside the open well.
pts = []
for j in range(13):
    a = 2 * math.pi * j / 12
    pts.append(
        (
            -0.26 + 0.04 * math.sin(a),
            -0.322 + 0.14 * math.cos(a),
            0.84 + 0.13 * math.sin(a),
        )
    )
curve_tube("Static steering wheel in cockpit", pts, 0.018, "ink", sides=4)
curve_tube(
    "Static steering wheel spoke",
    [(-0.26, -0.46, 0.84), (-0.26, -0.18, 0.84)],
    0.015,
    "rim",
    sides=4,
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
                rr.append("tireLight" if k == 1 and j % 4 == 0 else "tire")
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
                0.245,
                "rim",
                segments=12,
                depth=0.012,
                group=group,
            )
            disk(
                "Chrome hub " + wid + str(s),
                (0, s * (width / 2 + 0.017), 0),
                (0, s, 0),
                0.15,
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
root = bpy.data.objects.new("BeachBuggy_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/beach-buggy/" + f
        for f in [
            "build.py",
            "family.json",
            "coverage-region.json",
            "cockpit-region.json",
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
            "ownership": "Own continuous side and hood/deck charts on the low rounded body; genuine cockpit floor/inner panels, blue bucket cushions/seatbacks, opaque glass/framing, fixed black cage and gray trim have exact named semantic owners. Named source components retain base FACE paint_role attributes; their continuous UV charts own window/paint details. Trim islands share padded constant-role swatches; wheel-only meshes never sample coachwork.",
            "semanticOwners": {
                "bodySide": {
                    "component": "Own short rounded orange buggy tub with genuine cockpit",
                    "atlasPixelRect": [0, 0, 512, 160],
                    "meaning": "Continuous real body side paint, lower shadow and door cutline",
                },
                "hood": {
                    "atlasPixelRect": [0, 160, 512, 288],
                    "meaning": "Short rounded orange nose skin, broad warm clusters",
                },
                "rearDeck": {
                    "atlasPixelRect": [0, 288, 512, 384],
                    "meaning": "Flat rear engine cover with broad vent paint, never covers cockpit",
                },
                "windscreen": {
                    "component": "Static tiny windscreen exact framed opaque glass owner",
                    "atlasPixelRect": [0, 384, 512, 464],
                    "meaning": "Only actual front/back slab faces own blue glass with continuous dark perimeter; thin edges remain ink",
                },
                "bucketSeatbacks": {
                    "components": [
                        "Blue bucket seatback -1",
                        "Blue bucket seatback 1",
                        "Blue seatback center face -1",
                        "Blue seatback center face 1",
                    ],
                    "roles": ["seatBlue", "seatLight", "seatDark"],
                    "meaning": "Padded role swatches; actual back/cushion geometry, not a painted upper deck",
                },
                "trim": {
                    "roles": ["silver", "rim", "ink", "cream", "ruby"],
                    "meaning": "Exact named bumpers, round lamps, fixed cage tubes and static steering components; padded role islands",
                },
                "cockpit": {
                    "roles": ["bedFloor", "bedWall", "bedRib"],
                    "meaning": "Recessed actual floor, separate inner door panels/dashboard and low center tunnel",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Symmetric two-seat open dune buggy; short nose and flat engine cover have distinct semantic ownership.",
            "limitations": [
                "Economical runtime-topology component master.",
                "Neutral steering only; no suspension or animated equipment qualification.",
            ],
        },
        indent=2,
    )
    + "\n"
)
for file in [
    "build.py",
    "family.json",
    "coverage-region.json",
    "cockpit-region.json",
    "review.json",
]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
report = {
    "status": "draft",
    "artReviewStatus": "agent-QA-in-progress; run153 appearance wait waived",
    "family": "beach-buggy",
    "route": "beach-buggy",
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
    "equipment": "Static roll cage, windscreen and seats; no equipment animations. Driver-visible pose out of scope.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
