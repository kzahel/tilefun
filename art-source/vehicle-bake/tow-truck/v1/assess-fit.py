"""Measure occupied actual capture pixels at unchanged standard frame density."""

from pathlib import Path
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/tow-truck"
C = D / "author-view/captures"
sha = hashlib.sha256(
    (ROOT / "public/demos/vehicle-bake/tow-truck/v1/model.glb").read_bytes()
).hexdigest()
capture = json.loads((C / "capture.json").read_text())
assert capture["glbSha256"] == sha
views = []
for v in capture["views"]:
    if v["mode"] != "engine":
        continue
    bounds = v["bounds"]
    translated = {
        "minX": bounds["minX"] - 16,
        "maxX": bounds["maxX"] - 16,
        "minY": bounds["minY"] + 32,
        "maxY": bounds["maxY"] + 32,
    }
    assert (
        0 < translated["minX"] <= translated["maxX"] < 191
        and 0 < translated["minY"] <= translated["maxY"] < 223
    )
    views.append(
        {
            "yaw": v["yaw"],
            "actual224OccupiedBounds": bounds,
            "fallback192x224OccupiedBounds": translated,
            "fitsWithoutScaling": True,
        }
    )
assert len(views) == 16 and len(capture["views"]) == 32
receipt = {
    "status": "passed",
    "glbSha256": sha,
    "actualCapture": "engine/capture.json",
    "nativeViewport": [224, 224],
    "nativeRadius": 112,
    "source80ReferenceUnchanged": True,
    "familyExtraPadding": 0,
    "fallbackFrame": [192, 224],
    "engineOrigin": [112, 112],
    "fallbackOrigin": [96, 144],
    "translationOnly": [-16, 32],
    "scale": 1,
    "views": views,
    "limitation": "Measured occupied pixels fit standard fallback placement. Parent still owns independent runtime export/QA; this is no runtime registration claim.",
}
(D / "fit-assessment.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt, indent=2))
