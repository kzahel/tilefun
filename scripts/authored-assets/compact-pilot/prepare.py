"""Freeze exact original directional crops from the committed vehicle bank."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
# A fresh offline workspace; generated files never live beside this source code.
import os
WORKSPACE = Path(os.environ.get("TILEFUN_COMPACT_PILOT", ROOT / "data/authored-assets/compact-pilot")).resolve()
HERE = WORKSPACE / "source"
OUT = WORKSPACE / "render"
if WORKSPACE.exists():
    raise FileExistsError("Choose a new TILEFUN_COMPACT_PILOT workspace.")
HERE.mkdir(parents=True)
OUT.mkdir()
bank = json.loads((ROOT / "src/traffic/vehicles-v1.json").read_text())
source = ROOT / "public/assets/tilesets/me-complete.png"
assert hashlib.sha256(source.read_bytes()).hexdigest() == bank["sourceFingerprint"]
image = Image.open(source).convert("RGBA")
sheet = Image.new("RGB", (800, 260), "#53636b")
draw = ImageDraw.Draw(sheet)
for i, direction in enumerate(["north", "east", "south", "west"]):
    view = next(v for v in bank["views"] if v["id"] == "vehicle:compact-1:" + direction)
    x, y, w, h = view["rect"]
    crop = image.crop((x, y, x + w, y + h))
    crop.save(HERE / (direction + ".png"))
    enlarged = crop.resize((w * 3, h * 3), Image.Resampling.NEAREST)
    sheet.paste(enlarged, (i * 200, 40), enlarged)
    draw.text((i * 200 + 10, 10), direction + " · original", fill="white")
sheet.save(OUT / "sources.png")
print("Frozen four genuine source crops; atlas hash matches promoted bank")
