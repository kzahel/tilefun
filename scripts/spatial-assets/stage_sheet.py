"""Compose an auditable inspection sheet from actual preserved stage images."""
import argparse
import html
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reference import digest, name


def read(path):
    return json.loads(path.read_text()) if path.exists() else None


def font(size):
    path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)


def image_panel(canvas, image_path, rectangle, nearest=False):
    left, top, width, height = rectangle
    checker = Image.new("RGBA", (width, height), "#d7dce1")
    draw = ImageDraw.Draw(checker)
    for y in range(0, height, 24):
        for x in range(0, width, 24):
            if (x // 24 + y // 24) % 2:
                draw.rectangle((x, y, x + 23, y + 23), fill="#c4cbd2")
    image = Image.open(image_path).convert("RGBA")
    scale = min(width / image.width, height / image.height)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                         Image.Resampling.NEAREST if nearest else Image.Resampling.LANCZOS)
    checker.alpha_composite(image, ((width - image.width) // 2, (height - image.height) // 2))
    canvas.paste(checker.convert("RGB"), (left, top))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--run", type=name, required=True)
    parser.add_argument("--asset", type=name, help="Required if inference failed before creating run.json")
    parser.add_argument("--id", type=name, default="stages")
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    run = bundle / "runs" / args.run
    record = read(run / "run.json") or {}
    asset = record.get("input", {}).get("asset") or args.asset
    if not asset:
        raise RuntimeError("Asset identity is required")
    manifest = read(bundle / "inputs.json")
    entry = next(item for item in manifest["inputs"] if item["id"] == asset)
    source = bundle / entry["input"]
    if digest(source) != entry["cropSha256"]:
        raise RuntimeError("Original source pixels changed")
    pipeline = read(bundle / "pipelines" / args.run / "pipeline.json") or {}
    views_dir = bundle / "views" / args.run
    views = read(views_dir / "views.json") or {}
    registered_id = record.get("input", {}).get("reference") or record.get("input", {}).get("mode")
    reference = record.get("conditioningReference") or (read(bundle / "references" / registered_id / "reference.json") if registered_id else None) or read(bundle / "references" / f"{args.run}-reference/reference.json") or {}
    initial_id = views.get("input", {}).get("reference") or reference.get("id") or f"{args.run}-img2img-reference"
    initial = bundle / "references" / initial_id
    if not initial.exists():
        initial = bundle / "references" / f"{args.run}-reference"
    cutout = initial
    if reference.get("parent"):
        initial = bundle / "references" / reference["parent"]
    generation = read(initial / "generation.json") or {}
    mask_path = cutout / "mask.png"
    if not mask_path.exists():
        mask_path = initial / "native-alpha.png"
    captures = [p for p in sorted((run / "export").glob("inspection*")) if (p / "inspection.json").exists()]
    capture = captures[-1] if captures else run / "export/inspection"
    if not capture.exists() and (run / "export-inspection/inspection").exists():
        capture = run / "export-inspection/inspection"
    geometry_only = record.get("provider", {}).get("name") == "TripoSG"
    panels = [
        ("01  Original runtime pixels", source, True, "Original alpha and painted shadow retained"),
        ("02  Exact reference-editor input", initial / "provider-input.png", False, "NN enlargement; RGB128 background"),
        ("03  Generated reference RGB", initial / "generated-rgb.png", False, "Generated interpretation, not observed geometry"),
        ("04  Conditioning alpha mask", mask_path, False, "Native or independently learned alpha; no hand mask"),
        ("05  Conditioning RGBA reference", cutout / "reference.png", False, "Actual registered conditioning cutout"),
        ("06  Six MV-Adapter RGB views", views_dir / "views.png", False, "Jointly generated hypotheses; fixed cameras"),
        ("07  Six learned cutouts", views_dir / "cutouts.png", False, "Actual second-stage U2Net output"),
        ("08  Selected angle-0 alpha", views_dir / "mask-000.png", False, "Predeclared view selection, no cherry-picking"),
        ("09  Selected geometry reference", run / "input.png", False, "One registered image enters the 3D generator"),
        ("10  Exact provider preprocessing", run / "provider-input.png", False, "Provider alpha crop and composite; fixed frame where recorded"),
        ("11  Untouched raw geometry", run / "inspection/raw-geometry.png", False, "Six false-depth views; not generated color"),
        ("12  Original-alpha coverage", run / "bake/coverage.png", True, "Red unknown; cyan projected outside source"),
        ("13  Source-sized depth", run / "bake/source-depth.png", True, "False-depth display; float32 arrays saved"),
        ("14  GLB front", capture / "front.png", False, "Simplified gray shape; no texture" if geometry_only else "Separate generated appearance"),
        ("15  GLB side", capture / "side.png", False, "Inspect depth and hidden surfaces"),
        ("16  GLB oblique", capture / "oblique.png", False, "Raw arrays preserved; gray shape" if geometry_only else "PBR materials; raw depth mesh unchanged"),
    ]
    destination = bundle / "stage-sheets" / args.run / args.id
    destination.mkdir(parents=True, exist_ok=False)
    width, tile_height, header = 2400, 430, 130
    canvas = Image.new("RGB", (width, header + tile_height * 4 + 55), "#f1f4f7")
    draw = ImageDraw.Draw(canvas)
    status = pipeline.get("status", record.get("status", "generation incomplete"))
    draw.text((24, 18), f'{entry.get("label", asset)} — {args.run}', fill="#243142", font=font(28))
    draw.text((24, 61), f"Unreviewed diagnostic · {status} · image seed {generation.get('settings', {}).get('seed', '?')} · mesh seed {record.get('settings', {}).get('seed', '?')}", fill="#243142", font=font(20))
    draw.text((24, 94), "Read left to right, top to bottom. Checkerboard shows transparency; open HTML for original images and provenance.", fill="#435266", font=font(18))
    panel_records, cards = [], []
    for index, (label, path, nearest, limit) in enumerate(panels):
        left, top = (index % 4) * 600, header + (index // 4) * tile_height
        draw.text((left + 16, top + 8), label, fill="#243142", font=font(21))
        available = path.exists()
        item = {"stage": index + 1, "label": label, "available": available, "limit": limit,
                "displayResampling": "nearest" if nearest else "LANCZOS"}
        if available:
            path.resolve().relative_to(bundle)
            item.update({"file": str(path.relative_to(bundle)), "sha256": digest(path), "size": list(Image.open(path).size)})
            image_panel(canvas, path, (left + 16, top + 42, 568, 340), nearest)
            url = html.escape(os.path.relpath(path, destination).replace(os.sep, "/"), quote=True)
            visual = f'<a href="{url}"><img src="{url}" alt="{html.escape(label)}"></a><p><a href="{url}">Open original image</a> · {item["size"][0]}×{item["size"][1]}</p>'
        else:
            reason = "Stage not produced; inspect saved status" if status.startswith(("failed", "stopped")) else "Not present in this workflow mode"
            item["reason"] = reason
            draw.rectangle((left + 16, top + 42, left + 584, top + 382), fill="#dce2e8")
            draw.text((left + 36, top + 182), "Stage not produced", fill="#435266", font=font(24))
            visual = f'<p class="missing">{html.escape(reason)}</p>'
        draw.text((left + 16, top + 393), limit, fill="#435266", font=font(16))
        cards.append(f'<article><h2>{html.escape(label)}</h2>{visual}<p>{html.escape(limit)}</p></article>')
        panel_records.append(item)
    draw.text((24, canvas.height - 36), f'Source RGBA SHA-256: {entry["cropRgbaSha256"]} · coverage and extent metrics do not establish quality', fill="#435266", font=font(17))
    canvas.save(destination / "sheet.png")
    sheet = {"run": args.run, "asset": asset, "status": status, "review": "Unreviewed diagnostic, no human acceptance",
             "sourceRgbaSha256": entry["cropRgbaSha256"], "inputManifestSha256": digest(bundle / "inputs.json"),
             "implementationSha256": digest(__file__), "panels": panel_records, "sheetSha256": digest(destination / "sheet.png")}
    (destination / "sheet.json").write_text(json.dumps(sheet, indent=2) + "\n")
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pipeline stage inspection</title><style>body{font:16px system-ui;margin:24px;background:#f1f4f7;color:#243142}main{max-width:1300px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}article{padding:16px;background:white;border-radius:12px}h2{font-size:18px}p{line-height:1.5}img{width:100%;height:350px;object-fit:contain;background:repeating-conic-gradient(#c4cbd2 0% 25%,#d7dce1 0% 50%) 50%/24px 24px}.missing{min-height:160px}code{overflow-wrap:anywhere}</style><main>'
    page += f'<h1>{html.escape(entry.get("label", asset))}: pipeline stages</h1><p>Unreviewed diagnostic · {html.escape(status)}. Source pixels stay unchanged. Generated views are hypotheses.</p><p><a href="sheet.png">Full inspection sheet</a> · <a href="sheet.json">Stage files and SHA-256 provenance</a></p><div class="grid">' + ''.join(cards) + '</div></main></html>'
    (destination / "index.html").write_text(page)
    print(json.dumps({"sheet": str(destination / "sheet.png"), "availableStages": sum(p["available"] for p in panel_records)}))


if __name__ == "__main__":
    main()
