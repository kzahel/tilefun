"""Deterministic, role-owned vehicle paint study; never edits the base assets.

python scripts/vehicle-bake/paint-variants.py build [--output-root data/...]
python scripts/vehicle-bake/paint-variants.py verify
Requires Pillow only. Mesh/rig/UV bytes stay exact; only the embedded PNG changes.
"""

import argparse
import copy
import hashlib
import io
import json
import math
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "scripts/vehicle-bake/paint-variants-v1.json"
SOURCE = Path("art-source/vehicle-bake/paint-study/v1")
PUBLIC = Path("public/demos/original-vehicles/paint-study-v1")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, indent=2) + "\n").encode())


def decode(data):
    magic, version, length = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    gltf = json.loads(data[20:20 + size])
    offset = 20 + size
    size, kind = struct.unpack_from("<II", data, offset)
    assert kind == 0x004E4942 and offset + 8 + size == len(data)
    return gltf, data[offset + 8:]


def embedded(gltf, binary):
    assert len(gltf["images"]) == 1 and gltf["images"][0]["mimeType"] == "image/png"
    view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
    start = view.get("byteOffset", 0)
    return binary[start:start + view["byteLength"]]


def replace_atlas(data, png):
    gltf, binary = decode(data)
    # Append so every original geometry/UV/index byte and buffer offset survives.
    offset = len(binary)
    assert offset % 4 == 0
    view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
    view.update(byteOffset=offset, byteLength=len(png))
    binary += png
    gltf["buffers"][0]["byteLength"] = len(binary)
    binary += b"\0" * (-len(binary) % 4)
    header = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode()
    header += b" " * (-len(header) % 4)
    return (struct.pack("<III", 0x46546C67, 2, 28 + len(header) + len(binary))
            + struct.pack("<II", len(header), 0x4E4F534A) + header
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def prove_geometry(base, variant):
    old, a = decode(base)
    new, b = decode(variant)
    assert b[:len(a)] == a, "Original binary data changed"
    image_view = old["images"][0]["bufferView"]
    expected = copy.deepcopy(old)
    expected["bufferViews"][image_view] = new["bufferViews"][image_view]
    expected["buffers"][0]["byteLength"] = new["buffers"][0]["byteLength"]
    assert expected == new, "Non-image GLTF metadata changed"
    return {"originalBinarySha256": sha(a), "originalBinaryBytes": len(a),
            "originalBinaryPrefixExact": True, "allNonImageMetadataExact": True,
            "scope": "Geometry, normals, UVs, indices, materials, hierarchy, wheel pivots and radii unchanged"}


def accessor(gltf, binary, index):
    item = gltf["accessors"][index]
    assert not item.get("sparse") and not item.get("normalized")
    view = gltf["bufferViews"][item["bufferView"]]
    types = {5126: ("f", 4), 5125: ("I", 4), 5123: ("H", 2), 5121: ("B", 1)}
    code, width = types[item["componentType"]]
    count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[item["type"]]
    start = view.get("byteOffset", 0) + item.get("byteOffset", 0)
    stride = view.get("byteStride", width * count)
    return [struct.unpack_from("<" + code * count, binary, start + i * stride)
            for i in range(item["count"])]


def stripe_texels(gltf, binary, image, roles):
    """Own twin stripes in physical glTF lateral coordinates, never camera space."""
    node = next(n for n in gltf["nodes"] if n.get("name") == "Body_static")
    assert "matrix" not in node and "rotation" not in node and "scale" not in node
    flags = {}
    for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
        positions = accessor(gltf, binary, primitive["attributes"]["POSITION"])
        uvs = accessor(gltf, binary, primitive["attributes"]["TEXCOORD_0"])
        normals = accessor(gltf, binary, primitive["attributes"]["NORMAL"])
        indices = [v[0] for v in accessor(gltf, binary, primitive["indices"])]
        for i in range(0, len(indices), 3):
            ids = indices[i:i + 3]
            points = [(uvs[j][0] * image.width, uvs[j][1] * image.height) for j in ids]
            (ax, ay), (bx, by), (cx, cy) = points
            det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(det) < 1e-8:
                continue
            for y in range(max(0, math.floor(min(p[1] for p in points))), min(image.height, math.ceil(max(p[1] for p in points)))):
                for x in range(max(0, math.floor(min(p[0] for p in points))), min(image.width, math.ceil(max(p[0] for p in points)))):
                    if not roles.getpixel((x, y)):
                        continue
                    u = ((by - cy) * (x + .5 - cx) + (cx - bx) * (y + .5 - cy)) / det
                    v = ((cy - ay) * (x + .5 - cx) + (ax - cx) * (y + .5 - cy)) / det
                    w = 1 - u - v
                    if min(u, v, w) < -1e-6:
                        continue
                    weights = [u, v, w]
                    height = sum(positions[j][1] * t for j, t in zip(ids, weights))
                    lateral = sum(positions[j][2] * t for j, t in zip(ids, weights))
                    up = sum(normals[j][1] * t for j, t in zip(ids, weights))
                    selected = .11 < abs(lateral) < .29 and height > .45 and up > .35
                    flags.setdefault((x, y), set()).add(selected)
    conflicts = [p for p, states in flags.items() if len(states) > 1]
    assert not conflicts, f"Shared UV islands disagree on stripe ownership: {len(conflicts)}"
    result = {p for p, states in flags.items() if True in states}
    assert len(result) > 50, "Stripe did not own enough surface texels"
    return result


def role_mask(image, family):
    colors = {tuple(c): i + 1 for i, c in enumerate(family["paintColors"])}
    assert len(colors) == len(family["paintColors"])
    protected = {tuple(c) for c in family["protectedColors"]}
    assert not colors.keys() & protected
    mask = Image.new("L", image.size)
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = image.getpixel((x, y))
            assert a == 255 and (r, g, b) in colors.keys() | protected, f"Unknown source role at {(x, y)}"
            mask.putpixel((x, y), colors.get((r, g, b), 0))
    return mask


def recolor(image, roles, ramp, zones, secondary):
    result = image.copy()
    counts = {"primary": 0, "secondary": 0, "protected": 0}
    for y in range(image.height):
        for x in range(image.width):
            role = roles.getpixel((x, y))
            if not role:
                counts["protected"] += 1
                continue
            zone = zones.getpixel((x, y))
            color = (secondary if zone else ramp)[role - 1]
            result.putpixel((x, y), tuple(color) + (255,))
            counts["secondary" if zone else "primary"] += 1
    return result, counts


def build(output_root):
    config = read(CONFIG)
    source = output_root / SOURCE
    public = output_root / PUBLIC
    assert not (public / "review-manifest.json").exists(), "Frozen study: use a new revision/output root"
    source.mkdir(parents=True, exist_ok=True)
    write(source / "palette.json", config)
    candidates = []
    for family_id, family in config["families"].items():
        data = (ROOT / family["glb"]).read_bytes()
        assert sha(data) == family["glbSha256"], f"Base model changed: {family_id}"
        assert sha((ROOT / family["blend"]).read_bytes()) == family["blendSha256"]
        gltf, binary = decode(data)
        image = Image.open(io.BytesIO(embedded(gltf, binary))).convert("RGBA")
        assert image.size == (512, 512)
        roles = role_mask(image, family)
        roles.save(source / f"{family_id}-roles.png")
        for scheme in family["schemes"]:
            ident = f"paint-{family_id}-{scheme['id']}-v1"
            target = public / ident
            target.mkdir(parents=True, exist_ok=True)
            zones = Image.new("L", image.size)
            if scheme.get("secondaryRoof"):
                assert family_id == "pickup"
                # Explicit existing roof chart, from pickup/build.py's chart(cab).
                for y in range(352, 400):
                    for x in range(512):
                        if roles.getpixel((x, y)):
                            zones.putpixel((x, y), 1)
            if scheme.get("stripes"):
                assert family_id == "rosso-coupe"
                for p in stripe_texels(gltf, binary, image, roles):
                    zones.putpixel(p, 1)
            steps = family.get("rampSteps", list(range(6)))
            ramp = [config["ramps"][scheme["primary"]][i] for i in steps]
            secondary = [config["ramps"][scheme.get("secondary", scheme["primary"])][i] for i in steps]
            assert len(ramp) == len(family["paintColors"]) == len(secondary)
            painted, counts = recolor(image, roles, ramp, zones, secondary)
            buf = io.BytesIO()
            painted.save(buf, format="PNG", compress_level=9)
            png = buf.getvalue()
            variant = replace_atlas(data, png)
            proof = prove_geometry(data, variant)
            (target / "atlas.png").write_bytes(png)
            (target / "model.glb").write_bytes(variant)
            own = source / ident
            own.mkdir(parents=True, exist_ok=True)
            (own / "atlas.png").write_bytes(png)
            zones.save(own / "secondary-mask.png")
            recipe = {"schema": "tilefun-vehicle-paint-v1", "id": ident,
                      "family": family_id, "paintSchemeId": scheme["id"],
                      "base": family["glb"], "baseSha256": sha(data),
                      "baseBlend": family["blend"], "baseBlendSha256": family["blendSha256"],
                      "palette": scheme, "roleMask": f"../{family_id}-roles.png",
                      "atlasSha256": sha(png), "glbSha256": sha(variant),
                      "paintTexels": counts, "geometryProof": proof,
                      "humanApproval": False, "normalGameplay": False}
            write(own / "recipe.json", recipe)
            write(target / "report.json", {**recipe, "status": "complete",
                  "method": "Explicit owned color ramps and UV/physical-surface masks; embedded atlas replacement with unchanged mesh/rig/UV bytes. Review only."})
            candidate = {"id": ident, "name": f"{family['name']} · {scheme['name']}",
                         "title": f"Paint study · {family['name']} · {scheme['name']}",
                         "nativeSize": family["nativeSize"], "glb": "model.glb",
                         "atlas": "atlas.png", "report": "report.json",
                         "method": "Curated paint ramps; glass, rubber, lamps, trim and outlines preserved. Geometry and wheel rig unchanged.",
                         "audit": {"triangles": family["triangles"]},
                         "status": "awaiting-owner-review", "runtime": "not integrated"}
            write(target / "candidate.json", {"version": 1, "candidates": [candidate]})
            for src, dest in [("family-review.html", "index.html"), ("family-review.css", "review.css")]:
                content = (ROOT / "scripts/vehicle-bake" / src).read_bytes()
                (target / dest).write_bytes(content)
            candidates.append({"id": ident, "family": family_id, "scheme": scheme,
                               "name": candidate["name"], "nativeSize": family["nativeSize"],
                               "directory": str(PUBLIC / ident).replace("\\", "/"),
                               "glbSha256": sha(variant), "baseSha256": sha(data)})
    write(source / "study.json", {"schema": "tilefun-vehicle-paint-study-v1", "candidates": candidates})
    write(public / "study.json", {"schema": "tilefun-vehicle-paint-study-v1", "candidates": candidates})
    print(json.dumps({"status": "built", "variants": len(candidates), "output": str(public)}))


def verify(output_root):
    source, public = output_root / SOURCE, output_root / PUBLIC
    config = read(CONFIG)
    for row in read(source / "study.json")["candidates"]:
        target = public / row["id"]
        recipe = read(source / row["id"] / "recipe.json")
        data = (target / "model.glb").read_bytes()
        assert sha(data) == recipe["glbSha256"]
        family = config["families"][row["family"]]
        base = (ROOT / family["glb"]).read_bytes()
        assert sha(base) == recipe["baseSha256"]
        assert prove_geometry(base, data) == recipe["geometryProof"]
        gltf, binary = decode(data)
        png = embedded(gltf, binary)
        assert png == (target / "atlas.png").read_bytes() == (source / row["id"] / "atlas.png").read_bytes()
        assert sha(png) == recipe["atlasSha256"]
    print("Paint variants: all exact source/atlas/mesh preservation checks passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["build", "verify"])
    parser.add_argument("--output-root", type=Path, default=ROOT)
    args = parser.parse_args()
    output = args.output_root.resolve()
    assert output == ROOT or output.is_relative_to(ROOT / "data"), "Alternate outputs must be ignored scratch"
    {"build": build, "verify": verify}[args.action](output)
