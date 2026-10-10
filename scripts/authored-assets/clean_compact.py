"""Bounded compact-family UV cleanup; preserve the raw projection separately.

Window islands copy the original side-view crop without cross-view mixing. Fender
bands use an explicitly authored treatment with palette sampled from this variant.
Coverage is NOT upgraded by this cleanup; the new paint remains an interpretation.
"""
import argparse
import math
from pathlib import Path

from PIL import Image

from pipeline import digest, read, write


def clean(recipe_path, projection, geometry_path, config_path, output):
    if output.exists() or output.with_suffix(".json").exists():
        raise FileExistsError("Cleanup output exists; choose a new atlas revision.")
    recipe, geometry, config = read(recipe_path), read(geometry_path), read(config_path)
    sources = {}
    for view in recipe["views"]:
        source = recipe_path.parent / view["source"]
        if digest(source) != view["sourceSha256"]:
            raise ValueError("Frozen source changed before cleanup.")
        sources[view["id"]] = Image.open(source).convert("RGBA")
    atlas = Image.open(projection).convert("RGBA")
    if atlas.size != (config["atlasSize"],)*2:
        raise ValueError("Atlas size differs from the family configuration.")
    palette = {name: sources["east"].getpixel(tuple(point)) for name, point in config["paletteSamplesEast"].items()}
    if any(color[3] < 200 for color in palette.values()):
        raise ValueError("Palette landmark is outside the current vehicle; author this family's palette samples first.")
    changes = []
    for island in geometry["added"]:
        x0, y0, x1, y1 = island["rect"]
        w, h = x1-x0, y1-y0
        if island["region"].startswith("window-"):
            part = island["region"].rsplit("-", 1)[1]
            points = config["windowOutlinesEast"][part]
            if island["ownerView"] == "west":
                points = [[64-u, v+1] for u, v in points]
            bounds = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
            tile = sources[island["ownerView"]].crop(bounds).resize((w, h), Image.Resampling.NEAREST)
            kind = "Direct original side-window/frame crop, with an authored UV boundary"
        else:
            tile = Image.new("RGBA", (w, h))
            for y in range(h):
                v = (y+.5)/h
                for x in range(w):
                    top = math.sin(math.pi*(x+.5)/w)
                    if v < 1/3:
                        color = palette["highlight"] if top > .5 else palette["mid"]
                    elif v < .61:
                        color = palette["body"]
                    else:
                        color = palette["outline"]
                    tile.putpixel((x, y), color)
            kind = "Authored fender bevel/highlight/lip bands using this variant's source palette"
        atlas.paste(tile, (x0, y0))
        # Duplicate borders, preserving neighboring islands and native source pixels.
        for gap in range(1, 9):
            atlas.paste(tile.crop((0, 0, w, 1)), (x0, y0-gap))
            atlas.paste(tile.crop((0, h-1, w, h)), (x0, y1+gap-1))
            atlas.paste(tile.crop((0, 0, 1, h)), (x0-gap, y0))
            atlas.paste(tile.crop((w-1, 0, w, h)), (x1+gap-1, y0))
        changes.append({"region": island["region"], "rect": island["rect"], "paint": kind})
    atlas.save(output)
    write(output.with_suffix(".json"), {"recipeSha256": digest(recipe_path), "rawProjectionSha256": digest(projection),
          "geometryRecordSha256": digest(geometry_path), "configSha256": digest(config_path),
          "atlasSha256": digest(output), "palette": palette, "changes": changes,
          "status": "Authored cleanup; projection coverage/uncertainty remains unchanged; unreviewed"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipe", type=Path, required=True)
    parser.add_argument("--projection", type=Path, required=True)
    parser.add_argument("--geometry", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("compact-refinement.json"))
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    clean(args.recipe.resolve(), args.projection.resolve(), args.geometry.resolve(), args.config.resolve(), args.out.resolve())
    print(f"Source-window and authored-fender cleanup: {args.out}")
