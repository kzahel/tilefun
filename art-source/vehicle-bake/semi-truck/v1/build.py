"""Original rigid purple tractor and long cream teal box-trailer combination; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/semi-truck/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/semi-truck/v1"
)
O = ROOT / (
    "data/vehicle-bake/semi-truck/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/semi-truck/v1"
)
D = ROOT / "data/vehicle-bake/semi-truck"
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
    role = "paintLight" if z > 2.44 else "paint" if z > 1.0 else "paintShadow"
    inside, distance = polygon_inside(
        x, z, [(-3.88, 1.56), (-1.96, 1.56), (-1.96, 2.49), (-3.61, 2.49)]
    )
    if inside:
        return (
            "ink"
            if distance < 0.062
            else (
                "glassGlint"
                if 2.16 < z < 2.23
                else "glassLight" if z > 1.98 else "glass"
            )
        )
    if (abs(x + 1.88) < 0.022 and 0.47 < z < 2.51) or (
        -3.77 < x < -1.88 and abs(z - 0.50) < 0.023
    ):
        return "paintDeep"
    if -2.22 < x < -2.02 and 1.34 < z < 1.41:
        return "ink"
    return role


def end_paint(y, z, rear):
    role = "paintLight" if z > 2.44 else "paint" if z > 1.0 else "paintShadow"
    if rear:
        if abs(y) < 0.8 and 1.43 < z < 1.47:
            return "paintDeep"
    else:
        if abs(y) < 0.68 and 0.64 < z < 1.20:
            if abs(y) > 0.60 or min(z - 0.64, 1.20 - z) < 0.055:
                return "silver"
            return "silver" if abs(z - 0.78) < 0.025 or abs(z - 0.98) < 0.025 else "ink"
        if 0.74 < abs(y) < 0.97 and 0.88 < z < 1.15:
            return (
                "ink"
                if min(abs(y) - 0.74, 0.97 - abs(y), z - 0.88, 1.15 - z) < 0.03
                else "cream"
            )
    return role


def wind_paint(y, z):
    c = pane(y, z, -0.91, 0.91, 1.57, 2.53)
    return c if c else "paint"


def trailer_paint(y, z, rear=False):
    role = (
        "boxRoof"
        if z > 2.88
        else "teal" if 1.56 < z < 1.95 else "boxShadow" if z < 1.39 else "box"
    )
    if rear:
        if abs(y) < 0.025 and 1.36 < z < 2.94:
            return "ink"
        if 0.12 < abs(y) < 0.18 and 2.04 < z < 2.25:
            return "silver"
        if 1.02 < abs(y) < 1.16 and 1.31 < z < 1.48:
            return "ruby"
    return role


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 128:
            k = side_paint(
                -4.75 + 3.15 * (x + 0.5) / 512, 0.24 + 2.70 * (y + 0.5) / 128
            )
        elif y < 208:
            k = end_paint(
                -1.35 + 2.7 * ((x % 256) + 0.5) / 256,
                0.24 + 2.70 * (y - 128 + 0.5) / 80,
                x >= 256,
            )
        elif y < 288:
            k = wind_paint(
                -1.35 + 2.7 * (x + 0.5) / 512, 0.24 + 2.70 * (y - 208 + 0.5) / 80
            )
        elif y < 384:
            k = trailer_paint(0, 1.16 + 2.0 * (y - 288 + 0.5) / 96)
        elif y < 448:
            k = trailer_paint(
                -1.35 + 2.7 * ((x % 256) + 0.5) / 256,
                1.16 + 2.0 * (y - 384 + 0.5) / 64,
                x >= 256,
            )
        elif y < 464:
            k = "boxRoof"
        elif y < 480:
            k = "paintLight"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("SemiTruck_palette_unlit_nearest")
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
            if kind == "trailer":
                if abs(f.normal.x) > 0.65:
                    u = (
                        (256 if f.normal.x > 0 else 0) + (v.y + 1.35) / 2.7 * 256
                    ) / 512
                    py = 384 + (v.z - 1.16) / 2.0 * 64
                elif f.normal.z > 0.5:
                    u = (v.x + 1.2) / 5.95
                    py = 448 + (v.y + 1.35) / 2.7 * 16
                else:
                    u = (v.x + 1.2) / 5.95
                    py = 288 + (v.z - 1.16) / 2.0 * 96
            elif f.center.x < -3.7 and f.center.z > 1.43 and f.normal.x < -0.28:
                u = (v.y + 1.35) / 2.7
                py = 208 + (v.z - 0.24) / 2.70 * 80
            elif f.center.x > -1.87 and f.normal.x > 0.7:
                u = (256 + (v.y + 1.35) / 2.7 * 256) / 512
                py = 128 + (v.z - 0.24) / 2.70 * 80
            elif f.center.x < -4.35 and f.normal.x < -0.7:
                u = ((v.y + 1.35) / 2.7 * 256) / 512
                py = 128 + (v.z - 0.24) / 2.70 * 80
            elif abs(f.normal.y) > 0.65:
                u = (v.x + 4.75) / 3.15
                py = (v.z - 0.24) / 2.70 * 128
            elif f.normal.z > 0.5:
                u = (v.x + 4.75) / 3.15
                py = 464 + (v.y + 1.35) / 2.7 * 16
            else:
                u = (v.x + 4.75) / 3.15
                py = (v.z - 0.24) / 2.70 * 128
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


# Own tall tractor cab and distinct long closed trailer. The visual combination is rigid; no articulated joint or separate trailer physics.
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
body = mesh("Own tall purple tractor cab", vv, ff, "paint")
pocket(body, CFG["axles"][0])
chart(body, "work-cab")

tr = CFG["trailer"]
trailer = cube(
    "Own long rigid cream box trailer",
    ((tr["xRange"][0] + tr["xRange"][1]) / 2, 0, (tr["bottomZ"] + tr["roofZ"]) / 2),
    (tr["xRange"][1] - tr["xRange"][0], tr["width"], tr["roofZ"] - tr["bottomZ"]),
    "box",
    bevel=0.045,
)
chart(trailer, "trailer")
for y in [-0.56, 0.56]:
    cube(
        "Tractor dark frame rail " + str(y),
        (-2.20, y, 0.79),
        (4.30, 0.15, 0.22),
        "frame",
        bevel=0.012,
    )
    cube(
        "Trailer dark underframe rail " + str(y),
        (1.75, y, 1.16),
        (5.55, 0.15, 0.16),
        "frame",
        bevel=0.012,
    )
for x in [-1.64, -0.35, 1.65, 4.26]:
    cube(
        "Rigid frame crossmember " + str(x),
        (x, 0, 0.96),
        (0.14, 1.34, 0.14),
        "frame",
        bevel=0.012,
    )
disk(
    "Visible fifth-wheel coupling plate",
    (-1.30, 0, 1.12),
    (0, 0, 1),
    0.42,
    "deckEdge",
    segments=16,
    depth=0.07,
)
cube(
    "Fixed fifth-wheel frame saddle",
    (-1.30, 0, 1.01),
    (0.70, 1.28, 0.26),
    "frame",
    bevel=0.018,
)
curve_tube(
    "Fixed visual coupling kingpin",
    [(-1.02, 0, 1.16), (-1.02, 0, 1.30)],
    0.055,
    "frame",
    sides=8,
)
for side in [-1, 1]:
    curve_tube(
        "Restrained silver exhaust stack " + str(side),
        [
            (-1.96, side * 1.15, 1.22),
            (-1.96, side * 1.15, 2.72),
            (-1.89, side * 1.15, 2.82),
        ],
        0.055,
        "silver",
        sides=8,
    )
    disk(
        "Exhaust dark outlet " + str(side),
        (-1.89, side * 1.15, 2.82),
        (0, 0, 1),
        0.041,
        "ink",
        segments=8,
        depth=0.003,
    )
for axle in CFG["axles"][1:]:
    for x in [axle - 0.36, axle + 0.36]:
        for side in [-1, 1]:
            cube(
                "Trailer guard fixed hanger " + str((x, side)),
                (x, side * 1.10, 1.18),
                (0.09, 0.16, 0.30),
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
                    if axle == CFG["axles"][0]
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
            rr.append("paintDeep" if axle == CFG["axles"][0] else "deckSeam")
        mesh(
            "Integrated truck arch guard " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )

cube(
    "Silver tractor front bumper",
    (-4.535, 0, 0.43),
    (0.12, 2.24, 0.20),
    "silver",
    bevel=0.025,
)
cube(
    "Rear gray trailer bumper",
    (4.555, 0, 0.76),
    (0.13, 2.32, 0.18),
    "deckEdge",
    bevel=0.018,
)
for y in [-1.04, 1.04]:
    cube("Trailer red rear lamp " + str(y), (4.58, y, 1.02), (0.08, 0.18, 0.12), "ruby")

for side in [-1, 1]:
    # Small fixed mirrors do not become invented gameplay equipment.
    curve_tube(
        "Fixed cab mirror stalk " + str(side),
        [(-3.70, side * 1.02, 1.77), (-3.76, side * 1.21, 1.83)],
        0.025,
        "ink",
        sides=4,
    )
    cube(
        "Compact fixed blue mirror " + str(side),
        (-3.76, side * 1.23, 1.97),
        (0.17, 0.065, 0.24),
        "ink",
        bevel=0.025,
    )
    cube(
        "Mirror glass owner " + str(side),
        (-3.66, side * 1.23, 1.97),
        (0.025, 0.055, 0.16),
        "glass",
    )

# Wheel topology has an exact circular envelope and genuinely centered pivots.
r = CFG["wheelRadius"]
width = CFG["wheelWidth"]
nr = 20
for axle in CFG["axles"]:
    for side in [-1, 1]:
        wid = next(a["id"] for a in CFG["axleDefinitions"] if a["x"] == axle) + (
            "L" if side < 0 else "R"
        )
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
        axle = next(a["x"] for a in CFG["axleDefinitions"] if a["id"] == group[0])
        side = -1 if group[1] == "L" else 1
        for o in obs:
            o.location = (axle, side * CFG["halfTrack"], r)
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
for group, obs in groups.items():
    if group != "body":
        for o in obs:
            o.location = (0, 0, 0)
root = bpy.data.objects.new("SemiTruck_Root_forward_minus_X", None)
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
        axle = next(a["x"] for a in CFG["axleDefinitions"] if a["id"] == group[0])
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
        "scripts/vehicle-bake/semi-truck/" + f
        for f in [
            "build.py",
            "family.json",
            "coverage-region.json",
            "surface-regions.json",
            "coupling-region.json",
            "review.json",
        ]
    ],
    "sharedComponents": [
        "Blender glTF exporter (same selected-root/y-up/extras/material contract as coupe)",
        "scripts/vehicle-bake/catalog-v2.py:audit_glb(wheel_ids=all6) + underlying catalog.py",
        "scripts/vehicle-bake/clearance-v2.py",
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
                "purpleCabSides": {
                    "atlasPixelRect": [0, 0, 512, 128],
                    "meaning": "Actual tall tractor cab skin; blue panes/dark continuous frames and door seams",
                },
                "cabEnds": {
                    "atlasPixelRect": [0, 128, 512, 208],
                    "meaning": "Actual silver/ink grille and headlights, purple closed rear cab",
                },
                "windshield": {"atlasPixelRect": [0, 208, 512, 288]},
                "longTrailerSides": {
                    "atlasPixelRect": [0, 288, 512, 384],
                    "meaning": "Actual cream rigid box skin and broad teal lower stripe; no projected view silhouette",
                },
                "trailerEnds": {
                    "atlasPixelRect": [0, 384, 512, 448],
                    "meaning": "Own cream/teal front and rear door/seam/handle/lamp paint",
                },
                "trailerRoof": {"atlasPixelRect": [0, 448, 512, 464]},
                "cabRoof": {"atlasPixelRect": [0, 464, 512, 480]},
                "coupling": {
                    "meaning": "Real empty gap between cab and trailer volumes; actual plate and frame bridge below, not a dark painted fake gap"
                },
                "sixRoadWheels": {
                    "ids": CFG["wheelIds"],
                    "meaning": "Six independent Steer > Roll > tire/rim/hub assemblies, exact per-wheel radii. No articulation.",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Original authored semantic UVs including unseen surfaces; no projection/high-to-low transfer claim.",
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
    "coupling-region.json",
    "review.json",
]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
import importlib.util

spec = importlib.util.spec_from_file_location(
    "catalog_v2", ROOT / "scripts/vehicle-bake/catalog-v2.py"
)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
audit = catalog.audit_glb(O / "model.glb", wheel_ids=CFG["wheelIds"])
report = {
    "status": "draft",
    "artReviewStatus": "agent-QA-in-progress; run153 appearance wait waived",
    "family": "semi-truck",
    "route": "semi-truck",
    "revision": "v1",
    "toolchain": CFG["toolchain"],
    "wheelIds": CFG["wheelIds"],
    "rigidVisualCombination": "One fixed body containing cab/trailer/frame/coupling/stacks; six independent road wheels. No articulation, hitch gameplay or separate trailer physics.",
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
    "equipment": "Rigid visual tractor-and-box-trailer combination with real coupling gap/frame/fifth-wheel, six independent wheels and fixed stacks. No articulation, hitch gameplay, separate trailer physics or animated equipment.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
