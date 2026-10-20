"""Original recessed-side ice cream shop van; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/ice-cream-van/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/ice-cream-van/v1"
)
O = ROOT / (
    "data/vehicle-bake/ice-cream-van/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/ice-cream-van/v1"
)
D = ROOT / "data/vehicle-bake/ice-cream-van"
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


def side_paint(x, z, serving):
    role = (
        "paintLight"
        if z > 2.16
        else "paint" if z > 0.94 else "violetLight" if z > 0.86 else "paintShadow"
    )
    inside, distance = polygon_inside(
        x, z, [(-1.94, 1.31), (-0.61, 1.31), (-0.61, 2.10), (-1.43, 2.10)]
    )
    if inside:
        if distance < 0.062:
            return "ink"
        return (
            "glassGlint" if 1.81 < z < 1.88 else "glassLight" if z > 1.65 else "glass"
        )
    if (abs(x + 0.54) < 0.018 and 0.46 < z < 2.10) or (
        -1.90 < x < -0.54 and abs(z - 0.47) < 0.018
    ):
        return "paintDeep"
    if -0.79 < x < -0.63 and 1.14 < z < 1.19:
        return "ink"
    if serving:
        x0, x1 = CFG["servingRecess"]["xRange"]
        z0, z1 = CFG["servingRecess"]["zRange"]
        if x0 - 0.065 < x < x1 + 0.065 and z0 - 0.065 < z < z1 + 0.065:
            if min(abs(x - x0), abs(x - x1), abs(z - z0), abs(z - z1)) < 0.055:
                return "ink"
    else:
        # One large cone emblem belongs to this actual opposite-side skin chart.
        cx = 0.73
        cz = 1.78
        rad = 0.34
        distance = math.hypot(x - cx, z - cz)
        if distance < rad:
            if distance > rad - 0.045:
                return "ink"
            return "violetLight" if z > 1.83 else "violet"
        if 0.76 < z < 1.49:
            half = 0.31 * (z - 0.76) / 0.73
            if abs(x - cx) < half:
                if abs(x - cx) > half - 0.045 or z < 0.83:
                    return "ink"
                return (
                    "coneLight" if abs((x - cx) * 0.65 + z - 1.15) < 0.035 else "cone"
                )
    return role


def end_paint(y, z, rear):
    role = (
        "paintLight"
        if z > 2.02
        else (
            "paint"
            if z > 1.02
            else "violetLight" if z > 0.91 else "violet" if z > 0.58 else "paintShadow"
        )
    )
    if rear:
        # Two closed, unglazed cargo doors. Seam, hinges/handles and lamps are paint.
        if abs(y) < 0.018 and 0.43 < z < 2.02:
            return "ink"
        if abs(abs(y) - 0.78) < 0.016 and 0.45 < z < 2.01:
            return "paintDeep"
        if 0.04 < abs(y) < 0.16 and 1.12 < z < 1.18:
            return "ink"
        if 0.78 < abs(y) < 0.92 and 0.62 < z < 1.04:
            return "rubyLight" if z > 0.91 else "ruby"
    else:
        if abs(y) < 0.57 and 0.55 < z < 0.82:
            if abs(z - 0.61) < 0.012 or abs(z - 0.75) < 0.012:
                return "rim"
            return "ink"
        if 0.62 < abs(y) < 0.84 and 0.84 < z < 1.02:
            return (
                "ink"
                if min(abs(y) - 0.62, 0.84 - abs(y), z - 0.84, 1.02 - z) < 0.025
                else "cream"
            )
    return role


def wind_paint(y, z):
    if -0.87 < y < 0.87 and 1.31 < z < 2.12:
        if min(y + 0.87, 0.87 - y) < 0.065 or min(z - 1.31, 2.12 - z) < 0.064:
            return "ink"
        return (
            "glassGlint" if 1.77 < z < 1.85 else "glassLight" if z > 1.61 else "glass"
        )
    return "paintLight" if z > 2.02 else "paint"


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 256:
            k = side_paint(
                -2.6 + 5.2 * (x + 0.5) / 512,
                0.22 + 2.35 * ((y % 128) + 0.5) / 128,
                y < 128,
            )
        elif y < 320:
            k = end_paint(
                -1.15 + 2.3 * ((x % 256) + 0.5) / 256,
                0.22 + 2.35 * (y - 256 + 0.5) / 64,
                x >= 256,
            )
        elif y < 384:
            k = wind_paint(
                -1.15 + 2.3 * (x + 0.5) / 512, 0.22 + 2.35 * (y - 320 + 0.5) / 64
            )
        elif y < 464:
            k = "paintLight"
        elif y < 480:
            k = "paint"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("IceCreamVan_palette_unlit_nearest")
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
            if f.center.x > 2.29 and f.normal.x > 0.7:
                u = (256 + (v.y + 1.15) / 2.3 * 256) / 512
                py = 256 + (v.z - 0.22) / 2.35 * 64
            elif f.center.x < -2.29 and f.normal.x < -0.7:
                u = (v.y + 1.15) / 2.3 / 2
                py = 256 + (v.z - 0.22) / 2.35 * 64
            elif abs(f.normal.y) > 0.65:
                u = (v.x + 2.6) / 5.2
                py = (0 if f.center.y < 0 else 128) + (v.z - 0.22) / 2.35 * 128
            elif f.center.x < -1.4 and f.center.z > 1.24 and f.normal.x < -0.35:
                u = (v.y + 1.15) / 2.3
                py = 320 + (v.z - 0.22) / 2.35 * 64
            elif f.normal.z > 0.55 and f.center.z > 2.12:
                u = (v.x + 2.6) / 5.2
                py = 384 + (v.y + 1.15) / 2.3 * 48
            elif f.normal.z > 0.5 and f.center.x < -1.7:
                u = (v.x + 2.6) / 5.2
                py = 432 + (v.y + 1.15) / 2.3 * 32
            else:
                u = (v.x + 2.6) / 5.2
                py = (0 if f.center.y < 0 else 128) + (v.z - 0.22) / 2.35 * 128
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=1.0,
            location=(axle, side * 1.14, CFG["wheelRadius"]),
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


# Van-owned longitudinal loft: short sloping nose and high rounded cargo body.
# The roof is one continuous gently crowned coach surface, not an SUV scale-up.
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
body = mesh("Own ice cream shop body with actual serving aperture", vv, ff, "paint")
for axle in CFG["axles"]:
    pocket(body, axle)
# Carve a finite physical recess into only the serving side; the opposite side
# stays intact and owns its cone paint. No glass/sticker spans this opening.
recess = CFG["servingRecess"]
x0, x1 = recess["xRange"]
z0, z1 = recess["zRange"]
back = recess["backY"]
bpy.ops.mesh.primitive_cube_add(
    size=1, location=((x0 + x1) / 2, (-1.7 + back) / 2, (z0 + z1) / 2)
)
cutter = bpy.context.object
cutter.scale = (x1 - x0, back + 1.7, z1 - z0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.objects.active = body
mod = body.modifiers.new("Actual recessed side serving opening", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.solver = "EXACT"
mod.object = cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter, do_unlink=True)
body.data.update()
# Preserve exact Boolean boundary geometry while giving every interior panel
# its own editable component and paint owner. These replace, not overlay, faces.
interiors = {}
for poly in body.data.polygons:
    c = poly.center
    if (
        x0 - 1e-5 <= c.x <= x1 + 1e-5
        and z0 - 1e-5 <= c.z <= z1 + 1e-5
        and -1.2 < c.y < back + 1e-5
    ):
        label = (
            ("backwall", "interiorBack")
            if abs(c.y - back) < 1e-5
            else (
                ("counter-floor", "counter")
                if abs(c.z - z0) < 1e-5
                else (
                    ("ceiling", "paintDeep")
                    if abs(c.z - z1) < 1e-5
                    else (
                        ("front-jamb", "cream")
                        if abs(c.x - x0) < 1e-5
                        else ("rear-jamb", "cream") if abs(c.x - x1) < 1e-5 else None
                    )
                )
            )
        )
        if label:
            interiors.setdefault(label, []).append(poly.index)
removed = []
for (label, role), indices in interiors.items():
    verts = []
    faces = []
    for index in indices:
        poly = body.data.polygons[index]
        start = len(verts)
        verts.extend(tuple(body.data.vertices[v].co) for v in poly.vertices)
        faces.append(tuple(range(start, len(verts))))
    mesh("Serving recess " + label + " independent owner", verts, faces, role)
    removed.extend(indices)
assert len(interiors) == 5, interiors
bm = bmesh.new()
bm.from_mesh(body.data)
bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.faces[i] for i in removed], context="FACES_ONLY")
bm.to_mesh(body.data)
bm.free()
body.data.update()
chart(body, "shop-van")
cube(
    "Serving projecting counter ledge",
    ((x0 + x1) / 2, -1.1025, 1.145),
    (x1 - x0 + 0.10, 0.235, 0.086),
    "counter",
    bevel=0.015,
)
# Fixed shallow pink/cream striped awning. Every stripe is real opaque geometry.
aw = recess["awning"]
aw0, aw1 = aw["xRange"]
yi, yo = aw["innerY"], aw["outerY"]
zi, zo = aw["innerZ"], aw["outerZ"]
for i in range(aw["stripes"]):
    a = aw0 + (aw1 - aw0) * i / aw["stripes"]
    b = aw0 + (aw1 - aw0) * (i + 1) / aw["stripes"]
    vv = [
        (a, yi, zi),
        (b, yi, zi),
        (b, yo, zo),
        (a, yo, zo),
        (a, yi, zi - 0.05),
        (b, yi, zi - 0.05),
        (b, yo, zo - 0.05),
        (a, yo, zo - 0.05),
    ]
    ff = [
        (0, 1, 2, 3),
        (7, 6, 5, 4),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh("Fixed awning stripe " + str(i), vv, ff, "violet" if i % 2 else "paintLight")
    cube(
        "Fixed striped awning short valance " + str(i),
        ((a + b) / 2, yo - 0.005, zo - 0.035),
        (b - a, 0.045, 0.065),
        "violet" if i % 2 else "paintLight",
    )
for x in [aw0 + 0.045, aw1 - 0.045]:
    curve_tube(
        "Awning fixed corner bracket " + str(x),
        [(x, -1.015, 1.98), (x, yo + 0.02, zo - 0.03)],
        0.022,
        "ink",
        sides=4,
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
                    "violetLight" if k == 1 else "violet" if k < 3 else "violetShadow"
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
            rr.append("violetShadow")
        mesh(
            "Integrated broad ice cream van open wheel arch "
            + str(axle)
            + " "
            + str(side),
            vv,
            ff,
            rr,
        )

for x in [-2.40, 2.40]:
    cube(
        "Simple dark bumper " + str(x),
        (x, 0, 0.405),
        (0.11, 1.87, 0.16),
        "ink",
        bevel=0.03,
    )
    cube(
        "Bumper upper silver edge " + str(x),
        (x, 0, 0.495),
        (0.115, 1.66, 0.035),
        "silver",
    )
for side in [-1, 1]:
    # Small fixed mirrors do not become invented gameplay equipment.
    curve_tube(
        "Fixed cab mirror stalk " + str(side),
        [(-1.60, side * 0.95, 1.36), (-1.65, side * 1.02, 1.40)],
        0.025,
        "ink",
        sides=4,
    )
    cube(
        "Compact fixed blue mirror " + str(side),
        (-1.64, side * 1.02, 1.49),
        (0.17, 0.065, 0.24),
        "ink",
        bevel=0.025,
    )
    cube(
        "Mirror glass owner " + str(side),
        (-1.54, side * 1.02, 1.49),
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
                0.27,
                "rim",
                segments=12,
                depth=0.012,
                group=group,
            )
            disk(
                "Chrome hub " + wid + str(s),
                (0, s * (width / 2 + 0.017), 0),
                (0, s, 0),
                0.18,
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
root = bpy.data.objects.new("IceCreamVan_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/ice-cream-van/" + f
        for f in [
            "build.py",
            "family.json",
            "coverage-region.json",
            "surface-regions.json",
            "serving-region.json",
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
                "servingSideSkin": {
                    "atlasPixelRect": [0, 0, 512, 128],
                    "meaning": "Actual -Y aqua side skin, bounded cab glass and dark perimeter surrounding a true empty serving aperture",
                },
                "oppositeConeSide": {
                    "atlasPixelRect": [0, 128, 512, 256],
                    "meaning": "Actual +Y skin with large simple pink scoop and warm cone emblem; no overlay",
                },
                "endCaps": {"atlasPixelRect": [0, 256, 512, 320]},
                "windshield": {"atlasPixelRect": [0, 320, 512, 384]},
                "creamRoof": {"atlasPixelRect": [0, 384, 512, 432]},
                "creamNose": {"atlasPixelRect": [0, 432, 512, 464]},
                "recessInterior": {
                    "components": [
                        "Serving recess backwall independent owner",
                        "Serving recess counter-floor independent owner",
                        "Serving recess ceiling independent owner",
                        "Serving recess front-jamb independent owner",
                        "Serving recess rear-jamb independent owner",
                    ],
                    "roles": ["interiorBack", "counter", "paintDeep", "cream"],
                    "meaning": "Real finite-depth cut surfaces with exclusive padded colour ownership; no coincident painted opening",
                },
                "awning": {
                    "meaning": "Eight alternating opaque cream/pink geometry strips, short valance and fixed corner brackets"
                },
                "wheels": {
                    "meaning": "Four independent tire/rim/hub surfaces use padded palette islands; no fender paint on wheels"
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Original authored semantic UVs including unseen surfaces; no source projection or high-to-low transfer claim.",
            "outerInk": "Shared engine exterior pass RGB58,58,80; no geometry outline shell.",
            "asymmetry": "Physical serving recess/awning -Y; large cone on intact +Y body skin.",
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
    "serving-region.json",
    "review.json",
]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
report = {
    "status": "draft",
    "artReviewStatus": "agent-QA-in-progress; run153 appearance wait waived",
    "family": "ice-cream-van",
    "route": "ice-cream-van",
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
    "equipment": "Static shop van with physical serving recess, counter/backwall, fixed striped awning and opposite cone; no equipment animation.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
