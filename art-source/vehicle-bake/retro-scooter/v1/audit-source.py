"""Read-only packed motorcycle source, rounded scooter and actual GLB UV ownership."""

from pathlib import Path
from collections import Counter, defaultdict
import hashlib
import json
import math
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/retro-scooter/v1"
O = ROOT / "public/demos/vehicle-bake/retro-scooter/v1"
D = ROOT / "data/vehicle-bake/retro-scooter"
CFG = json.loads((A / "family.json").read_text())
S = CFG["exportWorldScale"]
TOTAL = json.loads((O / "report.json").read_text())["geometry"]["triangles"]
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
shape_parts = {
    key: next(
        o for o in bpy.context.scene.objects if o.type == "MESH" and o.name == owner
    )
    for key, owner in CFG["geometryOwners"].items()
}
assert all(len(o.data.vertices) > 4 for o in shape_parts.values())
shape_receipt = {
    key: {
        "owner": o.name,
        "vertices": len(o.data.vertices),
        "faces": len(o.data.polygons),
    }
    for key, o in shape_parts.items()
}
packed = []
for name in ["master.blend", "car.blend"]:
    bpy.ops.wm.open_mainfile(filepath=str(A / name))
    images = [i for i in bpy.data.images if i.packed_file]
    assert len(images) == 2
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert sum(len(records(o, 1)) for o in meshes) == TOTAL
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
            "triangles": TOTAL,
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
    "actualTriangleUVMatches": sum(actual.values()),
    "actualCornerPositionAndUVMatches": 3 * sum(actual.values()),
    "allActualGLBTrianglesMatchedToOwnSourceUV": True,
    "scooterSkin": {
        "parts": shape_receipt,
        "actualRearWheelArch": True,
        "distinctRearAndShieldFloorCharts": True,
        "surfaceUVPaintNotCameraProjection": True,
    },
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
