"""Nearest-only actual native rider/ignored-fixture inspection sheets."""

from pathlib import Path
from PIL import Image, ImageDraw

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-riders/bear-upright"
P = D / "captures"
for view in ["rider", "combined", "wire-rider", "wire-combined"]:
    for mode in ["study", "engine"]:
        frames = [
            Image.open(P / f"{view}-{mode}-{i}.png").convert("RGBA") for i in range(16)
        ]
        bounds = [f.getbbox() for f in frames]
        box = (
            min(b[0] for b in bounds) - 4,
            min(b[1] for b in bounds) - 4,
            max(b[2] for b in bounds) + 4,
            max(b[3] for b in bounds) + 4,
        )
        w = (box[2] - box[0]) * 4
        h = (box[3] - box[1]) * 4
        sheet = Image.new("RGB", (w * 4, (h + 22) * 4), "#263d37")
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(frames):
            im = f.crop(box).resize((w, h), Image.Resampling.NEAREST)
            x = i % 4 * w
            y = i // 4 * (h + 22)
            draw.text((x + 3, y + 3), f"{view}/{mode}/{i*22.5:g}/4x", fill="white")
            sheet.paste(im, (x, y + 22), im)
        sheet.save(D / f"inspection-{view}-{mode}.png")
print("Same-bounds integer4x detail sheets generated; original224pixels retained")
