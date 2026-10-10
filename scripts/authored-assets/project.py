"""Visibility-aware original-pixel draft into authored UVs; never invent coverage.

Runs inside Blender. Requires an explicit single atlas material. Shared UV texels
on distinct surfaces are marked ambiguous rather than silently overwritten.
"""
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from projection_math import project

OUT = Path(sys.argv[sys.argv.index("--") + 1])
recipe = json.loads((OUT / "recipe.json").read_text())
settings = recipe["projection"]
size = settings["atlasSize"]
if type(size) is not int or not 16 <= size <= 2048:
    raise ValueError("Use an atlasSize integer from 16 to 2048.")
material = bpy.data.materials[settings["material"]]
all_meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render]
targets = [o for o in all_meshes if material in list(o.data.materials)]
if not targets:
    raise ValueError("No visible mesh uses the selected projection material.")
if any(o.modifiers for o in all_meshes):
    raise ValueError("Apply modifiers in the working copy before projection; this baker requires authored mesh topology.")

vertices, faces = [], []
for obj in all_meshes:
    start = len(vertices)
    vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
    faces.extend([[start+i for i in p.vertices] for p in obj.data.polygons])
bvh = BVHTree.FromPolygons(vertices, faces)
distance = max(1000, max(v.length for v in vertices)*4)
views = []
for view in recipe["views"]:
    image = bpy.data.images.load(view["source"], check_existing=False)
    image.colorspace_settings.name = "Non-Color"  # Sample original bytes; Pillow writes the resulting RGBA.
    iw, ih = image.size
    pixels = np.empty(iw*ih*4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = np.clip(np.rint(pixels.reshape(ih, iw, 4)*255), 0, 255).astype(np.uint8)[::-1]
    a, e = map(math.radians, [view["camera"]["azimuth"], view["camera"]["elevation"]])
    direction = Vector((math.cos(a)*math.cos(e), math.sin(a)*math.cos(e), math.sin(e)))
    views.append((view, pixels, direction))

# Status: 0 gutter, 1 observed, 2 unseen, 3 overlapping UV surfaces, 4 disagreeing views.
status = np.zeros((size, size), dtype=np.uint8)
positions = np.full((size, size, 3), np.nan, dtype=np.float32)
atlas = np.full((size, size, 4), [207, 111, 155, 255], dtype=np.uint8)
for obj in targets:
    choices = settings.get("sourceViews", {}).get(obj.get("uv_region", obj.name))
    if choices is not None and any(name not in {view["id"] for view in recipe["views"]} for name in choices):
        raise ValueError(f"{obj.name}: sourceViews names an unknown source view.")
    uv = obj.data.uv_layers.active
    if not uv:
        raise ValueError(f"{obj.name}: author UV islands before projecting.")
    obj.data.calc_loop_triangles()
    for tri in obj.data.loop_triangles:
        if obj.data.materials[tri.material_index] != material:
            continue
        coords = np.array([[uv.data[k].uv.x*size, (1-uv.data[k].uv.y)*size] for k in tri.loops])
        if (coords < -1e-5).any() or (coords > size+1e-5).any():
            raise ValueError(f"{obj.name}: selected atlas UVs must be inside 0..1.")
        world = [obj.matrix_world @ obj.data.vertices[k].co for k in tri.vertices]
        normal = (world[1]-world[0]).cross(world[2]-world[0]).normalized()
        a, b, c = coords
        det = (b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
        if abs(det) < 1e-6:
            continue
        x0, y0 = np.maximum(0, np.floor(coords.min(axis=0))).astype(int)
        x1, y1 = np.minimum(size-1, np.ceil(coords.max(axis=0))).astype(int)
        for y in range(y0, y1+1):
            for x in range(x0, x1+1):
                dx, dy = x+.5-a[0], y+.5-a[1]
                wb = (dx*(c[1]-a[1])-(c[0]-a[0])*dy)/det
                wc = ((b[0]-a[0])*dy-dx*(b[1]-a[1]))/det
                if min(wb, wc, 1-wb-wc) < -1e-6:
                    continue
                point = world[0]*(1-wb-wc)+world[1]*wb+world[2]*wc
                if status[y, x]:
                    if status[y, x] == 3 or np.linalg.norm(positions[y, x]-np.array(point)) > .25:
                        status[y, x] = 3
                        atlas[y, x] = [228, 152, 73, 255]
                    continue
                positions[y, x] = point
                status[y, x] = 2
                samples = []
                for view, pixels, direction in views:
                    if choices is not None and view["id"] not in choices:
                        continue
                    facing = abs(normal.dot(direction))
                    if facing < .15:
                        continue
                    hit, _, _, _ = bvh.ray_cast(point+direction*distance, -direction, distance+1)
                    if hit is None or (hit-point).length > .15:
                        continue
                    u, v = project(point, view["camera"])
                    u = math.floor(u-view["offset"][0])
                    v = math.floor(v-view["offset"][1])
                    if 0 <= u < pixels.shape[1] and 0 <= v < pixels.shape[0] and pixels[v, u, 3] >= 200:
                        samples.append((facing, pixels[v, u]))
                if samples:
                    samples.sort(key=lambda pair: pair[0], reverse=True)
                    atlas[y, x] = [*samples[0][1][:3], 255]
                    status[y, x] = 1
                    # Keep the best observed sample, but report disagreements for cleanup.
                    if any(np.max(np.abs(s[1][:3].astype(int)-samples[0][1][:3].astype(int))) > 32 for s in samples[1:]):
                        status[y, x] = 4

coverage = np.zeros_like(atlas)
colors = {0: [41, 46, 56, 255], 1: [83, 176, 131, 255], 2: [207, 111, 155, 255],
          3: [228, 152, 73, 255], 4: [232, 211, 75, 255]}
for code, color in colors.items():
    coverage[status == code] = color
(OUT / "projection-draft.rgba").write_bytes(atlas.tobytes())
(OUT / "projection-coverage.rgba").write_bytes(coverage.tobytes())
node = material.node_tree.nodes.get(settings.get("textureNode", ""))
fill_record = None
if node and node.type == "TEX_IMAGE" and node.image and tuple(node.image.size) == (size, size):
    # Retain authored paint separately; it is never counted as observed coverage.
    original = node.image
    original.colorspace_settings.name = "Non-Color"
    paint = np.empty(size*size*4, dtype=np.float32)
    original.pixels.foreach_get(paint)
    paint = np.clip(np.rint(paint.reshape(size, size, 4)*255), 0, 255).astype(np.uint8)[::-1]
    filled = atlas.copy()
    unknown = np.isin(status, [0, 2, 3])
    filled[unknown] = paint[unknown]
    (OUT / "projection-with-authored-fill.rgba").write_bytes(filled.tobytes())
    fill_record = {"image": original.name, "filledUVTexels": int(unknown.sum()),
                   "meaning": "Existing authored atlas fills gutter/unseen/overlapping UV regions only. Coverage status remains unchanged; this is inferred paint, not source recovery."}
counts = {str(code): int((status == code).sum()) for code in colors}
(OUT / "coverage.json").write_text(json.dumps({"counts": counts, "legend": {str(k): v for k, v in
    {0: "unused UV/gutter", 1: "visible source sample", 2: "unobserved", 3: "overlapping UV surfaces", 4: "source-view color disagreement"}.items()},
    "authoredFill": fill_record,
    "sourceViews": settings.get("sourceViews", {}),
    "interpretation": "Counts measure UV texels, not surface area, accuracy or acceptance. Disagreements retain the most face-on visible original pixel and remain marked. Unknown and overlapping regions require authored cleanup. Gutters are not padded by this draft baker."}, indent=2)+"\n")
print("Baked original pixels with ray visibility and explicit unknown/conflict mask", flush=True)
