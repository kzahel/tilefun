"""Actual native alpha bounds and lossless standard-fallback placement, no resizing."""

import hashlib
import json
from pathlib import Path
from PIL import Image

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-bake/snowplow"
captures = D / "author-view/captures"
c = json.loads((captures / "capture.json").read_text())
assert c["status"] == "passed" and c["nativeSize"] == 256
assert (
    c["glbSha256"]
    == hashlib.sha256((D / "author-view/model.glb").read_bytes()).hexdigest()
)
assert (
    c["glbSha256"]
    == hashlib.sha256(
        (R / "public/demos/vehicle-bake/snowplow/v1/model.glb").read_bytes()
    ).hexdigest()
)
assert len(c["centered128GameCropProof"]) == 16
assert all(p["mismatchedChannels"] == 0 for p in c["centered128GameCropProof"])
headings = []
for mode in ["study", "engine"]:
    for i in range(16):
        p = captures / f"{mode}-{i}.png"
        im = Image.open(p).convert("RGBA")
        assert im.size == (256, 256)
        box = im.getchannel("A").getbbox()
        assert box and box[0] > 0 and box[1] > 0 and box[2] < 256 and box[3] < 256
        headings.append({"camera": mode, "headingIndex": i, "alphaBounds": list(box)})
cardinals = []
for i in [4, 12, 8, 0]:
    im = Image.open(captures / f"engine-{i}.png").convert("RGBA")
    box = im.getchannel("A").getbbox()
    target = [box[0] - 32, box[1] + 16, box[2] - 32, box[3] + 16]
    fits = target[0] >= 0 and target[1] >= 0 and target[2] <= 192 and target[3] <= 224
    if fits:
        frame = Image.new("RGBA", (192, 224))
        frame.paste(im, (-32, 16))
        original_pixels = [px for px in im.getdata() if px[3]]
        actual_pixels = [px for px in frame.getdata() if px[3]]
        assert original_pixels == actual_pixels
    cardinals.append(
        {
            "headingIndex": i,
            "nativeBounds": list(box),
            "fallbackBounds": target,
            "fitsWithoutPixelLoss": fits,
        }
    )
r = {
    "status": (
        "passed"
        if all(x["fitsWithoutPixelLoss"] for x in cardinals)
        else "needs-larger-fallback-padding"
    ),
    "glbSha256": c["glbSha256"],
    "nativeSize": 256,
    "meshRadius": 128,
    "centered128GameCropProof": c["centered128GameCropProof"],
    "paddingFrom224": {"left": 16, "right": 16, "top": 16, "bottom": 16},
    "paddingReason": "Requested 256/radius128 padding for the broad blade and hopper. The 256/radius128 viewport expands world bounds and padding at identical pixels per world unit; vehicle origin and scale remain unchanged.",
    "headings": headings,
    "fallbackFrame": [192, 224],
    "fallbackOrigin": [96, 144],
    "sourceGameOrigin": [128, 128],
    "translation": [-32, 16],
    "cardinals": cardinals,
    "meaning": "Fixed native cameras and world density. Only transparent padding can be cropped/added. Cardinal occupied pixel order/RGBA values are compared exactly after integer translation; no resize or recenter.",
}
(D / "native-fit.json").write_text(json.dumps(r, indent=2) + "\n")
print(json.dumps({"status": r["status"], "cardinals": cardinals}, indent=2))
