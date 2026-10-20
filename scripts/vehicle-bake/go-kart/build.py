"""Original small red and white tubular go-kart; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/go-kart/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/go-kart/v1"
)
O = ROOT / (
    "data/vehicle-bake/go-kart/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/go-kart/v1"
)
D = ROOT / "data/vehicle-bake/go-kart"
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


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        xx = -1.50 + 3.0 * (x + 0.5) / 512
        if y < 160:
            yy = -0.60 + 1.20 * (y + 0.5) / 160
            k = (
                "white"
                if abs(yy) < 0.105
                else "paintLight" if abs(yy) < 0.30 else "paint"
            )
        elif y < 320:
            zz = 0.12 + 0.50 * (y - 160 + 0.5) / 160
            k = "paintLight" if zz > 0.37 else "paint" if zz > 0.26 else "paintShadow"
            if -0.36 < xx < -0.12 and zz > 0.29:
                k = "white"
        elif y < 480:
            k = "paint" if x < 256 else "white"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("GoKart_palette_unlit_nearest")
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


def chart(o, kind="nose"):
    uv = o.data.uv_layers.active.data
    for f in o.data.polygons:
        for li in f.loop_indices:
            v = o.data.vertices[o.data.loops[li].vertex_index].co
            u = (v.x + 1.50) / 3.0
            py = (
                (v.y + 0.60) / 1.20 * 160
                if f.normal.z > 0.35
                else 160 + (v.z - 0.12) / 0.50 * 160
            )
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


# Own kart chassis: actual tubular rails and bumper hoops, no formula monocoque.
for side in [-1, 1]:
    curve_tube(
        "Tubular dark chassis side " + str(side),
        [
            (-1.20, side * 0.48, 0.18),
            (-0.95, side * 0.53, 0.17),
            (0.83, side * 0.53, 0.17),
            (1.26, side * 0.46, 0.19),
        ],
        0.043,
        "ink",
        sides=6,
    )
    curve_tube(
        "Fixed seat support " + str(side),
        [
            (0.25, side * 0.28, 0.16),
            (0.50, side * 0.27, 0.48),
            (0.60, side * 0.25, 0.74),
        ],
        0.030,
        "ink",
        sides=6,
    )
for x in [-1.20, -0.48, 0.52, 1.26]:
    curve_tube(
        "Chassis cross tube " + str(x),
        [(x, -0.48, 0.18), (x, 0.48, 0.18)],
        0.038,
        "ink",
        sides=6,
    )
front = [
    (-1.16, -0.53, 0.25),
    (-1.22, -0.80, 0.25),
    (-1.32, -0.895, 0.25),
    (-1.43, -0.86, 0.25),
    (-1.46, -0.73, 0.25),
    (-1.46, 0.73, 0.25),
    (-1.43, 0.86, 0.25),
    (-1.32, 0.895, 0.25),
    (-1.22, 0.80, 0.25),
    (-1.16, 0.53, 0.25),
]
curve_tube("Broad fixed front bumper hoop", front, 0.040, "ink", sides=8)
rear = [
    (1.25, -0.48, 0.22),
    (1.40, -0.60, 0.22),
    (1.46, -0.49, 0.22),
    (1.46, 0.49, 0.22),
    (1.40, 0.60, 0.22),
    (1.25, 0.48, 0.22),
]
curve_tube("Compact fixed rear bumper hoop", rear, 0.040, "ink", sides=6)
# Short rounded nose owns actual skin UV charts with one broad white center band.
sec = [
    (-0.75, 0),
    (-1, 0.25),
    (-1, 0.64),
    (-0.82, 0.94),
    (-0.45, 1),
    (0, 1.03),
    (0.45, 1),
    (0.82, 0.94),
    (1, 0.64),
    (1, 0.25),
    (0.75, 0),
]
vv = [
    (x, y * w, 0.20 + (h - 0.20) * z) for x, w, h in CFG["noseStations"] for y, z in sec
]
ns = len(sec)
ff = []
for i in range(len(CFG["noseStations"]) - 1):
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
        tuple((len(CFG["noseStations"]) - 1) * ns + j for j in range(ns)),
    ]
)
nose = mesh("Own short rounded red white kart nose", vv, ff, "paint")
chart(nose)
# A true shallow seat well with its own floor, inner walls and lip; upper center empty.
cube("Actual recessed cockpit floor", (0.03, 0, 0.19), (1.10, 0.64, 0.020), "floor")
for side in [-1, 1]:
    panel = cube(
        "Seat well red outer wall " + str(side),
        (0.03, side * 0.35, 0.325),
        (1.15, 0.060, 0.27),
        "paint",
        bevel=0.020,
    )
    chart(panel, "side")
    cube(
        "Dark inner seat well wall " + str(side),
        (0.03, side * 0.314, 0.323),
        (1.09, 0.016, 0.225),
        "inner",
    )
    curve_tube(
        "Seat well top lip " + str(side),
        [(-0.53, side * 0.35, 0.445), (0.56, side * 0.35, 0.445)],
        0.018,
        "ink",
        sides=6,
    )
cube("Fixed seat rear well panel", (0.60, 0, 0.33), (0.04, 0.67, 0.28), "inner")
cube(
    "Fixed dark seat cushion", (0.28, 0, 0.331), (0.42, 0.45, 0.14), "seat", bevel=0.045
)
cube("Seat cushion broad highlight", (0.27, 0, 0.406), (0.27, 0.32, 0.018), "tireLight")
back = cube(
    "Fixed dark seatback", (0.55, 0, 0.695), (0.115, 0.46, 0.59), "seat", bevel=0.045
)
for v in back.data.vertices:
    v.co.x += (v.co.z - 0.695) * 0.13
cube(
    "Fixed seatback broad highlight", (0.477, 0, 0.72), (0.020, 0.32, 0.32), "tireLight"
)
# Low steering column and broad round rim, fixed for the ordinary static vehicle.
curve_tube(
    "Fixed steering column", [(-0.42, 0, 0.24), (-0.20, 0, 0.64)], 0.023, "rim", sides=6
)
pts = []
for j in range(17):
    a = 2 * math.pi * j / 16
    pts.append(
        (-0.20 + 0.055 * math.sin(a), 0.17 * math.cos(a), 0.65 + 0.145 * math.sin(a))
    )
curve_tube("Fixed steering wheel rim", pts, 0.025, "ink", sides=6)
curve_tube(
    "Fixed steering cross spoke",
    [(-0.20, -0.14, 0.65), (-0.20, 0.14, 0.65)],
    0.017,
    "rim",
    sides=4,
)
for side in [-1, 1]:
    cube(
        "Fixed gray pedal " + str(side),
        (-0.49, side * 0.17, 0.245),
        (0.11, 0.11, 0.035),
        "rim",
        bevel=0.01,
    )
# Compact fixed motor and chain guard behind the central seat, not animated equipment.
cube(
    "Fixed rear motor block",
    (0.96, -0.08, 0.43),
    (0.53, 0.51, 0.38),
    "rim",
    bevel=0.045,
)
cube(
    "Fixed rear motor dark base",
    (0.96, -0.08, 0.24),
    (0.61, 0.57, 0.10),
    "ink",
    bevel=0.025,
)
for x in [0.78, 0.87, 0.96, 1.05, 1.14]:
    cube(
        "Broad motor cooling rib " + str(x),
        (x, -0.08, 0.635),
        (0.034, 0.43, 0.036),
        "silver",
    )
cube(
    "Fixed rear chain guard",
    (0.94, -0.465, 0.30),
    (0.65, 0.14, 0.20),
    "ink",
    bevel=0.035,
)
cube(
    "Fixed red motor tank", (0.99, 0.31, 0.47), (0.39, 0.20, 0.24), "paint", bevel=0.04
)
disk(
    "Fixed motor end cap",
    (1.12, 0.05, 0.42),
    (1, 0, 0),
    0.13,
    "silver",
    segments=12,
    depth=0.12,
)
# Four short chassis arms stop below one world pixel before rotating tire inner faces.
for axle in CFG["axles"]:
    spec = CFG["wheelSpecs"]["F" if axle < 0 else "R"]
    r = spec["radius"]
    inner = spec["halfTrack"] - spec["width"] / 2
    tip = inner - CFG["suspensionTipCenterGapSource"]
    for side in [-1, 1]:
        wid = ("F" if axle < 0 else "R") + ("L" if side < 0 else "R")
        for offset in [-0.14, 0.14]:
            curve_tube(
                "ChassisArm_" + wid + "_" + str(offset),
                [(axle + offset, side * 0.40, 0.19), (axle, side * tip, r)],
                0.018,
                "ink",
                sides=6,
            )
        curve_tube(
            "ChassisArm_" + wid + "_fixed_tip",
            [(axle, side * tip, r - 0.07), (axle, side * tip, r + 0.07)],
            0.015,
            "rim",
            sides=6,
        )

# Wheel topology has an exact circular envelope and genuinely centered pivots.
nr = 20
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
root = bpy.data.objects.new("GoKart_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/go-kart/" + f
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
            "ownership": "Own short rounded nose and actual low seat-well side skin use continuous red/white charts. Dark tubular frame, bumper hoops, fixed central seat/steering, gray rear motor ribs, chain guard and all4 exposed wheels have named geometry and padded semantic swatches. No glass or coincident surface overlays. No source projection or high-to-low claim.",
            "semanticOwners": {
                "noseTop": {
                    "component": "Own short rounded red white kart nose",
                    "atlasPixelRect": [0, 0, 512, 160],
                    "meaning": "Actual rounded nose skin, broad red paint with central white band",
                },
                "noseAndWellSides": {
                    "atlasPixelRect": [0, 160, 512, 320],
                    "meaning": "Actual nose and well-side red paint with bounded broad white side block",
                },
                "seatWell": {
                    "roles": ["floor", "inner", "seat", "ink", "tireLight"],
                    "meaning": "Separate floor/sidewalls/lips and fixed cushion/back. Six rays reach the real floor below surrounding walls; no opaque upper deck.",
                },
                "chassisMotor": {
                    "roles": ["ink", "rim", "silver", "paint"],
                    "meaning": "Fixed tubular chassis/bumper hoops, short arm tips, steering, gray motor and chain guard; exact named semantic owners",
                },
                "exposedWheels": {
                    "roles": ["tire", "tireLight", "rim", "silver", "white"],
                    "meaning": "Four independent small tires, source front.25/rear.27 radii. No fenders/caps. Ordinary distance and family-only equal-angle phases are independently proved.",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Low central seat well and rear fixed motor, short red/white nose and four intentionally exposed wheel crowns; front/rear radii have explicit owners.",
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
    "family": "go-kart",
    "route": "go-kart",
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
    "equipment": "Fixed tubular chassis, bumpers, steering, central seat and rear motor/chain guard. No equipment animation. Four intentionally exposed wheels; no caps. Ordinary driving hides driver; driver-visible pose out of scope. No glass, roof or helmet/driver geometry.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
