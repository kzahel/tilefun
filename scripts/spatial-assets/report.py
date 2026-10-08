"""Collect preserved pipeline artifacts into an inspectable experiment report."""
import argparse
import html
import json
import os
from pathlib import Path
from reference import digest, name


def read(path):
    return json.loads(path.read_text()) if path.exists() else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--id", type=name, required=True)
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    directory = bundle / "reports" / args.id
    directory.mkdir(parents=True, exist_ok=False)
    observations = read(Path(__file__).with_name("observations.json")) or {}
    records, sections = [], []

    def link(path, label, picture=False):
        url = html.escape(os.path.relpath(path, directory).replace(os.sep, "/"), quote=True)
        label = html.escape(label)
        return f'<a href="{url}"><img src="{url}" alt="{label}"></a>' if picture else f'<a href="{url}">{label}</a>'

    for run in sorted((bundle / "runs").iterdir()):
        record = read(run / "run.json")
        if not record:
            continue
        pipeline = read(bundle / "pipelines" / run.name / "pipeline.json")
        bake = read(run / "bake/bake.json")
        reference = record.get("conditioningReference")
        if reference:
            generation = read(bundle / "references" / reference["id"] / "generation.json")
            reference = {**reference, "generationTiming": generation.get("elapsedSeconds") if generation else None}
        item = {"id": run.name, "status": record["status"], "provider": record.get("provider"),
                "checkpoint": record.get("checkpoint"), "imageEncoder": record.get("imageEncoder"),
                "settings": record.get("settings"), "input": record.get("input"), "reference": reference,
                "mesh": record.get("mesh"), "inferenceSeconds": record.get("inferenceSeconds"),
                "elapsedSeconds": record.get("elapsedSeconds"), "peakAllocatedBytes": record.get("peakAllocatedBytes"),
                "peakReservedBytes": record.get("peakReservedBytes"), "rawHashes": record.get("outputSha256"),
                "pipeline": pipeline, "bake": bake, "agentObservation": observations.get(run.name), "exports": []}
        content = [f'<section id="{html.escape(run.name, quote=True)}"><h2>{html.escape(run.name)}</h2>']
        content.append(f'<p>{html.escape(observations.get(run.name, "No recorded visual assessment."))}</p>')
        content.append(f'<p>Status: {html.escape(pipeline["status"] if pipeline else record["status"])} · mesh seed {record.get("settings", {}).get("seed", "unknown")}</p>')
        if bake:
            content.append(f'<p>Original-alpha coverage: {bake["matchedPixels"]} matched, {bake["sourceUnmatchedPixels"]} unknown. This measures coverage, not clipping correctness.</p>')
        content.append('<p>' + link(run / "run.json", "Inference record") + '</p>')
        if (run / "raw.npz").exists():
            content.append('<p>' + link(run / "raw.npz", "Untouched vertices, triangles, voxels and PBR arrays") + '</p>')
        if bake:
            content.append('<p>' + ' · '.join(link(run / "bake" / file, label) for file, label in [
                ("bake.json", "Bake and transform metadata"), ("depth.npy", "Float32 pixel depth"),
                ("positions.npy", "Pixel surface XYZ"), ("validity.png", "Actual validity mask")]) + '</p>')
        for filename, label in [("input.png", "Actual conditioning input"), ("inspection/raw-geometry.png", "Untouched geometry, six false-depth views"), ("bake/inspection.png", "Original-color depth bake")]:
            if (run / filename).exists():
                content.append(link(run / filename, label, True))
        for export in sorted(run.glob("export*")):
            metadata = read(export / "export.json")
            if not metadata:
                continue
            item["exports"].append(metadata)
            content.append('<p>' + link(export / "candidate.glb", f'{export.name}: textured GLB') + ' · ' + link(export / "export.json", "Export record") + '</p>')
            for capture in sorted(export.glob("inspection*")):
                if (capture / "inspection.json").exists():
                    content.append('<p>' + link(capture / "viewer.html", f'{export.name}/{capture.name}: interactive 3D viewer') + '</p>')
                    content.append(link(capture / "oblique.png", "Generated appearance, oblique", True))
        comparison = bundle / "comparisons" / run.name
        if (comparison / "comparison.json").exists():
            content.append('<p>' + link(comparison / "comparison.json", "Overlap record") + '</p>')
            asset = record.get("input", {}).get("asset")
            if asset and (comparison / f"{asset}-overlap.png").exists():
                content.append(link(comparison / f"{asset}-overlap.png", "Original-color overlap comparison", True))
        content.append('</section>')
        records.append(item)
        sections.extend(content)
    views = [read(p) for p in sorted((bundle / "views").glob("*/views.json"))] if (bundle / "views").exists() else []
    generations = [read(p) for p in sorted((bundle / "references").glob("*/generation.json"))]
    sections.append('<h1>Image generation and segmentation evidence</h1>')
    for reference_path in sorted((bundle / "references").glob("*/reference.json")):
        ref = read(reference_path)
        sections.append(f'<section><h2>{html.escape(ref["id"])}</h2><p>{html.escape(ref["generator"])}</p>')
        sections.append('<p>' + link(reference_path, "Reference provenance, prompt and settings") + '</p>')
        for filename in ["source.png", "provider-input.png", "generated-rgb.png", "mask.png", "reference.png"]:
            image = reference_path.parent / filename
            if image.exists():
                sections.append('<p>' + html.escape(filename) + '</p>' + link(image, filename, True))
        sections.append('</section>')
    for views_record in views:
        view_path = bundle / "views" / views_record["id"]
        sections.append(f'<section><h2>{html.escape(views_record["id"])}</h2><p>Local multiview status: {html.escape(views_record["status"])}</p>')
        sections.append('<p>' + link(view_path / "views.json", "Prompts, cameras, model pins, settings and mask hashes") + '</p>')
        for filename in ["input.png", "views.png", "cutouts.png", "mask-000.png"]:
            if (view_path / filename).exists():
                sections.append('<p>' + html.escape(filename) + '</p>' + link(view_path / filename, filename, True))
        sections.append('</section>')
    summary = {"review": "Unreviewed experiments; observations are agent judgments, not human approvals",
               "inputManifestSha256": digest(bundle / "inputs.json"), "implementationSha256": digest(__file__),
               "timingLimit": "Single observations including variable cache/load times, not benchmarks",
               "runs": records, "viewGenerations": views, "imageGenerations": generations}
    (directory / "experiments.json").write_text(json.dumps(summary, indent=2) + "\n")
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Spatial experiments</title><style>body{font:16px system-ui;margin:24px;background:#f1f4f7;color:#243142}main{max-width:1100px;margin:auto}section{background:white;padding:24px;margin:24px 0;border-radius:12px}img{max-width:100%;max-height:650px;object-fit:contain;display:block;margin:12px 0}p{line-height:1.5}h2{overflow-wrap:anywhere}</style><main><h1>Spatial asset experiments</h1><p>Sprite → recorded reference generation → learned alpha → TRELLIS.2 → untouched mesh → source fitting and depth bake → simplified textured export. Every candidate is unreviewed. Generated views are hypotheses, not independent observations.</p><p>'
    navigation = '<nav aria-label="Experiment runs"><ul>' + ''.join(f'<li><a href="#{html.escape(item["id"], quote=True)}">{html.escape(item["id"])}</a></li>' for item in records) + '</ul></nav>'
    page += link(directory / "experiments.json", "Underlying experiment data") + '</p>' + navigation + ''.join(sections) + '</main></html>'
    (directory / "index.html").write_text(page)
    print(json.dumps({"report": str(directory / "index.html"), "runs": len(records)}))


if __name__ == "__main__":
    main()
