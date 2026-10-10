"""Compose review evidence from actual Blender renders; pin final public bytes."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
# A fresh offline workspace; generated files never live beside this source code.
import os
WORKSPACE = Path(os.environ.get("TILEFUN_COMPACT_PILOT", ROOT / "data/authored-assets/compact-pilot")).resolve()
HERE = WORKSPACE / "source"
OUT = WORKSPACE / "render"
BACKGROUND = "#53636b"


def place(sheet, name, box, label, native=False):
    x, y, w, h = box
    im = Image.open(OUT / (name + ".png")).convert("RGBA")
    if native:
        im = im.resize((76, 76), Image.Resampling.LANCZOS).resize((304, 304), Image.Resampling.NEAREST)
    else:
        im.thumbnail((w, h), Image.Resampling.LANCZOS)
    sheet.paste(im, (x + (w - im.width) // 2, y + (h - im.height) // 2), im)
    ImageDraw.Draw(sheet).text((x + 12, y + 10), label, fill="white")


sheet = Image.new("RGB", (1152, 768), BACKGROUND)
for k, (name, label) in enumerate([("oblique", "Authored mesh + cleaned UV"), ("top", "Top · orthographic"),
                                   ("side-left", "Left · orthographic"), ("front", "Front · orthographic"),
                                   ("rear", "Rear · orthographic"), ("side-right", "Right · orthographic")]):
    place(sheet, name, ((k % 3) * 384, (k // 3) * 384, 384, 384), label)
sheet.save(OUT / "comparison.png")
sheet = Image.new("RGB", (1152, 384), BACKGROUND)
for k, (name, label) in enumerate([("clay-oblique", "1 · Authored geometry"), ("draft-oblique", "2 · Raw sprite projection"),
                                   ("oblique", "3 · Cleaned UV paint")]):
    place(sheet, name, (k * 384, 0, 384, 384), label)
sheet.save(OUT / "stages.png")

# Fixed-camera inspection at 1 world pixel per image pixel. Match length scale,
# not exact projected source pixels; the source directions are hand-drawn.
sheet = Image.new("RGB", (1024, 520), BACKGROUND)
draw = ImageDraw.Draw(sheet)
for k, direction in enumerate(["east", "west", "north", "south"]):
    source = Image.open(HERE / (direction + ".png")).convert("RGBA")
    source.thumbnail((76, 76), Image.Resampling.NEAREST)
    render = Image.open(OUT / ("source-" + direction + ".png")).convert("RGBA").resize((76, 76), Image.Resampling.LANCZOS)
    for row, im, label in [(0, source, direction + " · original"), (1, render, "1 px / world px · 3x display")]:
        im = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
        sheet.paste(im, (k * 256 + (256 - im.width) // 2, row * 260 + 32), im)
        draw.text((k * 256 + 12, row * 260 + 12), label, fill="white")
sheet.save(OUT / "game-scale.png")
frames = []
for k in range(24):
    im = Image.open(OUT / f"orbit-{k:02d}.png").convert("RGBA")
    bg = Image.new("RGB", im.size, BACKGROUND)
    bg.paste(im, (0, 0), im)
    frames.append(bg.quantize(colors=128))
frames[0].save(OUT / "turntable.gif", save_all=True, append_images=frames[1:], duration=120, loop=0, disposal=2)

files = sorted(p for p in OUT.iterdir() if p.suffix in [".png", ".gif", ".glb", ".json"] and p.name != "candidate.json")
record = {"id": "projection:authored-compact-car-v1", "revision": "blender-uv-v1",
          "sourceFingerprint": json.loads((OUT / "provenance.json").read_text())["sourceFingerprint"],
          "files": [{"path": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
          "source": {"blendSha256": hashlib.sha256((HERE / "car.blend").read_bytes()).hexdigest(),
                     "recipeSha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path(__file__).resolve().parent.glob("*.py"))}}}
(OUT / "candidate.json").write_text(json.dumps(record, indent=2) + "\n")
print(f"Review panels and 24-frame turntable; pinned {len(files)} artifact hashes")
