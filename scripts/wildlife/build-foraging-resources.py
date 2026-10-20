"""Original native-pixel materials, nest construction stages and food cache.
The retained editable paint recipe is replayable without downloaded art.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
S = ROOT / "art-source/wildlife-v2/foraging-resources/behavior-v1"
O = ROOT / "public/demos/wildlife-v2/foraging-resources/behavior-v1"
assert not (S / "receipt.json").exists(), "Registered resource bank is immutable"
S.mkdir(parents=True, exist_ok=True)
O.mkdir(parents=True, exist_ok=True)
palette = {"outline": "#493b2d", "twig": "#a77b4c", "light": "#d2ae72", "soil": "#816144", "dark": "#59442f", "apple": "#c34d37", "fruit-light": "#e77c43", "leaf": "#6c8e43"}
paint = []
paint.append([("line", [8, 22, 24, 11], "outline", 3), ("line", [8, 21, 24, 11], "twig", 1), ("line", [15, 17, 13, 11], "outline", 2), ("line", [17, 16, 24, 17], "twig", 2)])
paint.append([("ellipse", [11, 12, 21, 22], "outline", 1), ("ellipse", [12, 13, 20, 21], "apple", 1), ("line", [14, 14, 14, 17], "fruit-light", 1), ("line", [16, 12, 17, 9], "dark", 1), ("ellipse", [18, 9, 22, 11], "leaf", 1)])
paint.append([("ellipse", [12, 14, 20, 22], "outline", 1), ("ellipse", [13, 14, 19, 21], "twig", 1), ("line", [14, 16, 14, 19], "light", 1), ("rectangle", [12, 13, 20, 15], "dark", 1)])
for stage in range(5):
    ops = []
    if stage:
        ops += [("ellipse", [5, 13, 27, 25], "outline", 1), ("ellipse", [6, 13, 26, 23], "twig", 1), ("ellipse", [9, 14, 23, 19], "dark", 1)]
    for i in range(2 + stage * 3):
        x = 5 + (i * 7) % 21
        y = 16 + (i * 3) % 8
        ops += [("line", [x, y, min(28, x + 5), y - 3 + i % 4], "light" if i % 3 == 0 else "twig", 1)]
    paint.append(ops)
paint.append([("ellipse", [7, 19, 25, 25], "soil", 1), ("ellipse", [10, 20, 22, 23], "dark", 1), ("line", [8, 19, 11, 17], "leaf", 1)])
paint.append([("ellipse", [7, 18, 25, 25], "outline", 1), ("ellipse", [8, 18, 24, 24], "soil", 1), ("line", [10, 19, 19, 19], "twig", 1), ("line", [8, 19, 11, 16], "leaf", 1), ("line", [22, 18, 24, 16], "leaf", 1)])
recipe = {"identity": "foraging-resources-behavior-v1", "canvas": 32, "anchor": [16, 16], "palette": palette, "frames": paint}
recipe_path = S / "paint.json"
if recipe_path.exists():
    recipe = json.loads(recipe_path.read_text(encoding="utf8"))
else:
    recipe_path.write_text(json.dumps(recipe, indent=2) + "\n", encoding="utf8")
sheet = Image.new("RGBA", (320, 128))
for column, operations in enumerate(recipe["frames"]):
    tile = Image.new("RGBA", (32, 32))
    draw = ImageDraw.Draw(tile)
    for shape, bounds, key, width in operations:
        if shape == "line":
            draw.line(bounds, fill=recipe["palette"][key], width=width)
        else:
            getattr(draw, shape)(bounds, fill=recipe["palette"][key])
    for row in range(4):
        sheet.alpha_composite(tile, (column * 32, row * 32))
sheet.save(O / "sheet.png")
print("Resource atlas", hashlib.sha256((O / "sheet.png").read_bytes()).hexdigest())
