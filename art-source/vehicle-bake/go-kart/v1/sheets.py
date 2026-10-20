"""Contact sheets from actual shared engine PNGs; integer nearest scaling only."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
p = ROOT / "data/vehicle-bake/go-kart/author-view/captures"
for mode in ["study", "engine"]:
    cell = 448
    sheet = Image.new("RGB", (4 * cell, 4 * (cell + 26)), "#263d37")
    draw = ImageDraw.Draw(sheet)
    for i in range(16):
        im = Image.open(p / f"{mode}-{i}.png").convert("RGBA")
        assert im.size == (224, 224)
        x = (i % 4) * cell
        y = (i // 4) * (cell + 26)
        draw.text(
            (x + 8, y + 4),
            f"{mode} / {i*22.5:g} degrees / actual GLB / 2x nearest",
            fill="white",
        )
        sheet.paste(
            im.resize((cell, cell), Image.Resampling.NEAREST),
            (x, y + 26),
            im.resize((cell, cell), Image.Resampling.NEAREST),
        )
    sheet.save(p / f"inspection-{mode}.png")
sheet = Image.new("RGB", (4 * 448, 4 * 474), "#263d37")
draw = ImageDraw.Draw(sheet)
for row, mode in enumerate(["study", "engine"]):
    for i in range(8):
        prefix = "roll" if mode == "study" else "game-roll"
        im = (
            Image.open(p / f"{prefix}-{i}.png")
            .convert("RGBA")
            .resize((448, 448), Image.Resampling.NEAREST)
        )
        x = (i % 4) * 448
        y = (row * 2 + i // 4) * 474
        phase = (i if i < 4 else i - 8) * 45
        draw.text(
            (x + 8, y + 4), f"{mode} / roll {phase} degrees / 2x nearest", fill="white"
        )
        sheet.paste(im, (x, y + 26), im)
sheet.save(p / "inspection-phases.png")

# Distinguish shared-distance front-angle labels from equal-angle diagnostic.
for kind in ["ordinary-distance", "equal-angle"]:
    sheet = Image.new("RGB", (4 * 448, 4 * 474), "#263d37")
    draw = ImageDraw.Draw(sheet)
    for row, mode in enumerate(["study", "engine"]):
        for i in range(8):
            im = (
                Image.open(p / f"{kind}-{mode}-{i}.png")
                .convert("RGBA")
                .resize((448, 448), Image.Resampling.NEAREST)
            )
            phase = (i if i < 4 else i - 8) * 45
            x = (i % 4) * 448
            y = (row * 2 + i // 4) * 474
            text = f"{mode} / {kind} / front {phase:g}deg"
            if kind == "ordinary-distance":
                text += f" / rear {phase*.25/.27:g}deg"
            draw.text((x + 6, y + 4), text, fill="white")
            sheet.paste(im, (x, y + 26), im)
    sheet.save(p / f"inspection-{kind}.png")
