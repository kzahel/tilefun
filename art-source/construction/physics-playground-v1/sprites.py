"""Draw loading fallbacks for the rigid playground pieces."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[3]
geometry = json.loads((root / "src/entities/PhysicsPlaygroundGeometry.json").read_text())
sizes = [(182, 101), (48, 48), (176, 72), (32, 60)]
color = {
    "track": "#437a83", "frame": "#234753", "rail": "#e9ab3e", "exit": "#52927e",
    "exitRail": "#89bc8e", "deck": "#3c6875", "dark": "#263b45",
}
for (name, spec), (width, height) in zip(geometry.items(), sizes, strict=True):
    image = Image.new("RGBA", (width, height))
    draw = ImageDraw.Draw(image)
    depth = spec["size"][1]
    pieces = sorted(spec["pieces"], key=lambda p: (
        0 if p["paint"] in ("frame", "dark") else 1, sum(p["y"])
    ))
    for piece in pieces:
        x0, x1 = [width / 2 + x for x in piece["x"]]
        y0, y1 = [height - depth / 2 + y - 1 for y in piece["y"]]
        z0, z1 = piece["top"]
        b0, b1 = piece["bottom"]
        draw.polygon([(x0, y1-z0), (x1, y1-z1), (x1, y1-b1), (x0, y1-b0)], "#2e4246")
        draw.polygon([(x0, y0-z0), (x1, y0-z1), (x1, y1-z1), (x0, y1-z0)], color[piece["paint"]])
    image.save(root / "public/assets/vehicles" / f"{name}.png")
