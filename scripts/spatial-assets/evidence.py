"""Save compact portable measurements and diagnostic previews, without raw weights/meshes."""
import argparse
import json
from pathlib import Path
import shutil
from PIL import Image
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    args.destination.mkdir(parents=True, exist_ok=False)
    records = []
    for run in report["runs"]:
        if not run.get("reference"):
            continue
        reference = run["reference"]
        portable_ref = {key: reference.get(key) for key in ["id", "generator", "models", "settings", "provenance", "sha256", "size", "generationControl", "generationTiming", "segmentation"]}
        item = {key: run.get(key) for key in ["id", "status", "provider", "checkpoint", "settings", "mesh", "inferenceSeconds", "elapsedSeconds", "peakAllocatedBytes", "peakReservedBytes", "rawHashes", "agentObservation", "exports"]}
        item["reference"] = portable_ref
        item["sourceRgbaSha256"] = reference.get("sourceRgbaSha256")
        item["sourceSha256"] = reference.get("sourceSha256")
        pipeline = run.get("pipeline")
        item["pipelineStatus"] = pipeline.get("status") if pipeline else None
        item["geometryScreen"] = pipeline.get("volumeScreen") if pipeline else None
        item["stages"] = pipeline.get("stages") if pipeline else None
        bake = run.get("bake")
        item["bake"] = {key: bake.get(key) for key in ["matchedPixels", "sourceUnmatchedPixels", "meshOutsideAlphaPixels", "transform", "sourceRgbaSha256"]} if bake else None
        directory = args.bundle / "runs" / run["id"]
        item["previews"] = {}
        images = {"raw": directory / "inspection/raw-geometry.png", "bake": directory / "bake/inspection.png"}
        for export in sorted(directory.glob("export*")):
            for capture in sorted(export.glob("inspection*")):
                if (capture / "inspection.json").exists():
                    images[export.name] = capture / "oblique.png"
        for role, source in images.items():
            if not source.exists():
                continue
            filename = f'{run["id"]}-{role}.png'
            image = Image.open(source)
            image.thumbnail((960, 600), Image.Resampling.LANCZOS)
            image.save(args.destination / filename)
            item["previews"][role] = {"file": filename, "sourceSha256": digest(source), "previewSha256": digest(args.destination / filename), "method": "LANCZOS preview, aspect preserved; original artifact unchanged"}
        records.append(item)
    result = {"review": report["review"], "timingLimit": report["timingLimit"], "inputManifestSha256": report["inputManifestSha256"],
              "reportSha256": digest(args.report), "implementationSha256": digest(__file__), "runs": records,
              "viewGenerations": [{key: item.get(key) for key in ["id", "status", "provider", "models", "input", "settings", "cameras", "segmentation", "outputs", "elapsedSeconds", "generationSeconds", "peakAllocatedBytes", "peakReservedBytes"]} for item in report["viewGenerations"]],
              "imageGenerations": [{key: item.get(key) for key in ["id", "status", "models", "sourceSha256", "settings", "elapsedSeconds", "generationSeconds", "peakAllocatedBytes", "peakReservedBytes"]} for item in report["imageGenerations"]]}
    (args.destination / "measurements.json").write_text(json.dumps(result, indent=2) + "\n")
    shutil.copyfile(Path(__file__).with_name("observations.json"), args.destination / "observations.json")
    print(json.dumps({"destination": str(args.destination), "runs": len(records)}))


if __name__ == "__main__":
    main()
