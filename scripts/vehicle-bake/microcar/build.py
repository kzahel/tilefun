"""Original tiny bubble microcar; own geometry and semantic UV ownership.
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
    "data/vehicle-bake/microcar/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/microcar/v1"
)
O = ROOT / (
    "data/vehicle-bake/microcar/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/microcar/v1"
)
D = ROOT / "data/vehicle-bake/microcar"
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


def aperture(x, t, x0, x1, t0, t1):
    u = (x - x0) / (x1 - x0)
    v = (t - t0) / (t1 - t0)
    rad = 0.17
    dx = max(abs(u - 0.5) - (0.5 - rad), 0)
    dy = max(abs(v - 0.5) - (0.5 - rad), 0)
    if 0 <= u <= 1 and 0 <= v <= 1 and dx * dx + dy * dy <= rad * rad:
        if min(u, 1 - u) < 0.08 or min(v, 1 - v) < 0.115:
            return "ink"
        return (
            "glassGlint" if 0.26 < v < 0.34 else "glassLight" if v < 0.56 else "glass"
        )
    return None


def egg_paint(x, t):
    a = abs(t)
    role = (
        "roof"
        if a < 0.63 and x > -0.56
        else "paintLight" if a < 0.85 else "paint" if a < 1.33 else "paintMid"
    )
    # One panoramic front aperture and one coherent side pane per side.
    # All are on the same actual egg skin, with solid painted pillar gaps.
    k = aperture(x, t, -1.42, -0.63, -0.84, 0.84)
    if k:
        return k
    for side in [-1, 1]:
        lo, hi = sorted([side * 0.75, side * 1.30])
        k = aperture(x, t, -0.49, 0.78, lo, hi)
        if k:
            return k
    if (
        0.97 < x < 1.39
        and a < 0.53
        and any(abs(x - q) < 0.027 for q in [1.04, 1.17, 1.30])
    ):
        return "paintDeep"
    if a > 1.31 and abs(x + 0.58) < 0.017:
        return "paintDeep"
    return role


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 352:
            k = egg_paint(
                -1.64 + 3.28 * (x + 0.5) / 512, -math.pi / 2 + math.pi * (y + 0.5) / 352
            )
        elif y < 432:
            xx = -1.64 + 3.28 * (x + 0.5) / 512
            zz = 0.18 + 0.40 * (y - 352 + 0.5) / 80
            k = "paintMid" if zz > 0.39 else "paintShadow"
            if -1.38 < xx < -0.58 and abs(zz - 0.34) < 0.013:
                k = "paintDeep"
        elif y < 480:
            k = "paintLight" if x < 256 else "paintMid"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))
png(A / "atlas.png", 512, 512, atlas)

shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Microcar_palette_unlit_nearest")
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


def pocket(o, axle):
    for side in [-1, 1]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20,
            radius=CFG["arch"]["cutRadius"],
            depth=0.82,
            location=(axle, side * 0.90, CFG["wheelRadius"]),
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


# Own bubble geometry: compact upper elliptic arc over a tapering lower shell.
# No hood/cabin/box rescaling, and no body/glass overlays.
stations = CFG["eggStations"]
nt = CFG["crossSectionSegments"]
vv = []
ff = []
for x, w, h in stations:
    base = min(CFG["upperBaseZ"], h - 0.12)
    for j in range(nt + 1):
        t = -math.pi / 2 + math.pi * j / nt
        vv.append((x, w * math.sin(t), base + (h - base) * max(0, math.cos(t)) ** 0.92))
for i in range(len(stations) - 1):
    for j in range(nt):
        ff.append(
            (
                i * (nt + 1) + j,
                (i + 1) * (nt + 1) + j,
                (i + 1) * (nt + 1) + j + 1,
                i * (nt + 1) + j + 1,
            )
        )
for side, j in [(-1, 0), (1, nt)]:
    idx = len(vv)
    for x, w, h in stations:
        vv.append((x, side * w * 0.83, CFG["lowerFloorZ"]))
    for i in range(len(stations) - 1):
        ff.append((i * (nt + 1) + j, idx + i, idx + i + 1, (i + 1) * (nt + 1) + j))
left = len(stations) * (nt + 1)
right = left + len(stations)
for i in range(len(stations) - 1):
    ff.append((left + i, right + i, right + i + 1, left + i + 1))
for i in [0, len(stations) - 1]:
    ff.append(tuple([i * (nt + 1) + j for j in range(nt + 1)] + [right + i, left + i]))
body = mesh(
    "Own tiny egg bubble continuous upper skin and tapered lower shell", vv, ff, "paint"
)
uv = body.data.uv_layers.active.data
for face in list(body.data.polygons)[: (len(stations) - 1) * nt]:
    for li in face.loop_indices:
        vi = body.data.loops[li].vertex_index
        i, j = divmod(vi, nt + 1)
        uv[li].uv = ((stations[i][0] + 1.64) / 3.28, 1 - (j / nt) * 352 / 512)
for face in list(body.data.polygons)[
    (len(stations) - 1) * nt : (len(stations) - 1) * (nt + 2)
]:
    for li in face.loop_indices:
        v = body.data.vertices[body.data.loops[li].vertex_index].co
        uv[li].uv = (
            (v.x + 1.64) / 3.28,
            1 - (352 + max(0, min(1, (v.z - 0.18) / 0.40)) * 80) / 512,
        )
for face in list(body.data.polygons)[(len(stations) - 1) * (nt + 3) :]:
    for li in face.loop_indices:
        uv[li].uv = (0.25 if face.center.x < 0 else 0.75, 1 - 456 / 512)
for axle in CFG["axles"]:
    pocket(body, axle)

# These broad low shoulders are integrated into the narrowing egg ends.
# Full actual body and every trim triangle remain in the roll proof.
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
        idx = len(vv)
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
                (last * (n + 1) + j, last * (n + 1) + j + 1, idx + j + 1, idx + j)
            )
            rr.append("paintDeep")
        mesh(
            "Integrated tiny bubble wheel shoulder " + str(axle) + " " + str(side),
            vv,
            ff,
            rr,
        )

for x in [-1.57, 1.55]:
    cube(
        "Tiny restrained chrome bumper " + str(x),
        (x, 0, 0.30),
        (0.08, 0.90, 0.075),
        "silver",
        bevel=0.02,
    )
for side in [-1, 1]:
    disk(
        "Ordinary round headlamp rim " + str(side),
        (-1.515, side * 0.36, 0.65),
        (-1, side * 0.15, 0),
        0.108,
        "silver",
        segments=10,
        depth=0.018,
    )
    disk(
        "Ordinary cream round headlamp " + str(side),
        (-1.535, side * 0.363, 0.65),
        (-1, side * 0.15, 0),
        0.081,
        "cream",
        segments=10,
        depth=0.004,
    )
    disk(
        "Tiny rear ruby lamp " + str(side),
        (1.46, side * 0.28, 0.54),
        (1, 0, 0),
        0.060,
        "ruby",
        segments=8,
        depth=0.02,
    )
    cube(
        "Quiet side door handle " + str(side),
        (-0.34, side * 0.837, 0.87),
        (0.10, 0.02, 0.025),
        "silver",
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
                0.18,
                "rim",
                segments=12,
                depth=0.012,
                group=group,
            )
            disk(
                "Chrome hub " + wid + str(s),
                (0, s * (width / 2 + 0.017), 0),
                (0, s, 0),
                0.12,
                "silver",
                segments=12,
                depth=0.037,
                group=group,
            )
            disk(
                "Hub glint " + wid + str(s),
                (-0.025, s * (width / 2 + 0.055), 0.025),
                (0, s, 0),
                0.045,
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
root = bpy.data.objects.new("Microcar_Root_forward_minus_X", None)
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
        "scripts/vehicle-bake/microcar/" + f
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
            "ownership": "Own continuous longitudinal/angular chart on actual egg skin: one curved panoramic front aperture, one side pane each, dark perimeter frames and painted pillar gaps. Pale roof/upper paint and coral rose lower body remain physical skin. Local arch booleans preserve UV interpolation. No glass overlay or silhouette paint.",
            "semanticOwners": {
                "eggSkin": {
                    "component": "Own tiny egg bubble continuous upper skin and tapered lower shell",
                    "atlasPixelRect": [0, 0, 512, 352],
                    "domain": {
                        "xSource": [-1.64, 1.64],
                        "lateralAngle": [-1.5707963267948966, 1.5707963267948966],
                    },
                    "meaning": "Single coherent actual rounded skin chart for panoramic front, side panes, pale roof, rose paint and rear vent bars; separate solid pillar gaps",
                },
                "lowerShell": {
                    "atlasPixelRect": [0, 352, 512, 432],
                    "meaning": "Lower side shadows and front-door lower seam",
                },
                "endCaps": {
                    "atlasPixelRect": [0, 432, 512, 480],
                    "meaning": "Short rounded front-door/nose cap and compact rear underside; no duplicate glazing",
                },
                "trim": {
                    "roles": [
                        "silver",
                        "cream",
                        "ruby",
                        "paintDeep",
                        "paintLight",
                        "paint",
                        "paintMid",
                    ],
                    "meaning": "Named tiny bumpers, ordinary round lamps, handles and integrated broad fenders own padded role swatches",
                },
            },
            "roleSwatchPixelCenters": {
                k: [(i % 16) * 32 + 16, 480 + (i // 16) * 16 + 8]
                for i, k in enumerate(keys)
            },
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Symmetric egg body with distinct front panoramic aperture and rear vent bars; one pane per side, closed passenger cabin.",
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
    "family": "microcar",
    "route": "microcar",
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
    "equipment": "Static closed microcar body and glazing; no animated doors or equipment.",
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(audit, indent=2), flush=True)
