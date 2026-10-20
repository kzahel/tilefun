"""Native Person7 likeness and three-identity ruler; no normalization or mutable prior inputs."""

from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-riders/person7-upright"
O = R / "public/demos/vehicle-riders/person7-upright/v1"
C = json.loads((Path(__file__).parent / "rider.json").read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = R / "public/assets/sprites/person7.png"
standing = Image.open(source).convert("RGBA")
boxes = {"study": (80, 108, 144, 172), "engine": (80, 80, 144, 144)}
sheet = Image.new("RGB", (840, 1240), "#263d37")
draw = ImageDraw.Draw(sheet)
draw.text(
    (4, 4),
    "Person7 source16x32 / actual study / actual game; same4x nearest pixel ruler",
    fill="white",
)
rows = []
directions = [
    ("front", 0, 4),
    ("back", 1, 12),
    ("profile-left", 2, 0),
    ("profile-right", 3, 8),
]
for j, (name, row, index) in enumerate(directions):
    y = j * 300 + 30
    draw.text((4, y), name, fill="white")
    frame = standing.crop((0, row * 32, 16, (row + 1) * 32))
    cell = Image.new("RGBA", (64, 64))
    cell.paste(frame, (24, 16))
    cell = cell.resize((256, 256), Image.Resampling.NEAREST)
    sheet.paste(cell, (8, y + 20), cell)
    bounds = {}
    for k, mode in enumerate(["study", "engine"]):
        p = D / "captures" / f"rider-{mode}-{index}.png"
        im = Image.open(p).convert("RGBA")
        bounds[mode] = im.getbbox()
        crop = im.crop(boxes[mode]).resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(crop, (280 + k * 280, y + 20), crop)
    rows.append(
        {
            "label": name,
            "sourceRow": row,
            "sourceBounds": frame.getbbox(),
            "actualYaw": index * 22.5,
            "actualBounds": bounds,
        }
    )
sheet.save(D / "identity-comparison.png")
# Actual earlier GLBs remain unchanged at +/-52world positions; all hips share the same height.
refs = [
    ("Explorer", "public/demos/pixel-characters/person-32.png", 32, 27, 60),
    ("Person7", "public/assets/sprites/person7.png", 16, 32, 112),
    ("Bear", "public/demos/pixel-characters/bear-32.png", 32, 27, 164),
]
ruler = Image.new("RGB", (896, 940), "#263d37")
draw = ImageDraw.Draw(ruler)
sources = Image.new("RGBA", (224, 64))
for name, path, width, pivot, x in refs:
    im = Image.open(R / path).convert("RGBA").crop((0, 0, width, 32))
    sources.paste(im, (x - width // 2, 48 - pivot))
    draw.text((x * 4 - 60, 8), name, fill="white")
for label, native, y in [
    ("Source standing: shared ground, original pixels", sources, 48),
    (
        "Actual study: shared hip origins, unchanged world scale",
        Image.open(D / "captures/ruler-study-4.png")
        .convert("RGBA")
        .crop((0, 108, 224, 172)),
        350,
    ),
    (
        "Actual game: shared hip origins, unchanged world scale",
        Image.open(D / "captures/ruler-engine-4.png")
        .convert("RGBA")
        .crop((0, 80, 224, 144)),
        652,
    ),
]:
    draw.text((4, y - 18), label, fill="white")
    large = native.resize((896, 256), Image.Resampling.NEAREST)
    ruler.paste(large, (0, y), large)
    bar = 41 if "study" in label else 40
    draw.line((16, y + 244, 16 + bar, y + 244), fill="white", width=3)
    draw.text(
        (64, y + 236),
        "10px reference; study10world =10.22native, game/source10native",
        fill="white",
    )
ruler.save(D / "common-world-ruler.png")
report = {
    "status": "author-comparative-inspection-pending-human-review",
    "humanApproval": False,
    "riderSha256": sha(O / "rider.glb"),
    "sourceStandingSha256": sha(source),
    "pixelComparison": "Person7 source16x32 padded in64px cell; actual figures use one fixed64px hip-centered crop per camera, all headings. Every display uses4x nearest enlargement only; no per-figure or per-heading scaling. Different standing/seated poses mean no pixel-equivalence claim.",
    "views": rows,
    "scaleControls": C["scaleControls"],
    "sourceRulerInputs": {path: sha(R / path) for _, path, _, _, _ in refs},
    "sourceGroundPivots": "Person7 bottom32, approved32px Explorer/Bear pivot27; only translations align standing ground. Actual ruler aligns hip origins; hips at screen-horizontal offsets-52/0/+52world. No identity is resized.",
    "observations": [
        "Own tall stacked teal cap, actual projecting brim and orange skin-UV accent retain Person7 silhouette.",
        "Pale face and source gray-brown side/back hair use Person7 own skin charts; blue/teal jacket and olive trousers/boots are distinct from Explorer/Bear.",
        "Compact legacy torso and limbs remain under a large cap instead of extending to Explorer contact reach. Actual ruler shows relative size without normalizing to height24 metadata.",
    ],
    "uncertainty": [
        "Sprite observations do not specify unique depth or hidden skeleton. Cap/head forward depth and bill were refined to reveal face while frontal widths, cap height and fixed short chains remain unchanged.",
        "The3D view has heading-dependent apparent height because depth contributes to fixed projection. Source raster/standing pose is not reconstructed pixel-for-pixel.",
        "Small eye/face/brim/orange clusters lose pixels at some headings. No inferred face/head or seated body approval is transferred from standing source.",
        "Explorer-profile failure is conditional on this fixed upright template, not every possible leaning pose or inferred anatomy.",
    ],
}
(D / "identity-inspection.json").write_text(json.dumps(report, indent=2) + "\n")
print("Own native identity and immutable-control common world ruler retained")
