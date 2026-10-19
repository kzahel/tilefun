"""Accepted-coupe paint variation, deterministic Blender 5.2 background constructor.

Read-only pinned committed base inputs; -- --scratch replays retained source.
Existing base skin UV/positions, wheel transforms and rig remain unchanged.
"""

from pathlib import Path
import hashlib
import json
import shutil
import struct
import sys
import zlib

import bpy
import numpy as np

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / "family.json").read_text())
SCRATCH = "--scratch" in sys.argv
A = ROOT / (
    "data/vehicle-bake/race-coupe/replay/source"
    if SCRATCH
    else "art-source/vehicle-bake/race-coupe/v1"
)
O = ROOT / (
    "data/vehicle-bake/race-coupe/replay/public"
    if SCRATCH
    else "public/demos/vehicle-bake/race-coupe/v1"
)
for p in [A, O, A / "evidence"]:
    p.mkdir(parents=True, exist_ok=True)
if (O / "report.json").exists():
    assert (
        json.loads((O / "report.json").read_text())["status"] != "complete"
    ), "Finished revision immutable"
for path, expected in CFG["baseHashes"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path


def png(path, pixels):
    h, w = pixels.shape[:2]

    def chunk(k, v):
        return (
            struct.pack(">I", len(v))
            + k
            + v
            + struct.pack(">I", zlib.crc32(k + v) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\0" + row.tobytes() for row in pixels)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


bpy.ops.wm.open_mainfile(filepath=str(ROOT / CFG["baseBlend"]))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
root = bpy.data.objects["Coupe_export_root"]
assert tuple(root.scale) == (1, 1, 1) and all(
    abs(v) < 1e-8 for v in root.rotation_euler
)
bpy.context.view_layer.update()
body = bpy.data.objects["Body_static"]
base_recipe = json.loads((ROOT / CFG["baseRecipe"]).read_text())
source_components = base_recipe["components"]
base_meshes = [o for o in scene.objects if o.type == "MESH"]
assert len(base_meshes) == 5


def mesh_digest(obj):
    # Ordered source geometry, topology, exact UV coordinates and local pose.
    m = obj.data
    uv = m.uv_layers.active.data
    data = {
        "vertices": [list(v.co) for v in m.vertices],
        "faces": [list(f.vertices) for f in m.polygons],
        "uv": [list(v.uv) for v in uv],
        "matrixBasis": [list(row) for row in obj.matrix_basis],
        "parent": obj.parent.name if obj.parent else None,
    }
    return hashlib.sha256(json.dumps(data, separators=(",", ":")).encode()).hexdigest()


base_geometry = {o.name: mesh_digest(o) for o in base_meshes}
base_wheels = {o.name: mesh_digest(o) for o in base_meshes if o != body}
base_body_vertices = len(body.data.vertices)
base_body_polygons = len(body.data.polygons)
image = bpy.data.images.load(str(ROOT / CFG["baseAtlas"]), check_existing=False)
original = (
    np.rint(np.array(image.pixels[:]).reshape(512, 512, 4) * 255)
    .astype(np.uint8)[::-1]
    .copy()
)
atlas = original.copy()
protected = np.zeros((512, 512), bool)
occupied = np.zeros((512, 512), bool)
owned = np.full((512, 512), -1, np.int32)
points = np.zeros((512, 512, 3), np.float64)
normals = np.zeros((512, 512, 3), np.float64)
body_kind = {i for i, c in enumerate(source_components) if c["kind"] == "body"}
body_kind.update([100, 101, 102, 103])


def raster(obj):
    m = obj.data
    m.calc_loop_triangles()
    uv = m.uv_layers.active.data
    owner = m.attributes["source_owner"]
    for tri in m.loop_triangles:
        sid = owner.data[tri.polygon_index].value
        guard = obj != body or sid not in body_kind
        coords = np.array(
            [[uv[li].uv.x * 512, (1 - uv[li].uv.y) * 512] for li in tri.loops]
        )
        xyz = np.array(
            [list(obj.matrix_world @ m.vertices[j].co) for j in tri.vertices]
        )
        for x, y in coords:
            ix, iy = min(511, max(0, int(x))), min(511, max(0, int(y)))
            occupied[iy, ix] = True
            if guard:
                protected[iy, ix] = True
        a, b, c = coords
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-8:
            continue
        lo = np.maximum(np.floor(coords.min(axis=0)).astype(int), 0)
        hi = np.minimum(np.ceil(coords.max(axis=0)).astype(int), 511)
        for y in range(lo[1], hi[1] + 1):
            for x in range(lo[0], hi[0] + 1):
                u = (
                    (b[1] - c[1]) * (x + 0.5 - c[0]) + (c[0] - b[0]) * (y + 0.5 - c[1])
                ) / den
                v = (
                    (c[1] - a[1]) * (x + 0.5 - c[0]) + (a[0] - c[0]) * (y + 0.5 - c[1])
                ) / den
                w = 1 - u - v
                if min(u, v, w) < -1e-6:
                    continue
                occupied[y, x] = True
                if guard:
                    protected[y, x] = True
                else:
                    owned[y, x] = sid
                    points[y, x] = xyz[0] * u + xyz[1] * v + xyz[2] * w
                    normals[y, x] = tri.normal


for obj in base_meshes:
    raster(obj)
# Preserve non-coachwork islands and a 2px guard apron around their sampling area.
for _ in range(2):
    prior = protected.copy()
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        protected |= np.roll(prior, (dy, dx), (0, 1))
red_texels = np.zeros((512, 512), bool)
for rgb, new in CFG["recolor"].items():
    color = np.array([int(v) for v in rgb.split(",")])
    take = np.all(original[:, :, :3] == color, axis=2) & ~protected
    atlas[take, :3] = new
    red_texels |= take
eligible = (owned >= 0) & red_texels & ~protected
lo, hi = CFG["stripeAbsY"]
stripe = (
    eligible
    & np.isin(owned, CFG["stripeSurfaceOwners"])
    & (np.abs(points[:, :, 1]) >= lo)
    & (np.abs(points[:, :, 1]) <= hi)
    & (points[:, :, 2] >= CFG["stripeMinimumZ"])
    & (normals[:, :, 2] >= CFG["stripeMinimumNormalZ"])
)
roundel = CFG["roundel"]
cx, cz = roundel["centerXZ"]
circle = (
    eligible
    & (owned == roundel["owner"])
    & (np.abs(points[:, :, 1]) >= roundel["minimumAbsY"])
    & (np.abs(normals[:, :, 1]) >= roundel["minimumAbsNormalY"])
    & (
        (points[:, :, 0] - cx) ** 2 + (points[:, :, 2] - cz) ** 2
        <= roundel["radius"] ** 2
    )
)
atlas[stripe | circle, :3] = CFG["cream"]
assert np.array_equal(atlas[protected], original[protected])

# A dedicated free atlas rectangle gives new spoiler faces their own bounded UV
# owner without moving any original UV. Guard/padding included in the vacancy.
rect = None
for y in range(4, 512 - 12):
    for x in range(4, 512 - 20):
        if not occupied[y - 2 : y + 10, x - 2 : x + 18].any():
            rect = (x, y)
            break
    if rect:
        break
assert rect, "No free padded spoiler swatches"
sx, sy = rect
atlas[sy : sy + 8, sx : sx + 8] = (*CFG["blueLight"], 255)
atlas[sy : sy + 8, sx + 8 : sx + 16] = (*CFG["blueDeep"], 255)
assert not occupied[sy - 2 : sy + 10, sx - 2 : sx + 18].any()
png(A / "atlas.png", atlas)
shutil.copyfile(A / "atlas.png", O / "atlas.png")
png(A / "palette-draft.png", original)
png(
    A / "evidence/stripe-mask.png",
    np.stack(
        [stripe.astype(np.uint8) * 255] * 3
        + [np.full_like(stripe, 255, dtype=np.uint8)],
        axis=2,
    ),
)
png(
    A / "evidence/roundel-mask.png",
    np.stack(
        [circle.astype(np.uint8) * 255] * 3
        + [np.full_like(circle, 255, dtype=np.uint8)],
        axis=2,
    ),
)
png(
    A / "evidence/protected-mask.png",
    np.stack(
        [protected.astype(np.uint8) * 255] * 3
        + [np.full_like(protected, 255, dtype=np.uint8)],
        axis=2,
    ),
)
mat = body.data.materials[0]
paint_image = bpy.data.images.load(str(A / "atlas.png"), check_existing=False)
paint_image.pack()
for node in mat.node_tree.nodes:
    if node.type == "TEX_IMAGE":
        node.image = paint_image
        node.interpolation = "Closest"
        node.extension = "EXTEND"
planning = bpy.data.images.load(str(A / "palette-draft.png"), check_existing=False)
planning.name = "Unused pinned red-base palette planning draft"
planning.pack()
planning.use_fake_user = True
for im in list(bpy.data.images):
    if im not in [paint_image, planning] and not im.users:
        bpy.data.images.remove(im)

spoiler_objects = []


def spoiler_box(name, loc, size, role, sid):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    bevel = ob.modifiers.new("Modest softened spoiler corners", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    ob.parent = root
    ob.data.materials.append(mat)
    for layer in list(ob.data.uv_layers):
        ob.data.uv_layers.remove(layer)
    uv = ob.data.uv_layers.new(name=body.data.uv_layers.active.name)
    attr = ob.data.attributes.new("source_owner", "INT", "FACE")
    for f in ob.data.polygons:
        attr.data[f.index].value = sid
        for li in f.loop_indices:
            p = ob.data.vertices[ob.data.loops[li].vertex_index].co
            x, y = (sx + 4, sy + 4) if role == "blade" else (sx + 12, sy + 4)
            uv.data[li].uv = (x / 512, 1 - y / 512)
    tri = ob.modifiers.new("Explicit spoiler triangles", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=tri.name)
    spoiler_objects.append(ob)


sp = CFG["spoiler"]
spoiler_box(
    "STATIC modest rear racing spoiler blade",
    sp["bladeCenter"],
    sp["bladeSize"],
    "blade",
    200,
)
for i, side in enumerate([-1, 1]):
    bottom, top = sp["supportBottom"], sp["supportTop"]
    spoiler_box(
        "STATIC rear spoiler deck-mounted foot " + str(side),
        (sp["supportX"], side * sp["supportY"], (bottom + top) / 2),
        (0.10, 0.09, top - bottom),
        "foot",
        201 + i,
    )
# Preserve a semantic master before consolidation. Original source_owner face
# attributes retain editable accepted-coupe components; new equipment is separate.
scene.render.threads_mode = "FIXED"
scene.render.threads = 4
bpy.ops.wm.save_as_mainfile(filepath=str(A / "master.blend"))
assert all(mesh_digest(o) == base_geometry[o.name] for o in base_meshes)
bpy.ops.object.select_all(action="DESELECT")
for ob in [body, *spoiler_objects]:
    ob.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
assert (
    len(body.data.vertices) > base_body_vertices
    and len(body.data.polygons) > base_body_polygons
)
assert all(
    mesh_digest(bpy.data.objects[name]) == expected
    for name, expected in base_wheels.items()
)
S = CFG["exportWorldScale"]
root.scale = (S,) * 3
bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for ob in root.children_recursive:
    ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(O / "model.glb"),
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_materials="EXPORT",
)
shutil.copyfile(O / "model.glb", A / "model.glb")
root.scale = (1, 1, 1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(A / "car.blend"))
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

audit = audit_glb(O / "model.glb")
assert audit["triangles"] <= 2800 and (
    audit["meshes"],
    audit["primitives"],
    audit["materials"],
    audit["textures"],
) == (5, 5, 1, 1)
recipe = {
    **CFG,
    "baseGeometrySignatures": base_geometry,
    "baseWheelSignatures": base_wheels,
    "baseBodyVertices": base_body_vertices,
    "baseBodyPolygons": base_body_polygons,
    "newSpoilerOwners": [200, 201, 202],
    "spoilerChartPixels": [sx, sy, 16, 8],
    "paintTexelCounts": {
        "redRampChanged": int(red_texels.sum()),
        "stripes": int(stripe.sum()),
        "roundels": int(circle.sum()),
        "protectedUnchanged": int(protected.sum()),
    },
    "baseUVUnchanged": True,
    "baseWheelGeometryUVPoseUnchanged": True,
    "masterMeaning": "Editable accepted runtime-topology component master with retained source_owner semantic face attributes and separate new static spoiler parts; no high-to-low transfer claim.",
}
for dest in [A / "recipe.json", O / "recipe.json"]:
    dest.write_text(json.dumps(recipe, indent=2) + "\n")
ownership = {
    "method": CFG["paintMethod"],
    "baseHashes": CFG["baseHashes"],
    "sourceComponents": source_components,
    "newSpoilerOwners": {
        "200": "STATIC blade, own reserved free atlas chart",
        "201": "STATIC deck-mounted foot -1",
        "202": "STATIC deck-mounted foot 1",
    },
    "preserved": "Exact accepted body/wheel geometry and UVs; wheel transforms, source_owner attributes and four Steer/Roll parents. Guarded glass/ink/lamps/chrome/intake/tire atlas samples unchanged.",
    "paint": "Six exact red coachwork ramp colors replaced by royal blue; barycentric triangle UV raster recovers source-world positions and normals for two absY stripe bands and side XZ roundels. Protected source owners and colors block markings. No camera or screen samples used.",
    "originalUVsUnchanged": True,
    "protectedTexelsUnchanged": True,
    "exteriorInk": "Shared RGB58,58,80 silhouette pass only; atlas retains inherited internal frames and ink.",
    "atlasPalette": sorted(
        {tuple(int(v) for v in p[:3]) for p in atlas.reshape(-1, 4)}
    ),
}
(A / "paint-ownership.json").write_text(json.dumps(ownership, indent=2) + "\n")
for name in ["build.py", "family.json", "coverage-region.json", "review.json"]:
    shutil.copyfile(HERE / name, A / name)
report = {
    "status": "draft",
    "artReviewStatus": "agent-QA pending; no formal human approval",
    "family": "race-coupe",
    "route": "race-coupe",
    "revision": "v1",
    "method": CFG["paintMethod"],
    "geometry": audit,
    "exportWorldScale": S,
    "baseHashes": CFG["baseHashes"],
    "wheels": base_recipe["wheels"],
    "atlasSize": [512, 512],
    "sourceBlend": (A / "car.blend").relative_to(ROOT).as_posix(),
    "masterBlend": (A / "master.blend").relative_to(ROOT).as_posix(),
    "recipe": (A / "recipe.json").relative_to(ROOT).as_posix(),
    "render": CFG["render"],
    "renderThreads": 4,
}
(O / "report.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {
            "audit": audit,
            "paint": recipe["paintTexelCounts"],
            "spoilerChart": recipe["spoilerChartPixels"],
        },
        indent=2,
    )
)
