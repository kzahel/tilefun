"""Compare source/native render boundaries before and after a mesh correction."""
import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pipeline import digest, read, write


def pixels(image, threshold=128):
    rgba = image.convert("RGBA")
    return {(x, y) for y in range(rgba.height) for x in range(rgba.width) if rgba.getpixel((x, y))[3] >= threshold}


def boundary(mask):
    return {p for p in mask if any(q not in mask for q in [(p[0]-1, p[1]), (p[0]+1, p[1]), (p[0], p[1]-1), (p[0], p[1]+1)])}


def measure(source, rendered):
    if source.size != rendered.size:
        raise ValueError("Silhouettes must use the same logical canvas.")
    a, b = pixels(source), pixels(rendered)
    ea, eb = boundary(a), boundary(b)
    distances = [min(math.dist(p, q) for q in other) for own, other in [(ea, eb), (eb, ea)] for p in own] if ea and eb else []
    return {"iou": len(a & b)/len(a | b) if a or b else None,
            "sourceOnly": len(a-b), "renderOnly": len(b-a),
            "meanBoundaryDistancePixels": sum(distances)/len(distances) if distances else None,
            "maxBoundaryDistancePixels": max(distances) if distances else None}


def difference(source, rendered):
    a, b = pixels(source), pixels(rendered)
    image = Image.new("RGB", source.size, "#253139")
    for p in a | b:
        image.putpixel(p, (157, 172, 184) if p in a and p in b else (238, 91, 110) if p in a else (78, 183, 239))
    # A visible reference contour makes local overshoots easier to inspect.
    for p in boundary(a):
        if p in b:
            image.putpixel(p, (235, 240, 243))
    return image


def report(before, after, output, after_label="REVISED MESH"):
    output.mkdir(parents=True, exist_ok=False)
    recipe = read(after / "recipe.json")
    sheet = Image.new("RGB", (1184, 704), "#253139")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    stats = {}
    for col, view in enumerate(recipe["views"]):
        name = view["id"]
        source = Image.open(after / f"{name}-source.png").convert("RGBA")
        prior_source = Image.open(before / f"{name}-source.png").convert("RGBA")
        if source.tobytes() != prior_source.tobytes():
            raise ValueError("Comparison sources changed between revisions.")
        old = Image.open(before / f"{name}-render.png").convert("RGBA")
        new = Image.open(after / f"{name}-render.png").convert("RGBA")
        stats[name] = {"before": measure(source, old), "after": measure(source, new)}
        for row, image in enumerate([old, new]):
            x, y = col*296, row*321
            draw.rectangle((x+6, y+6, x+290, y+315), fill="#53636b")
            draw.text((x+18, y+16), f"{'PREVIOUS' if row==0 else after_label} / {name}", fill="white", font=font)
            difference(source, image).resize((256, 256), Image.Resampling.NEAREST).save(output / f"{name}-{'before' if row==0 else 'after'}.png")
            sheet.paste(difference(source, image).resize((256, 256), Image.Resampling.NEAREST), (x+20, y+46))
    draw.text((16, 648), "White = source contour · gray = overlap · red = missing · blue = extra", fill="white", font=font)
    draw.text((16, 674), "Includes painted sprite shadow. Whole silhouette alone does not fit internal arch boundaries.", fill="#b4c4cd", font=font)
    sheet.save(output / "silhouette.png")
    write(output / "silhouette.json", {"views": stats, "threshold": 128, "sourceIncludesShadow": True,
          "beforeRecipeSha256": digest(before / "recipe.json"), "afterRecipeSha256": digest(after / "recipe.json"),
          "interpretation": "Boundary/occupancy evidence, not an acceptance score or an internal-part fit."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--after-label", default="REVISED MESH")
    args = parser.parse_args()
    report(args.before.resolve(), args.after.resolve(), args.out.resolve(), args.after_label)
