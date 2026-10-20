"""Contact sheets from actual shared engine PNGs; integer nearest scaling only."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
p = ROOT / "data/vehicle-bake/woody-wagon/author-view/captures"
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


# Detail sheets use a single fixed 128px crop per camera, then nearest2x. Original
# full224px captures above remain the camera/clipping evidence.
def detail_sheet(name, panels):
    out = Image.new("RGB", (1024, 280 * ((len(panels) + 3) // 4)), "#263d37")
    pen = ImageDraw.Draw(out)
    for i, (file, mode, label) in enumerate(panels):
        box = (48, 64, 176, 192) if mode == "study" else (48, 32, 176, 160)
        tile = (
            Image.open(p / file)
            .convert("RGBA")
            .crop(box)
            .resize((256, 256), Image.Resampling.NEAREST)
        )
        x, y = (i % 4) * 256, (i // 4) * 280
        out.paste(tile, (x, y + 24), tile)
        pen.text((x + 5, y + 5), label, fill="white")
    out.save(p / name)


for mode in ["study", "engine"]:
    detail_sheet(
        f"inspection-tight-{mode}.png",
        [
            (f"{mode}-{i}.png", mode, f"{mode} {i * 22.5:g}deg / fixed crop2x")
            for i in range(16)
        ],
    )
detail_sheet(
    "inspection-tight-phases.png",
    [
        (
            f"{'roll' if mode == 'study' else 'game-roll'}-{i}.png",
            mode,
            f"{mode} {(i if i < 4 else i - 8) * 45}deg",
        )
        for mode in ["study", "engine"]
        for i in range(8)
    ],
)
if (p / "independent-FL-0.png").exists():
    detail_sheet(
        "inspection-independent.png",
        [
            (
                f"independent-{w}-{i}.png",
                "engine",
                f"{w} only {[0, 90, -90, 0][i]}deg / other fixed",
            )
            for w in ["FL", "FR", "RL", "RR"]
            for i in range(4)
        ],
    )
detail_sheet(
    "inspection-wires.png",
    [
        (f"wire-{mode}.png", mode, f"{mode} actual GLB wireframe")
        for mode in ["study", "engine"]
    ],
)
