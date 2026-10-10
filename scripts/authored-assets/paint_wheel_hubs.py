"""Author a small three-spoke hub using the current compact sprite's gray palette.

This is explicit animation-friendly UV paint, not recovered rotating source art.
"""
import argparse
import math
from pathlib import Path
from PIL import Image, ImageDraw
from pipeline import digest, read, write

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--recipe", type=Path, required=True)
parser.add_argument("--atlas", type=Path, required=True)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
if args.out.exists() or args.out.with_suffix(".json").exists():
    raise FileExistsError("Choose a new hub atlas output.")
recipe = read(args.recipe)
view = next(v for v in recipe["views"] if v["id"] == "east")
source = args.recipe.resolve().parent/view["source"]
assert digest(source) == view["sourceSha256"]
reference = Image.open(source).convert("RGBA")
palette = {"base": reference.getpixel((14, 57)), "spoke": reference.getpixel((13, 59)), "ink": reference.getpixel((11, 55))}
if any(c[3] != 255 for c in palette.values()):
    raise ValueError("Hub palette landmark is outside the compact source.")
atlas = Image.open(args.atlas).convert("RGBA")
if atlas.size != (1024, 1024):
    raise ValueError("This compact hub island expects the 1024 atlas layout.")
tile = Image.new("RGBA", (72, 72), palette["ink"])
draw = ImageDraw.Draw(tile)
draw.ellipse((4, 4, 68, 68), fill=palette["base"])
for k in range(3):
    a = k*math.tau/3
    draw.line((36+11*math.cos(a), 36+11*math.sin(a), 36+28*math.cos(a), 36+28*math.sin(a)), fill=palette["spoke"], width=8)
draw.ellipse((29, 29, 43, 43), fill=palette["spoke"])
atlas.paste(tile, (408, 344))
atlas.save(args.out)
write(args.out.with_suffix(".json"), {"inputAtlasSha256": digest(args.atlas), "sourceSha256": digest(source),
    "atlasSha256": digest(args.out), "rect": [408, 344, 480, 416], "palette": palette,
    "status": "Authored three-spoke wheel hub for visible rotation; unreviewed; coverage unchanged"})
