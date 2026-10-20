"""Original single-seat formula open-wheel racer; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/open-wheel-racer/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/open-wheel-racer/v1"
)
O = ROOT / (
    "data/vehicle-bake/open-wheel-racer/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/open-wheel-racer/v1"
)
D = ROOT / "data/vehicle-bake/open-wheel-racer"
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


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        xx = -2.10 + 4.0 * (x + 0.5) / 512
        if y < 160:
            yy = -0.50 + (y + 0.5) / 160
            k = (
                "yellowLight"
                if xx < -0.55 and abs(yy) < 0.11
                else "paintLight" if abs(yy) < 0.28 else "paint"
            )
        elif y < 320:
            zz = 0.18 + 0.82 * (y - 160 + 0.5) / 160
            k = "paint" if zz > 0.48 else "paintMid" if zz > 0.30 else "paintShadow"
            if xx < -0.55 and zz > 0.43:
                k = "yellow"
        elif y < 448:
            u = (x + 0.5) / 512
            v = (y - 320 + 0.5) / 128
            k = (
                "ink"
                if min(u, 1 - u) < 0.065 or min(v, 1 - v) < 0.16
                else "glassLight" if v > 0.45 else "glass"
            )
        elif y < 480:
            k = "yellow" if x < 256 else "paintLight"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("OpenWheelRacer_palette_unlit_nearest")
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
        if (
            kind == "body"
            and -0.281 < f.center.x < 0.581
            and abs(f.center.y) < 0.305
            and 0.275 < f.center.z < 0.80
        ):
            role_uv(
                o, f, "floor" if f.normal.z > 0.5 and f.center.z < 0.35 else "inner"
            )
            continue
        if kind == "wind" and abs(f.normal.x) < 0.5:
            continue
        for li in f.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index].co
            if kind == "wind":
                u = (v.y + 0.285) / 0.57
                py = 320 + (v.z - 0.765) / 0.18 * 128
            elif f.normal.z > 0.35:
                u = (v.x + 2.10) / 4.0
                py = (v.y + 0.50) * 160
            else:
                u = (v.x + 2.10) / 4.0
                py = 160 + (v.z - 0.18) / 0.82 * 160
            uv[li].uv = (max(0.001, min(0.999, u)), 1 - py / 512)


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


# Original narrow formula monocoque, true cockpit tub, separate low sidepods.
sec = [
    (-0.75, 0),
    (-1, 0.18),
    (-1, 0.70),
    (-0.85, 0.92),
    (-0.5, 1),
    (0, 1.02),
    (0.5, 1),
    (0.85, 0.92),
    (1, 0.70),
    (1, 0.18),
    (0.75, 0),
]
vv = []
ff = []
ns = len(sec)
for x, w, h in CFG["chassisStations"]:
    for y, z in sec:
        vv.append((x, y * w, 0.18 + (h - 0.18) * z))
for i in range(len(CFG["chassisStations"]) - 1):
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
        tuple((len(CFG["chassisStations"]) - 1) * ns + j for j in range(ns)),
    ]
)
body = mesh(
    "Own narrow formula monocoque with actual recessed cockpit", vv, ff, "paint"
)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.15, 0, 1.28))
cutter = bpy.context.object
cutter.scale = (0.86, 0.60, 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mod = cutter.modifiers.new("Rounded genuine single-seat aperture", "BEVEL")
mod.width = 0.075
mod.segments = 2
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.view_layer.objects.active = body
mod = body.modifiers.new("Actual open cockpit down to low floor", "BOOLEAN")
mod.operation = "DIFFERENCE"
mod.solver = "EXACT"
mod.object = cutter
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter, do_unlink=True)
chart(body, "body")
cube("Actual recessed cockpit floor", (0.12, 0, 0.300), (0.74, 0.50, 0.020), "floor")
for side in [-1, 1]:
    cube(
        "Dark inner cockpit panel " + str(side),
        (0.15, side * 0.296, 0.53),
        (0.67, 0.018, 0.40),
        "inner",
    )
    cube(
        "Continuous cyan cockpit rim " + str(side),
        (0.16, side * 0.322, 0.773),
        (0.64, 0.065, 0.045),
        "paintLight",
        bevel=0.014,
    )
    cube(
        "Low integrated formula sidepod " + str(side),
        (0.25, side * 0.52, 0.44),
        (1.36, 0.30, 0.32),
        "paint",
        bevel=0.06,
    )
    cube(
        "Broad sidepod inlet " + str(side),
        (-0.439, side * 0.52, 0.46),
        (0.025, 0.22, 0.16),
        "ink",
    )
cube("Dark dashboard in real cockpit", (-0.258, 0, 0.66), (0.045, 0.48, 0.17), "ink")
cube(
    "Fixed dark seat cushion",
    (0.29, 0, 0.397),
    (0.30, 0.40, 0.145),
    "seat",
    bevel=0.045,
)
seat = cube(
    "Fixed dark seatback", (0.506, 0, 0.665), (0.115, 0.41, 0.43), "seat", bevel=0.04
)
for v in seat.data.vertices:
    v.co.x += (v.co.z - 0.665) * 0.16
cube(
    "Fixed seatback broad highlight", (0.436, 0, 0.70), (0.02, 0.29, 0.24), "tireLight"
)
cube("Low narrow undertray", (0.25, 0, 0.205), (2.60, 1.46, 0.07), "ink")

# Actual compact static opaque windscreen, no driver/helmet geometry.
vv = []
for dx in [-0.011, 0.011]:
    vv += [
        (-0.36 + dx, -0.285, 0.765),
        (-0.36 + dx, 0.285, 0.765),
        (-0.27 + dx, 0.25, 0.945),
        (-0.27 + dx, -0.25, 0.945),
    ]
wind = mesh(
    "Small static framed opaque blue windscreen",
    vv,
    [
        (0, 1, 2, 3),
        (7, 6, 5, 4),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ],
    "ink",
)
chart(wind, "wind")

# Broad static airfoils, wholly ahead/behind the swept tire cylinders.
profile = [
    (-0.20, -0.015),
    (-0.12, 0.040),
    (0.10, 0.050),
    (0.20, 0.015),
    (0.16, -0.020),
    (-0.14, -0.035),
]
for label, cx, cz, span in [("Front", -2.12, 0.33, 1.16), ("Rear", 2.08, 1.16, 1.08)]:
    vv = []
    ff = []
    rr = []
    ys = [-span, -span * 0.82, -span * 0.48, 0, span * 0.48, span * 0.82, span]
    for yy in ys:
        for xx, zz in profile:
            vv.append((cx + xx, yy, cz + zz))
    for k in range(len(ys) - 1):
        for j in range(len(profile)):
            ff.append(
                (
                    k * 6 + j,
                    k * 6 + (j + 1) % 6,
                    (k + 1) * 6 + (j + 1) % 6,
                    (k + 1) * 6 + j,
                )
            )
            rr.append(
                "yellow"
                if k in [0, 5]
                else (
                    "paintLight" if j in [0, 1] else "paint" if j < 3 else "paintShadow"
                )
            )
    ff.extend([tuple(range(5, -1, -1)), tuple((len(ys) - 1) * 6 + j for j in range(6))])
    rr.extend(["yellow", "yellow"])
    mesh(label + " broad static formula wing", vv, ff, rr)
    for side in [-1, 1]:
        cube(
            label + " fixed wing endplate " + str(side),
            (cx, side * span, cz + 0.005),
            (0.40, 0.028, 0.16 if label == "Rear" else 0.25),
            "yellow" if label == "Front" else "paint",
            bevel=0.015,
        )
for side in [-1, 1]:
    curve_tube(
        "Rear wing fixed pylon " + str(side),
        [
            (1.67, side * 0.27, 0.49),
            (1.82, side * 0.27, 0.76),
            (2.04, side * 0.27, 1.14),
        ],
        0.043,
        "ink",
        sides=6,
    )
    curve_tube(
        "Front wing fixed nose brace " + str(side),
        [(-1.85, side * 0.14, 0.36), (-2.09, side * 0.25, 0.35)],
        0.030,
        "paintShadow",
        sides=6,
    )

# Four open wheels, no fender/crown covers. Wishbone tips stop a subpixel short
# of the rotating inner tire face. Uprights stay fixed and share the same gap.
for axle in CFG["axles"]:
    spec = CFG["wheelSpecs"]["F" if axle < 0 else "R"]
    r = spec["radius"]
    inner = spec["halfTrack"] - spec["width"] / 2
    tip = inner - CFG["suspensionTipCenterGapSource"]
    for side in [-1, 1]:
        wid = ("F" if axle < 0 else "R") + ("L" if side < 0 else "R")
        for level, zdelta in [("upper", 0.08), ("lower", -0.10)]:
            for offset in [-0.27, 0.27]:
                curve_tube(
                    "Suspension_" + wid + "_" + level + "_" + str(offset),
                    [
                        (axle + offset, side * 0.29, r + zdelta),
                        (axle, side * tip, r + zdelta * 0.45),
                    ],
                    0.020,
                    "ink",
                    sides=6,
                )
        curve_tube(
            "Suspension_" + wid + "_fixed_upright",
            [(axle, side * tip, r - 0.105), (axle, side * tip, r + 0.105)],
            0.018,
            "rim",
            sides=6,
        )

# Wheel topology has an exact circular envelope and genuinely centered pivots.
nr = 24
for axle in CFG["axles"]:
    spec = CFG["wheelSpecs"]["F" if axle < 0 else "R"]
    r = spec["radius"]
    width = spec["width"]
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
                r * 0.60,
                "rim",
                segments=12,
                depth=0.012,
                group=group,
            )
            disk(
                "Chrome hub " + wid + str(s),
                (0, s * (width / 2 + 0.017), 0),
                (0, s, 0),
                r * 0.38,
                "silver",
                segments=12,
                depth=0.037,
                group=group,
            )
            disk(
                "Hub glint " + wid + str(s),
                (-0.035, s * (width / 2 + 0.055), 0.035),
                (0, s, 0),
                r * 0.15,
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
            spec = CFG["wheelSpecs"][group[0]]
            o.location = (axle, side * spec["halfTrack"], spec["radius"])
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
for group, obs in groups.items():
    if group != "body":
        for o in obs:
            o.location = (0, 0, 0)
root = bpy.data.objects.new("OpenWheelRacer_Root_forward_minus_X", None)
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
        spec = CFG["wheelSpecs"][group[0]]
        r = spec["radius"]
        c = Vector((axle, side * spec["halfTrack"], r))
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
        "scripts/vehicle-bake/open-wheel-racer/" + f
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
            "ownership": "Own narrow formula chassis UV skin: broad cyan/yellow nose, real low floor and dark inner panels/seat, opaque framed blue windscreen, sidepods and static broad wings. Four intentionally exposed tire assemblies, no crown/fender caps. Wishbone/upright tips end subpixel short of real rotating inner tire faces. No source projection, glass overlays or high-to-low transfer claim.",
            "semanticOwners": {
                "chassisTop": {
                    "component": "Own narrow formula monocoque with actual recessed cockpit",
                    "atlasPixelRect": [0, 0, 512, 160],
                    "meaning": "Actual chassis top cyan clusters and broad yellow nose accent; no surface bridges the open cockpit",
                },
                "chassisSide": {
                    "atlasPixelRect": [0, 160, 512, 320],
                    "meaning": "Narrow low body-side cyan shading and yellow nose accents",
                },
                "smallWindscreen": {
                    "component": "Small static framed opaque blue windscreen",
                    "atlasPixelRect": [0, 320, 512, 448],
                    "meaning": "Actual front/back slab faces own bounded coolblue glass, thin slab edges stay ink",
                },
                "cockpit": {
                    "roles": ["floor", "inner", "seat", "ink", "tireLight"],
                    "meaning": "Recessed actual floor, inner panels/dashboard and fixed dark seat; no driver or helmet sphere",
                },
                "wingsSuspension": {
                    "roles": [
                        "paint",
                        "paintLight",
                        "paintShadow",
                        "yellow",
                        "ink",
                        "rim",
                    ],
                    "meaning": "Fixed front/rear airfoils, endplates, supports and wishbone/upright rods; static exact palette UV islands",
                },
                "exposedWheels": {
                    "roles": ["tire", "tireLight", "rim", "silver", "white"],
                    "meaning": "Independent wheel meshes with front0.39/rear0.45 source radii; no fake fender covers. Ordinary same-distance roll differs by radius; equal-angle proof is family-only.",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Single-seat real open cockpit, long yellow nose, broad fixed wings and four intentionally exposed wheel crowns; different front/rear radii have explicit owners.",
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
    "family": "open-wheel-racer",
    "route": "open-wheel-racer",
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
    "equipment": "Fixed front/rear wings and wishbone/upright geometry. No equipment animation. Four intentionally exposed wheels; no fake fenders/caps. Existing ordinary driving hides driver, no driver/helmet geometry.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
