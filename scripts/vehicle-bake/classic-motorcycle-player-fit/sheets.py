"""Actual raw-GLTF source diagnostic sheets; integer nearest enlargement only."""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
C = ROOT / "data/vehicle-bake/classic-motorcycle-player-fit/captures"


def sheet(name, panels, tight=False):
    cell = 384 if tight else 448
    out = Image.new(
        "RGB", (4 * cell, ((len(panels) + 3) // 4) * (cell + 24)), "#263d37"
    )
    pen = ImageDraw.Draw(out)
    for i, (file, label) in enumerate(panels):
        image = Image.open(C / file).convert("RGBA")
        assert image.size == (224, 224)
        if tight:
            image = image.crop(
                (64, 80, 160, 176) if "study" in file else (64, 52, 160, 148)
            )
        image = image.resize((cell, cell), Image.Resampling.NEAREST)
        x, y = i % 4 * cell, i // 4 * (cell + 24)
        out.paste(image, (x, y + 24), image)
        pen.text((x + 5, y + 5), label, fill="white")
    out.save(C / name)


for mode in ["study", "engine"]:
    for view in ["combined", "bike-alone", "rider-alone", "ownership-mask"]:
        sheet(
            f"inspection-{view}-{mode}.png",
            [
                (
                    f"{view}-{mode}-{i}.png",
                    f"{view} / {mode} {i*22.5:g}deg / raw GLTF 2x",
                )
                for i in range(16)
            ],
        )
        sheet(
            f"inspection-detail-{view}-{mode}.png",
            [
                (
                    f"{view}-{mode}-{i}.png",
                    f"{view} / {mode} {i*22.5:g}deg / fixed crop4x",
                )
                for i in range(16)
            ],
            tight=True,
        )
        if view != "ownership-mask":
            sheet(
                f"inspection-detail-wire-{view}-{mode}.png",
                [
                    (
                        f"wire-{view}-{mode}-{i}.png",
                        f"actual {view} / {mode} {i*22.5:g}deg wire",
                    )
                    for i in range(16)
                ],
                tight=True,
            )
sheet(
    "inspection-phases.png",
    [
        (f"phase-{mode}-{i}.png", f"{mode} signed {(i if i<4 else i-8)*45}deg")
        for mode in ["study", "engine"]
        for i in range(8)
    ],
    tight=True,
)
sheet(
    "inspection-independent.png",
    [
        (f"independent-{w}-{i}.png", f"{w} only {[0,90,-90,0][i]}deg")
        for w in ["F", "R"]
        for i in range(4)
    ],
    tight=True,
)
sheet(
    "inspection-wires.png",
    [
        (f"wire-{view}-{mode}.png", f"{view} / {mode} wireframe")
        for mode in ["study", "engine"]
        for view in ["combined", "bike-alone", "rider-alone"]
    ],
    tight=True,
)
