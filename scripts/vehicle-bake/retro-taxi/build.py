"""Original rounded yellow four-door retro taxi; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/retro-taxi/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/retro-taxi/v1"
)
O = ROOT / (
    "data/vehicle-bake/retro-taxi/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/retro-taxi/v1"
)
D = ROOT / "data/vehicle-bake/retro-taxi"
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


def pane(x, z, poly):
    crosses = []
    distances = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        dx = b[0] - a[0]
        dz = b[1] - a[1]
        c = dx * (z - a[1]) - dz * (x - a[0])
        crosses.append(c)
        distances.append(abs(c) / math.hypot(dx, dz))
    if all(c >= 0 for c in crosses) or all(c <= 0 for c in crosses):
        if min(distances) < 0.05:
            return "ink"
        return (
            "glassGlint" if 1.27 < z < 1.32 else "glassLight" if z > 1.21 else "glass"
        )
    return None


def side_paint(x, z):
    for poly in CFG["sidePanes"]:
        p = pane(x, z, poly)
        if p:
            return p
    if 0.43 < z < 1.04 and any(abs(x - q) < 0.016 for q in [-1.0, 0.025, 1.04]):
        return "ink"
    if -1.0 < x < 1.04 and abs(z - 0.43) < 0.015:
        return "paintDeep"
    if any(abs(x - q) < 0.075 for q in [-0.19, 0.87]) and 0.995 < z < 1.03:
        return "rim"
    c = CFG["checkerBelt"]
    x0, x1 = c["longitudinalRange"]
    z0, z1 = c["verticalRange"]
    if x0 < x < x1 and z0 < z < z1:
        parity = (
            math.floor((x - x0) / c["cellSize"]) + math.floor((z - z0) / c["cellSize"])
        ) % 2
        return c["roles"][parity]
    return (
        "paintLight"
        if z > 1.37
        else "paint" if z > 0.71 else "paintMid" if z > 0.43 else "paintShadow"
    )


def end_paint(y, z, rear):
    if rear:
        if 0.58 < abs(y) < 0.80 and 0.64 < z < 0.84:
            return "rubyLight" if z > 0.77 else "ruby"
    else:
        if abs(y) < 0.37 and 0.62 < z < 0.84:
            return "ink" if abs(z - 0.70) > 0.02 else "rim"
    return "paintLight" if z > 0.87 else "paint" if z > 0.58 else "paintMid"


def wind_paint(y, z, rear):
    lo, hi = (1.065, 1.43)
    if abs(y) < 0.73 and lo < z < hi:
        if min(0.73 - abs(y), z - lo, hi - z) < 0.05:
            return "ink"
        return (
            "glassGlint" if 1.30 < z < 1.35 else "glassLight" if z > 1.23 else "glass"
        )
    return "roof" if z > 1.43 else "paintLight"


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 192:
            k = side_paint(-2.5 + 5.0 * (x + 0.5) / 512, 0.22 + 1.48 * (y + 0.5) / 192)
        elif y < 272:
            k = end_paint(
                -1.10 + 2.2 * ((x % 256) + 0.5) / 256,
                0.22 + 1.48 * (y - 192 + 0.5) / 80,
                x >= 256,
            )
        elif y < 384:
            k = wind_paint(
                -1.10 + 2.2 * ((x % 256) + 0.5) / 256,
                0.22 + 1.48 * (y - 272 + 0.5) / 112,
                x >= 256,
            )
        elif y < 448:
            yy = -1.10 + 2.20 * (y - 384 + 0.5) / 64
            k = "roof" if abs(yy) < 0.62 else "paintLight"
        elif y < 464:
            k = "paintLight"
        elif y < 480:
            u = (x + 0.5) / 512
            v = (y - 464 + 0.5) / 16
            k = "checkerBlack" if 0.10 < u < 0.90 and 0.18 < v < 0.82 else "cream"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("RetroTaxi_palette_unlit_nearest")
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


def cube(name, loc, scale, role="silver", group="body", bevel=0, bevel_segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Restrained rounded trim", "BEVEL")
        mod.width = bevel
        mod.segments = bevel_segments
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


def chart(o, kind="sedan"):
    uv = o.data.uv_layers.active.data
    for f in o.data.polygons:
        for li in f.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index].co
            if kind == "sign":
                if abs(f.normal.x) < 0.7:
                    continue
                u = (v.y + 0.34) / 0.68
                py = 464 + (v.z - 1.50) / 0.15 * 16
            elif abs(f.center.x) > 2.20 and abs(f.normal.x) > 0.7:
                u = ((v.y + 1.1) / 2.2 * 256 + (256 if f.center.x > 0 else 0)) / 512
                py = 192 + (v.z - 0.22) / 1.48 * 80
            elif abs(f.normal.y) > 0.65:
                u = (v.x + 2.5) / 5.0
                py = (v.z - 0.22) / 1.48 * 192
            elif (
                -1.08 < f.center.x < -0.50 and f.center.z > 1.04 and f.normal.x < -0.35
            ):
                u = ((v.y + 1.10) / 2.2 * 256) / 512
                py = 272 + (v.z - 0.22) / 1.48 * 112
            elif 0.65 < f.center.x < 1.14 and f.center.z > 1.04 and f.normal.x > 0.35:
                u = (256 + (v.y + 1.10) / 2.2 * 256) / 512
                py = 272 + (v.z - 0.22) / 1.48 * 112
            elif f.normal.z > 0.50 and f.center.z > 1.45:
                u = (v.x + 2.5) / 5.0
                py = 384 + (v.y + 1.10) / 2.2 * 64
            elif f.normal.z > 0.4:
                u = (v.x + 2.5) / 5.0
                py = 448 + (v.y + 1.10) / 2.2 * 16
            else:
                u = (v.x + 2.5) / 5.0
                py = (v.z - 0.22) / 1.48 * 192
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24,
            radius=CFG["arch"]["cutRadius"],
            depth=0.96,
            location=(axle, side * 1.08, CFG["wheelRadius"]),
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


# Own rounded compact four-door sedan contour: substantial hood/trunk and domed cabin.
# Every contour is strictly ordered. No duplicate cabin-side or loft overlay faces.
vv = []
ff = []
ns = len(CFG["section"])
for x, w, h in CFG["sedanStations"]:
    base = min(1.015, h - 0.075)
    lowScale = min(1, (base - 0.025 - 0.24) / (0.96 - 0.24))
    for y, z in CFG["section"]:
        if isinstance(z, str):
            zz = (
                h
                if z == "top"
                else (
                    base
                    if z == "glassBase"
                    else base + (h - base) * CFG["roofLevels"][z]
                )
            )
        else:
            zz = 0.24 + (z - 0.24) * lowScale
        vv.append((x, y * w, zz))
for i in range(len(CFG["sedanStations"]) - 1):
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
        tuple((len(CFG["sedanStations"]) - 1) * ns + j for j in range(ns)),
    ]
)
body = mesh(
    "Own rounded yellow taxi substantial hood domed cabin trunk skin", vv, ff, "paint"
)
for axle in CFG["axles"]:
    pocket(body, axle)
chart(body, "sedan")

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
                    "paintLight" if k == 1 else "paint" if k < 3 else "paintShadow"
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
        mesh(
            "Integrated rounded taxi fender " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )

# The small sign is an actual fixed box. Front/back inset is UV paint on its faces.
sign = CFG["roofSign"]
roof_sign = cube(
    "Fixed taxi roof sign actual UV inset owner",
    sign["center"],
    sign["dimensions"],
    "cream",
    bevel=0.020,
)
chart(roof_sign, "sign")
cube(
    "Fixed taxi roof sign low support",
    (-0.02, 0, 1.515),
    (0.28, 0.42, 0.045),
    "ink",
    bevel=0.012,
)
for x in [-2.30, 2.30]:
    cube(
        "Rounded gray taxi bumper " + str(x),
        (x, 0, 0.405),
        (0.10, 1.64, 0.12),
        "rim",
        bevel=0.025,
    )
    cube(
        "Broad silver bumper edge " + str(x),
        (x, 0, 0.47),
        (0.105, 1.45, 0.025),
        "silver",
    )
for side in [-1, 1]:
    disk(
        "Simple round gray headlamp rim " + str(side),
        (-2.18, side * 0.58, 0.83),
        (-1, 0, 0),
        0.14,
        "ink",
        segments=12,
        depth=0.020,
    )
    disk(
        "Simple round gray headlamp " + str(side),
        (-2.203, side * 0.58, 0.83),
        (-1, 0, 0),
        0.105,
        "silver",
        segments=12,
        depth=0.012,
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
root = bpy.data.objects.new("RetroTaxi_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/retro-taxi/" + f
        for f in [
            "build.py",
            "family.json",
            "coverage-region.json",
            "surface-regions.json",
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
            "ownership": "Original rounded low four-door sedan skin with continuous side pane/door/checker charts, swept front/rear blue glazing, domed roof and substantial hood/trunk. Checker belt is actual side-panel UV paint with two rows of broad black/cream squares, no overlay planes. Fixed small roof sign has dark inset painted on its actual front/back faces. All other trim and wheels own named padded semantic palette islands.",
            "semanticOwners": {
                "sedanSides": {
                    "component": "Own rounded yellow taxi substantial hood domed cabin trunk skin",
                    "atlasPixelRect": [0, 0, 512, 192],
                    "meaning": "Two framed blue door panes per side, four total door seams/handles and two-row checker belt on actual body skin",
                },
                "endCaps": {
                    "atlasPixelRect": [0, 192, 512, 272],
                    "meaning": "Simple front grille and rear red tail paint",
                },
                "frontRearGlass": {
                    "atlasPixelRect": [0, 272, 512, 384],
                    "meaning": "Front half swept windshield, rear half swept rear window; continuous dark frames on actual surface triangles",
                },
                "domedRoof": {
                    "atlasPixelRect": [0, 384, 512, 448],
                    "meaning": "Broad warm yellow domed roof skin beneath fixed sign",
                },
                "hoodTrunk": {
                    "atlasPixelRect": [0, 448, 512, 464],
                    "meaning": "Substantial rounded yellow hood/trunk paint",
                },
                "roofSign": {
                    "component": "Fixed taxi roof sign actual UV inset owner",
                    "atlasPixelRect": [0, 464, 512, 480],
                    "roles": ["cream", "checkerBlack"],
                    "meaning": "Small actual static solid, front/back UV-owned blank dark inset and cream border; no text or logo",
                },
                "trim": {
                    "roles": [
                        "ink",
                        "rim",
                        "silver",
                        "paint",
                        "paintLight",
                        "paintDeep",
                    ],
                    "meaning": "Named static bumpers/headlamps, low sign support and broad integrated rounded fender shoulders",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Symmetric low four-door sedan, broad side checker belt, swept front/rear glass and substantial hood/trunk. Small fixed blank roof sign; no open-interior claim.",
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
    "surface-regions.json",
    "review.json",
]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
report = {
    "status": "draft",
    "artReviewStatus": "agent-QA-in-progress; run153 appearance wait waived",
    "family": "retro-taxi",
    "route": "retro-taxi",
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
    "equipment": "Static four-door taxi, fixed blank roof sign and painted closed doors. No equipment animations or sign/light-effect tags. Existing ordinary driving hides driver; no visible animated driver.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
