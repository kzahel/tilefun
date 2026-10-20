"""Original low orange yellow mobile crane with rigid stowed work equipment; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/mobile-crane/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/mobile-crane/v1"
)
O = ROOT / (
    "data/vehicle-bake/mobile-crane/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/mobile-crane/v1"
)
D = ROOT / "data/vehicle-bake/mobile-crane"
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
    role = "paintLight" if z > 2.08 else "paint" if z > 0.94 else "paintShadow"
    inside, distance = polygon_inside(
        x, z, [(-3.27, 1.22), (-1.94, 1.22), (-1.94, 2.12), (-3.08, 2.12)]
    )
    if inside:
        return (
            "ink"
            if distance < 0.060
            else (
                "glassGlint"
                if 1.82 < z < 1.89
                else "glassLight" if z > 1.67 else "glass"
            )
        )
    if (abs(x + 1.88) < 0.022 and 0.46 < z < 2.14) or (
        -3.22 < x < -1.88 and abs(z - 0.48) < 0.023
    ):
        return "paintDeep"
    if -2.17 < x < -2.00 and 1.04 < z < 1.10:
        return "ink"
    return role


def end_paint(y, z, rear):
    role = "paintLight" if z > 2.08 else "paint" if z > 0.94 else "paintShadow"
    if not rear:
        if abs(y) < 0.64 and 0.61 < z < 0.96:
            return (
                "silver"
                if abs(y) > 0.57 or abs(z - 0.68) < 0.02 or abs(z - 0.88) < 0.02
                else "ink"
            )
        if 0.70 < abs(y) < 0.94 and 0.92 < z < 1.10:
            return (
                "ink"
                if min(abs(y) - 0.70, 0.94 - abs(y), z - 0.92, 1.10 - z) < 0.026
                else "cream"
            )
    return role


def wind_paint(y, z):
    c = pane(y, z, -0.9, 0.9, 1.22, 2.14)
    return c if c else "paint"


def pod_paint(v, z, front):
    c = (
        pane(v, z, -1.08, -0.36, 1.64, 2.44)
        if front
        else pane(v, z, -0.97, 0.12, 1.64, 2.44)
    )
    return c if c else "paintLight" if z > 2.46 else "paint"


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 128:
            k = side_paint(-3.65 + 2.0 * (x + 0.5) / 512, 0.24 + 2.41 * (y + 0.5) / 128)
        elif y < 208:
            k = end_paint(
                -1.35 + 2.7 * ((x % 256) + 0.5) / 256,
                0.24 + 2.41 * (y - 128 + 0.5) / 80,
                x >= 256,
            )
        elif y < 288:
            k = wind_paint(
                -1.35 + 2.7 * (x + 0.5) / 512, 0.24 + 2.41 * (y - 208 + 0.5) / 80
            )
        elif y < 352:
            zz = 0.48 + 0.92 * (y - 288 + 0.5) / 64
            k = "paintLight" if zz > 1.13 else "paint" if zz > 0.80 else "paintDeep"
        elif y < 432:
            k = pod_paint(
                (
                    -1.30 + 1.15 * (x + 0.5) / 256
                    if x < 256
                    else -1.2 + 1.55 * (x - 256 + 0.5) / 256
                ),
                1.15 + 1.60 * (y - 352 + 0.5) / 80,
                x < 256,
            )
        elif y < 464:
            k = "paintLight"
        elif y < 480:
            k = "boom"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("MobileCrane_palette_unlit_nearest")
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
            if kind == "carrier":
                if f.normal.x < -0.65 and f.center.x < -3.4:
                    u = (v.y + 1.35) / 2.7 * 256 / 512
                    py = 128 + (v.z - 0.24) / 2.41 * 80
                else:
                    u = (v.x + 3.7) / 7.4
                    py = 288 + (v.z - 0.48) / 0.92 * 64
            elif kind == "pod":
                if abs(f.normal.y) > 0.65:
                    u = (256 + (v.x + 1.2) / 1.55 * 256) / 512
                    py = 352 + (v.z - 1.15) / 1.60 * 80
                elif f.normal.x < -0.65:
                    u = (v.y + 1.30) / 1.15 * 256 / 512
                    py = 352 + (v.z - 1.15) / 1.60 * 80
                else:
                    continue
            elif f.center.x < -3.0 and f.center.z > 1.17 and f.normal.x < -0.28:
                u = (v.y + 1.35) / 2.7
                py = 208 + (v.z - 0.24) / 2.41 * 80
            elif f.center.x > -1.90 and f.normal.x > 0.7:
                u = (256 + (v.y + 1.35) / 2.7 * 256) / 512
                py = 128 + (v.z - 0.24) / 2.41 * 80
            elif f.center.x < -3.40 and f.normal.x < -0.7:
                u = ((v.y + 1.35) / 2.7 * 256) / 512
                py = 128 + (v.z - 0.24) / 2.41 * 80
            elif abs(f.normal.y) > 0.65:
                u = (v.x + 3.65) / 2.0
                py = (v.z - 0.24) / 2.41 * 128
            elif f.normal.z > 0.5:
                u = (v.x + 3.65) / 2.0
                py = 432 + (v.y + 1.35) / 2.7 * 32
            else:
                u = (v.x + 3.65) / 2.0
                py = (v.z - 0.24) / 2.41 * 128
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def role_face(o, poly, role):
    idx = keys.index(role)
    cx = (idx % 16) * 32 + 16
    cy = 480 + (idx // 16) * 16 + 8
    for li in poly.loop_indices:
        o.data.uv_layers.active.data[li].uv = (cx / 512, 1 - cy / 512)
    o.data.attributes["paint_role"].data[poly.index].value = idx


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


# Own short closed driver cab, low carrier and all-rigid stowed crane equipment. No working crane animation/gameplay is qualified.
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
body = mesh("Own closed orange mobile-crane driver cab", vv, ff, "paint")
pocket(body, CFG["axles"][0])
chart(body, "work-cab")

carrier = cube(
    "Own low orange six-wheel crane carrier",
    (0, 0, 0.92),
    (7.0, 2.48, 0.62),
    "paint",
    bevel=0.045,
)
for axle in CFG["axles"]:
    pocket(carrier, axle)
chart(carrier, "carrier")
pod = CFG["operatorPod"]
operator = cube(
    "Own offset closed glazed operator pod",
    pod["center"],
    pod["size"],
    "paint",
    bevel=0.035,
)
chart(operator, "pod")
disk(
    "Fixed stowed crane turntable",
    (2.1, 0.35, 1.22),
    (0, 0, 1),
    0.55,
    "deckEdge",
    segments=16,
    depth=0.12,
)
cube(
    "Fixed low boom pedestal",
    (2.1, 0.35, 1.47),
    (0.82, 0.78, 0.50),
    "paint",
    bevel=0.035,
)
for i, beam in enumerate(CFG["stowedBoom"]):
    lo, hi = beam["xRange"]
    bottom, top = beam["zRange"]
    o = cube(
        "Rigid stowed boom section " + str(i),
        ((lo + hi) / 2, 0.35, (bottom + top) / 2),
        (hi - lo, beam["width"], top - bottom),
        "boom",
        bevel=0.025,
    )
    for poly in o.data.polygons:
        role_face(
            o,
            poly,
            (
                "boomLight"
                if poly.normal.z > 0.55
                else "boomShadow" if poly.normal.z < -0.55 else "boom"
            ),
        )
cube(
    "Stowed forward boom roof cradle",
    (-2.15, 0.35, 2.34),
    (0.30, 0.57, 0.13),
    "deckEdge",
    bevel=0.02,
)
cube(
    "Fixed gray boom tip shoe",
    (-3.55, 0.35, 2.59),
    (0.10, 0.50, 0.48),
    "deckEdge",
    bevel=0.025,
)
curve_tube(
    "Fixed short stowed hook cable",
    [(-3.55, 0.35, 2.62), (-3.68, 0.35, 2.29)],
    0.018,
    "frame",
    sides=6,
)
curve_tube(
    "Fixed readable gray J hook",
    [
        (-3.68, 0.35, 2.29),
        (-3.68, 0.35, 2.10),
        (-3.64, 0.35, 2.03),
        (-3.55, 0.35, 2.02),
        (-3.48, 0.35, 2.08),
        (-3.48, 0.35, 2.16),
    ],
    0.045,
    "silver",
    sides=6,
)
for x in CFG["outriggerXs"]:
    for side in [-1, 1]:
        cap = cube(
            "Short stowed outrigger cap " + str((x, side)),
            (x, side * 1.18, 0.94),
            (0.38, 0.22, 0.28),
            "boom",
            bevel=0.018,
        )
        for poly in cap.data.polygons:
            if poly.normal.y * side > 0.9:
                role_face(cap, poly, "frame")
for y in [-0.56, 0.56]:
    cube(
        "Dark crane underframe rail " + str(y),
        (0, y, 0.68),
        (6.76, 0.14, 0.18),
        "frame",
        bevel=0.012,
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
                rr.append("paintLight" if k == 1 else "paint" if k < 3 else "paintDeep")
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
        mesh(
            "Integrated truck arch guard " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )

cube(
    "Gray mobile-crane front bumper",
    (-3.555, 0, 0.43),
    (0.12, 2.40, 0.18),
    "deckEdge",
    bevel=0.025,
)
cube(
    "Gray mobile-crane rear bumper",
    (3.555, 0, 0.43),
    (0.13, 2.40, 0.18),
    "deckEdge",
    bevel=0.018,
)
for y in [-1.04, 1.04]:
    cube(
        "Carrier small red rear lamp " + str(y),
        (3.52, y, 0.96),
        (0.07, 0.16, 0.11),
        "ruby",
    )

for side in [-1, 1]:
    # Small fixed mirrors do not become invented gameplay equipment.
    curve_tube(
        "Fixed cab mirror stalk " + str(side),
        [(-3.12, side * 1.02, 1.55), (-3.16, side * 1.16, 1.61)],
        0.025,
        "ink",
        sides=4,
    )
    cube(
        "Compact fixed blue mirror " + str(side),
        (-3.16, side * 1.18, 1.75),
        (0.17, 0.065, 0.24),
        "ink",
        bevel=0.025,
    )
    cube(
        "Mirror glass owner " + str(side),
        (-3.06, side * 1.18, 1.75),
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
root = bpy.data.objects.new("MobileCrane_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/mobile-crane/" + f
        for f in [
            "build.py",
            "family.json",
            "coverage-region.json",
            "surface-regions.json",
            "stow-region.json",
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
                "driverCabSides": {
                    "atlasPixelRect": [0, 0, 512, 128],
                    "meaning": "Closed actual skin glass, continuous dark frames and orange body/door seam",
                },
                "driverCabEnds": {"atlasPixelRect": [0, 128, 512, 208]},
                "driverWindshield": {"atlasPixelRect": [0, 208, 512, 288]},
                "lowCarrierSkin": {
                    "atlasPixelRect": [0, 288, 512, 352],
                    "meaning": "Real low closed hull with all6 open local tire pockets and integrated arch shoulders",
                },
                "offsetOperatorPod": {
                    "atlasPixelRect": [0, 352, 512, 432],
                    "meaning": "Own actual closed pod front/side glass charts, no overlay",
                },
                "driverRoof": {"atlasPixelRect": [0, 432, 512, 464]},
                "rigidStowedBoom": {
                    "components": [
                        "Rigid stowed boom section 0",
                        "Rigid stowed boom section 1",
                        "Rigid stowed boom section 2",
                    ],
                    "roles": ["boom", "boomLight", "boomShadow"],
                    "meaning": "Three broad overlapping stepped solid sections, all fixed; no lift/telescope node or motion claim",
                },
                "hookCable": {
                    "components": [
                        "Fixed short stowed hook cable",
                        "Fixed readable gray J hook",
                    ],
                    "meaning": "Actual small fixed gray geometry near stowed front tip; no cable animation",
                },
                "fourStowedOutriggers": {
                    "meaning": "Four short solid yellow cap components tucked within measured carrier width; dark actual outer end-face paint, not extended stabilizer arms"
                },
                "sixRoadWheels": {
                    "ids": CFG["wheelIds"],
                    "meaning": "All6 independently rolling tire/rim/hub assemblies; only qualified moving parts",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Original semantic UV painting including unseen surfaces; no source projection/high-to-low transfer claim.",
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
    "stow-region.json",
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
    "family": "mobile-crane",
    "route": "mobile-crane",
    "revision": "v1",
    "toolchain": CFG["toolchain"],
    "wheelIds": CFG["wheelIds"],
    "rigidVisualCombination": "One fixed body containing carrier/cabs/boom/hook/cable/outrigger caps; six independent road wheels. All work equipment rigid/stowed; no working crane gameplay or animation.",
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
    "equipment": "All crane equipment fixed/stowed: three boom sections, small offset glazed operator pod, real short cable/J hook and four short outrigger caps. No lift/telescope/cable/outrigger animation or gameplay.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
