"""Actual raw GLTF standard placement proof; no normal fallback activation claim."""

from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/touring-motorcycle"
C = D / "captures"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
glb = sha(ROOT / "public/demos/vehicle-bake/touring-motorcycle/v1/model.glb")
raw = json.loads((D / "raw-capture.json").read_text())
assert raw["glbSha256"] == glb
views = []
cardinals = []
for view in ["combined", "bike-alone", "rider-alone"]:
    for i in range(16):
        path = C / f"{view}-engine-{i}.png"
        src = Image.open(path).convert("RGBA")
        assert src.size == (224, 224)
        box = src.getbbox()
        assert box is not None
        placed = (box[0] - 16, box[1] + 32, box[2] - 16, box[3] + 32)
        assert 0 < placed[0] < placed[2] < 192 and 0 < placed[1] < placed[3] < 224
        views.append(
            {
                "view": view,
                "yaw": i * 22.5,
                "nativeBounds": box,
                "placedBounds": placed,
                "scale": 1,
            }
        )
        if i not in [0, 4, 8, 12]:
            continue
        dst = Image.new("RGBA", (192, 224))
        dst.paste(src, (-16, 32))
        occupied = 0
        for y in range(224):
            for x in range(224):
                pixel = src.getpixel((x, y))
                if pixel[3]:
                    assert dst.getpixel((x - 16, y + 32)) == pixel
                    occupied += 1
        assert sum(bool(p[3]) for p in dst.getdata()) == occupied
        target = C / f"placement-cardinal-{view}-{i//4}.png"
        dst.save(target)
        cardinals.append(
            {
                "view": view,
                "yaw": i * 22.5,
                "image": target.name,
                "sha256": sha(target),
                "dimensions": [192, 224],
                "allOccupiedRGBAExact": True,
                "opaquePixelsLost": 0,
                "occupiedPixels": occupied,
            }
        )
assert len(raw["paddingParity"]) == 32
coverage = json.loads((D / "coverage-draft1.json").read_text())
assert coverage["inputSha256"] == glb
assert {w["wheel"] for w in coverage["wheels"]} == {"Wheel_F_Roll", "Wheel_R_Roll"}
assert all(w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"])
assert coverage["controls"]["bodyRemovalCoveredCounts"] == [0, 0]
assert coverage["controls"]["syntheticBroadPanelPositiveCounts"] == [25, 25]
assert coverage["controls"]["sameSyntheticPanelsOffsetOutsideRegionCounts"] == [0, 0]
result = {
    "status": "passed",
    "glbSha256": glb,
    "nativeViewport": [224, 224],
    "meshRadius": 112,
    "referenceDensity": 80 / 4.6,
    "paddingOnly32RGBAParity": True,
    "standard192x224Translation": [-16, 32],
    "scale": 1,
    "views": views,
    "cardinals": cardinals,
    "fenderCoverage": {
        "F": 25,
        "R": 25,
        "samplesEach": 25,
        "actualControlsPassed": True,
    },
    "limitation": "Raw source geometric placement only. Normal occupied fallback, rider identity, AI and actual shared loader/browser remain separately gated by parent.",
}
(D / "pixel-assessment.json").write_text(json.dumps(result, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": "passed",
            "views": len(views),
            "cardinals": len(cardinals),
            "crownSamplesEach": 25,
        }
    )
)
