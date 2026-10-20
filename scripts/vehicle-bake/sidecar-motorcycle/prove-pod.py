"""Actual open sidecar floor/seat depth from all triangles, with fill/reset control."""

from pathlib import Path
import hashlib
import json
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/sidecar-motorcycle/v1"
O = ROOT / "public/demos/vehicle-bake/sidecar-motorcycle/v1"
D = ROOT / "data/vehicle-bake/sidecar-motorcycle"
S = 80 / 4.6
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
results = []
for file, scale in [(A / "master.blend", 1), (O / "model.glb", S)]:
    before = sha(file)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if file.suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(file))
    else:
        bpy.ops.import_scene.gltf(filepath=str(file))
    bpy.context.view_layer.update()
    points = []
    faces = []
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        ob.data.calc_loop_triangles()
        offset = len(points)
        points += [ob.matrix_world @ v.co for v in ob.data.vertices]
        faces += [tuple(offset + i for i in t.vertices) for t in ob.data.loop_triangles]
    assert len(faces) == 3418
    stub = [
        p
        for p in points
        if abs(p.y / scale - 0.744) < 1e-5
        and abs(p.x / scale - 0.4) < 0.03
        and abs(p.z / scale - 0.36) < 0.03
    ]
    assert len(stub) >= 8
    if file.suffix == ".blend":
        recipe = json.loads((A / "recipe.json").read_text())
        wheel_meshes = [
            bpy.data.objects[c["name"]]
            for c in recipe["components"]
            if c["group"] == "SC"
        ]
    else:
        wheel_meshes = [
            o
            for o in bpy.data.objects["Wheel_SC_Roll"].children_recursive
            if o.type == "MESH"
        ]
    wheel_points = [
        o.matrix_world @ v.co for o in wheel_meshes for v in o.data.vertices
    ]
    gap_source = min(p.y for p in wheel_points) / scale - max(p.y for p in stub) / scale
    assert 0 < gap_source * S < 0.5

    def tree(extra=[], extra_faces=[]):
        return BVHTree.FromPolygons(
            points + extra, faces + extra_faces, all_triangles=True
        )

    baseline = tree()
    cy = 0.35

    def ray(bvh, x, y, z):
        point, normal, index, distance = bvh.ray_cast(
            Vector((x, y, z)) * scale, Vector((0, 0, -1)), 3 * scale
        )
        assert point is not None, (x, y, z)
        return point.z / scale

    floor = []
    for x in [-0.2, 0, 0.2]:
        for y in [cy - 0.1, cy + 0.1]:
            z = ray(baseline, x, y, 1.4)
            assert abs(z - 0.41) < 1e-5, (x, y, z)
            floor.append(
                {
                    "xySource": [x, y],
                    "actualFloorZSource": z,
                    "depthBelowRimSource": 0.88 - z,
                }
            )
    seat = []
    for y in [cy - 0.1, cy + 0.1]:
        top = ray(baseline, 0.55, y, 1.4)
        below = ray(baseline, 0.55, y, 0.54)
        assert abs(top - 0.67) < 1e-5 and abs(below - 0.41) < 1e-5
        seat.append(
            {
                "xySource": [0.55, y],
                "actualSeatTopSource": top,
                "actualFloorBelowSeatSource": below,
                "seatAboveFloorSource": top - below,
            }
        )
    offset = len(points)
    fixture = [
        Vector((x, y, 0.84)) * scale
        for x, y in [
            (-0.3, cy - 0.2),
            (0.3, cy - 0.2),
            (0.3, cy + 0.2),
            (-0.3, cy + 0.2),
        ]
    ]
    blocked = tree(
        fixture, [(offset, offset + 1, offset + 2), (offset, offset + 2, offset + 3)]
    )
    assert all(abs(ray(blocked, *r["xySource"], 1.4) - 0.84) < 1e-5 for r in floor)
    assert all(
        abs(ray(baseline, *r["xySource"], 1.4) - r["actualFloorZSource"]) < 1e-7
        for r in floor
    )
    assert sha(file) == before
    results.append(
        {
            "input": file.relative_to(ROOT).as_posix(),
            "sha256": before,
            "status": "passed",
            "allCandidateTriangles": len(faces),
            "actualFloorRays": floor,
            "actualSeatRays": seat,
            "fillNegative": {
                "addedTriangles": 2,
                "candidateTrianglesRemoved": 0,
                "blockedFloorRays": 6,
                "rejected": True,
                "baselineRestoredExact": True,
            },
            "sourceBytesUnchanged": True,
            "actualFixedAxleAttachment": {
                "matchingStubEndVertices": len(stub),
                "gapSource": gap_source,
                "gapWorldPixels": gap_source * S,
                "subpixelAttachedGap": True,
            },
        }
    )
result = {
    "status": "passed",
    "glbSha256": sha(O / "model.glb"),
    "results": results,
    "emptyPassengerWell": True,
    "noPassengerFunctionOrArticulationClaim": True,
}
(D / "pod-depth-proof.json").write_text(
    json.dumps(result, indent=2) + "\n", encoding="utf-8"
)
print(
    json.dumps(
        {
            "status": "passed",
            "sourceAndActualGLB": True,
            "depthSource": 0.47,
            "seatAboveFloor": 0.26,
            "floorRaysEach": 6,
            "fillNegatives": 2,
        }
    )
)
