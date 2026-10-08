"""Build the ten-asset comparison sheet and linked stage inspection report."""
import argparse
import html
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw
from reference import digest, name
from stage_sheet import font, image_panel, read


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--batch", type=name, required=True)
    parser.add_argument("--id", type=name, default="report")
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    batch_dir = bundle / "batches" / args.batch
    batch = read(batch_dir / "batch.json")
    manifest = read(bundle / "inputs.json")
    if batch["inputManifestSha256"] != digest(bundle / "inputs.json"):
        raise RuntimeError("Batch source manifest changed")
    destination = batch_dir / args.id
    destination.mkdir(exist_ok=False)
    assessment = read(batch_dir / "assessment.json") or {}
    canvas = Image.new("RGB", (2400, 120 + len(batch["assets"]) * 380), "#f1f4f7")
    draw = ImageDraw.Draw(canvas)
    draw.text((20, 10), "Ten current game assets — local generation stages", fill="#243142", font=font(28))
    columns = ["Original sprite", "Local SDXL cutout", "Selected MV view", "Raw geometry side", "Textured GLB front", "Textured GLB side"]
    for index, label in enumerate(columns):
        draw.text((index * 400 + 14, 65), label, fill="#243142", font=font(20))
    rows, cards = [], []

    def link(path, label, picture=False):
        url = html.escape(os.path.relpath(path, destination).replace(os.sep, "/"), quote=True)
        return f'<a href="{url}"><img src="{url}" alt="{html.escape(label)}"></a>' if picture else f'<a href="{url}">{html.escape(label)}</a>'

    for row, item in enumerate(batch["assets"]):
        run_id = item["run"]
        entry = next(e for e in manifest["inputs"] if e["id"] == item["asset"])
        run = bundle / "runs" / run_id
        record = read(run / "run.json") or {}
        pipeline = read(bundle / "pipelines" / run_id / "pipeline.json") or {}
        bake = read(run / "bake/bake.json") or {}
        export = read(run / "export/export.json") or {}
        views = read(bundle / "views" / run_id / "views.json") or {}
        initial_id = views.get("input", {}).get("reference") or f"{run_id}-img2img-reference"
        initial = bundle / "references" / initial_id
        generation = read(initial / "generation.json") or {}
        captures = [p for p in sorted((run / "export").glob("inspection*")) if (p / "inspection.json").exists()]
        capture = captures[-1] if captures else run / "export/inspection"
        paths = [bundle / entry["input"], initial / "reference.png", run / "input.png", run / "inspection/side.png", capture / "front.png", capture / "side.png"]
        top = 110 + row * 380
        draw.text((14, top + 2), f'{item["label"]} · {item["status"]}', fill="#243142", font=font(20))
        for column, path in enumerate(paths):
            if path.exists():
                image_panel(canvas, path, (column * 400 + 14, top + 40, 372, 320), column in (0, 3))
            else:
                draw.rectangle((column * 400 + 14, top + 40, column * 400 + 386, top + 360), fill="#dce2e8")
                draw.text((column * 400 + 30, top + 185), "Not produced", fill="#435266", font=font(22))
        observation = assessment.get(item["asset"], "Agent visual assessment pending")
        data = {"asset": item["asset"], "label": item["label"], "run": run_id, "status": item["status"],
                "source": entry, "referenceSettings": generation.get("settings"), "viewSettings": views.get("settings"),
                "conditioning": {"prompt": generation.get("prompt"), "negativePrompt": generation.get("negativePrompt"),
                                 "promptCorrection": item.get("promptCorrection"), "imageModels": generation.get("models"),
                                 "viewModels": views.get("models"), "trellisProvider": record.get("provider"),
                                 "trellisCheckpoint": record.get("checkpoint"), "imageEncoder": record.get("imageEncoder")},
                "meshSettings": record.get("settings"), "rawMesh": record.get("mesh"), "geometryScreen": pipeline.get("volumeScreen"),
                "bake": bake, "export": export, "agentObservation": observation,
                "timing": {"imageGeneration": generation.get("elapsedSeconds"), "multiview": views.get("elapsedSeconds"),
                           "trellis": record.get("elapsedSeconds"), "geometryPipeline": pipeline.get("elapsedSeconds"), "batchObserved": item.get("batchObservedSeconds")},
                "hashes": {"sourceRgba": entry["cropRgbaSha256"], "raw": record.get("outputSha256")},
                "previewInputs": [{"file": str(p.relative_to(bundle)), "sha256": digest(p)} for p in paths if p.exists()]}
        rows.append(data)
        stage_dir = bundle / "stage-sheets" / run_id / "stages"
        content = f'<section id="{html.escape(item["asset"], quote=True)}"><h2>{html.escape(item["label"])}</h2><p>{html.escape(item["status"])} · {html.escape(observation)}</p>'
        if (stage_dir / "index.html").exists():
            content += '<p>' + link(stage_dir / "index.html", "Inspect all 16 stages") + ' · ' + link(stage_dir / "sheet.png", "Full stage sheet") + ' · ' + link(stage_dir / "sheet.json", "Stage provenance") + '</p>'
        if (capture / "viewer.html").exists():
            content += '<p>' + link(capture / "viewer.html", "Orbit the generated mesh") + ' · ' + link(run / "export/candidate.glb", "Download textured GLB") + '</p>'
        artifact_links = [(initial / "generation.json", "Image generation record"), (views and bundle / "views" / run_id / "views.json", "View generation record"), (run / "run.json", "TRELLIS record"), (run / "raw.npz", "Raw geometry and appearance arrays"), (run / "bake/bake.json", "Source fit and coverage record"), (run / "bake/depth.npy", "Float32 source depth"), (run / "bake/positions.npy", "Source XYZ positions"), (bundle / "comparisons" / run_id / "comparison.json", "Actor overlap record")]
        content += '<p>' + ' · '.join(link(path, label) for path, label in artifact_links if path and path.exists()) + '</p>'
        content += '<div class="pictures">' + link(paths[0], "Original current sprite", True)
        if paths[4].exists():
            content += link(paths[4], "Actual textured GLB front", True)
        content += '</div>'
        if bake:
            content += f'<p>Original-alpha coverage: {bake["matchedPixels"]}/{bake["sourceOpaquePixels"]}; {bake["sourceUnmatchedPixels"]} unknown. Coverage is not correctness.</p>'
        content += '</section>'
        cards.append(content)
    canvas.save(destination / "overview.png")
    summary = {"batch": args.batch, "status": batch["status"], "review": "Unreviewed diagnostics; observations are agent assessments, not approvals",
               "settings": batch["settings"], "inputManifestSha256": batch["inputManifestSha256"],
               "implementationSha256": digest(__file__), "overviewSha256": digest(destination / "overview.png"), "assets": rows}
    (destination / "results.json").write_text(json.dumps(summary, indent=2) + "\n")
    nav = '<nav><ul>' + ''.join(f'<li><a href="#{html.escape(i["asset"], quote=True)}">{html.escape(i["label"])}</a></li>' for i in batch["assets"]) + '</ul></nav>'
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ten current assets</title><style>body{font:16px system-ui;margin:24px;background:#f1f4f7;color:#243142}main{max-width:1200px;margin:auto}section{background:white;padding:20px;margin:20px 0;border-radius:12px}p{line-height:1.5}.pictures{display:flex;flex-wrap:wrap;gap:16px}.pictures a{flex:1 1 280px;min-width:0}img{width:100%;max-height:420px;object-fit:contain}h2{overflow-wrap:anywhere}</style><main><h1>Ten current game assets</h1><p>Local SDXL → learned alpha → MV-Adapter → learned alpha and fixed angle-0 selection → TRELLIS.2 → source fitting/depth → textured GLB. All outputs are unreviewed. The five other generated views are hypotheses, not joint TRELLIS input. GLB front/side are provider-axis cameras; source coverage/depth uses the separately saved fitted game projection.</p><p><a href="overview.png">All-assets stage comparison sheet</a> · <a href="results.json">Measurements and provenance</a></p>'
    probes = sorted((bundle / "mask-probes").glob("*/probe.json"))
    extra = ""
    if probes:
        extra = '<section><h2>Saved-image mask ablations</h2><p>Same generated RGB pixels, alternative automatic masks. These were not used in the baseline meshes. Border masking retains table supports but also enclosed background; higher thresholds erase foreground.</p>'
        for probe in probes:
            extra += '<h3>' + html.escape(probe.parent.name) + '</h3>' + link(probe.parent / "comparison.png", "Automatic mask comparison", True) + '<p>' + link(probe, "Mask experiment provenance") + '</p>'
        extra += '</section>'
    (destination / "index.html").write_text(page + nav + ''.join(cards) + extra + '</main></html>', encoding="utf8")
    print(json.dumps({"report": str(destination / "index.html"), "assets": len(rows)}))


if __name__ == "__main__":
    main()
