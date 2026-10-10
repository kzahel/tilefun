"""Refine an isolated compact template with continuous windows and real fenders.

Load a COPY of the 085 scene; pass -- out-directory config.json base-atlas.png.
The 1024 atlas retains the old 512 atlas at top-left and allocates distinct new
islands. Source cameras are used to author shared, symmetric window geometry.
"""
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--")+1:]
out, config_path, base_atlas = map(Path, args)
out.mkdir(parents=True, exist_ok=False)
root = Path(__file__).resolve().parents[2]
config = json.loads(config_path.read_text())
cameras = json.loads((root / config["referenceCameraPreset"]).read_text())["cameras"]
size = config["atlasSize"]
if size != 1024:
    raise ValueError("This compact-family island layout requires a 1024-square atlas.")
mat = bpy.data.materials["Sprite palette · cleaned UV atlas"]
before = {o.name: [list(v.co) for v in o.data.vertices] for o in bpy.context.scene.objects if o.type == "MESH"}
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        for layer in obj.data.uv_layers:
            for loop in layer.data:
                loop.uv = (loop.uv.x/2, .5+loop.uv.y/2)
image = bpy.data.images.load(str(base_atlas.resolve()), check_existing=False)
image.pack()
mat.node_tree.nodes["Clean atlas"].image = image
added = []
source_views = {}


def mesh(name, vertices, faces, coords, rect, region, owner):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    editable = bmesh.new()
    editable.from_mesh(data)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(data)
    editable.free()
    uv = data.uv_layers.new(name="CompactAtlasV2")
    original = {frozenset(face): dict(zip(face, mapping)) for face, mapping in zip(faces, coords)}
    x0, y0, x1, y1 = rect
    for face in data.polygons:
        mapping = original[frozenset(face.vertices)]
        for loop in face.loop_indices:
            u, v = mapping[data.loops[loop].vertex_index]
            uv.data[loop].uv = ((x0+u*(x1-x0))/size, 1-(y0+v*(y1-y0))/size)
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj["uv_region"] = region
    obj["provenance"] = "Authored compact-family window/fender refinement; original-pixel paint remains a draft"
    source_views[region] = [owner]
    added.append({"name": name, "region": region, "rect": rect, "ownerView": owner,
                  "vertices": len(vertices), "faces": len(faces)})


# The complete side-window frame is one planar surface across the old shell seam.
# Its upper glass is inset relative to the outer fender edge; the side doors keep
# their original cabin/body shell underneath. The two explicit panels retain a
# central pillar gap and do not flatten the whole side into a source image card.
plane = config["windowPlane"]
for side, label, direction in [(-1, "left", "east"), (1, "right", "west")]:
    camera = cameras[direction]
    e = math.radians(camera["elevation"])
    sx, sy = camera["horizontalScale"], camera["horizontalScale"]*camera["verticalStretch"]
    cx, cy = camera["origin"]
    for index, (part, east_outline) in enumerate(config["windowOutlinesEast"].items()):
        outline = east_outline if side == -1 else [[64-u, v+1] for u, v in east_outline]
        vertices = []
        for u, v in outline:
            x = (u-cx)/(sx if side == -1 else -sx)
            z = (cy+sy*math.sin(e)*(plane["widthIntercept"]+plane["outset"])-v) / (sy*(math.cos(e)+math.sin(e)*plane["widthPerHeight"]))
            y = side*(plane["widthIntercept"]-plane["widthPerHeight"]*z+plane["outset"])
            vertices.append((x, y, z))
        u0, u1 = min(p[0] for p in outline), max(p[0] for p in outline)
        v0, v1 = min(p[1] for p in outline), max(p[1] for p in outline)
        mapping = [[(u-u0)/(u1-u0), (v-v0)/(v1-v0)] for u, v in outline]
        col = index+(0 if side == -1 else 2)
        rect = [16+col*256, 704, 240+col*256, 832]
        mesh(f"Window and frame · {label} · {part}", vertices, [list(range(len(vertices)))],
             [mapping], rect, f"window-{label}-{part}", direction)

# Three continuous bevel/wheel-well bands with depth, curved over each tire.
fender = config["fender"]
segments, profile = fender["segments"], fender["profile"]
for side, label, direction in [(-1, "left", "east"), (1, "right", "west")]:
    for index, axle in enumerate(fender["axles"]):
        vertices, faces, mapping = [], [], []
        for k in range(segments+1):
            angle = math.pi*k/segments
            for radius, width in profile:
                if width > fender["endWidth"]:
                    width = fender["endWidth"] + (width-fender["endWidth"])*math.sin(angle)**fender["flareExponent"]
                vertices.append((axle+radius*math.cos(angle), side*width, fender["centerHeight"]+radius*math.sin(angle)))
        count = len(profile)
        for k in range(segments):
            for band in range(count-1):
                faces.append([k*count+band, (k+1)*count+band, (k+1)*count+band+1, k*count+band+1])
                mapping.append([(k/segments, band/(count-1)), ((k+1)/segments, band/(count-1)),
                                ((k+1)/segments, (band+1)/(count-1)), (k/segments, (band+1)/(count-1))])
        col = index+(0 if side == -1 else 2)
        rect = [16+col*256, 544, 240+col*256, 672]
        mesh(f"Raised fender · {label} · {axle}", vertices, faces, mapping, rect, f"fender-{label}-{index}", direction)

for name, vertices in before.items():
    assert vertices == [list(v.co) for v in bpy.data.objects[name].data.vertices], name
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co)
        assert min(v.co.z for v in obj.data.vertices) >= -1e-5
bpy.context.scene["review_status"] = "Unreviewed compact window/fender prototype; original geometry preserved underneath"
bpy.ops.wm.save_as_mainfile(filepath=str(out / "car.blend"))
(out / "geometry-refinement.json").write_text(json.dumps({"configSha256": hashlib.sha256(config_path.read_bytes()).hexdigest(),
    "cameraPresetSha256": hashlib.sha256((root/config["referenceCameraPreset"]).read_bytes()).hexdigest(),
    "originalMeshesPreserved": len(before), "added": added, "sourceViews": source_views}, indent=2)+"\n")
print("Added four continuous window/frame panels and four raised fender meshes", flush=True)
