"""Original classic regular-cab pickup; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/pickup/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/pickup/v1"
)
O = ROOT / (
    "data/vehicle-bake/pickup/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/pickup/v1"
)
D = ROOT / "data/vehicle-bake/pickup"
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


def cab_side(x, z):
    role = (
        "paintLight"
        if z > 1.86
        else "paint" if z > 1.0 else "paintMid" if z > 0.60 else "paintShadow"
    )
    # Single door window, generous and fully bounded on both actual cab sides.
    k = framed(x, z, -1.08, 0.16, 1.20, 1.88)
    if k:
        return k
    # Quiet door seam/handle paint; no small projecting geometry.
    if (-1.12 < x < 0.20 and abs(z - 0.62) < 0.017) or (
        0.55 < z < 1.18 and abs(x - 0.20) < 0.018
    ):
        return "paintDeep"
    if -0.10 < x < 0.06 and 1.04 < z < 1.08:
        return "silver"
    return role


def cab_end(y, z, rear):
    role = "paintLight" if z > 1.87 else "paint" if z > 1.02 else "paintMid"
    k = framed(y, z, -0.77, 0.77, 1.26 if rear else 1.24, 1.85)
    return k or role


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 192:
            xx = -1.40 + 1.85 * (x + 0.5) / 512
            zz = 0.35 + 1.75 * (y + 0.5) / 192
            k = cab_side(xx, zz)
        elif y < 352:
            yy = -1.1 + 2.2 * ((x % 256) + 0.5) / 256
            zz = 0.35 + 1.75 * (y - 192 + 0.5) / 160
            k = cab_end(yy, zz, x >= 256)
        elif y < 400:
            yy = -1.1 + 2.2 * (y - 352 + 0.5) / 48
            k = "paintLight" if abs(yy) < 0.67 else "paint"
        elif y < 448:
            xx = -2.65 + 1.65 * (x + 0.5) / 512
            yy = -1.1 + 2.2 * (y - 400 + 0.5) / 48
            k = "paintLight" if abs(yy) < 0.58 else "paint"
            if abs(yy) < 0.021:
                k = "paintMid"
            if abs(xx + 2.45) < 0.016:
                k = "paintDeep"
        elif y < 480:
            yy = -1.1 + 2.2 * (x + 0.5) / 512
            xx = 0.40 + 2.15 * (y - 448 + 0.5) / 32
            k = "bedFloor"
            if any(abs(yy - q) < 0.019 for q in [-0.60, -0.30, 0, 0.30, 0.60]):
                k = "bedRib"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)
shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Pickup_palette_unlit_nearest")
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
            if kind == "cab":
                if abs(f.normal.x) > 0.65:
                    u = ((v.y + 1.1) / 2.2 * 256 + (256 if f.center.x > 0 else 0)) / 512
                    py = 192 + (v.z - 0.35) / 1.75 * 160
                elif f.normal.z > 0.65 and f.center.z > 1.8:
                    u = (v.x + 1.4) / 1.85
                    py = 352 + (v.y + 1.1) / 2.2 * 48
                else:
                    u = (v.x + 1.4) / 1.85
                    py = (v.z - 0.35) / 1.75 * 192
            elif kind == "hood":
                u = (v.x + 2.65) / 1.65
                py = 400 + (v.y + 1.1) / 2.2 * 48
            elif kind == "floor":
                u = (v.y + 1.1) / 2.2
                py = 448 + (v.x - 0.40) / 2.15 * 32
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=1.1,
            location=(axle, side * 1.25, CFG["wheelRadius"]),
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


# A regular cab with a short crown, sloping front windshield and near-vertical rear.
# Distinct from the hood and cargo box, with an actual gap behind the cab.
sec = [
    [-0.91, 0.40],
    [-0.99, 0.70],
    [-0.99, 1.16],
    [-0.96, 1.75],
    [-0.89, 1.91],
    [-0.73, 1.99],
    [0, 2.02],
    [0.73, 1.99],
    [0.89, 1.91],
    [0.96, 1.75],
    [0.99, 1.16],
    [0.99, 0.70],
    [0.91, 0.40],
]
stations = CFG["cabStations"]
vv = []
for x, width, frontSlope in stations:
    for y, z in sec:
        vv.append((x + frontSlope * max(0, min(1, (z - 1.16) / 0.86)), y * width, z))
ns = len(sec)
ff = []
for i in range(len(stations) - 1):
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
        tuple((len(stations) - 1) * ns + j for j in range(ns)),
    ]
)
cab = mesh("Regular cab actual skin with bounded windows", vv, ff, "paint")
pocket(cab, CFG["axles"][0])
chart(cab, "cab")

# Gently rounded rectangular hood, broad flat crown and short front face.
sec = [
    [-0.78, 0.63],
    [-0.88, 0.86],
    [-0.88, 1.11],
    [-0.78, 1.23],
    [-0.55, 1.28],
    [0, 1.30],
    [0.55, 1.28],
    [0.78, 1.23],
    [0.88, 1.11],
    [0.88, 0.86],
    [0.78, 0.63],
]
vv = []
ns = len(sec)
for x, w, h in CFG["hoodStations"]:
    for y, z in sec:
        vv.append((x, y * w, 0.63 + (z - 0.63) * h))
ff = []
for i in range(len(CFG["hoodStations"]) - 1):
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
        tuple((len(CFG["hoodStations"]) - 1) * ns + j for j in range(ns)),
    ]
)
hood = mesh("Rounded rectangular separate engine hood", vv, ff, "paint")
pocket(hood, CFG["axles"][0])
chart(hood, "hood")

# Recessed cargo bed is an open tub, not a glass/deck patch. All walls have thickness.
floor = cube(
    "Recessed cargo floor with longitudinal painted ribs",
    (1.49, 0, 0.665),
    (2.10, 1.96, 0.09),
    "bedFloor",
)
pocket(floor, CFG["axles"][1])
chart(floor, "floor")
for side in [-1, 1]:
    wall = cube(
        "Cargo outer side wall " + str(side),
        (1.49, side * 0.95, 0.94),
        (2.10, 0.18, 0.57),
        "paint",
        bevel=0.045,
    )
    pocket(wall, CFG["axles"][1])
    # Face-owned interior shadow and exterior low band; independent of screen view.
    for f in wall.data.polygons:
        role = (
            "bedWall"
            if f.normal.y * side < -0.5
            else (
                "paintLight"
                if f.normal.z > 0.5
                else "paint" if f.center.z > 1.02 else "paintMid"
            )
        )
        idx = keys.index(role)
        cx = (idx % 16) * 32 + 16
        cy = 480 + (idx // 16) * 16 + 8
        for li in f.loop_indices:
            wall.data.uv_layers.active.data[li].uv = (cx / 512, 1 - cy / 512)
    # Thick rolled rim highlights stop at the tailgate, leaving the center fully open.
    cube(
        "Rolled cargo rail " + str(side),
        (1.49, side * 0.95, 1.235),
        (2.14, 0.20, 0.085),
        "paintLight",
        bevel=0.035,
    )
    # Wall below wheel arch is removed, not hidden behind painted rubber.
for x, label in [(0.48, "Cargo front bulkhead"), (2.50, "Closed upright tailgate")]:
    wall = cube(label, (x, 0, 0.94), (0.12, 1.90, 0.58), "paintMid", bevel=0.035)
    for f in wall.data.polygons:
        inward = f.normal.x > 0 if x < 1 else f.normal.x < 0
        role = "bedWall" if inward else "paintLight" if f.normal.z > 0.5 else "paint"
        idx = keys.index(role)
        for li in f.loop_indices:
            wall.data.uv_layers.active.data[li].uv = (
                ((idx % 16) * 32 + 16) / 512,
                1 - (480 + (idx // 16) * 16 + 8) / 512,
            )
    cube(label + " dark upper seam", (x, 0, 1.24), (0.13, 1.75, 0.045), "paintDeep")
# Narrow central chassis never bridges the four wheel pockets.
cube("Narrow structural chassis", (0.03, 0, 0.37), (4.7, 1.30, 0.15), "paintDeep")

# Thick continuous shoulders rise above every tire and are seated in coachwork.
# Rear inner surfaces are the visible cargo wheel housings above the recessed floor.
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
                    "bedWall"
                    if axle > 0 and k < 2
                    else "paintLight" if k == 1 else "paint" if k < 3 else "paintMid"
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
            rr.append("paintDeep")
        # Inner cargo wheelhouse cheek closes the visible cavity into a true raised tub.
        if axle > 0:
            ff.append(tuple(range(n + 1)))
            rr.append("bedWall")
        mesh("Integrated broad open fender " + str(axle) + " " + str(side), vv, ff, rr)
for side in [-1, 1]:
    cube(
        "Cab sill between arches " + str(side),
        (-0.30, side * 0.95, 0.43),
        (1.24, 0.18, 0.14),
        "paintShadow",
        bevel=0.025,
    )
# Short bumpers; grille and broad lamps preserve classic pickup recognition.
for x in [-2.61, 2.64]:
    cube(
        "Short metal bumper " + str(x),
        (x, 0, 0.43),
        (0.15, 2.02, 0.15),
        "silver",
        bevel=0.035,
    )
cube("Front dark grille", (-2.543, 0, 0.87), (0.04, 1.31, 0.43), "ink")
for z in [0.75, 0.88, 1.01]:
    cube("Broad grille bar " + str(z), (-2.570, 0, z), (0.03, 1.16, 0.035), "rim")
cube("Tailgate lower seam", (2.567, 0, 0.78), (0.014, 1.64, 0.025), "paintDeep")


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


for side in [-1, 1]:
    disk(
        "Round chrome headlamp " + str(side),
        (-2.545, side * 0.78, 1.04),
        (-1, 0, 0),
        0.158,
        "silver",
        segments=12,
        depth=0.020,
    )
    disk(
        "Round ivory headlamp " + str(side),
        (-2.568, side * 0.78, 1.04),
        (-1, 0, 0),
        0.119,
        "cream",
        segments=12,
        depth=0.012,
    )
    cube(
        "Front amber corner lamp " + str(side),
        (-2.565, side * 0.79, 0.78),
        (0.027, 0.18, 0.075),
        "amber",
    )
    cube(
        "Rear vertical ruby lamp " + str(side),
        (2.574, side * 0.81, 0.96),
        (0.025, 0.13, 0.25),
        "ruby",
    )
    cube(
        "Rear lamp glint " + str(side),
        (2.588, side * 0.81, 1.02),
        (0.015, 0.075, 0.045),
        "rubyLight",
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
            (-width / 2, 0.37),
            (-width * 0.36, r),
            (width * 0.36, r),
            (width / 2, 0.37),
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
                0.295,
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
                0.082,
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
root = bpy.data.objects.new("Pickup_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/pickup/" + f
        for f in ["build.py", "family.json", "coverage-region.json", "review.json"]
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
            "ownership": "Own cab side/front/rear/roof charts on actual skin, rounded hood chart, recessed cargo floor, shadowed interior walls, tailgate and wheelhouses. Named source components retain base FACE paint_role attributes; their continuous UV charts own window/paint details. Trim islands share padded constant-role swatches; wheel-only meshes never sample coachwork.",
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Symmetric regular cab; front hood and rear open bed have distinct semantic ownership.",
            "limitations": [
                "Economical runtime-topology component master.",
                "Neutral steering only; no suspension or animated equipment qualification.",
            ],
        },
        indent=2,
    )
    + "\n"
)
for file in ["build.py", "family.json", "coverage-region.json", "review.json"]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
report = {
    "status": "draft",
    "artReviewStatus": "awaiting-owner-review",
    "family": "pickup",
    "route": "pickup",
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
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
