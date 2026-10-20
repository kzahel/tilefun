"""Measure occupied actual capture pixels at unchanged standard frame density."""

from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/cement-mixer"
C = D / "author-view/captures"
sha = hashlib.sha256(
    (ROOT / "public/demos/vehicle-bake/cement-mixer/v1/model.glb").read_bytes()
).hexdigest()
capture = json.loads((C / "capture.json").read_text())
assert capture["glbSha256"] == sha
views = []
for v in capture["views"]:
    if v["mode"] != "engine":
        continue
    bounds = v["bounds"]
    translated = {
        "minX": bounds["minX"] - 32,
        "maxX": bounds["maxX"] - 32,
        "minY": bounds["minY"] + 16,
        "maxY": bounds["maxY"] + 16,
    }
    assert (
        0 < translated["minX"] <= translated["maxX"] < 191
        and 0 < translated["minY"] <= translated["maxY"] < 223
    )
    views.append(
        {
            "yaw": v["yaw"],
            "actual256OccupiedBounds": bounds,
            "fallback192x224OccupiedBounds": translated,
            "fitsWithoutScaling": True,
        }
    )
assert len(views) == 16 and len(capture["views"]) == 32
cardinals = []
for index in [0, 4, 8, 12]:
    src = Image.open(C / f"engine-{index}.png").convert("RGBA")
    assert src.size == (256, 256)
    dst = Image.new("RGBA", (192, 224), (0, 0, 0, 0))
    dst.paste(src, (-32, 16))
    occupied = 0
    for y in range(256):
        for x in range(256):
            value = src.getpixel((x, y))
            if not value[3]:
                continue
            occupied += 1
            assert 0 <= x - 32 < 192 and 0 <= y + 16 < 224
            assert dst.getpixel((x - 32, y + 16)) == value
    assert sum(1 for p in dst.getdata() if p[3]) == occupied
    path = C / f"fallback-cardinal-{index//4}.png"
    dst.save(path)
    cardinals.append(
        {
            "yaw": index * 22.5,
            "image": "engine/" + path.name,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "dimensions": [192, 224],
            "allOccupiedPixelsExact": True,
            "occupiedPixels": occupied,
            "opaquePixelsLost": 0,
            "translationOnly": [-32, 16],
            "scale": 1,
        }
    )
receipt = {
    "status": "passed",
    "glbSha256": sha,
    "actualCapture": "engine/capture.json",
    "nativeViewport": [256, 256],
    "nativeRadius": 128,
    "source80ReferenceUnchanged": True,
    "familyExtraPadding": 32,
    "fallbackFrame": [192, 224],
    "engineOrigin": [128, 128],
    "fallbackOrigin": [96, 144],
    "translationOnly": [-32, 16],
    "scale": 1,
    "views": views,
    "cardinalExactPixelProof": cardinals,
    "standardCardinalPlacementPixelExact": True,
    "limitation": "Measured occupied pixels fit standard fallback placement. Parent still owns independent runtime export/QA; this is no runtime registration claim.",
}
(D / "fit-assessment.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, indent=2))
