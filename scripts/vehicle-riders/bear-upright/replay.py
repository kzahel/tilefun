"""Fresh source-only replay from exactly five retained inputs, no fixture or ignored input."""

from pathlib import Path
import argparse, subprocess, json, shutil, hashlib

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = R / "art-source/vehicle-riders/bear-upright/v1"
O = R / "public/demos/vehicle-riders/bear-upright/v1"
D = R / "data/vehicle-riders/bear-upright"
parser = argparse.ArgumentParser()
parser.add_argument("--blender", required=True)
args = parser.parse_args()
core = [
    "build.py",
    "rider.json",
    "identity.json",
    "explorer-upright-v1.json",
    "bear-upright-v1.json",
]
assert json.loads((O / "recipe.json").read_text())["sourceDependencies"] == core
inputs = D / "declared-inputs-only"
outputs = D / "replay-final"
assert (
    not inputs.exists() and not outputs.exists()
), "Fresh empty replay directories required; preserve prior receipts."
inputs.mkdir(parents=True)
for n in core:
    shutil.copyfile(A / n, inputs / n)
assert sorted(p.name for p in inputs.iterdir()) == sorted(core)
with (D / "source-only-replay.log").open("w", encoding="utf8") as log:
    subprocess.run(
        [
            args.blender,
            "--background",
            "--factory-startup",
            "--threads",
            "4",
            "--python-exit-code",
            "1",
            "--python",
            str(inputs / "build.py"),
            "--",
            "--scratch",
        ],
        cwd=R,
        stdout=log,
        stderr=subprocess.STDOUT,
        check=True,
    )
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for n in core:
    assert (
        (inputs / n).read_bytes()
        == (A / n).read_bytes()
        == (outputs / "source" / n).read_bytes()
    ), n
for n in ["rider.glb", "atlas.png", "recipe.json"]:
    assert (
        (O / n).read_bytes()
        == (A / n).read_bytes()
        == (outputs / "public" / n).read_bytes()
    ), n
report = {
    "status": "passed",
    "byteIdentical": True,
    "onlyFiveDeclaredFilesPresent": True,
    "inputHashes": {n: sha(A / n) for n in core},
    "outputs": {n: sha(O / n) for n in ["rider.glb", "atlas.png", "recipe.json"]},
    "scratchInputDependencies": [],
    "sharedInputDependencies": [],
    "blender": "5.2.2 LTS d13f752e3b9c factory background4threads",
    "freshInputs": "data/vehicle-riders/bear-upright/declared-inputs-only/",
    "freshOutputs": "data/vehicle-riders/bear-upright/replay-final/",
    "meaning": "Rider construction reads only retained own constructor/config/identity and own/global-profile copies. Actual original profile and approved identity provenance pins are verified separately. Fixture/viewer are diagnostic outputs under ignored data, never construction inputs.",
}
(D / "replay-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
