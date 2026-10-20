"""Classic identity evidence at one common native-pixel ruler; never auto-fit art."""

from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image, ImageDraw

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
D = R / "data/vehicle-riders/classic-upright-v2"
O = R / "public/demos/vehicle-riders/classic-upright/v2"
I = json.loads((S / "identity.json").read_text())
C = json.loads((S / "rider.json").read_text())
proof = json.loads((D / "contact-proof.json").read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = R / I["sourcePNG"]
assert sha(source) == I["sourceSha256"]
standing = Image.open(source).convert("RGBA")
palette = {tuple(bytes.fromhex(h[1:])): key for key, h in I["palette"].items()}
assert len(palette) == 7
assert {p[:3] for p in standing.get_flattened_data() if p[3]} == set(palette)
for row, label in enumerate(["front", "back", "left", "right"]):
    actual = [
        "".join(
            (
                palette[standing.getpixel((x, row * 16 + y))[:3]]
                if standing.getpixel((x, row * 16 + y))[3]
                else "."
            )
            for x in range(16)
        )
        for y in range(16)
    ]
    assert actual == I["sourceCharts"][label]

# Decode actual GLB TEXCOORD_0 and its embedded image, independently of recipe.
raw = (O / "rider.glb").read_bytes()
size = struct.unpack_from("<I", raw, 12)[0]
g = json.loads(raw[20 : 20 + size])
binary = raw[28 + size :]
primitive = g["meshes"][0]["primitives"][0]


def accessor(index):
    a = g["accessors"][index]
    v = g["bufferViews"][a["bufferView"]]
    kinds = {5123: "H", 5125: "I", 5126: "f"}
    width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[a["type"]]
    fmt = "<" + kinds[a["componentType"]] * width
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", struct.calcsize(fmt))
    return [
        struct.unpack_from(fmt, binary, start + i * stride) for i in range(a["count"])
    ]


view = g["bufferViews"][g["images"][0]["bufferView"]]
embedded = Image.open(
    io.BytesIO(
        binary[
            view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]
        ]
    )
).convert("RGBA")
atlas = Image.open(O / "atlas.png").convert("RGBA")
assert atlas.size == (256, 256) and atlas.tobytes() == embedded.tobytes()
assert atlas.getchannel("A").getextrema() == (255, 255)
assert {p[:3] for p in atlas.get_flattened_data()} == set(palette)
uv = accessor(primitive["attributes"]["TEXCOORD_0"])
indices = [v[0] for v in accessor(primitive["indices"])]
paint = Counter()
for i in range(0, len(indices), 3):
    triangle = [uv[index] for index in indices[i : i + 3]]
    for a in range(1, 9):
        for b in range(1, 10 - a):
            weights = [a / 10, b / 10, 1 - (a + b) / 10]
            u, v = [
                sum(w * point[axis] for w, point in zip(weights, triangle))
                for axis in range(2)
            ]
            color = embedded.getpixel(
                (min(255, max(0, int(u * 256))), min(255, max(0, int(v * 256))))
            )[:3]
            assert color in palette
            paint[palette[color]] += 1
assert set(paint) == set(I["palette"])

sheet = Image.new("RGB", (840, 1240), "#33434b")
draw = ImageDraw.Draw(sheet)
draw.text(
    (4, 4),
    "Classic original / actual study / actual game - same4x nearest ruler",
    fill="white",
)
rows = []
for j, (label, row, index) in enumerate(
    [("front", 0, 4), ("back", 1, 12), ("left", 2, 0), ("right", 3, 8)]
):
    y = 30 + j * 300
    draw.text((4, y), label + " - fixed64px cells, no auto-fit", fill="white")
    native = Image.new("RGBA", (64, 64))
    frame = standing.crop((0, row * 16, 16, row * 16 + 16))
    # Common inferred pelvis registration only; original pixels are untouched.
    native.paste(frame, (24, 19))
    panels = [native]
    bounds = {}
    for mode, box in [("study", (80, 108, 144, 172)), ("engine", (80, 80, 144, 144))]:
        im = Image.open(D / f"captures/rider-{mode}-{index}.png").convert("RGBA")
        bounds[mode] = im.getbbox()
        panels.append(im.crop(box))
    for k, panel in enumerate(panels):
        enlarged = panel.resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(enlarged, (8 + k * 280, y + 20), enlarged)
        draw.line((20 + k * 280, y + 268, 60 + k * 280, y + 268), fill="white", width=2)
    rows.append(
        {
            "direction": label,
            "sourceRow": row,
            "actualYaw": index * 22.5,
            "sourceBounds": frame.getbbox(),
            "actualBounds": bounds,
        }
    )
sheet.save(D / "identity-comparison.png")

# Common world scale control uses untouched Explorer; display placement is lateral only.
ruler = Image.new("RGB", (896, 940), "#33434b")
draw = ImageDraw.Draw(ruler)
sources = Image.new("RGBA", (224, 64))
explorer = (
    Image.open(R / "public/demos/pixel-characters/person-32.png")
    .convert("RGBA")
    .crop((0, 0, 32, 32))
)
sources.paste(explorer, (56, 50 - explorer.getbbox()[3]))
sources.paste(standing.crop((0, 0, 16, 16)), (104, 34))
for label, im, y in [
    (
        "Standing: original Explorer and Classic; common ground / original pixels",
        sources,
        48,
    ),
    (
        "Seated study: shared hip origins, unchanged world scale",
        Image.open(D / "captures/ruler-study-4.png")
        .convert("RGBA")
        .crop((0, 108, 224, 172)),
        350,
    ),
    (
        "Seated game: same fixed world-pixel density",
        Image.open(D / "captures/ruler-engine-4.png")
        .convert("RGBA")
        .crop((0, 80, 224, 144)),
        652,
    ),
]:
    draw.text((4, y - 18), label, fill="white")
    enlarged = im.resize((896, 256), Image.Resampling.NEAREST)
    ruler.paste(enlarged, (0, y), enlarged)
    draw.line((16, y + 244, 56, y + 244), fill="white", width=3)
    draw.text(
        (64, y + 236), "10native pixels / one common4x nearest scale", fill="white"
    )
ruler.save(D / "common-world-ruler.png")

parts = proof["actualPartBoundsWorld"]
head = parts["RiderClassic broad face UV owner"]
head_width = head["max"][1] - head["min"][1]
assert abs(head_width - C["anatomy"]["headDimensions"][1] * C["worldScale"]) < 1e-4
head_owners = [n for n in parts if "face UV" in n or "pointed ear" in n]
head_ear_height = max(parts[n]["max"][2] for n in head_owners) - min(
    parts[n]["min"][2] for n in head_owners
)
all_height = max(p["max"][2] for p in parts.values()) - min(
    p["min"][2] for p in parts.values()
)
report = {
    "status": "passed",
    "humanApproval": False,
    "actualBikePresent": False,
    "riderSha256": sha(O / "rider.glb"),
    "identitySource": {"path": I["sourcePNG"], "sha256": I["sourceSha256"]},
    "exactOriginalPalette": I["palette"],
    "actualGLBUVInteriorPaletteSamples": dict(paint),
    "sourceChartsExact": True,
    "commonRuler": {
        "allImagesSame4xNearest": True,
        "noIndependentFitOrResize": True,
        "sourceHipRow13RegistrationIsInferred": True,
        "worldScale": C["worldScale"],
        "decodedHeadWidthWorld": head_width,
        "standingHeadWidthPixels": 14,
        "decodedHeadWidthToSourceRatio": head_width / 14,
        "decodedHeadAndEarHeightWorld": head_ear_height,
        "decodedTotalSeatedHeightWorld": all_height,
        "sourceVisibleHeightPixels": 16,
        "sourceHeadIncludingEarsRows": 11,
        "sourceBodyFeetRows": 5,
        "decodedPartBoundsWorld": parts,
    },
    "directions": rows,
    "tail": "No distinct tail in all16sourceframes; none invented",
    "uncertainty": [
        "2D standing art does not determine a unique3D skeleton or depth",
        "Short bent limbs and head depth are inferred; common scale is fixed, not an exact per-view sprite reconstruction",
        "Own short-reach profile is not an actual-bike mount or universal fit",
        "Raw GLTF source viewer; no CarMeshAsset or authority/AI/fallback qualification",
    ],
}
(D / "identity-inspection.json").write_text(
    json.dumps(report, indent=2) + "\n", encoding="utf-8"
)
print(
    json.dumps(
        {
            "status": "passed",
            "paletteColorsUsedByActualUV": len(paint),
            "headWidthWorld": head_width,
            "seatedHeightWorld": all_height,
        }
    )
)
