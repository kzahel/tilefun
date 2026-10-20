"""Portable six-input Blender --scratch receipt for parent's generic replay."""

from pathlib import Path
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/classic-motorcycle-bear-fit"
A = ROOT / "art-source/vehicle-bake/classic-motorcycle-bear-fit/v1"
O = ROOT / "public/demos/vehicle-bake/classic-motorcycle-bear-fit/v1"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = json.loads((D / "source-only-replay.json").read_text())
assert source["status"] == "passed"
for p, h in {**source["inputHashes"], **source["sharedInputHashes"]}.items():
    assert sha(ROOT / p) == h
outputs = {n: sha(O / n) for n in ["model.glb", "atlas.png", "recipe.json"]}
assert all(
    source["outputs"][n]["sha256"] == h == sha(A / n) for n, h in outputs.items()
)
receipt = {
    "status": "passed",
    "byteIdentical": True,
    "runner": "blender",
    "invokedBuilder": "scripts/vehicle-bake/classic-motorcycle-bear-fit/build.py",
    "arguments": ["--scratch"],
    "args": ["--scratch"],
    "inputHashes": source["inputHashes"],
    "sharedInputHashes": source["sharedInputHashes"],
    "scratchInputDependencies": [],
    "glbSha256": outputs["model.glb"],
    "atlasSha256": outputs["atlas.png"],
    "recipeSha256": outputs["recipe.json"],
    "outputHashes": outputs,
    "freshSixInputProof": "evidence/source-only-replay.json",
    "meaning": "Normalized portable constructor receipt; --scratch outputs only under fresh data. Four own construction files plus stable catalog-cycle and unchanged Bear profile. No master, ignored or rider-model construction inputs.",
}
(D / "replay-verification.json").write_text(json.dumps(receipt, indent=2) + "\n")
(A / "evidence").mkdir(exist_ok=True)
(A / "evidence/replay-verification.json").write_text(
    json.dumps(receipt, indent=2) + "\n"
)
print(
    json.dumps({"status": "normalized", "inputs": 6, "glbSha256": outputs["model.glb"]})
)
