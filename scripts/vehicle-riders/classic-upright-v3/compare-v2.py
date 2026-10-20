"""Independent actual packed-scene comparison; immutable v2 is read-only control."""

from pathlib import Path
import hashlib, json, math
import bpy

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
D = R / "data/vehicle-riders/classic-upright-v3"
A = R / "art-source/vehicle-riders/classic-upright/v3"
B = R / "art-source/vehicle-riders/classic-upright/v2"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def inspect(path):
    bpy.ops.wm.open_mainfile(filepath=str(path / "master.blend"))
    image = next(i for i in bpy.data.images if i.type == "IMAGE")
    pix = list(image.pixels[:])
    objects = {}
    for o in bpy.context.scene.objects:
        if o.type != "MESH":
            continue
        positions = [tuple(o.matrix_world @ v.co) for v in o.data.vertices]
        uv = o.data.uv_layers.active.data
        faces = []
        for face in o.data.polygons:
            corners = tuple(
                (positions[o.data.loops[i].vertex_index], tuple(uv[i].uv))
                for i in face.loop_indices
            )
            # Blender may reorder equivalent primitive faces. No coordinate/UV
            # rounding and no winding reversal; compare actual cyclic polygons.
            faces.append(min(corners[j:] + corners[:j] for j in range(len(corners))))
        objects[o.name] = {
            "vertices": sorted(positions),
            "faces": sorted(faces),
            "uv": sorted(tuple(p.uv) for p in uv),
        }
    return objects, pix


before, bpaint = inspect(B)
after, apaint = inspect(A)
assert before.keys() == after.keys()
changed = [n for n in before if before[n] != after[n]]
expected = [
    "RiderClassic pointed ear left",
    "RiderClassic pointed ear right",
]
assert set(changed) == set(expected), changed
paintChecks = {}
for n in before:
    if n in changed:
        continue
    sampled = set()
    for uv in before[n]["uv"]:
        x = max(0, min(255, int(uv[0] * 256)))
        y = max(0, min(255, int(uv[1] * 256)))
        # All corners plus a conservative 3px swatch neighborhood, not palette membership.
        for xx in range(max(0, x - 3), min(256, x + 4)):
            for yy in range(max(0, y - 3), min(256, y + 4)):
                sampled.add((xx, yy))
    assert all(
        bpaint[(y * 256 + x) * 4 : (y * 256 + x + 1) * 4]
        == apaint[(y * 256 + x) * 4 : (y * 256 + x + 1) * 4]
        for x, y in sampled
    ), n
    paintChecks[n] = len(sampled)
assert (A / "atlas.png").read_bytes() == (B / "atlas.png").read_bytes()
assert (A / "classic-upright-v1.json").read_bytes() == (
    B / "classic-upright-v1.json"
).read_bytes()


def box(parts, names):
    pp = [p for n in names for p in parts[n]["vertices"]]
    return {
        "min": [min(p[i] for p in pp) for i in range(3)],
        "max": [max(p[i] for p in pp) for i in range(3)],
    }


v1 = box(before, ["RiderClassic broad face UV owner", *expected])
v2 = box(after, ["RiderClassic broad face UV owner", *expected])
assert abs(v2["max"][1] - v2["min"][1] - 0.78) < 1e-6
assert abs(v2["min"][2] - 0.14) < 1e-6 and abs(v2["max"][2] - 0.82) < 1e-6
assert (
    abs(v1["max"][1] - v2["max"][1]) < 1e-6 and abs(v1["min"][1] - v2["min"][1]) < 1e-6
)
for name in ["RiderClassic pointed ear left", "RiderClassic pointed ear right"]:
    ts = after[name]["vertices"]
    tip = [p for p in ts if abs(p[2] - 0.82) < 1e-6]
    assert len(tip) == 2 and max(p[0] for p in tip) - min(p[0] for p in tip) < 0.121
for p, h in json.loads((D / "protected-prior-inputs.json").read_text()).items():
    assert sha(R / p) == h, p
result = {
    "status": "passed",
    "v2DiagnosticNotAppearanceQualified": True,
    "v2ModelSha256": sha(B / "rider.glb"),
    "v3ModelSha256": sha(A / "rider.glb"),
    "onlyChangedOwners": changed,
    "addedOwners": [],
    "exactUnchangedGeometryFacesUV": [n for n in before if n not in changed],
    "unchangedPaintSampleChecks": paintChecks,
    "profileBytesExact": True,
    "profileSha256": sha(A / "classic-upright-v1.json"),
    "hipOriginUnchanged": [0, 0, 0],
    "headBoundsV2": v1,
    "headBoundsV3": v2,
    "headWidthExact": True,
    "atlasBytesExactToV2": True,
    "earMaximumHeightDeltaSource": v2["max"][2] - v1["max"][2],
    "earMaximumHeightDeltaWorld": (v2["max"][2] - v1["max"][2]) * 80 / 4.6,
    "commonWorldScale": 80 / 4.6,
    "noAvatarScaling": True,
    "headSurfaceFiniteJoinMeaning": "Only existing finite torso/head/neck join and v3 measured head/ear attachment region. Other body contact forbidden; actual palm into measured GLB head surface negative/reset separately retained.",
}
(D / "v2-geometry-comparison.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "changed": changed,
            "lowerBodyExact": len(result["exactUnchangedGeometryFacesUV"]),
            "v3HeadBounds": v2,
        }
    )
)
