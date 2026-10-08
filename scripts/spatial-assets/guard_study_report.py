"""Inspectable 075 prop guard and tree mask/framing/seed matrices."""
import argparse
import html
import json
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw
from alternatives_report import font, panel, read
from prepare_guard_study import PROPS, TREE_MODES
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--portable", type=Path)
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    root = bundle / "report"
    root.mkdir(exist_ok=True)
    plan = read(bundle / "plan.json")
    manifest = read(bundle / "inputs.json")
    if digest(bundle / "inputs.json") != plan["inputManifestSha256"]:
        raise RuntimeError("Frozen manifest changed")
    controls = read(bundle / "controls.json")
    evidence = []
    sheets = {}

    def keep(path):
        if path.exists():
            evidence.append({"file": os.path.relpath(path, bundle), "sha256": digest(path)})

    def link(path, label=None):
        if not path.exists():
            return ""
        href = os.path.relpath(path, root).replace(os.sep, "/")
        return f'<a href="{html.escape(href, quote=True)}">{html.escape(label or path.name)}</a>'

    def tile(canvas, image, col, row, label, nearest=False):
        x, y = col * 320 + 10, row * 290 + 80
        ImageDraw.Draw(canvas).text((x, y - 25), label, fill="white", font=font(15))
        panel(canvas, image, x, y, 300, 250, nearest)
        keep(image)

    def canvas(rows, title, cols=6):
        image = Image.new("RGB", (cols * 320, rows * 290 + 85), "#19222c")
        ImageDraw.Draw(image).text((18, 15), title, fill="white", font=font(23))
        return image

    def save(image, name):
        image.save(root / name)
        sheets[name] = digest(root / name)

    def export(run):
        return run / ("export-inspection" if (run / "export-inspection").exists() else "export")

    # Each prop has full source/reference/provider/front/side comparisons.
    for asset in PROPS:
        sheet = canvas(5, f"075 {asset}: same RGB / crop-preserving alpha guard — unreviewed")
        entry = next(e for e in manifest["inputs"] if e["id"] == asset)
        for col, provider in enumerate(["source", "native", "TRELLIS clean", "TRELLIS floor32", "Tripo clean", "Tripo floor32"]):
            if col == 0:
                for row in range(5):
                    tile(sheet, bundle / entry["enlarged"], col, row, "Original source pixels", True)
                continue
            if col == 1:
                parent = bundle / "references" / f"qwen-{asset}-s42"
                for row, (file, label) in enumerate([("generated-native.png", "Frozen Qwen native RGBA"), ("generated-rgb.png", "Underlying RGB"), ("native-alpha.png", "Native alpha"), ("provider-input.png", "Editor input"), ("generated-native.png", "No regeneration")]):
                    tile(sheet, parent / file, col, row, label)
                continue
            mode = "native-clean" if col in [2, 4] else "native-floor32"
            ref = f"mask-{asset}-{mode}"
            run_id = f"trellis-{ref}" if col < 4 else f"triposg-{asset}-{ref}-hierarchical"
            run = bundle / "runs" / run_id
            paths = [(bundle / "references" / ref / "reference.png", provider + " cutout"),
                     (run / "provider-input.png", "Actual provider input"),
                     (export(run) / "inspection/front.png", "Seed42 front"),
                     (export(run) / "inspection/side.png", "Seed42 side"),
                     (export(run) / "inspection/oblique.png", "Seed42 oblique")]
            for row, (image, label) in enumerate(paths):
                tile(sheet, image, col, row, label)
        save(sheet, f"prop-{asset}.png")

    tree = canvas(5, "075 oak: mask × framing × seed; gray shapes, no texture — unreviewed")
    for index, mode in enumerate(TREE_MODES):
        for offset, framing in enumerate(["default", "common"]):
            col = index * 2 + offset
            tile(tree, bundle / "framing" / f"{mode}-{framing}.png", col, 0, f"{mode} / {framing} input")
            for seed, first_row in [(42, 1), (43, 3)]:
                if seed == 42 and framing == "default":
                    control = next(c for c in controls if c["asset"] == "oak-tree" and c["mode"] == mode)
                    run = Path(control["bundle"]) / "runs" / control["id"]
                else:
                    run = bundle / "runs" / f"triposg-tree-{mode}-{framing}-s{seed}"
                for row, view in [(first_row, "front"), (first_row + 1, "side")]:
                    tile(tree, export(run) / "inspection" / f"{view}.png", col, row, f"Seed{seed} {view}" + (" (074)" if seed == 42 and framing == "default" else ""))
    save(tree, "tree-framing-seeds.png")
    full_tent = bundle / "runs/triposg-tent-blue-mask-tent-blue-native-floor32-hierarchical/export/inspection"
    if full_tent.exists():
        tent = canvas(3, "075 tent: 50k inspection versus full provider export — unreviewed", 4)
        for index, mode in enumerate(["native-clean", "native-floor32"]):
            run = bundle / "runs" / f"triposg-tent-blue-mask-tent-blue-{mode}-hierarchical"
            for offset, kind in enumerate(["export-inspection", "export"]):
                for row, view in enumerate(["front", "side", "oblique"]):
                    tile(tent, run / kind / "inspection" / f"{view}.png", index * 2 + offset, row,
                         f"{mode} {'50k' if offset == 0 else 'full'} {view}")
        save(tent, "tent-full-provider.png")
    texture_runs = sorted((bundle / "runs").glob("texture-*/run.json"))
    if texture_runs:
        texture = canvas(3, "075 shape-first tree texturing; source geometry retained — unreviewed", len(texture_runs)+1)
        parents = [bundle.parent / "073/runs/texture-triposg-oak-qwen"] + [p.parent for p in texture_runs]
        for col, run in enumerate(parents):
            for row, view in enumerate(["front", "side", "oblique"]):
                tile(texture, export(run) / "inspection" / f"{view}.png", col, row, ("073 prior" if col == 0 else run.name.removeprefix("texture-tree-")) + f" {view}")
        save(texture, "tree-textures.png")

    # Control identities are checked against their frozen ledger, including raw arrays.
    for control in controls:
        base = Path(control["bundle"])
        for file, expected in control["files"].items():
            path = base / file
            if digest(path) != expected:
                raise RuntimeError(f"Earlier control changed: {path}")
            keep(path)
    for directory in ["framing", "references", "background-analysis", "mask-analysis", "implementation/workflows"]:
        for path in (bundle / directory).rglob("*"):
            if path.is_file():
                keep(path)
    for file in ["plan.json", "controls.json", "tree-jobs.json", "mask-execution.json", "texture-selection.json", "assessment.json", "guard-analysis.json", "execution.json", "mask-environment.json", "inherited-point-masks.json"]:
        keep(bundle / file)

    cards = []
    meshes = []
    for path in sorted((bundle / "runs").glob("*/run.json")):
        record = read(path)
        run = path.parent
        meshes.append({"id": run.name, "status": record["status"], "runRecordSha256": digest(path)})
        info = [link(path, "run/settings/timings"), link(run / "input.png", "conditioning cutout"), link(run / "provider-input.png", "actual model input"), link(run / "raw.npz", "raw arrays"), link(run / "raw.glb", "raw GLB")]
        for ex in [run / "export", run / "export-inspection"]:
            info += [link(ex / "candidate.glb", ex.name + " GLB"), link(ex / "export.json", ex.name + " settings"), link(ex / "inspection/viewer.html", ex.name + " interactive viewer")]
            for material in sorted((ex / "materials").glob("*")):
                info.append(link(material, "material: " + material.name))
        info += [link(bundle / "stage-sheets" / run.name / "stages/index.html", "all pipeline stages"), link(bundle / "pipelines" / run.name / "pipeline.json", "pipeline stages/status")]
        hashes = record["implementationSha256"]
        for label, sha in (hashes.items() if isinstance(hashes, dict) else [("runner", hashes)]):
            info.append(link(bundle / "implementation/by-sha" / f"{sha}.py", "exact code: " + label))
        preview = export(run) / "inspection/oblique.png"
        image = f'<img src="{os.path.relpath(preview, root)}" alt="{html.escape(run.name)}">' if preview.exists() else ""
        cards.append(f'<article><h3>{html.escape(run.name)}</h3><p>{html.escape(record["status"])} · seed {record.get("settings", {}).get("seed", "?")}</p>{image}<p>' + " · ".join(x for x in info if x) + '</p></article>')
    generations = [{"id": p.parent.name, "status": read(p)["status"], "recordSha256": digest(p)} for p in sorted((bundle / "references").glob("*/generation.json"))]
    results = {"inputManifestSha256": plan["inputManifestSha256"], "generations": generations,
               "meshes": meshes, "sheetSha256": sheets,
               "extraArtifacts": list({e["file"]: e for e in evidence}.values()),
               "assessment": read(bundle / "assessment.json"), "review": plan["review"]}
    (root / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    assessment = results["assessment"] or {"findings": ["Execution complete; visual assessment pending."]}
    findings = "".join(f'<li>{html.escape(f)}</li>' for f in assessment.get("findings", []))
    visuals = "".join(f'<p><a href="{name}"><img class="sheet" src="{name}" alt="{name}"></a></p>' for name in sheets)
    data = [link(bundle / f, f) for f in ["inputs.json", "plan.json", "controls.json", "mask-execution.json", "tree-jobs.json", "framing/protocol.json", "texture-selection.json", "assessment.json", "guard-analysis.json", "execution.json"]]
    reference_links = "".join(f'<p>{html.escape(p.parent.name)}: ' + " · ".join(link(f) for f in sorted(p.parent.iterdir()) if f.is_file()) + "</p>" for p in sorted((bundle / "references").glob("*/reference.json")))
    reference_links += '<p>Inherited SAM mask/logits/automatic point evidence: ' + " · ".join(link(p) for p in sorted((bundle / "mask-analysis").rglob("*")) if p.is_file()) + ' · ' + link(bundle / "mask-environment.json", "SAM/U2Net environment pins") + ' · ' + link(bundle / "inherited-point-masks.json", "automatic-point mask records") + '</p>'
    for workflow in sorted((bundle / "implementation/workflows").glob("*.ps1")):
        reference_links += '<p>' + link(workflow, "Archived PowerShell workflow: " + workflow.stem) + '</p>'
    css = '<style>body{font:16px system-ui;margin:24px;background:#f1f4f7;color:#243142}main{max-width:1500px;margin:auto}p,li{line-height:1.5;overflow-wrap:anywhere}img{max-width:100%;height:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:18px}article{padding:16px;background:white;border-radius:12px}h3{overflow-wrap:anywhere}.sheet{width:100%}</style>'
    intro = f'<h1>075: alpha guard and tree framing</h1><p>{len(meshes)} new run records; {sum(m["status"] == "succeeded" for m in meshes)} succeeded. Four frozen Qwen generations reused, zero new editor images. Earlier 073/074 controls are retained separately. Gray Tripo shapes and generated TRELLIS appearance are distinct evidence.</p><ul>{findings}</ul>'
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>075 spatial experiments</title>' + css + '<main>' + intro + visuals
    page += '<h2>Protocol and underlying data</h2><p>' + " · ".join(x for x in data if x) + ' · <a href="results.json">complete hash ledger</a></p>' + reference_links
    page += '<h2>Every run</h2><div class="grid">' + ''.join(cards) + '</div></main></html>'
    (root / "index.html").write_text(page)
    if args.portable:
        args.portable.mkdir(parents=True, exist_ok=True)
        for name in list(sheets) + ["results.json"]:
            shutil.copyfile(root / name, args.portable / name)
        windows = "D:/" + str(bundle.relative_to("/mnt/d")).replace(os.sep, "/") if str(bundle).startswith("/mnt/d/") else str(bundle)
        full = html.escape("file:///" + windows + "/report/index.html", quote=True)
        portable = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>075 spatial experiments</title>' + css + '<main>' + intro + f'<p><a href="{full}">Full local report: stages, masks, raw arrays, model settings, GLBs, interactive views and exact code</a> · <a href="results.json">complete evidence hashes</a></p>' + visuals + '</main></html>'
        (args.portable / "index.html").write_text(portable)
    print(json.dumps({"runs": len(meshes), "sheets": len(sheets), "evidence": len(results["extraArtifacts"])}))


if __name__ == "__main__":
    main()
