"""Build inspectable 073 reference/geometry comparisons with actual artifact links."""
import argparse
import html
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from reference import digest


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else None


def font(size):
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)


def panel(sheet, path, x, y, width, height, nearest=False):
    if not path.exists():
        ImageDraw.Draw(sheet).text((x + 20, y + 30), "Not produced", font=font(17), fill="#8793a3")
        return
    canvas = Image.new("RGBA", (width, height), "#d7dce1")
    draw = ImageDraw.Draw(canvas)
    for yy in range(0, height, 20):
        for xx in range(0, width, 20):
            if (xx // 20 + yy // 20) % 2:
                draw.rectangle((xx, yy, xx + 19, yy + 19), fill="#c4cbd2")
    image = Image.open(path).convert("RGBA")
    image.thumbnail((width, height), Image.Resampling.NEAREST if nearest else Image.Resampling.LANCZOS)
    canvas.alpha_composite(image, ((width - image.width) // 2, (height - image.height) // 2))
    sheet.paste(canvas.convert("RGB"), (x, y))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--portable", type=Path)
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    destination = bundle / "report"
    destination.mkdir(exist_ok=True)
    plan = read(bundle / "plan.json")
    manifest = read(bundle / "inputs.json")
    if digest(bundle / "inputs.json") != plan["inputManifestSha256"]:
        raise RuntimeError("Frozen manifest changed")
    rows = []
    # Each asset has RGB/native reference above the separate mask result.
    sheet = Image.new("RGB", (6 * 320, len(plan["assets"]) * 700 + 80), "#19222c")
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 15), "073: source / FLUX / Qwen reference and mask comparison — unreviewed", font=font(25), fill="white")
    for i, asset in enumerate(plan["assets"]):
        entry = next(x for x in manifest["inputs"] if x["id"] == asset)
        paths = [bundle / entry["enlarged"]]
        labels = [f"{asset}: source"]
        for model in ["flux", "qwen"]:
            for seed in [42, 43]:
                paths.append(bundle / "references" / f"{model}-{asset}-s{seed}" / "generated-native.png")
                labels.append(f"{model} seed {seed}: raw output")
        # Preserved previous SDXL evidence, if it exists; no new baseline pixels.
        baseline = bundle.parent / "071/references" / f"fidelity-001-{asset}-s65/reference.png"
        baseline_label = "SDXL 0.65 previous control"
        if asset == "oak-tree":
            baseline = bundle.parent / "070/references/oak-sdxl-strength08-001/reference.png"
            baseline_label = "SDXL 0.8 previous control"
        elif asset == "picnic-table":
            baseline = bundle.parent / "071/references/current2-picnic-table-001-img2img-reference/reference.png"
            baseline_label = "SDXL 0.8 previous control"
        paths.append(baseline)
        labels.append(baseline_label)
        for j, (path, label) in enumerate(zip(paths, labels)):
            x, y = j * 320 + 10, i * 700 + 90
            draw.text((x, y - 25), label, font=font(16), fill="white")
            panel(sheet, path, x, y, 300, 260, nearest=j == 0)
            if path.exists():
                rows.append({"asset": asset, "label": label, "file": str(path), "sha256": digest(path)})
            if j in [1, 2, 3, 4]:
                model, seed = [("flux", 42), ("flux", 43), ("qwen", 42), ("qwen", 43)][j - 1]
                mask = bundle / "references" / f"{model}-{asset}-s{seed}-u2net/reference.png"
                draw.text((x, y + 282), "Separate U2Net on saved RGB", font=font(16), fill="white")
                panel(sheet, mask, x, y + 310, 300, 260)
        draw.text((18, i * 700 + 680), "Qwen upper panel composites native alpha; hidden RGB under transparency is not visible artwork.", font=font(14), fill="#bdcad8")
    sheet.save(destination / "reference-sheet.png")
    runs = []
    for path in sorted((bundle / "runs").glob("*/run.json")):
        record = read(path)
        export_root = path.parent / "export"
        if (path.parent / "export-inspection/inspection/viewer.html").exists():
            export_root = path.parent / "export-inspection"
        elif (path.parent / "export-bounds/inspection/viewer.html").exists():
            export_root = path.parent / "export-bounds"
        runs.append({"id": path.parent.name, "record": record, "directory": path.parent, "export": export_root})
    overview = Image.new("RGB", (6 * 320, len(plan["assets"]) * 350 + 90), "#19222c")
    od = ImageDraw.Draw(overview)
    od.text((18, 15), "073 overview: color and shape are separate comparisons — unreviewed", font=font(24), fill="white")
    run_by_id = {r["id"]: r for r in runs}
    for i, asset in enumerate(plan["assets"]):
        entry = next(x for x in manifest["inputs"] if x["id"] == asset)
        cases = [
            ("Original sprite", None),
            ("FLUX → TRELLIS: colored", f"trellis-flux-{asset}-s42-u2net"),
            ("Qwen native alpha → TRELLIS", f"trellis-qwen-{asset}-s42"),
            ("Qwen → TripoSG: shape", f"triposg-{asset}-qwen-{asset}-s42-hierarchical"),
            ("Original → TripoSG: shape", f"triposg-{asset}-original-hierarchical"),
            ("Shape-first → texture", "texture-triposg-oak-qwen" if asset == "oak-tree" else "texture-fitted-car-qwen-uv2" if asset == "compact-1-east" else ""),
        ]
        for j, (label, case_id) in enumerate(cases):
            file = bundle / entry["enlarged"] if case_id is None else run_by_id.get(case_id, {"export": Path("/nonexistent")})["export"] / "inspection/oblique.png"
            x, y = j * 320 + 10, i * 350 + 120
            od.text((x, y - 25), label, font=font(15), fill="white")
            panel(overview, file, x, y, 300, 260, nearest=j == 0)
        od.text((12, i * 350 + 70), asset, font=font(18), fill="#bdcad8")
    overview.save(destination / "overview.png")
    probes = ["compact-1-east", "oak-tree"]
    mask_sheet = Image.new("RGB", (6 * 320, 800), "#19222c")
    md = ImageDraw.Draw(mask_sheet)
    md.text((18, 15), "Matched alpha probes: same Qwen image / TRELLIS seed and settings", font=font(24), fill="white")
    md.text((18, 48), "U2Net uses raw RGB ignoring alpha; hidden colors are a confound, especially on oak. Unreviewed.", font=font(18), fill="#bdcad8")
    for i, asset in enumerate(probes):
        entry = next(x for x in manifest["inputs"] if x["id"] == asset)
        reference = bundle / "references" / f"qwen-{asset}-s42"
        paths = [bundle / entry["enlarged"], reference / "generated-native.png", reference / "native-alpha.png",
                 bundle / "runs" / f"trellis-qwen-{asset}-s42/export/inspection/oblique.png",
                 reference.with_name(reference.name + "-u2net") / "reference.png",
                 bundle / "runs" / f"trellis-qwen-{asset}-u2net-probe/export/inspection/oblique.png"]
        for j, (file, label) in enumerate(zip(paths, ["Original", "Qwen returned RGBA", "Qwen native alpha", "TRELLIS native-alpha result", "Raw RGB + U2Net", "TRELLIS U2Net result"])):
            x, y = j * 320 + 10, i * 350 + 155
            md.text((x, y - 25), label, font=font(15), fill="white")
            panel(mask_sheet, file, x, y, 300, 260, nearest=j == 0)
        md.text((12, i * 350 + 102), asset, font=font(18), fill="#bdcad8")
    mask_sheet.save(destination / "mask-probe-sheet.png")
    geometry = Image.new("RGB", (5 * 320, max(1, len(runs)) * 345 + 80), "#19222c")
    gd = ImageDraw.Draw(geometry)
    gd.text((18, 15), "073: geometry/appearance — observed sources and generated hypotheses", font=font(23), fill="white")
    geometry_records = []
    for i, run in enumerate(runs):
        root = run["directory"]
        asset = run["record"].get("input", {}).get("asset", "compact-1-east")
        entry = next((x for x in manifest["inputs"] if x["id"] == asset), None)
        provider_input = root / "provider-input.png"
        if not provider_input.exists() and run["id"].startswith("fitted-car"):
            provider_input = bundle / "car-sources.png"
        original = bundle / entry["enlarged"] if entry else root / "input.png"
        files = [original, provider_input] + [run["export"] / "inspection" / f"{view}.png" for view in ["oblique", "side", "top"]]
        for j, (file, label) in enumerate(zip(files, ["Original source", "Exact provider input", "Oblique", "Side", "Top"])):
            x, y = j * 320 + 10, i * 345 + 100
            gd.text((x, y - 25), label, font=font(16), fill="white")
            panel(geometry, file, x, y, 300, 250, nearest=j == 0)
            if file.exists():
                geometry_records.append({"run": run["id"], "label": label, "file": str(file), "sha256": digest(file)})
        gd.text((12, i * 345 + 58), run["id"], font=font(17), fill="#bdcad8")
    geometry.save(destination / "geometry-sheet.png")
    def link(path, label):
        if not path.exists():
            return ""
        url = os.path.relpath(path, destination).replace(os.sep, "/")
        return f'<a href="{html.escape(url, quote=True)}">{html.escape(label)}</a>'
    def visual(path, label):
        if not path.exists():
            return f'<p>{html.escape(label)}: not produced</p>'
        url = os.path.relpath(path, destination).replace(os.sep, "/")
        return f'<figure><a href="{html.escape(url, quote=True)}"><img src="{html.escape(url, quote=True)}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
    image_cards = []
    generations = []
    for path in sorted((bundle / "references").glob("*/generation.json")):
        record = read(path)
        generations.append({"id": record["id"], "status": record["status"], "seconds": record.get("seconds"), "peakAllocatedBytes": record.get("peakAllocatedBytes"), "nativeAlpha": record.get("nativeAlpha"), "recordSha256": digest(path)})
        root = path.parent
        links = [link(path, "Generation record / exact prompt / versions"), link(root / "provider-input.png", "Exact input"), link(root / "generated-rgb.png", "Raw RGB channels (alpha ignored)"), link(root / "native-alpha.png", "Native alpha"), link(root.with_name(root.name + "-u2net") / "reference.json", "Independent mask record")]
        card = f'<article><h3>{html.escape(root.name)}</h3><p>{html.escape(record["status"])} · {record.get("seconds", 0):.1f}s · peak allocated {record.get("peakAllocatedBytes", 0) / 2**30:.2f} GiB</p>'
        card += visual(root / "generated-native.png", "Raw editor output; checkerboard shows returned alpha")
        card += visual(root.with_name(root.name + "-u2net") / "reference.png", "Separate U2Net cutout")
        card += '<p>' + " · ".join(x for x in links if x) + '</p></article>'
        image_cards.append(card)
    mesh_cards = []
    for run in runs:
        root = run["directory"]
        record = run["record"]
        hashes = record.get("implementationSha256", {})
        hashes = hashes if isinstance(hashes, dict) else {"runner": hashes}
        card = f'<article><h3>{html.escape(run["id"])}</h3><p>{html.escape(record["status"])} · {record.get("elapsedSeconds", 0):.1f}s</p>'
        card += visual(run["export"] / "inspection/oblique.png", "Actual GLB oblique capture")
        for path, label in [(root / "run.json", "Inference/fit record"), (root / "raw.npz", "Untouched geometry arrays"), (root / "raw.glb", "Raw geometry GLB"), (run["export"] / "candidate.glb", "Export GLB"), (run["export"] / "export.json", "Export transformations"), (run["export"] / "inspection/viewer.html", "Interactive orbit / wireframe"), (root / "fit-sheet.png", "Four-view fit residuals"), (root / "observed-atlas.png", "Observed texture atlas"), (run["export"] / "materials/index.json", "Actual UV/material arrays and texture images"), (bundle / "implementation/by-sha" / f"{record.get('implementationSha256')}.py", "Exact runner implementation"), (bundle / "stage-sheets" / run["id"] / "stages/index.html", "Every pipeline stage / depth data")]:
            value = link(path, label)
            if value:
                card += f'<p>{value}</p>'
        card += '<p>' + ' · '.join(link(bundle / "implementation/by-sha" / f"{sha}.py", f"Exact implementation: {name}") for name, sha in hashes.items()) + '</p>'
        mesh_cards.append(card + '</article>')
    result = {"inputManifestSha256": digest(bundle / "inputs.json"), "generations": generations, "meshes": [{"id": x["id"], "status": x["record"]["status"], "runRecordSha256": digest(x["directory"] / "run.json")} for x in runs], "imageEvidence": rows, "geometryEvidence": geometry_records, "sheetSha256": {n: digest(destination / n) for n in ["overview.png", "reference-sheet.png", "geometry-sheet.png"]}, "review": "Unreviewed diagnostic candidates; no automatic quality verdict", "implementationSha256": digest(__file__)}
    result["sheetSha256"]["mask-probe-sheet.png"] = digest(destination / "mask-probe-sheet.png")
    result["assessment"] = read(bundle / "assessment.json")
    (destination / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>073 spatial pipeline alternatives</title><style>body{font:16px system-ui;margin:20px;background:#edf1f5;color:#243142}main{max-width:1400px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}article{padding:16px;background:white;border-radius:12px;overflow-wrap:anywhere}img{width:100%;height:300px;object-fit:contain;background:repeating-conic-gradient(#c4cbd2 0% 25%,#d7dce1 0% 50%) 50%/24px 24px}figure{margin:12px 0}p{line-height:1.5}a{overflow-wrap:anywhere}</style><main><h1>Spatial pipeline alternatives: first four routes</h1><p>Five frozen game assets; two editor seeds; fixed mesh seed. These are unreviewed experiments. Read RGB/native alpha, masking and geometry separately. A generated view is a hypothesis.</p><p><a href="reference-sheet.png">Reference / mask comparison sheet</a> · <a href="geometry-sheet.png">Geometry comparison sheet</a> · <a href="results.json">Evidence hashes and results</a></p>'
    page += visual(destination / "overview.png", "Open the overview sheet for a side-by-side comparison of the four routes")
    page += '<p>' + link(destination / "mask-probe-sheet.png", "Matched alpha probe comparison") + ' · ' + link(bundle / "execution.json", "Complete execution ledger, including failures") + '</p>'
    page += visual(destination / "mask-probe-sheet.png", "Independent masks change interpretation; compare both controls")
    assessment = read(bundle / "assessment.json")
    if assessment:
        page += '<h2>Findings</h2>' + ''.join(f'<p>{html.escape(item)}</p>' for item in assessment.get("findings", [])) + '<p>' + link(bundle / "assessment.json", "Observations, limitations and next experiments") + '</p>'
    page += '<p>' + " · ".join(link(bundle / name, label) for name, label in [("plan.json", "Protocol and source identities"), ("inputs.json", "Frozen input metadata"), ("environment.json", "Setup environment"), ("mesh-execution.json", "Mesh execution ledger"), ("image-edit-freeze.txt", "Image editor environment lock"), ("triposg-freeze.txt", "TripoSG environment lock")]) + '</p>'
    page += '<h2>References and independent masks</h2><div class="grid">' + ''.join(image_cards) + '</div><h2>Geometry and appearance</h2><div class="grid">' + ''.join(mesh_cards) + '</div></main></html>'
    (destination / "index.html").write_text(page)
    if args.portable:
        args.portable.mkdir(parents=True, exist_ok=True)
        previews = []
        for name in ["overview.png", "reference-sheet.png", "geometry-sheet.png", "mask-probe-sheet.png"]:
            image = Image.open(destination / name)
            image.thumbnail((1920, 16000), Image.Resampling.LANCZOS)
            image.save(args.portable / name)
            previews.append({"source": name, "sourceSha256": digest(destination / name), "previewSha256": digest(args.portable / name), "transform": "LANCZOS fit within 1920x16000"})
        (args.portable / "results.json").write_text(json.dumps({**result, "previewTransforms": previews}, indent=2) + "\n")
        (args.portable / "index.html").write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>073 spatial alternatives evidence</title><style>body{font:16px system-ui;margin:20px;max-width:1400px}img{max-width:100%;height:auto}a{overflow-wrap:anywhere}</style><h1>073 spatial alternatives</h1><p>Unreviewed diagnostic experiments. Full local report and raw data are under D:/spatial-assets/073/report/index.html.</p><p><a href="results.json">Results and provenance</a></p><h2>Overview</h2><a href="overview.png"><img src="overview.png" alt="Four route comparison"></a><h2>Reference / mask comparisons</h2><a href="reference-sheet.png"><img src="reference-sheet.png" alt="Reference and mask matrix"></a><h2>Geometry comparisons</h2><a href="geometry-sheet.png"><img src="geometry-sheet.png" alt="Original, provider input and three actual GLB views"></a>')
        with (args.portable / "index.html").open("a") as page_file:
            page_file.write('<h2>Matched mask probes</h2><a href="mask-probe-sheet.png"><img src="mask-probe-sheet.png" alt="Same Qwen images with native versus independent alpha"></a></html>')
    print(json.dumps({"references": len(generations), "meshes": len(runs), "report": str(destination / "index.html")}))


if __name__ == "__main__":
    main()
