"""Raw frozen-car parity and nearest-only inspection sheets from actual GPU PNGs."""

from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-riders/explorer"
P = D / "captures"
C = json.loads((Path(__file__).with_name("rider.json")).read_text())
rows = []
for mode in ["study", "engine"]:
    for i in range(16):
        a = Image.open(P / f"bare-{mode}-{i}.png").convert("RGBA")
        b = Image.open(
            R / C["carControl"]["frozenCaptures"] / f"{mode}-{i}.png"
        ).convert("RGBA")
        n = sum(x != y for x, y in zip(a.tobytes(), b.tobytes()))
        rows.append({"mode": mode, "index": i, "mismatchedRGBAChannels": n})
assert all(r["mismatchedRGBAChannels"] == 0 for r in rows), rows
mask_rows = []
for mode in ["study", "engine"]:
    for i in range(16):
        alone = (
            Image.open(P / f"rider-{mode}-{i}.png")
            .convert("RGBA")
            .getchannel("A")
            .tobytes()
        )
        visible = (
            Image.open(P / f"visible-mask-{mode}-{i}.png")
            .convert("RGBA")
            .getchannel("A")
            .tobytes()
        )
        outside = sum(v > 0 and a == 0 for a, v in zip(alone, visible))
        occluded = sum(a > 0 and v == 0 for a, v in zip(alone, visible))
        assert outside == 0 and occluded > 0
        mask_rows.append(
            {
                "mode": mode,
                "index": i,
                "visibleMaskOutsideRiderPixels": outside,
                "actualCarDepthOccludedRiderPixels": occluded,
            }
        )
(D / "occlusion-proof.json").write_text(
    json.dumps(
        {
            "status": "passed",
            "singleDepthTarget": True,
            "views": mask_rows,
            "meaning": "Car writes real depth without color in the visibility diagnostic; rider then depth-tests in that same target. Visible alpha is a strict subset of rider-alone alpha at all32headings. Production combined view uses both original opaque materials, one shared camera/yaw/target and one shared outline. No sprite overlays.",
        },
        indent=2,
    )
    + "\n"
)
(D / "bare-car-parity.json").write_text(
    json.dumps(
        {
            "status": "passed",
            "carSha256": C["carControl"]["sha256"],
            "frozenViews": C["carControl"]["frozenCaptures"],
            "comparedPixelsPerView": 224 * 224,
            "views": rows,
            "meaning": "All32 rider-hidden pixels exactly match existing unchanged frozen roadster views. No re-export, camera fitting or per-heading resizing.",
        },
        indent=2,
    )
    + "\n"
)
for view in ["combined", "rider", "visible-mask"]:
    for mode in ["study", "engine"]:
        sheet = Image.new("RGB", (4 * 448, 4 * 474), "#263d37")
        draw = ImageDraw.Draw(sheet)
        for i in range(16):
            im = (
                Image.open(P / f"{view}-{mode}-{i}.png")
                .convert("RGBA")
                .resize((448, 448), Image.Resampling.NEAREST)
            )
            x = i % 4 * 448
            y = i // 4 * 474
            draw.text(
                (x + 6, y + 4),
                f"{view} / {mode} / {i*22.5:g}deg / 2x nearest",
                fill="white",
            )
            sheet.paste(im, (x, y + 26), im)
        sheet.save(D / f"inspection-{view}-{mode}.png")
        if view == "rider":
            frames = [
                Image.open(P / f"rider-{mode}-{i}.png").convert("RGBA")
                for i in range(16)
            ]
            bounds = [f.getbbox() for f in frames]
            box = (
                min(b[0] for b in bounds) - 3,
                min(b[1] for b in bounds) - 3,
                max(b[2] for b in bounds) + 3,
                max(b[3] for b in bounds) + 3,
            )
            w = (box[2] - box[0]) * 4
            h = (box[3] - box[1]) * 4
            detail = Image.new("RGB", (4 * w, 4 * (h + 22)), "#263d37")
            labels = ImageDraw.Draw(detail)
            for i, frame in enumerate(frames):
                crop = frame.crop(box).resize((w, h), Image.Resampling.NEAREST)
                x = i % 4 * w
                y = i // 4 * (h + 22)
                labels.text((x + 3, y + 3), f"{mode} {i*22.5:g} / 4x", fill="white")
                detail.paste(crop, (x, y + 22), crop)
            detail.save(D / f"identity-detail-{mode}.png")
print("All32 unchanged frozen bare-car pixel comparisons exact")
