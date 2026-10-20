"""Read-only packed motorcycle source, rounded tank and actual GLB UV ownership."""

from pathlib import Path
from collections import Counter, defaultdict
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/touring-motorcycle/v1"
O = ROOT / "public/demos/vehicle-bake/touring-motorcycle/v1"
D = ROOT / "data/vehicle-bake/touring-motorcycle"
S = 80 / 4.6
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = {
    n: sha(A / n) for n in ["master.blend", "car.blend", "atlas.png", "model.glb"]
}


def records(ob, scale):
    ob.data.calc_loop_triangles()
    uv = ob.data.uv_layers.active.data
    return [
        tuple(
            sorted(
                (
                    tuple(
                        c * scale
                        for c in (
                            ob.matrix_world
                            @ ob.data.vertices[ob.data.loops[li].vertex_index].co
                        )
                    ),
                    tuple(uv[li].uv),
                )
                for li in tri.loops
            )
        )
        for tri in ob.data.loop_triangles
    ]


bpy.ops.wm.open_mainfile(filepath=str(A / "master.blend"))
bpy.context.view_layer.update()
source = Counter()
owners = defaultdict(list)
parts = []
for ob in bpy.context.scene.objects:
    if ob.type != "MESH":
        continue
    assert (
        len(ob.data.uv_layers) == 1
        and ob.data.uv_layers.active.name == "Semantic_palette_UV"
    )
    assert ob.get("surface_owner")
    snapshot = ob.copy()
    snapshot.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(snapshot)
    bpy.context.view_layer.objects.active = snapshot
    mod = snapshot.modifiers.new(
        "Read-only explicit runtime triangulation", "TRIANGULATE"
    )
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()
    rr = records(snapshot, S)
    bpy.data.objects.remove(snapshot, do_unlink=True)
    source.update(rr)
    for r in rr:
        owners[r].append(ob["surface_owner"])
    parts.append(
        {
            "owner": ob["surface_owner"],
            "triangles": len(rr),
            "vertices": len(ob.data.vertices),
        }
    )
touring_parts = {}
for label, token, expected in [
    ("tank", "TOURING larger shouldered", 40),
    ("fairing", "TOURING broad cream", 32),
    ("screen", "TOURING tall cool", 8),
    ("pannierLeft", "TOURING closed deep pannier -1", 32),
    ("pannierRight", "TOURING closed deep pannier 1", 32),
]:
    ob = next(
        o for o in bpy.context.scene.objects if o.type == "MESH" and token in o.name
    )
    pp = [ob.matrix_world @ v.co for v in ob.data.vertices]
    assert len(pp) == expected
    lo = [min(p[i] for p in pp) for i in range(3)]
    hi = [max(p[i] for p in pp) for i in range(3)]
    if label.startswith("pannier"):
        assert hi[0] - lo[0] > 0.8 and hi[1] - lo[1] > 0.26 and hi[2] - lo[2] > 0.31
        assert lo[0] > 0.47 and min(abs(lo[1]), abs(hi[1])) > 0.23
    touring_parts[label] = {
        "owner": ob["surface_owner"],
        "vertices": len(pp),
        "minSource": lo,
        "maxSource": hi,
        "actualDepthSource": [hi[i] - lo[i] for i in range(3)],
        "closedVolume": label != "screen",
    }
tire_widths = {}
for wid in ["F", "R"]:
    ob = next(
        o
        for o in bpy.context.scene.objects
        if o.type == "MESH" and o.name == "True motorcycle rounded tire " + wid
    )
    width = max(v.co.y for v in ob.data.vertices) - min(
        v.co.y for v in ob.data.vertices
    )
    assert abs(width - (0.22 if wid == "F" else 0.30)) < 1e-6
    tire_widths[wid] = width
packed = []
for name in ["master.blend", "car.blend"]:
    bpy.ops.wm.open_mainfile(filepath=str(A / name))
    images = [i for i in bpy.data.images if i.packed_file]
    assert len(images) == 2
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert sum(len(records(o, 1)) for o in meshes) == 2496
    if name == "car.blend":
        assert len(meshes) == 3
        assert list(bpy.data.objects["Motorcycle_Root"]["wheel_ids"]) == ["F", "R"]
    packed.append(
        {
            "path": name,
            "sha256": sha(A / name),
            "packedImages": [
                {"name": i.name, "dimensions": list(i.size)} for i in images
            ],
            "meshes": len(meshes),
            "triangles": 2496,
            "semanticUV": True,
        }
    )
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(O / "model.glb"))
bpy.context.view_layer.update()
actual = Counter()
for ob in bpy.context.scene.objects:
    if ob.type == "MESH":
        actual.update(records(ob, 1))
source_tris = list(source.elements())
centers = KDTree(len(source_tris))
for i, tri in enumerate(source_tris):
    centers.insert(sum((Vector(p) for p, q in tri), Vector()) / 3, i)
centers.balance()
used = set()
for tri in actual.elements():
    center = sum((Vector(p) for p, q in tri), Vector()) / 3
    found = next(
        (
            i
            for _, i, _ in centers.find_range(center, 0.0002)
            if i not in used
            and all(
                any(
                    (Vector(p) - Vector(ep)).length < 0.0002
                    and (Vector(q) - Vector(eq)).length < 2e-6
                    for ep, eq in source_tris[i]
                )
                for p, q in tri
            )
        ),
        None,
    )
    assert found is not None, tri
    used.add(found)
assert len(used) == len(source_tris) == sum(actual.values())
assert all(sha(A / n) == h for n, h in before.items())
result = {
    "status": "passed",
    "glbSha256": sha(O / "model.glb"),
    "sourceInputHashes": before,
    "packedScenes": packed,
    "semanticOwners": parts,
    "touringGeometry": touring_parts,
    "actualTireWidthsSource": tire_widths,
    "rearTireWider": tire_widths["R"] > tire_widths["F"],
    "actualTriangleUVMatches": sum(actual.values()),
    "actualCornerPositionAndUVMatches": 3 * sum(actual.values()),
    "allActualGLBTrianglesMatchedToOwnSourceUV": True,
    "method": "Original semantic component master at runtime topology; no high-to-low or bitmap transfer claim",
    "readonlySourceUnchanged": True,
}
(D / "source-audit.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "actualTriangleUVMatches": sum(actual.values()),
            "packedScenes": packed,
        },
        indent=2,
    )
)
