"""Run a registered reference through TRELLIS.2, raw inspection, fit, bake and comparison."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

from reference import digest, name
from geometry_checks import geometry_checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--reference", type=name, required=True)
    parser.add_argument("--id", type=name, required=True)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    scripts = Path(__file__).parent.resolve()
    expected_provider = "75fbf0183001ed9876c8dbb35de6b68552ee08bd"
    revision = subprocess.check_output(["git", "-C", str(args.provider), "rev-parse", "HEAD"], text=True).strip()
    if revision != expected_provider:
        raise RuntimeError("TRELLIS.2 checkout revision changed")
    reference_path = args.bundle / "references" / args.reference / "reference.json"
    reference = json.loads(reference_path.read_text())
    if reference["status"] != "registered":
        raise RuntimeError("Register an image-generation output first")
    asset = reference["asset"]
    if reference["inputManifestSha256"] != digest(args.bundle / "inputs.json"):
        raise RuntimeError("Original source manifest changed")
    reference_image = (args.bundle / reference["file"]).resolve()
    reference_image.relative_to(args.bundle.resolve())
    if digest(reference_image) != reference["sha256"]:
        raise RuntimeError("Registered reference image changed")
    if (args.bundle / "runs" / args.id).exists() or (args.bundle / "comparisons" / args.id).exists():
        raise RuntimeError("Run/comparison already exists; use a new ID")
    directory = args.bundle / "pipelines" / args.id
    directory.mkdir(parents=True, exist_ok=False)
    implementation = directory / "implementation"
    implementation.mkdir()
    helper_hashes = {}
    for helper in scripts.glob("*.py"):
        (implementation / helper.name).write_bytes(helper.read_bytes())
        helper_hashes[helper.name] = digest(helper)
    record = {"id": args.id, "reference": args.reference, "asset": asset,
              "referenceRecordSha256": digest(reference_path), "pipelineSha256": digest(__file__),
              "geometryChecksSha256": digest(scripts / "geometry_checks.py"),
              "helperSha256": helper_hashes,
              "status": "started", "stages": [], "review": "unreviewed diagnostic pipeline, no promotion"}
    shutil_source = scripts / "pipeline.py"
    (directory / "pipeline.py").write_bytes(shutil_source.read_bytes())
    (directory / "geometry_checks.py").write_bytes((scripts / "geometry_checks.py").read_bytes())

    def persist():
        (directory / "pipeline.json").write_text(json.dumps(record, indent=2) + "\n")

    def execute(script, parameters):
        stage = {"script": script, "implementationSha256": digest(scripts / script), "status": "started"}
        record["stages"].append(stage)
        persist()
        start = time.perf_counter()
        try:
            subprocess.run([sys.executable, str(scripts / script), "--bundle", str(args.bundle), *map(str, parameters)], check=True)
            stage["status"] = "succeeded"
        except subprocess.CalledProcessError:
            stage["status"] = "failed"
            raise
        finally:
            stage["elapsedSeconds"] = time.perf_counter() - start
            persist()

    started = time.perf_counter()
    persist()
    try:
        execute("infer.py", ["--provider", args.provider, "--asset", asset, "--reference-record", reference_path,
                             "--id", args.id, "--seed", args.seed,
                             "--checkpoint-revision", "af44b45f2e35a493886929c6d786e563ec68364d",
                             "--encoder-revision", "ea8dc2863c51be0a264bab82070e3e8836b02d51",
                             "--structure-revision", "25e0d31ffbebe4b5a97464dd851910efc3002d96"])
        execute("inspect_raw.py", ["--run", args.id])
        run = args.bundle / "runs" / args.id
        import numpy as np
        raw = np.load(run / "raw.npz")
        screen = geometry_checks(raw["vertices"], raw["faces"])
        record["volumeScreen"] = {**screen, "minimumExtentRatio": .05, "maximumOakBoundaryAreaFraction": .8, "maximumOakNormalConcentration": .95}
        if screen["axisExtentRatio"] < .05:
            record["status"] = "stopped-flat-geometry"
        elif asset == "oak-tree" and (screen["boundaryBoxSurfaceAreaFraction"] > .8 or screen["areaWeightedNormalConcentration"] > .95):
            record["status"] = "stopped-box-or-plane-geometry"
        else:
            execute("fit.py", ["--run", args.id])
            execute("bake.py", ["--asset", asset, "--run", args.id, "--transform", run / "fit/transform.json"])
            if asset in ("oak-tree", "compact-1-side-body") and (args.bundle / "controls" / ("compact-1-side-body" if asset == "oak-tree" else "oak-tree")).exists():
                execute("compare.py", ["--id", args.id, "--oak-run" if asset == "oak-tree" else "--car-run", args.id])
            else:
                execute("compare.py", ["--id", args.id, "--asset-run", args.id])
            execute("export_mesh.py", ["--provider", args.provider, "--run", args.id])
            record["status"] = "completed-diagnostics"
    except Exception as error:
        record["status"] = "failed"
        record["failure"] = str(error)
        raise
    finally:
        record["elapsedSeconds"] = time.perf_counter() - started
        persist()
    print(json.dumps({"id": args.id, "status": record["status"]}))


if __name__ == "__main__":
    main()
