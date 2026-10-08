"""Validate retained source integrity, stage provenance, depth arrays and report links."""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import numpy as np
from PIL import Image
from reference import digest, name

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("href", "src") and value:
                self.targets.append(value)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--batch", type=name, required=True)
    parser.add_argument("--report", type=name, default="report")
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    manifest = json.loads((bundle / "inputs.json").read_text())
    batch_dir = bundle / "batches" / args.batch
    batch = json.loads((batch_dir / "batch.json").read_text())
    assert batch["status"].startswith("completed"), "Batch is incomplete"
    assert len(batch["assets"]) == 10 and len({i["asset"] for i in batch["assets"]}) == 10
    assert batch["inputManifestSha256"] == digest(bundle / "inputs.json")
    checked, stage_count = 0, 0
    residuals = {}
    pages = [batch_dir / args.report / "index.html"]
    for item in batch["assets"]:
        entry = next(e for e in manifest["inputs"] if e["id"] == item["asset"])
        assert digest(args.repo / entry["source"]) == entry["sourceSha256"], "Runtime source changed"
        source = bundle / entry["input"]
        assert digest(source) == entry["cropSha256"]
        rgba = np.array(Image.open(source).convert("RGBA"))
        assert hashlib.sha256(rgba.tobytes()).hexdigest() == entry["cropRgbaSha256"]
        x, y, width, height = entry["rect"]
        original = Image.open(args.repo / entry["source"]).convert("RGBA").crop((x, y, x+width, y+height))
        np.testing.assert_array_equal(rgba, np.array(original))
        if item["status"] == "completed-diagnostics":
            initial = bundle / "references" / f"{item['run']}-img2img-reference"
            generation = json.loads((initial / "generation.json").read_text())
            views = json.loads((bundle / "views" / item["run"] / "views.json").read_text())
            assert generation["sourceSha256"] == entry["cropSha256"]
            assert generation["prompt"] == views["prompt"]
            assert generation["settings"]["strength"] == batch["settings"]["strength"]
            assert generation["settings"]["seed"] == views["settings"]["seed"] == batch["settings"]["imageSeed"]
            if "promptCorrection" in item:
                correction = item["promptCorrection"]
                prompt = bundle / correction["file"].replace("\\", "/")
                assert digest(prompt) == correction["sha256"]
                assert prompt.read_text().strip() == generation["prompt"]
        stage_dir = bundle / "stage-sheets" / item["run"] / "stages"
        sheet = json.loads((stage_dir / "sheet.json").read_text())
        assert sheet["inputManifestSha256"] == batch["inputManifestSha256"]
        assert len(sheet["panels"]) == 16 and digest(stage_dir / "sheet.png") == sheet["sheetSha256"]
        for panel in sheet["panels"]:
            if panel["available"]:
                assert digest(bundle / panel["file"]) == panel["sha256"], "Stage image changed"
                stage_count += 1
        if item["status"] == "completed-diagnostics":
            assert all(p["available"] for p in sheet["panels"])
            run = bundle / "runs" / item["run"]
            bake = json.loads((run / "bake/bake.json").read_text())
            depth = np.load(run / "bake/depth.npy")
            positions = np.load(run / "bake/positions.npy")
            valid = np.array(Image.open(run / "bake/validity.png")) > 0
            alpha = rgba[:,:,3] > 0
            assert depth.dtype == np.float32 and depth.shape == alpha.shape
            np.testing.assert_array_equal(np.isfinite(depth), valid)
            assert not valid[~alpha].any() and np.isnan(depth[~valid]).all()
            assert valid.sum() == bake["matchedPixels"] and alpha.sum() == bake["sourceOpaquePixels"]
            np.testing.assert_allclose((positions[:,:,1][valid]+positions[:,:,2][valid])/np.sqrt(2), depth[valid], atol=1e-4)
            rows, cols = np.indices(depth.shape)
            # Dense float32 CUDA triangle interpolation has subpixel residuals.
            # Record them explicitly; reject quarter-pixel errors, flips or shifts.
            error = np.maximum(abs(positions[:,:,0] + entry["anchor"][0] - (cols+.5)),
                               abs(entry["anchor"][1] + positions[:,:,1] - positions[:,:,2] - (rows+.5)))[valid]
            residuals[item["asset"]] = {"maxPixels": float(error.max()), "p99Pixels": float(np.percentile(error, 99))}
            assert error.max() <= .25, "Position projection exceeds a quarter source pixel"
            export = json.loads((run / "export/export.json").read_text())
            assert digest(run / "export/candidate.glb") == export["sha256"]
            record = json.loads((run / "run.json").read_text())
            assert digest(run / "raw.npz") == record["outputSha256"]["raw.npz"] == export["rawArraysSha256"]
            checked += 1
        pages.append(stage_dir / "index.html")
    links = 0
    for page in pages:
        parser = Links()
        parser.feed(page.read_text())
        for target in parser.targets:
            url = urlsplit(target)
            if url.scheme or not url.path:
                continue
            path = (page.parent / unquote(url.path)).resolve()
            path.relative_to(bundle)
            assert path.exists(), f"Missing linked artifact: {path}"
            links += 1
    result = {"sources": 10, "completedDepthAndMeshChecks": checked, "stageImagesVerified": stage_count,
              "linksVerified": links, "projectionTolerancePixels": .25, "projectionResiduals": residuals}
    destination = batch_dir / args.report / "artifact-validation.json"
    with destination.open("x", encoding="utf8") as output:
        json.dump(result, output, indent=2)
        output.write("\n")
    print(json.dumps(result))

if __name__ == "__main__":
    main()
