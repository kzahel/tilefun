"""Matched cutout/geometry evidence, including frozen prior-run controls."""
import argparse
import html
import json
import os
from pathlib import Path
import shutil

from PIL import Image, ImageDraw
from alternatives_report import font, panel, read
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--portable", type=Path)
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    plan = read(bundle / "plan.json")
    manifest = read(bundle / "inputs.json")
    references = read(bundle / "mask-execution.json")
    references += read(bundle / "point-mask-execution.json") or []
    references += read(bundle / "floor-mask-execution.json") or []
    modes = list(dict.fromkeys(r["segmentation"]["mode"] for r in references))
    source = Path(plan["sourceBundle"])
    destination = bundle / "report"
    destination.mkdir(exist_ok=True)
    runs = []
    for path in sorted((bundle / "runs").glob("*/run.json")):
        export = path.parent / "export-inspection" if (path.parent / "export-inspection").exists() else path.parent / "export"
        runs.append({"id": path.parent.name, "record": read(path), "root": path.parent, "export": export})
    run_map = {item["id"]: item for item in runs}
    sheet = Image.new("RGB", (360*len(modes), len(plan["assets"])*1670 + 100), "#19222c")
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 15), "074: same visible RGB; mask changes; two geometry providers", fill="white", font=font(25))
    draw.text((18, 50), "Unreviewed. TripoSG is shape only; TRELLIS is colored. Inspect provider crops separately.", fill="#bdcad8", font=font(18))
    evidence = []
    for i, asset in enumerate(plan["assets"]):
        base_y = 130 + i*1670
        draw.text((18, base_y-30), asset, fill="white", font=font(23))
        for j, mode in enumerate(modes):
            ref_id = f"mask-{asset}-{mode}"
            reference = bundle / "references" / ref_id
            if not reference.exists():
                draw.text((j*360+10, base_y), mode, fill="white", font=font(20))
                draw.text((j*360+30, base_y+200), "Not applicable to this asset", fill="#bdcad8", font=font(18))
                continue
            tr_id = f"trellis-{ref_id}"
            tp_id = f"triposg-{asset}-{ref_id}-hierarchical"
            tr = run_map.get(tr_id, {"root": bundle / "absent", "export": bundle / "absent"})
            tp = run_map.get(tp_id, {"root": bundle / "absent", "export": bundle / "absent"})
            draw.text((j*360+10, base_y), mode, fill="white", font=font(20))
            items = [(reference / "reference.png", "Registered cutout"), (reference / "mask.png", "Actual alpha"),
                     (tr["root"] / "provider-input.png", "Exact TRELLIS input"),
                     (tr["export"] / "inspection/oblique.png", "TRELLIS colored GLB"),
                     (tp["root"] / "provider-input.png", "Exact TripoSG input"),
                     (tp["export"] / "inspection/oblique.png", "TripoSG shape GLB")]
            for row, (file, label) in enumerate(items):
                x, y = j*360+10, base_y+55+row*265
                draw.text((x, y-25), label, fill="#bdcad8", font=font(16))
                panel(sheet, file, x, y, 340, 235)
                if file.exists():
                    evidence.append({"file": os.path.relpath(file, bundle), "sha256": digest(file), "asset": asset, "mode": mode, "label": label})
    sheet.save(destination / "overview.png")
    seed_sheet = None
    if (bundle / "seed-probe-execution.json").exists():
        seed_cases = [("native-clean", 42), ("native-hard", 42), ("native-clean", 43), ("native-hard", 43)]
        if (bundle / "floor-mask-execution.json").exists():
            seed_cases = [("native-clean", 42), ("native-hard", 42), ("native-floor32", 42), ("native-clean", 43), ("native-hard", 43), ("native-floor32", 43)]
        seed_sheet = Image.new("RGB", (360*len(seed_cases), 640), "#19222c")
        sd = ImageDraw.Draw(seed_sheet)
        sd.text((18, 15), "Car alpha controls: each cutout unchanged across mesh seeds 42 and 43", fill="white", font=font(23))
        for j, (mode, seed) in enumerate(seed_cases):
            run_id = f"trellis-mask-compact-1-east-{mode}" + ("-s43" if seed == 43 else "")
            root = bundle / "runs" / run_id
            sd.text((j*360+10, 65), f"{mode}; seed {seed}", fill="white", font=font(19))
            for row, (file, label) in enumerate([(root / "provider-input.png", "Exact provider input"), (root / "export/inspection/oblique.png", "Actual colored GLB")]):
                x, y = j*360+10, 120+row*260
                sd.text((x, y-25), label, fill="#bdcad8", font=font(16))
                panel(seed_sheet, file, x, y, 340, 235)
                if file.exists():
                    evidence.append({"file": str(file.relative_to(bundle)), "sha256": digest(file), "label": "Mesh seed repeat"})
        seed_sheet.save(destination / "seed-sheet.png")
    def link(file, label):
        if not file.exists():
            return ""
        url = html.escape(os.path.relpath(file, destination).replace(os.sep, "/"), quote=True)
        return f'<a href="{url}">{html.escape(label)}</a>'
    def visual(file, label):
        if not file.exists():
            return f'<p>{html.escape(label)}: not produced</p>'
        url = html.escape(os.path.relpath(file, destination).replace(os.sep, "/"), quote=True)
        return f'<figure><a href="{url}"><img src="{url}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
    masks_html = []
    for reference in references:
        root = bundle / "references" / reference["id"]
        card = '<article><h3>' + html.escape(reference["id"]) + '</h3>'
        card += visual(root / "mask-input.png", "Same composited RGB supplied to mask experiment")
        card += visual(root / "mask.png", "Actual alpha") + visual(root / "reference.png", "Exact registered cutout")
        logits = root / "sam-output.npz" if (root / "sam-output.npz").exists() else bundle / "mask-analysis" / reference["asset"] / "sam-output.npz"
        card += '<p>' + link(root / "reference.json", "Mask record / metrics / prompt box")
        parent = bundle / "references" / reference["parent"]
        card += ' · ' + link(parent / "generation.json", "Frozen Qwen generation / exact prompt")
        card += ' · ' + link(parent / "generated-native.png", "Original returned RGBA")
        card += ' · ' + link(bundle / "implementation/by-sha" / f'{reference["implementationSha256"]}.py', "Exact mask implementation")
        if reference["segmentation"]["mode"].startswith("sam2"):
            card += ' · ' + link(logits, "SAM binary mask, score and low-resolution logits")
        masks_html.append(card + '</p></article>')
    meshes_html = []
    for run in runs:
        card = '<article><h3>' + html.escape(run["id"]) + '</h3><p>' + html.escape(run["record"]["status"]) + '</p>'
        card += visual(run["root"] / "provider-input.png", "Exact provider crop/composite")
        card += visual(bundle / "background-analysis" / run["id"] / "outside-rgb-x32.png", "Diagnostic only: outside hard foreground RGB amplified 32x") if (bundle / "background-analysis" / run["id"]).exists() else ''
        card += visual(run["export"] / "inspection/oblique.png", "Actual GLB capture")
        if run["export"].name == "export-inspection" and (run["root"] / "export/inspection/oblique.png").exists():
            card += visual(run["root"] / "export/inspection/oblique.png", "Full provider export: compare decimation effects")
            card += '<p>' + link(run["root"] / "export/inspection/viewer.html", "Full provider-export viewer") + '</p>'
        for file, label in [(run["root"] / "run.json", "Inference record"), (run["root"] / "raw.npz", "Untouched geometry/attributes"),
                            (run["root"] / "raw.glb", "Raw geometry GLB"), (run["export"] / "candidate.glb", "Inspection GLB"),
                            (run["export"] / "export.json", "Export transformations"), (run["export"] / "materials/index.json", "Actual UV/material data"),
                            (run["export"] / "inspection/viewer.html", "Orbit, wireframe, six views"),
                            (bundle / "stage-sheets" / run["id"] / "stages/index.html", "Sixteen stages / source-sized depth data")]:
            value = link(file, label)
            if value:
                card += '<p>' + value + '</p>'
        hashes = run["record"]["implementationSha256"]
        hashes = hashes if isinstance(hashes, dict) else {"runner": hashes}
        for name, sha in hashes.items():
            card += '<p>' + link(bundle / "implementation/by-sha" / f"{sha}.py", f"Exact implementation: {name}") + '</p>'
        meshes_html.append(card + '</article>')
    controls = []
    control_html = []
    for asset in plan["assets"]:
        for id in [f"trellis-qwen-{asset}-s42", f"trellis-qwen-{asset}-u2net-probe", f"triposg-{asset}-qwen-{asset}-s42-hierarchical"]:
            root = source / "runs" / id
            record = read(root / "run.json")
            export = root / "export-inspection" if (root / "export-inspection").exists() else root / "export"
            controls.append({"id": id, "bundle": "073", "runRecordSha256": digest(root / "run.json"), "exportSha256": digest(export / "candidate.glb")})
            for file in [root / "run.json", export / "candidate.glb", root / "provider-input.png"]:
                evidence.append({"file": os.path.relpath(file, bundle), "sha256": digest(file), "label": "Frozen 073 control"})
            card = '<article><h3>073 control: ' + html.escape(id) + '</h3>'
            card += visual(root / "provider-input.png", "Prior provider input; raw RGB / prior alpha branch")
            card += visual(export / "inspection/oblique.png", "Frozen prior GLB capture")
            card += '<p>' + link(root / "run.json", "Original run record") + ' · ' + link(export / "inspection/viewer.html", "Prior viewer") + '</p></article>'
            control_html.append(card)
    generations = []
    for file in sorted((bundle / "references").glob("*/generation.json")):
        record = read(file)
        generations.append({"id": record["id"], "status": record["status"], "recordSha256": digest(file)})
    # Include actual mask, RGB and SAM-array bytes, not just the images embedded in the sheet.
    for root in sorted((bundle / "mask-analysis").glob("*")):
        for file in root.iterdir():
            evidence.append({"file": str(file.relative_to(bundle)), "sha256": digest(file), "label": "Saved mask inputs/output"})
    for reference in references:
        root = bundle / "references" / reference["id"]
        for name in ["mask.png", "mask-input.png", "reference.json"]:
            evidence.append({"file": str((root / name).relative_to(bundle)), "sha256": digest(root / name), "label": "Mask variant data"})
        if (root / "sam-output.npz").exists():
            evidence.append({"file": str((root / "sam-output.npz").relative_to(bundle)), "sha256": digest(root / "sam-output.npz"), "label": "Point-prompted logits"})
    for file in sorted((bundle / "background-analysis").glob("**/*")):
        if file.is_file():
            evidence.append({"file": str(file.relative_to(bundle)), "sha256": digest(file), "label": "Declared RGB amplification / measurements"})
    for file in sorted((bundle / "runs").glob("triposg-*/export/inspection/*.png")):
        evidence.append({"file": str(file.relative_to(bundle)), "sha256": digest(file), "label": "Full provider-export capture control"})
    assessment = read(bundle / "assessment.json")
    result = {"inputManifestSha256": digest(bundle / "inputs.json"), "generations": generations,
              "meshes": [{"id": r["id"], "status": r["record"]["status"], "runRecordSha256": digest(r["root"] / "run.json")} for r in runs],
              "controls": controls, "maskMetrics": [{"id": r["id"], **r["metrics"]} for r in references],
              "extraArtifacts": evidence, "sheetSha256": {"overview.png": digest(destination / "overview.png")},
              "assessment": assessment, "implementationSha256": digest(__file__), "review": plan["review"]}
    result["backgroundAnalysis"] = read(bundle / "background-analysis/results.json")
    (destination / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    if seed_sheet is not None:
        result["sheetSha256"]["seed-sheet.png"] = digest(destination / "seed-sheet.png")
        (destination / "results.json").write_text(json.dumps(result, indent=2) + "\n")
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>074 controlled masks and geometry</title><style>body{font:16px system-ui;margin:20px;background:#edf1f5;color:#243142}main{max-width:1400px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:18px}article{padding:16px;background:white;border-radius:12px;overflow-wrap:anywhere}img{width:100%;height:300px;object-fit:contain;background:#d7dce1}figure{margin:12px 0}p{line-height:1.5}a{overflow-wrap:anywhere}</style><main><h1>074: controlled foreground and geometry</h1><p>Same saved Qwen images, no new editor sampling. Four primary masks share exactly the same composited RGB; a separate oak point probe is explicitly labeled. Geometry seed 42. Unreviewed experiments.</p>'
    page += '<p>' + ' · '.join(link(bundle / name, label) for name, label in [("plan.json", "Protocol"), ("environment.json", "SAM/U2Net/checkpoint environment"), ("sam2-freeze.txt", "Environment lock"), ("mask-execution.json", "All mask metrics"), ("execution.json", "Complete run ledger"), ("report/results.json", "Evidence hashes")]) + '</p>'
    if assessment:
        page += '<h2>Findings</h2>' + ''.join('<p>' + html.escape(item) + '</p>' for item in assessment.get("findings", []))
        page += '<p>' + link(bundle / "assessment.json", "Observations, limits and next experiments") + '</p>'
    page += visual(destination / "overview.png", "Open the full-resolution matched comparison sheet")
    if seed_sheet is not None:
        page += visual(destination / "seed-sheet.png", "Native, hard and low-alpha-floor controls at mesh seeds 42 and 43")
    page += '<h2>Mask inputs and cutouts</h2><div class="grid">' + ''.join(masks_html) + '</div>'
    page += '<h2>Matched geometry</h2><div class="grid">' + ''.join(meshes_html) + '</div>'
    page += '<h2>Frozen prior controls; not recomputed</h2><div class="grid">' + ''.join(control_html) + '</div></main></html>'
    (destination / "index.html").write_text(page)
    if args.portable:
        args.portable.mkdir(parents=True, exist_ok=True)
        image = Image.open(destination / "overview.png")
        image.thumbnail((1440, 5000), Image.Resampling.LANCZOS)
        image.save(args.portable / "overview.png")
        if seed_sheet is not None:
            seed_sheet.save(args.portable / "seed-sheet.png")
        (args.portable / "results.json").write_text(json.dumps({**result, "previewTransform": {"method": "LANCZOS fit within 1440x5000", "sourceSha256": digest(destination / "overview.png"), "previewSha256": digest(args.portable / "overview.png")}}, indent=2) + "\n")
        for name in ["plan.json", "assessment.json", "execution.json", "environment.json", "mask-execution.json", "point-mask-execution.json", "floor-mask-execution.json", "seed-probe-execution.json", "floor-seed-execution.json"]:
            if (bundle / name).exists():
                shutil.copyfile(bundle / name, args.portable / name)
        findings = '' if not assessment else ''.join('<p>' + html.escape(item) + '</p>' for item in assessment.get("findings", []))
        (args.portable / "index.html").write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>074 evidence</title><style>body{font:16px system-ui;margin:20px;max-width:1400px}img{max-width:100%;height:auto}a{overflow-wrap:anywhere}</style><h1>074 controlled masks and geometry</h1><p>Unreviewed diagnostic outputs. Full report/raw arrays: D:/spatial-assets/074/report/index.html.</p><p><a href="results.json">Results and provenance</a> · <a href="plan.json">Protocol</a></p>' + findings + '<a href="overview.png"><img src="overview.png" alt="Four alpha branches and matched 3D results"></a></html>')
        if seed_sheet is not None:
            page_file = args.portable / "index.html"
            page_file.write_text(page_file.read_text().replace('</html>', '<h2>Second mesh seed</h2><a href="seed-sheet.png"><img src="seed-sheet.png" alt="Matched seed repeat"></a></html>'))
    print(json.dumps({"references": len(references), "geometryRuns": len(runs), "controls": len(controls), "report": str(destination / "index.html")}))


if __name__ == "__main__":
    main()
