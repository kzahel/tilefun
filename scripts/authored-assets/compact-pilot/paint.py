"""Project genuine sprite pixels into named UV islands, then author clean paint.

Pillow only. Projection is a recorded rough camera hypothesis, not calibration.
Final windows/trim/hidden surfaces are deliberate palette-matched authorship.
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
# A fresh offline workspace; generated files never live beside this source code.
import os
WORKSPACE = Path(os.environ.get("TILEFUN_COMPACT_PILOT", ROOT / "data/authored-assets/compact-pilot")).resolve()
HERE = WORKSPACE / "source"
OUT = WORKSPACE / "render"
data = json.loads((HERE / "geometry.json").read_text())
regions = data["regions"]
sources = {d: Image.open(HERE / (d + ".png")).convert("RGBA")
           for d in ["east", "west", "north", "south"]}
draft = Image.new("RGBA", (512, 512), (66, 73, 86, 255))
coverage = Image.new("RGB", (512, 512), "#292e38")


def project(point, region):
    x, y, z = point
    if region.endswith("left"):
        return "east", x + 32, 52 - y - z
    if region.endswith("right"):
        return "west", 32 - x, 53 + y - z
    return "north", 16 + y, 40 + .9 * x - .65 * z


# Rasterize triangulated UV polygons, interpolating the actual authored 3D points.
# Use Pillow to triangulate only the convex named top/cabin surfaces; concave body
# sides use their planar X/Z inverse, so no fan crosses a wheel-arch opening.
observed = 0
painted = 0
for obj in data["objects"]:
    region = obj["region"]
    x0, y0, x1, y1 = regions[region]
    if region in ["tire", "hub", "underbody"]:
        continue
    for face, uv in zip(obj["faces"], obj["uvs"]):
        points = [obj["vertices"][i] for i in face]
        pixels = [(u * 512, (1 - v) * 512) for u, v in uv]
        mask = Image.new("1", (512, 512))
        ImageDraw.Draw(mask).polygon(pixels, fill=1)
        # Recover planar position from UV through three non-collinear corners.
        a = pixels[0]
        chosen = None
        for j in range(1, len(pixels) - 1):
            b, c = pixels[j], pixels[j + 1]
            det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
            if abs(det) > 1e-4:
                chosen = j, det
                break
        if not chosen:
            continue
        j, det = chosen
        b, c = pixels[j], pixels[j + 1]
        for v in range(y0, y1 + 1):
            for u in range(x0, x1 + 1):
                if not mask.getpixel((u, v)):
                    continue
                dx, dy = u + .5 - a[0], v + .5 - a[1]
                wb = (dx * (c[1] - a[1]) - (c[0] - a[0]) * dy) / det
                wc = ((b[0] - a[0]) * dy - dx * (b[1] - a[1])) / det
                p = [points[0][k] * (1 - wb - wc) + points[j][k] * wb + points[j + 1][k] * wc for k in range(3)]
                direction, sx, sy = project(p, region)
                im = sources[direction]
                sx, sy = round(sx), round(sy)
                painted += 1
                if 0 <= sx < im.width and 0 <= sy < im.height and im.getpixel((sx, sy))[3] >= 200:
                    draft.putpixel((u, v), (*im.getpixel((sx, sy))[:3], 255))
                    coverage.putpixel((u, v), (83, 176, 131))
                    observed += 1
                else:
                    draft.putpixel((u, v), (207, 111, 155, 255) if ((u // 8 + v // 8) % 2) else (84, 53, 86, 255))
                    coverage.putpixel((u, v), (209, 112, 155))
draft.save(OUT / "projected-atlas.png")
coverage.save(OUT / "coverage.png")

# Deliberate texture atlas at four texels per logical paint pixel. Large UV islands
# preserve straight stripes and glass boundaries instead of per-triangle seams.
atlas = Image.new("RGBA", (512, 512), (39, 46, 65, 255))
palette = {"blue": "#246cc5", "light": "#3996df", "roof": "#58c2e7",
           "dark": "#244476", "outline": "#313b58", "glass": "#7fa9ce",
           "glasslight": "#b0cce0", "stripe": "#84cae2", "tire": "#343948"}


def tile(region, width, height, painter):
    im = Image.new("RGB", (width, height), palette["blue"])
    draw = ImageDraw.Draw(im)
    painter(draw, im)
    x0, y0, x1, y1 = regions[region]
    atlas.paste(im.resize((x1 - x0 + 1, y1 - y0 + 1), Image.Resampling.NEAREST), (x0, y0))
    # Four-pixel duplicated gutters keep texture filtering from leaking neighbors.
    for n in range(1, 5):
        atlas.paste(atlas.crop((x0, y0, x1 + 1, y0 + 1)), (x0, y0 - n))
        atlas.paste(atlas.crop((x0, y1, x1 + 1, y1 + 1)), (x0, y1 + n))
        atlas.paste(atlas.crop((x0, y0 - 4, x0 + 1, y1 + 5)), (x0 - n, y0 - 4))
        atlas.paste(atlas.crop((x1, y0 - 4, x1 + 1, y1 + 5)), (x1 + n, y0 - 4))


def body(d, im):
    d.rectangle((0, 0, 55, 2), fill=palette["light"])
    d.rectangle((0, 5, 55, 6), fill=palette["dark"])
    d.rectangle((2, 3, 53, 3), fill=palette["stripe"])
    d.line((23, 0, 23, 6), fill=palette["dark"])
    d.line((41, 0, 41, 6), fill=palette["dark"])
    d.rectangle((37, 1, 40, 1), fill=palette["outline"])
    d.rectangle((0, 1, 2, 2), fill="#f3f2e6")
    d.rectangle((53, 1, 55, 2), fill="#dc555f")


def cabin(d, im):
    d.rectangle((0, 0, 33, 8), fill=palette["outline"])
    d.polygon([(2, 7), (9, 1), (17, 1), (17, 7)], fill=palette["glass"])
    d.polygon([(19, 1), (24, 1), (30, 7), (19, 7)], fill=palette["glass"])
    d.polygon([(3, 7), (10, 1), (12, 1), (5, 7)], fill=palette["glasslight"])
    d.line((20, 2, 24, 6), fill=palette["glasslight"])
    d.line((0, 8, 33, 8), fill=palette["light"])
    d.line((0, 0, 33, 0), fill=palette["roof"])


def roof(d, im):
    d.rectangle((0, 0, 19, 17), fill=palette["roof"])
    d.rectangle((0, 0, 19, 0), fill=palette["light"])
    d.rectangle((0, 0, 0, 17), fill=palette["light"])
    d.rectangle((19, 0, 19, 17), fill=palette["light"])
    d.rectangle((2, 3, 3, 8), fill="#80d8ee")
    d.rectangle((15, 2, 17, 2), fill="#91dff0")


def glass(d, im):
    d.rectangle((0, 0, 19, 13), fill=palette["outline"])
    d.rectangle((1, 1, 18, 12), fill=palette["glass"])
    d.polygon([(2, 9), (11, 1), (16, 1), (4, 12), (2, 12)], fill=palette["glasslight"])
    d.line((2, 11, 17, 11), fill=palette["dark"])


def hood(d, im):
    d.rectangle((0, 0, 19, 17), fill=palette["light"])
    d.rectangle((1, 1, 18, 16), fill=palette["roof"])
    d.line((1, 16, 18, 16), fill=palette["blue"])
    d.rectangle((2, 4, 3, 8), fill="#80d8ee")
    d.rectangle((15, 3, 17, 3), fill="#91dff0")


def fascia(d, im, rear=False):
    d.rectangle((0, 0, 19, 7), fill=palette["blue"])
    d.rectangle((0, 0, 19, 1), fill=palette["light"])
    d.rectangle((0, 5, 19, 7), fill=palette["dark"])
    d.rectangle((1, 2, 4, 4), fill="#d64e5d" if rear else "#f3f2e6")
    d.rectangle((15, 2, 18, 4), fill="#d64e5d" if rear else "#f3f2e6")
    d.rectangle((7, 3, 12, 4), fill=palette["outline"])


for side in ["left", "right"]:
    tile("body-" + side, 56, 7, body)
    tile("cabin-" + side, 34, 9, cabin)
tile("roof", 20, 18, roof)
tile("hood", 20, 18, hood)
tile("hatch", 20, 18, hood)
tile("windshield", 20, 14, glass)
tile("rear-glass", 20, 14, glass)
tile("front", 20, 8, fascia)
tile("rear", 20, 8, lambda d, im: fascia(d, im, True))
tile("tire", 18, 18, lambda d, im: d.rectangle((0, 0, 17, 17), fill=palette["tire"]))


def hub(d, im):
    d.rectangle((0, 0, 17, 17), fill="#536178")
    d.ellipse((2, 2, 15, 15), fill="#718098")
    d.ellipse((5, 5, 12, 12), fill="#3e4b63")
    d.rectangle((8, 3, 9, 14), fill="#8795a9")
    d.rectangle((3, 8, 14, 9), fill="#8795a9")
    d.ellipse((7, 7, 10, 10), fill="#536178")


tile("hub", 18, 18, hub)
tile("underbody", 12, 6, lambda d, im: d.rectangle((0, 0, 11, 5), fill="#293044"))
tile("trim", 12, 6, lambda d, im: d.rectangle((0, 0, 11, 5), fill=palette["outline"]))
tile("blue", 12, 6, lambda d, im: d.rectangle((0, 0, 11, 5), fill=palette["blue"]))
atlas.save(OUT / "car-atlas.png")
guide = atlas.convert("RGB")
d = ImageDraw.Draw(guide)
for name, rect in regions.items():
    d.rectangle(rect, outline="white", width=1)
    d.text((rect[0] + 2, rect[1] + 3), name, fill="white", stroke_width=1, stroke_fill="black")
guide.save(OUT / "uv-layout.png")

bank = json.loads((ROOT / "src/traffic/vehicles-v1.json").read_text())
record = {"id": "authored-compact-car-v1", "status": "unreviewed diagnostic candidate",
          "sourceFingerprint": bank["sourceFingerprint"],
          "sources": [{"direction": d, "sha256": hashlib.sha256((HERE / (d + '.png')).read_bytes()).hexdigest()}
                      for d in sources],
          "draftProjection": {"method": "Named-face orthographic projection from genuine east/west/north sprites",
                              "opaqueSampleFraction": observed / painted,
                              "limits": "Approximate cameras; not independent observed surface coverage"},
          "cleanPaint": {"method": "Authored rectified glass, roof, panels, stripe, lights and wheels using sprite palette/design",
                         "observed": "Source crops preserved unchanged; projected draft retained separately",
                         "inferred": "Hidden surfaces, wheel hubs, underside; all final atlas pixels are authored"},
          "axes": {"units": "world pixels", "front": "-X", "ground": "Z=0", "glb": "Y up, export conversion by Blender"},
          "limits": ["No exact all-view pixel match claimed", "Clean atlas is interpreted paint, not lossless sprite transfer", "Collision and support metadata unchanged"],
          "regions": regions}
(OUT / "provenance.json").write_text(json.dumps(record, indent=2) + "\n")
print(f"Draft opaque samples {observed}/{painted}; clean named UV atlas saved")
