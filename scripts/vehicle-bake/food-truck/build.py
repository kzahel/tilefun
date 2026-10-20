"""Original red/cream food truck, actual serving cavity and fixed shade/counter.
Deterministic Blender retained source replay: -- --scratch.
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
    "data/vehicle-bake/food-truck/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/food-truck/v1"
)
O = ROOT / (
    "data/vehicle-bake/food-truck/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/food-truck/v1"
)
D = ROOT / "data/vehicle-bake/food-truck"
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


def framed(x, z, x0, x1, z0, z1):
    if x0 <= x <= x1 and z0 <= z <= z1:
        if min(x - x0, x1 - x) < 0.055 or min(z - z0, z1 - z) < 0.055:
            return "ink"
        f = (z - z0) / (z1 - z0)
        return (
            "glassGlint" if 0.68 < f < 0.79 else "glassLight" if f > 0.44 else "glass"
        )
    return None


def cab_side(x, z):
    k = framed(
        x, z, -2.35 + 0.18 * max(0, min(1, (z - 1.32) / 0.72)), -1.25, 1.32, 2.07
    )
    if k:
        return k
    if abs(x + 1.16) < 0.018 and 0.53 < z < 2.10:
        return "paintDeep"
    if -1.47 < x < -1.29 and 1.22 < z < 1.27:
        return "ink"
    return "creamLight" if z > 1.28 else "paint" if z > 0.72 else "paintMid"


def burger(x, z):
    # Broad custom graphic, no brand/lettering/tiny sesame marks.
    u = (x - 0.78) / 0.90
    v = (z - 1.72) / 0.64
    if abs(u) > 1 or abs(v) > 1:
        return None
    if -0.90 < v < -0.48 and abs(u) < 0.84:
        return "ink" if abs(u) > 0.76 or v < -0.80 else "bun"
    if -0.46 < v < -0.20 and abs(u) < 0.94:
        return "ink" if abs(u) > 0.84 else "patty"
    if -0.18 < v < 0.02 and abs(u) < 0.99:
        return "ink" if abs(u) > 0.90 else "lettuce"
    if 0.03 < v < 0.18 and abs(u) < 0.90:
        return "paintDeep"
    if 0.17 < v < 0.85 and u * u + ((v - 0.17) / 0.70) ** 2 < 1:
        return "ink" if u * u + ((v - 0.17) / 0.70) ** 2 > 0.80 else "bun"
    return None


atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 112:
            xx = -3 + 2 * (x + 0.5) / 512
            zz = 0.9 + 1.35 * (y + 0.5) / 112
            k = cab_side(xx, zz)
        elif y < 224:
            yy = -1.2 + 2.4 * ((x % 256) + 0.5) / 256
            zz = 0.8 + 1.45 * (y - 112 + 0.5) / 112
            k = (framed(yy, zz, -0.91, 0.91, 1.35, 2.08) if x < 256 else None) or (
                "creamLight" if zz > 1.28 else "paint"
            )
        elif y < 400:
            opposite = y >= 304
            start = 304 if opposite else 224
            h = 96 if opposite else 80
            xx = -1.15 + 4.05 * (x + 0.5) / 512
            zz = 0.4 + 2.25 * (y - start + 0.5) / h
            k = "creamLight" if zz > 1.38 else "paint" if zz > 0.72 else "paintMid"
            if 1.33 < zz < 1.40:
                k = "creamMid"
            if opposite:
                k = burger(xx, zz) or k
            elif (
                -0.73 < xx < 2.29
                and 1.13 < zz < 2.43
                and not (-0.68 < xx < 2.24 and 1.18 < zz < 2.38)
            ):
                k = "ink"
        elif y < 432:
            k = "creamLight" if 0.10 < (x + 0.5) / 512 < 0.90 else "cream"
        elif y < 448:
            k = "paintLight" if 0.15 < (x + 0.5) / 512 < 0.85 else "paint"
        elif y < 480:
            xx = -0.68 + 2.92 * (x + 0.5) / 512
            zz = 1.18 + 1.20 * (y - 448 + 0.5) / 32
            k = "innerLight" if 1.40 < zz < 2.10 else "inner"
            if 0.55 < xx < 0.59:
                k = "inner"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))

png(A / "atlas.png", 512, 512, atlas)
shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Food_Truck_palette_unlit_nearest")
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


exec(
    compile(
        Path(__file__).with_name("geometry.py").read_text(),
        str(Path(__file__).with_name("geometry.py")),
        "exec",
    )
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
        axle = CFG["wheelSpecs"][group]["axle"]
        r = CFG["wheelSpecs"][group]["radius"]
        side = -1 if group[1] == "L" else 1
        for o in obs:
            o.location = (axle, side * CFG["wheelSpecs"][group]["halfTrack"], r)
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
for group, obs in groups.items():
    if group != "body":
        for o in obs:
            o.location = (0, 0, 0)
root = bpy.data.objects.new("Food_Truck_Root_forward_minus_X", None)
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
        axle = CFG["wheelSpecs"][group]["axle"]
        r = CFG["wheelSpecs"][group]["radius"]
        side = -1 if group[1] == "L" else 1
        c = Vector((axle, side * CFG["wheelSpecs"][group]["halfTrack"], r))
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
        "scripts/vehicle-bake/food-truck/" + f
        for f in [
            "build.py",
            "geometry.py",
            "family.json",
            "coverage-region.json",
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
            "ownership": CFG["paintOwnership"],
            "observedProjectionTexels": 0,
            "uncertainty": "Wholly original authored surfaces, including underside. No source-image fidelity or high-to-low transfer asserted.",
            "outerInk": "No exterior silhouette paint in atlas; shared engine outline is RGB 58,58,80.",
            "asymmetry": "Serving recess, fixed shade and counter on -Y side; broad original burger graphic on opposite +Y actual skin. Closed cab front glass owns a separate chart; no rear-box glass invented.",
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
    "geometry.py",
    "family.json",
    "coverage-region.json",
    "review.json",
]:
    shutil.copy2(Path(__file__).with_name(file), A / file)
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
report = {
    "status": "draft",
    "artReviewStatus": "awaiting-owner-review",
    "family": "food-truck",
    "route": "food-truck",
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
