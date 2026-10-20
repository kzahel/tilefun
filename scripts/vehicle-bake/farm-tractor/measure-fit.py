"""Actual native alpha bounds and lossless standard-fallback placement, no resizing."""

import hashlib
import json
from pathlib import Path
from PIL import Image

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-bake/farm-tractor"
captures = D / "author-view/captures"
c = json.loads((captures / "capture.json").read_text())
assert c["status"] == "passed" and c["nativeSize"] == 224
assert (
    c["glbSha256"]
    == hashlib.sha256((D / "author-view/model.glb").read_bytes()).hexdigest()
)
assert (
    c["glbSha256"]
    == hashlib.sha256(
        (R / "public/demos/vehicle-bake/farm-tractor/v1/model.glb").read_bytes()
    ).hexdigest()
)
assert len(c["centered128GameCropProof"]) == 16
assert all(p["mismatchedChannels"] == 0 for p in c["centered128GameCropProof"])
headings = []
for mode in ["study", "engine"]:
    for i in range(16):
        p = captures / f"{mode}-{i}.png"
        im = Image.open(p).convert("RGBA")
        assert im.size == (224, 224)
        box = im.getchannel("A").getbbox()
        assert box and box[0] > 0 and box[1] > 0 and box[2] < 224 and box[3] < 224
        headings.append({"camera": mode, "headingIndex": i, "alphaBounds": list(box)})
cardinals = []
for i in [4, 12, 8, 0]:
    im = Image.open(captures / f"engine-{i}.png").convert("RGBA")
    box = im.getchannel("A").getbbox()
    target = [box[0] - 16, box[1] + 32, box[2] - 16, box[3] + 32]
    fits = target[0] >= 0 and target[1] >= 0 and target[2] <= 192 and target[3] <= 224
    if fits:
        frame = Image.new("RGBA", (192, 224))
        frame.paste(im, (-16, 32))
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
    "nativeSize": 224,
    "meshRadius": 112,
    "centered128GameCropProof": c["centered128GameCropProof"],
    "headings": headings,
    "fallbackFrame": [192, 224],
    "fallbackOrigin": [96, 144],
    "sourceGameOrigin": [112, 112],
    "translation": [-16, 32],
    "cardinals": cardinals,
    "meaning": "Fixed native cameras and world density. Only transparent padding can be cropped/added. Cardinal occupied pixel order/RGBA values are compared exactly after integer translation; no resize or recenter.",
}
(D / "native-fit.json").write_text(json.dumps(r, indent=2) + "\n")
print(json.dumps({"status": r["status"], "cardinals": cardinals}, indent=2))
