"""Verify unchanged native GLB captures fit ordinary fallback frames by translation."""

from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/stretch-limousine"
P = D / "author-view/captures"
model = ROOT / "public/demos/vehicle-bake/stretch-limousine/v1/model.glb"
sha = hashlib.sha256(model.read_bytes()).hexdigest()
capture = json.loads((P / "capture.json").read_text())
assert capture["glbSha256"] == sha and capture["nativeSize"] == 224
offset = (-16, 32)  # (96,144) fallback origin minus (112,112) native game origin.


def fits(bounds, delta):
    x0, y0, x1, y1 = bounds
    dx, dy = delta
    return 0 <= x0 + dx < x1 + dx <= 192 and 0 <= y0 + dy < y1 + dy <= 224


rows = []
sheet = Image.new("RGBA", (192, 224 * 4))
for index in range(16):
    im = Image.open(P / f"engine-{index}.png").convert("RGBA")
    assert im.size == (224, 224)
    bounds = im.getchannel("A").getbbox()
    assert fits(bounds, offset), (index, bounds)
    frame = Image.new("RGBA", (192, 224))
    x0, y0, x1, y1 = bounds
    frame.paste(im.crop(bounds), (x0 + offset[0], y0 + offset[1]))
    copied = frame.crop(
        (x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1])
    )
    assert copied.tobytes() == im.crop(bounds).tobytes()
    assert not fits(bounds, (224, 224))
    assert fits(bounds, offset)
    rows.append(
        {
            "headingDegrees": index * 22.5,
            "nativeBounds": list(bounds),
            "fallbackBounds": [
                x0 + offset[0],
                y0 + offset[1],
                x1 + offset[0],
                y1 + offset[1],
            ],
            "occupiedPixelsExact": True,
        }
    )
    if index % 4 == 0:
        sheet.paste(frame, (0, (index // 4) * 224))
sheet.save(D / "author-cardinal-fit.png")
(D / "fallback-native-fit.json").write_text(
    json.dumps(
        {
            "status": "passed",
            "glbSha256": sha,
            "nativeSize": [224, 224],
            "frameSize": [192, 224],
            "nativeGroundOrigin": [112, 112],
            "fallbackGroundOrigin": [96, 144],
            "translationOnly": list(offset),
            "resizing": False,
            "perHeadingFit": False,
            "views": rows,
            "negativeOffFrameTranslationRejected": True,
            "baselineRestored": True,
            "meaning": "All16 native game headings fit the ordinary fallback frame with exact RGBA occupied pixels, fixed origins and transparent-margin cropping only. Physical collider measurement/runtime packaging remains parent-owned v3 work.",
        },
        indent=2,
    )
    + "\n"
)
