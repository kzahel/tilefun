"""Original teal/cream true F/R motorcycle and measured immutable rider contacts.
Deterministic retained source replay: -- --scratch.
"""

import bpy, bmesh, math, json, sys, shutil, struct, zlib
from pathlib import Path
from mathutils import Vector

sys.dont_write_bytecode = True

ROOT = next(
    p
    for p in Path(__file__).resolve().parents
    if (p / "AGENTS.md").is_file() and (p / "public").is_dir()
)
import argparse, re

parser = argparse.ArgumentParser(
    description="Parameterized classic-motorcycle static control variant"
)
parser.add_argument(
    "--config", type=Path, default=Path(__file__).with_name("family.json")
)
parser.add_argument("--variant-id")
parser.add_argument("--scratch", action="store_true")
args = parser.parse_args(
    sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
)
CONFIG_PATH = args.config.resolve()
CFG = json.loads(CONFIG_PATH.read_text())
VARIANT = args.variant_id or CFG["id"]
assert VARIANT == CFG["id"] and re.fullmatch(r"[a-z0-9-]+", VARIANT)
SCRATCH = args.scratch
A = ROOT / (
    f"data/vehicle-bake/{VARIANT}/replay/source"
    if SCRATCH
    else f"art-source/vehicle-bake/{VARIANT}/v1"
)
O = ROOT / (
    f"data/vehicle-bake/{VARIANT}/replay/public"
    if SCRATCH
    else f"public/demos/vehicle-bake/{VARIANT}/v1"
)
D = ROOT / f"data/vehicle-bake/{VARIANT}"
for p in (A, O, D, A / "evidence"):
    p.mkdir(parents=True, exist_ok=True)
if (O / "report.json").exists():
    prior = json.loads((O / "report.json").read_text())
    assert prior.get("status") != "complete" and not prior.get(
        "sourceImmutable"
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


# Broad teal/cream tank skin charts and constant-role swatches only.
PROFILE_PATH = ROOT / CFG["riderProfile"]["path"]
import hashlib

assert (
    hashlib.sha256(PROFILE_PATH.read_bytes()).hexdigest()
    == CFG["riderProfile"]["sha256"]
)
PROFILE = json.loads(PROFILE_PATH.read_text())
MOUNT = Vector(CFG["riderMountSource"])
CONTACTS = {name: MOUNT + Vector(p) / S for name, p in PROFILE["contacts"].items()}
atlas = bytearray(512 * 512 * 4)
for y in range(512):
    for x in range(512):
        if y < 256:
            xx = -0.82 + 0.72 * (x + 0.5) / 512
            zz = 0.78 + 0.48 * (y + 0.5) / 256
            q = ((xx + 0.46) / 0.245) ** 2 + ((zz - 1.025) / 0.085) ** 2
            k = (
                "cream"
                if q < 0.80
                else (
                    "ink"
                    if q < 1.0
                    else (
                        "paintLight"
                        if zz > 1.10
                        else "paint" if zz > 0.94 else "paintMid"
                    )
                )
            )
        elif y < 384:
            k = "paintLight" if 0.2 < (x + 0.5) / 512 < 0.8 else "paint"
        elif y < 448:
            k = "cream"
        elif y < 480:
            k = "seat"
        else:
            k = keys[min(len(keys) - 1, ((y - 480) // 16) * 16 + x // 32)]
        atlas[(y * 512 + x) * 4 : (y * 512 + x + 1) * 4] = bytes((*P[k], 255))

png(A / "atlas.png", 512, 512, atlas)
shutil.copy2(A / "atlas.png", O / "atlas.png")
mat = bpy.data.materials.new("Motorcycle_palette_unlit_nearest")
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
        side = 0
        for o in obs:
            o.location = (axle, side * CFG["wheelSpecs"][group]["halfTrack"], r)
contact_nodes = []
for name, point in CONTACTS.items():
    o = bpy.data.objects.new("BikeSocket_" + name, None)
    scene.collection.objects.link(o)
    o.location = point
    o["profile_contact"] = name
    contact_nodes.append(o)
mount_node = bpy.data.objects.new("Rider_Mount_Profile", None)
scene.collection.objects.link(mount_node)
mount_node.location = MOUNT
mount_node["profile_sha256"] = CFG["riderProfile"]["sha256"]
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
for group, obs in groups.items():
    if group != "body":
        for o in obs:
            o.location = (0, 0, 0)
root = bpy.data.objects.new("Motorcycle_Root", None)
scene.collection.objects.link(root)
root["tilefun_motorcycle"] = 1
root["wheel_ids"] = ["F", "R"]
root["presentation_stage"] = "source-prototype-not-production"
for node in contact_nodes + [mount_node]:
    node.parent = root

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
        side = 0
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
    "riderProfileInput": CFG["riderProfile"],
    "riderMountSource": list(MOUNT),
    "actualBikeContactsSource": {n: list(p) for n, p in CONTACTS.items()},
    "method": CFG["paintMethod"],
    "masterMeaning": "Editable semantic component master at runtime topology; no separate high-poly/decimation claim.",
    "sourceDependencies": [
        (
            CONFIG_PATH.relative_to(ROOT).as_posix()
            if f == "family.json"
            else Path(__file__).parent.relative_to(ROOT).as_posix() + "/" + f
        )
        for f in [
            "build.py",
            "geometry.py",
            "family.json",
            "raw-audit.py",
        ]
    ],
    "sharedComponents": [
        "Blender glTF exporter (same selected-root/y-up/extras/material contract as coupe)",
        "Explicit stable catalog-cycle.py static true-F/R audit; no shared runtime/browser qualification inferred",
        "Own two-wheel actual-body+rider envelope/negative proofs; parent cycle review pending",
        "Raw GLTF depth diagnostic imports only shared CarMeshProjection and CarPixelOutline math; CarMeshAsset not used",
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
            "asymmetry": "Teal rounded tank with cream surface side-panel charts, dark saddle, exposed gray engine, tubular frame and real front/rear fenders. Exactly two independent road wheels F/R; opaque bikeatlas512; Configured rider loaded separately readonly for measured fit/depth diagnostics.",
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
    "raw-audit.py",
]:
    shutil.copy2(
        CONFIG_PATH if file == "family.json" else Path(__file__).with_name(file),
        A / file,
    )
import importlib.util

spec = importlib.util.spec_from_file_location(
    "own_cycle_raw_audit", Path(__file__).with_name("raw-audit.py")
)
raw_audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(raw_audit)
audit = raw_audit.audit_glb(O / "model.glb")
cycle_path = ROOT / "scripts/vehicle-bake/catalog-cycle.py"
assert (
    hashlib.sha256(cycle_path.read_bytes()).hexdigest()
    == CFG["constructionSharedInputs"]["scripts/vehicle-bake/catalog-cycle.py"]
)
cycle_spec = importlib.util.spec_from_file_location("stable_cycle_catalog", cycle_path)
cycle_catalog = importlib.util.module_from_spec(cycle_spec)
cycle_spec.loader.exec_module(cycle_catalog)
cycle_audit = cycle_catalog.audit_glb(O / "model.glb", wheel_ids=["F", "R"])
assert all(
    cycle_audit[k] == audit[k]
    for k in [
        "triangles",
        "vertices",
        "meshes",
        "primitives",
        "materials",
        "textures",
        "sha256",
    ]
)
report = {
    "status": "draft",
    "sourceStage": "prototype-in-progress",
    "normalActivation": "not-authorized; rider identity/AI/fallback gates remain",
    "sharedTwoWheelQualification": "pending parent actual shared loader/browser review",
    "sharedStaticCycleCatalog": cycle_audit,
    "CarMeshAssetUsed": False,
    "rawGLTFDiagnostic": True,
    "artReviewStatus": "awaiting-owner-review",
    "family": VARIANT,
    "route": VARIANT,
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
