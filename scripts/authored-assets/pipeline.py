"""Offline, source-preserving Blender authoring and fidelity inspection.

Requires Pillow. Blender is invoked as a separate background process. No game,
registered artwork, source sprites or review decisions are written by this tool.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont
from pixel_style import ink
from projection_math import project

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DIRECTIONS = ["east", "west", "north", "south"]
AZIMUTHS = {"east": -90, "west": 90, "north": 0, "south": 180}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def checked_id(value):
    if not isinstance(value, str) or not value or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for c in value):
        raise ValueError(f"Use a lowercase filename-safe identifier: {value!r}")
    return value


def least_squares(rows, values):
    """Small full-rank least squares; no scientific Python dependency needed."""
    n = len(rows[0])
    matrix = [[sum(row[i] * row[j] for row in rows) for j in range(n)] +
              [sum(row[i] * value for row, value in zip(rows, values))] for i in range(n)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda k: abs(matrix[k][col]))
        matrix[col], matrix[pivot] = matrix[pivot], matrix[col]
        if abs(matrix[col][col]) < 1e-8:
            raise ValueError("Landmarks do not constrain this camera. Include different ground depths and heights.")
        divisor = matrix[col][col]
        matrix[col] = [v / divisor for v in matrix[col]]
        for row in range(n):
            if row != col:
                factor = matrix[row][col]
                matrix[row] = [a - factor * b for a, b in zip(matrix[row], matrix[col])]
    return [row[-1] for row in matrix]


def calibrate(view):
    marks = view.get("landmarks", [])
    if len(marks) < 4:
        raise ValueError(f"{view['id']}: provide at least four world/pixel landmarks.")
    a = math.radians(view["camera"]["azimuth"])
    horizontal, vertical, us, vs = [], [], [], []
    ox, oy = view["offset"]
    for mark in marks:
        x, y, z = mark["world"]
        u, v = mark["pixel"]  # Coordinates in the original unpadded source crop.
        horizontal.append([-math.sin(a) * x + math.cos(a) * y, 1])
        vertical.append([math.cos(a) * x + math.sin(a) * y, z, 1])
        us.append(u + ox)
        vs.append(v + oy)
    sx, cx = least_squares(horizontal, us)
    depth, height, cy = least_squares(vertical, vs)
    if sx <= 0 or depth <= 0 or height >= 0:
        raise ValueError(f"{view['id']}: inconsistent facing, height or ground landmarks; inspect them before fitting.")
    camera = {"azimuth": view["camera"]["azimuth"],
              "elevation": math.degrees(math.atan2(depth, -height)),
              "horizontalScale": sx, "verticalStretch": math.hypot(depth, height) / sx,
              "origin": [cx, cy], "status": "landmark-fit; requires visual inspection"}
    residuals = [math.dist(project(m["world"], camera), [m["pixel"][0] + ox, m["pixel"][1] + oy]) for m in marks]
    return camera, {"count": len(marks), "rmsPixels": math.sqrt(sum(r*r for r in residuals) / len(residuals)),
                    "maxPixels": max(residuals)}


def vehicle_spec(vehicle):
    bank = read(ROOT / "src/traffic/vehicles-v1.json")
    selected = [v for v in bank["views"] if v["vehicleId"] == vehicle]
    if not selected:
        raise ValueError(f"Unknown vehicle {vehicle!r}; use the list command.")
    views = []
    for direction in DIRECTIONS:
        entry = next(v for v in selected if v["direction"] == direction)
        views.append({"id": direction, "rect": entry["rect"], "anchor": entry["metadata"]["anchor"],
                      "metadata": entry["metadata"], "sourceApproval": entry["approval"]})
    return {"assetId": vehicle, "family": vehicle.rsplit("-", 1)[0],
            "source": {"image": "public/assets/tilesets/me-complete.png", "sha256": bank["sourceFingerprint"]},
            "views": views}


def initialize(spec, output, setup=None):
    checked_id(spec["assetId"])
    views = spec["views"]
    if not views or len({v["id"] for v in views}) != len(views):
        raise ValueError("Supply one or more uniquely identified source views.")
    source = (ROOT / spec["source"]["image"]).resolve()
    if digest(source) != spec["source"]["sha256"]:
        raise ValueError("Source atlas hash differs from the declared input; refusing to extract changed pixels.")
    image = Image.open(source).convert("RGBA")
    width = max(v["rect"][2] for v in views)
    height = max(v["rect"][3] for v in views)
    setup = setup or {}
    # Validate everything before creating the output directory.
    prepared = []
    for view in views:
        name = checked_id(view["id"])
        x, y, w, h = view["rect"]
        if any(type(v) is not int for v in [x, y, w, h]) or min(x, y) < 0 or min(w, h) <= 0 or x+w > image.width or y+h > image.height:
            raise ValueError(f"{name}: source rectangle is outside the atlas.")
        offset = [(width-w)//2, (height-h)//2]
        default = {"azimuth": AZIMUTHS.get(name, -90), "elevation": 45 if name in ["east", "west"] else 70,
                   "horizontalScale": 1, "verticalStretch": 1, "origin": [width/2, height*(.8 if name in ["east", "west"] else .55)],
                   "status": "rough hypothesis; fit before evaluating fidelity"}
        camera = setup.get("cameras", {}).get(name, view.get("camera", default))
        validate_camera(camera)
        prepared.append({**view, "source": f"refs/{name}.png", "offset": offset, "camera": camera})
    blend = setup.get("blend", spec.get("blend"))
    blend_path = (ROOT / blend).resolve() if blend else None
    if blend_path and not blend_path.is_file():
        raise ValueError(f"Blender template missing: {blend_path}")
    output.mkdir(parents=True, exist_ok=False)
    (output / "refs").mkdir()
    for view in prepared:
        x, y, w, h = view["rect"]
        target = output / view["source"]
        image.crop((x, y, x+w, y+h)).save(target)
        view["sourceSha256"] = digest(target)
    if blend_path:
        shutil.copy2(blend_path, output / "working.blend")
    recipe = {"schema": "authored-assets-v1", "assetId": spec["assetId"], "family": spec.get("family", "custom"),
              "source": {**spec["source"], "image": str(source)}, "canvas": [width, height],
              "workingBlend": "working.blend" if blend else None,
              "template": {"path": blend, "sha256": digest(blend_path)} if blend else None,
              "views": prepared, "appearance": "unlit", "projection": setup.get("projection", spec.get("projection")),
              "reviewStatus": "offline diagnostic; unreviewed"}
    if setup.get("pixelStyle", spec.get("pixelStyle")):
        recipe["pixelStyle"] = setup.get("pixelStyle", spec.get("pixelStyle"))
    write(output / "recipe.json", recipe)
    return recipe


def validate_camera(camera):
    values = [camera[k] for k in ["azimuth", "elevation", "horizontalScale", "verticalStretch"]] + camera["origin"]
    if len(camera["origin"]) != 2 or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
        raise ValueError("Camera parameters must be finite numbers.")
    if not 0 < camera["elevation"] < 90 or min(camera["horizontalScale"], camera["verticalStretch"]) <= 0:
        raise ValueError("Use positive camera scales and elevation between 0 and 90 degrees.")


def compare(source, render, ignore=None):
    if source.size != render.size:
        raise ValueError("Source and render must have the same logical pixel size.")
    intersection = union = missing = extra = error = exact = 0
    diff = Image.new("RGB", source.size, "#253139")
    for y in range(source.height):
        for x in range(source.width):
            if ignore and ignore.getpixel((x, y)):
                continue
            a, b = source.getpixel((x, y)), render.getpixel((x, y))
            sa, sb = a[3] >= 128, b[3] >= 128
            union += sa or sb
            if sa and sb:
                intersection += 1
                delta = [abs(a[k]-b[k]) for k in range(3)]
                error += sum(delta)
                exact += not any(delta)
                diff.putpixel((x, y), tuple(delta))
            elif sa:
                missing += 1
                diff.putpixel((x, y), (238, 91, 110))
            elif sb:
                extra += 1
                diff.putpixel((x, y), (78, 183, 239))
    return {"silhouetteIoU": intersection/union if union else None,
            "sourceOnlyPixels": missing, "renderOnlyPixels": extra, "intersectionPixels": intersection,
            "rgbMAEOnIntersection": error/(3*intersection) if intersection else None,
            "exactRGBPixelsOnIntersection": exact}, diff


def reference(recipe_path, view, canvas):
    path = recipe_path.parent / view["source"]
    if digest(path) != view["sourceSha256"]:
        raise ValueError(f"Frozen reference changed: {path}")
    original = Image.open(path).convert("RGBA")
    result = Image.new("RGBA", canvas)
    result.alpha_composite(original, tuple(view["offset"]))
    return result


def compose(run, recipe, originals, renders):
    w, h = recipe["canvas"]
    factor = max(1, min(4, 288//max(w, h)))
    cellw, cellh = max(240, w*factor+40), h*factor+65
    sheet = Image.new("RGB", (cellw*len(originals), cellh*2+40), "#253139")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    for col, (view, original, render) in enumerate(zip(recipe["views"], originals, renders)):
        for row, im in enumerate([original, render]):
            x, y = col*cellw, row*cellh
            draw.rectangle((x+6, y+6, x+cellw-6, y+cellh-6), fill="#53636b")
            draw.text((x+18, y+16), f"{'SPRITE' if row == 0 else 'BLENDER'} / {view['id']}", fill="white", font=font)
            enlarged = im.resize((w*factor, h*factor), Image.Resampling.NEAREST)
            sheet.paste(enlarged, (x+(cellw-w*factor)//2, y+46), enlarged)
    draw.text((16, cellh*2+10), f"{recipe['assetId']} · same mesh / atlas in every view · unreviewed diagnostic", fill="#b4c4cd", font=font)
    sheet.save(run / "comparison.png")


def evaluate(recipe_path, blend_path, blender, output, atlas=None):
    recipe = read(recipe_path)
    if recipe["schema"] != "authored-assets-v1":
        raise ValueError("Unsupported recipe schema.")
    for view in recipe["views"]:
        checked_id(view["id"])
        validate_camera(view["camera"])
    if atlas:
        if not recipe.get("projection"):
            raise ValueError("Define projection.material and projection.textureNode before overriding the atlas.")
        recipe["atlasOverride"] = {"path": str(atlas), "sha256": digest(atlas)}
    canvas = tuple(recipe["canvas"])
    originals = [reference(recipe_path, v, canvas) for v in recipe["views"]]
    if not blend_path.is_file():
        raise ValueError(f"Author or select a working Blender file first: {blend_path}")
    # Each run is immutable evidence; no implicit overwrite or model rebuild.
    output.mkdir(parents=True, exist_ok=False)
    shutil.copy2(blend_path, output / "input.blend")
    write(output / "recipe.json", recipe)
    provenance = {"recipeSha256": digest(recipe_path), "inputBlendSha256": digest(blend_path),
                  "scripts": {p.name: digest(p) for p in [Path(__file__), HERE / "render.py", HERE / "projection_math.py"]}}
    style = recipe.get("pixelStyle")
    if style:
        if style.get("logicalPixelWidth", 1) != 1:
            raise ValueError("This pixel-outline prototype supports exactly one logical pixel.")
        # Validate before launching Blender; this is an explicit render pass,
        # not a change to exported GLB materials or source-coverage evidence.
        ink(Image.new("RGBA", (1, 1)), color=style.get("outlineColor", [58, 58, 80]), mode=style.get("outline", "inner"))
        provenance["scripts"]["pixel_style.py"] = digest(HERE / "pixel_style.py")
        provenance["pixelStyle"] = style
    with (output / "blender.log").open("w", encoding="utf-8") as log:
        subprocess.run([str(blender), "--background", "--factory-startup", str(output / "input.blend"),
                        "--python-exit-code", "1", "--python", str(HERE / "render.py"), "--", str(output)],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    renders, metrics = [], {}
    w, h = canvas
    for view, original in zip(recipe["views"], originals):
        name, camera = view["id"], view["camera"]
        raw = Image.open(output / f"{name}-raw.png").convert("RGBA")
        sx = camera["horizontalScale"]
        sy = sx * camera["verticalStretch"]
        cx, cy = camera["origin"]
        render = raw.transform(canvas, Image.Transform.AFFINE,
                               (8/sx, 0, raw.width/2-cx*8/sx, 0, 8/sy, raw.height/2-cy*8/sy),
                               Image.Resampling.NEAREST)
        if style:
            render.save(output / f"{name}-unoutlined.png")
            render = ink(render, color=style.get("outlineColor", [58, 58, 80]), mode=style.get("outline", "inner"))
        original.save(output / f"{name}-source.png")
        render.save(output / f"{name}-render.png")
        ignore = None
        if view.get("ignoreMask"):
            mask_path = recipe_path.parent / view["ignoreMask"]
            ignore = Image.open(mask_path).convert("L")
            if ignore.size != canvas:
                raise ValueError(f"{name}: ignore mask must use logical canvas dimensions.")
            provenance.setdefault("ignoreMasks", {})[name] = digest(mask_path)
            shutil.copy2(mask_path, output / f"{name}-ignore.png")
        stats, diff = compare(original, render, ignore)
        diff.resize((w*4, h*4), Image.Resampling.NEAREST).save(output / f"{name}-diff.png")
        bg = Image.new("RGBA", canvas, "#53636b")
        overlay = Image.blend(Image.alpha_composite(bg, original), Image.alpha_composite(bg, render), .5)
        overlay.resize((w*4, h*4), Image.Resampling.NEAREST).save(output / f"{name}-overlay.png")
        if view.get("landmarks"):
            distances = [math.dist(project(m["world"], camera), [m["pixel"][0]+view["offset"][0], m["pixel"][1]+view["offset"][1]]) for m in view["landmarks"]]
            stats["landmarkRMSPixels"] = math.sqrt(sum(d*d for d in distances)/len(distances))
        metrics[name] = stats
        renders.append(render)
    if style:
        for k in range(4):
            path = output / f"orbit-{k}.png"
            orbit = Image.open(path).convert("RGBA")
            orbit.save(output / f"orbit-{k}-unoutlined.png")
            logical = orbit.resize(canvas, Image.Resampling.NEAREST)
            ink(logical, color=style.get("outlineColor", [58, 58, 80]), mode=style.get("outline", "inner")).resize(orbit.size, Image.Resampling.NEAREST).save(path)
    compose(output, recipe, originals, renders)
    write(output / "metrics.json", {"views": metrics, "interpretation": "Diagnostic measurements, not acceptance scores. Alpha includes painted shadows unless explicitly masked. RGB error is measured only on opaque overlap; examine missing/extra pixels and all-angle renders too."})
    def number(value):
        return f"{value:.3f}" if value is not None else "no overlap"
    rows = "".join(f"<tr><td>{html.escape(name)}</td><td>{number(s['silhouetteIoU'])}</td><td>{number(s['rgbMAEOnIntersection'])}</td><td><a href='{name}-overlay.png'>overlay</a> / <a href='{name}-diff.png'>difference</a></td></tr>" for name, s in metrics.items())
    (output / "index.html").write_text(f"<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{html.escape(recipe['assetId'])} authoring study</title><style>body{{background:#253139;color:#edf3f7;font:16px system-ui;margin:24px}}a{{color:#7bc9ee}}img{{max-width:100%;image-rendering:pixelated}}table{{width:100%;table-layout:fixed}}td,th{{padding:8px;text-align:left;overflow-wrap:anywhere}}</style><h1>{html.escape(recipe['assetId'])} · unreviewed authoring study</h1><p>Same geometry and atlas across all views. Camera hypotheses may vary between source drawings. These metrics do not establish acceptance or texture coverage.</p><img src='comparison.png' alt='Original sprites above Blender renders'><table><tr><th>View<th>Silhouette overlap<th>RGB error on overlap<th>Inspection</tr>{rows}</table><p>Difference: red = source only; blue = render only; opaque overlap = absolute RGB difference. Painted shadows are included unless masked explicitly.</p><p><a href='asset.blend'>Editable source</a> · <a href='asset.glb'>Portable GLB</a> · <a href='metrics.json'>Measurements</a> · <a href='provenance.json'>Hashes</a></p>" + "".join(f"<img src='orbit-{k}.png' width='256' alt='Unobserved mesh angle {k}'>" for k in range(4)), encoding="utf-8")
    if digest(blend_path) != provenance["inputBlendSha256"]:
        raise RuntimeError("Working input changed during evaluation; run is not a stable snapshot.")
    if digest(recipe_path) != provenance["recipeSha256"]:
        raise RuntimeError("Recipe changed during evaluation; run is not a stable snapshot.")
    if atlas and digest(atlas) != recipe["atlasOverride"]["sha256"]:
        raise RuntimeError("Atlas changed during evaluation; run is not a stable snapshot.")
    for view in recipe["views"]:
        reference(recipe_path, view, canvas)
    provenance["outputs"] = {p.name: digest(p) for p in sorted(output.iterdir()) if p.is_file()}
    write(output / "provenance.json", provenance)
    return metrics


def bake(recipe_path, blend_path, blender, output):
    recipe = read(recipe_path)
    if not recipe.get("projection"):
        raise ValueError("Define projection.atlasSize and projection.material in the recipe first.")
    for view in recipe["views"]:
        checked_id(view["id"])
        validate_camera(view["camera"])
        reference(recipe_path, view, tuple(recipe["canvas"]))
    output.mkdir(parents=True, exist_ok=False)
    (output / "refs").mkdir()
    for view in recipe["views"]:
        frozen = output / "refs" / (view["id"]+".png")
        shutil.copy2(recipe_path.parent / view["source"], frozen)
        if digest(frozen) != view["sourceSha256"]:
            raise ValueError("Reference changed while freezing the projection run.")
        view["source"] = str(frozen.resolve())
    shutil.copy2(blend_path, output / "input.blend")
    write(output / "recipe.json", recipe)
    with (output / "blender.log").open("w", encoding="utf-8") as log:
        subprocess.run([str(blender), "--background", "--factory-startup", str(output / "input.blend"),
                        "--python-exit-code", "1", "--python", str(HERE / "project.py"), "--", str(output)],
                       check=True, stdout=log, stderr=subprocess.STDOUT, cwd=ROOT)
    size = recipe["projection"]["atlasSize"]
    for name in ["projection-draft", "projection-coverage", "projection-with-authored-fill"]:
        raw = output / (name+".rgba")
        if raw.exists():
            Image.frombytes("RGBA", (size, size), raw.read_bytes()).save(output / (name+".png"))
    write(output / "provenance.json", {"recipeSha256": digest(recipe_path), "inputBlendSha256": digest(output / "input.blend"),
          "scripts": {p.name: digest(p) for p in [Path(__file__), HERE / "project.py", HERE / "projection_math.py"]},
          "outputs": {str(p.relative_to(output)): digest(p) for p in sorted(output.rglob("*")) if p.is_file()}})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="List supported source-bank vehicle IDs; this is not model support.")
    init = commands.add_parser("init", help="Freeze references and initialize a new workspace.")
    choice = init.add_mutually_exclusive_group(required=True)
    choice.add_argument("--vehicle")
    choice.add_argument("--spec", type=Path)
    init.add_argument("--out", type=Path, required=True)
    init.add_argument("--setup", type=Path, help="Optional template and camera hypotheses.")
    fit = commands.add_parser("calibrate", help="Fit a fixed-azimuth affine camera from recorded landmarks.")
    fit.add_argument("--recipe", type=Path, required=True)
    fit.add_argument("--out", type=Path, required=True)
    run = commands.add_parser("evaluate", help="Render one authored mesh and report all source-view differences.")
    run.add_argument("--recipe", type=Path, required=True)
    run.add_argument("--blend", type=Path)
    run.add_argument("--blender", type=Path, required=True)
    run.add_argument("--out", type=Path)
    run.add_argument("--atlas", type=Path, help="Bind an explicit projected or cleaned atlas to the configured material/node.")
    projection = commands.add_parser("project", help="Bake visible original pixels into an existing, explicitly selected UV atlas.")
    projection.add_argument("--recipe", type=Path, required=True)
    projection.add_argument("--blend", type=Path)
    projection.add_argument("--blender", type=Path, required=True)
    projection.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "list":
        bank = read(ROOT / "src/traffic/vehicles-v1.json")
        print("\n".join(sorted({v["vehicleId"] for v in bank["views"]})))
    elif args.command == "init":
        spec = vehicle_spec(args.vehicle) if args.vehicle else read(args.spec)
        initialize(spec, args.out.resolve(), read(args.setup) if args.setup else None)
        print(f"Frozen references and editable recipe: {args.out.resolve()}")
    elif args.command == "calibrate":
        recipe = read(args.recipe)
        if args.out.exists():
            raise FileExistsError("Calibration output exists; choose a new recipe filename.")
        if not any(v.get("landmarks") for v in recipe["views"]):
            raise ValueError("No recorded landmarks. Add real world/pixel correspondences before camera calibration.")
        for view in recipe["views"]:
            if view.get("landmarks"):
                view["camera"], view["calibration"] = calibrate(view)
        # Keep relative reference/blend paths meaningful when writing elsewhere.
        for view in recipe["views"]:
            for key in ["source", "ignoreMask"]:
                if view.get(key):
                    view[key] = str((args.recipe.resolve().parent / view[key]).resolve())
        if recipe.get("workingBlend"):
            recipe["workingBlend"] = str((args.recipe.resolve().parent / recipe["workingBlend"]).resolve())
        write(args.out, recipe)
        fitted = sum(bool(v.get("landmarks")) for v in recipe["views"])
        print(f"Fit {fitted}/{len(recipe['views'])} source cameras to {args.out}; inspect residuals and source overlays.")
    else:
        recipe_path = args.recipe.resolve()
        recipe = read(recipe_path)
        if not args.blend and not recipe.get("workingBlend"):
            parser.error("Supply --blend or author workingBlend in the recipe.")
        blend = args.blend.resolve() if args.blend else (recipe_path.parent / recipe["workingBlend"]).resolve()
        output = args.out.resolve() if args.out else recipe_path.parent / "runs" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        if args.command == "project":
            bake(recipe_path, blend, args.blender.resolve(), output)
            print(f"Original-pixel UV draft and uncertainty mask: {output}")
        else:
            evaluate(recipe_path, blend, args.blender.resolve(), output, args.atlas.resolve() if args.atlas else None)
            print(f"Actual Blender renders and source comparisons: {output / 'index.html'}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, FileExistsError, subprocess.CalledProcessError) as error:
        print(f"Authoring pipeline: {error}", file=sys.stderr)
        sys.exit(1)
