"""Independent native v3 peer measurements; read-only v2 control, no art writes."""

from pathlib import Path
from collections import Counter
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

R = Path.cwd()
D = R / "data/vehicle-riders/classic-v3-peer/v3"
OLD = R / "art-source/vehicle-riders/classic-comparison/v1"
read = lambda p: json.loads(p.read_text(encoding="utf-8"))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
pins = {}


def input_file(p):
    pins[p.relative_to(R).as_posix()] = sha(p)
    return p


comparison = read(D / "comparison.json")
eyes = read(D / "identity-eye-control.json")
ears = read(D / "ear-control.json")
audit = read(D / "peer-component-audit.json")
old = read(input_file(OLD / "evidence/identity-landmarks.json"))["all32Rows"]["v2"]
identity = read(
    input_file(R / "art-source/vehicle-riders/classic-upright/v3/identity.json")
)
standing = Image.open(input_file(R / identity["sourcePNG"])).convert("RGBA")
assert sha(R / identity["sourcePNG"]) == identity["sourceSha256"]
assert len(audit["unchangedOwners"]) == 20 and len(audit["changedOwners"]) == 2
assert (
    not audit["addedOwners"]
    and not audit["removedOwners"]
    and audit["profileBytesExact"]
)
palette = {tuple(bytes.fromhex(c[1:])): k for k, c in identity["palette"].items()}


def load(name, mode, i, ear=False):
    return Image.open(
        D / ("ear-controls" if ear else "captures") / f"{name}-{mode}-{i}.png"
    ).convert("RGBA")


def v2(mode, i, ruler=False):
    p = (
        R
        / f"public/demos/vehicle-riders/classic-upright/v2/captures/{'ruler' if ruler else 'rider'}-{mode}-{i}.png"
    )
    return Image.open(input_file(p)).convert("RGBA")


def bbox(points):
    if not points:
        return None
    return [
        min(p[0] for p in points),
        min(p[1] for p in points),
        max(p[0] for p in points) + 1,
        max(p[1] for p in points) + 1,
    ]


def span(b):
    return [b[2] - b[0], b[3] - b[1]] if b else None


def colors(im):
    return Counter(
        palette.get(p[:3], "commonInk") for p in im.get_flattened_data() if p[3]
    )


rows = []
for n, e in enumerate(eyes["rows"]):
    mode, yaw = e["mode"], e["yaw"]
    i = round(yaw / 22.5)
    raw, violet, common = [
        load(name, mode, i)
        for name in [
            "raw-unoutlined",
            "source-violet-rider",
            "common-vehicle-ink-rider",
        ]
    ]
    assert (
        raw.getchannel("A").tobytes()
        == violet.getchannel("A").tobytes()
        == common.getchannel("A").tobytes()
    )
    assert (
        old[n]["sourceInteriorEyeCoordinates"]
        == e["interiorPixelCoordinates"]["violet"]
    )
    assert (
        old[n]["commonInteriorEyeCoordinates"]
        == e["interiorPixelCoordinates"]["common"]
    )
    for role in ["n", "l"]:
        rgb = (*bytes.fromhex(identity["palette"][role][1:]), 255)
        for key, im in [("raw", raw), ("violet", violet), ("common", common)]:
            actual = [
                [x, y]
                for y in range(224)
                for x in range(224)
                if im.getpixel((x, y)) == rgb
            ]
            assert actual == old[n]["paint"][key][role]["pixels"], (mode, yaw, role)
    face = [p["pixel"] for p in e["surfacePixels"] if "face UV" in p["owner"]]
    ear_pixels = [p["pixel"] for p in e["surfacePixels"] if "pointed ear" in p["owner"]]
    removals = ears["rows"][n]["removed"]
    morphology = {}
    for side in ["left", "right"]:
        loss = removals[side]["alphaLoss"]["raw"]
        widths = Counter(p[1] for p in loss)
        morphology[side] = {
            "alphaPixels": len(loss),
            "bounds": bbox(loss),
            "span": span(bbox(loss)),
            "rowWidths": dict(sorted(widths.items())),
            "topRowWidth": widths[min(widths)] if widths else None,
            "maximumWidth": max(widths.values()) if widths else None,
            "alphaLossCoordinates": loss,
        }
    assert set(map(tuple, removals["left"]["alphaLoss"]["raw"])).isdisjoint(
        set(map(tuple, removals["right"]["alphaLoss"]["raw"]))
    )
    b = raw.getbbox()
    rows.append(
        {
            "mode": mode,
            "yaw": yaw,
            "rawAndOutlinedBounds": list(b),
            "rawAndOutlinedSpan": span(b),
            "v2Span": old[n]["outlinedSpan"],
            "rawAndOutlinedOpaquePixels": sum(
                1 for p in raw.get_flattened_data() if p[3]
            ),
            "v2OpaquePixels": old[n]["rawOpaquePixelCount"],
            "rawPaletteCounts": dict(colors(raw)),
            "sourcePaletteCounts": dict(colors(violet)),
            "commonPaletteCounts": dict(colors(common)),
            "faceSurfaceBounds": bbox(face),
            "earSurfaceBounds": bbox(ear_pixels),
            "earRiseAboveHighestFacePixel": max(0, bbox(face)[1] - bbox(ear_pixels)[1]),
            "rawEyePaintPixels": e["rawEyePixels"],
            "sourceInteriorEyeCoordinates": e["interiorPixelCoordinates"]["violet"],
            "commonInteriorEyeCoordinates": e["interiorPixelCoordinates"]["common"],
            "eyesAndCollarExactToV2": True,
            "earMorphology": morphology,
        }
    )

font = ImageFont.load_default(size=12)
small = ImageFont.load_default(size=11)
bg = "#263d37"


def crop(im, mode):
    box = (80, 108, 144, 172) if mode == "study" else (80, 80, 144, 144)
    b = im.getbbox()
    assert box[0] <= b[0] and box[1] <= b[1] and box[2] >= b[2] and box[3] >= b[3]
    return im.crop(box)


def reference(index):
    im = Image.new("RGBA", (64, 64))
    im.paste(standing.crop((0, index * 16, 16, (index + 1) * 16)), (24, 19))
    return im


def paste(out, im, x, y, scale=1):
    if scale > 1:
        im = im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)
    out.paste(im, (x, y), im)


poses = [(m, i) for m in ["study", "engine"] for i in [0, 2, 3, 4, 5, 6, 8, 12]]
sheet = Image.new("RGB", (1232, 90 + len(poses) * 154), bg)
pen = ImageDraw.Draw(sheet)
pen.text(
    (8, 8),
    "V3 PEER: original standing | v2 source | v3 source | v3 common ink | v3 ears removed | v3 eyes removed",
    font=font,
    fill="white",
)
pen.text(
    (8, 28),
    "Each cell native64 crop + nearest2x. Same80/4.6 density, projection, hip/yaw; no model/angle fit.",
    font=small,
    fill="#eed299",
)
pen.text(
    (8, 46),
    "Original pixels/hip registration unchanged observational reference. Source-only agent QA; no human/normal/bike qualification.",
    font=small,
    fill="#eed299",
)
for n, (mode, i) in enumerate(poses):
    y = 88 + n * 154
    r = rows[(0 if mode == "study" else 16) + i]
    pen.text(
        (8, y),
        f"{mode} {i*22.5:g}deg; eyes={len(r['sourceInteriorEyeCoordinates'])}; ear alpha L/R={r['earMorphology']['left']['alphaPixels']}/{r['earMorphology']['right']['alphaPixels']}",
        font=small,
        fill="white",
    )
    refrow = 0 if i in [2, 3, 4, 5, 6] else {0: 2, 8: 3, 12: 1}[i]
    cells = [reference(refrow), crop(v2(mode, i), mode)]
    cells += [
        crop(load(name, mode, i, ear), mode)
        for name, ear in [
            ("source-violet-rider", False),
            ("common-vehicle-ink-rider", False),
            ("both-removed-violet", True),
            ("eyes-removed-source-violet", False),
        ]
    ]
    for c, im in enumerate(cells):
        paste(sheet, im, 8 + c * 204, y + 48)
        paste(sheet, im, 76 + c * 204, y + 20, 2)
sheet.save(D / "peer-native-identity.png")

sheet = Image.new("RGB", (852, 60 + 32 * 142), bg)
pen = ImageDraw.Draw(sheet)
pen.text(
    (8, 8),
    "ALL32: v2 source | v3 source | v3 common ink | v3 ears removed (source)",
    font=font,
    fill="white",
)
pen.text(
    (8, 28),
    "Each cell native + nearest2x; fixed64px crop/world ruler. Ear geometry removal is diagnostic only.",
    font=small,
    fill="#eed299",
)
for n, r in enumerate(rows):
    mode, i = r["mode"], round(r["yaw"] / 22.5)
    y = 60 + n * 142
    pen.text((8, y), f"{mode} {r['yaw']:g}deg", font=small, fill="white")
    cells = [
        crop(v2(mode, i), mode),
        crop(load("source-violet-rider", mode, i), mode),
        crop(load("common-vehicle-ink-rider", mode, i), mode),
        crop(load("both-removed-violet", mode, i, True), mode),
    ]
    for c, im in enumerate(cells):
        paste(sheet, im, 8 + c * 212, y + 45)
        paste(sheet, im, 76 + c * 212, y + 14, 2)
sheet.save(D / "peer-all32.png")

sheet = Image.new("RGB", (936, 1050), bg)
pen = ImageDraw.Draw(sheet)
pen.text(
    (8, 8),
    "WORLD RULER: original standing | immutable v2+Explorer | v3+Explorer source | v3+Explorer common ink",
    font=small,
    fill="white",
)
for m, mode in enumerate(["study", "engine"]):
    y = 45 + m * 500
    pen.text(
        (8, y),
        f"{mode} front90: native224 above, same fixed crop nearest2x below. No model/camera scaling.",
        font=small,
        fill="white",
    )
    original = Image.new("RGBA", (224, 224))
    original.paste(standing.crop((0, 0, 16, 16)), (104, 127 if mode == "study" else 99))
    for c, im in enumerate(
        [
            original,
            v2(mode, 4, True),
            load("source-violet-ruler", mode, 4),
            load("common-vehicle-ink-ruler", mode, 4),
        ]
    ):
        paste(sheet, im, 8 + c * 232, y + 20)
        paste(
            sheet,
            im.crop((48, 108, 144, 172) if mode == "study" else (48, 80, 144, 144)),
            8 + c * 232,
            y + 264,
            2,
        )
sheet.save(D / "peer-world-ruler.png")

pins.update(comparison["inputHashes"])
pins.update(audit["inputHashes"])
for path, h in pins.items():
    assert sha(R / path) == h, path
result = {
    "status": "complete-independent-v3-native-measurements",
    "agentQAOnly": True,
    "humanApproval": False,
    "formalHumanVerdict": None,
    "noActualBikeQualification": True,
    "glbSha256": comparison["riderSha256"],
    "triangles": 1766,
    "all32InteriorEyesAndCollarCoordinatesExactToV2": True,
    "all32RawOutlinedAlphaExact": True,
    "geometryUnchangedExceptBothEars": True,
    "profileAndAtlasBytesExactToV2": True,
    "originalStandingFrameSpan": {"front": [14, 16], "side": [10, 16]},
    "all32Rows": rows,
    "inputHashes": pins,
    "limits": [
        "Volumetric seated silhouette differs from standing; game side is now10x25 versus original10x16.",
        "Some rear/side collar and far-ear cues are really occluded; not every ear must contribute alpha at every heading.",
        "No human approval, actual-bike, normal, AI, fallback, animation or all-avatar claim.",
    ],
}
(D / "peer-analysis.json").write_text(
    json.dumps(result, indent=2) + "\n", encoding="utf-8"
)
print(
    json.dumps(
        {
            "status": result["status"],
            "inputsVerified": len(pins),
            "front": [r for r in rows if r["yaw"] == 90],
        }
    )
)
