"""Fresh repository replay of exactly four retained constructor inputs."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = R / "art-source/vehicle-riders/classic-upright/v2"
O = R / "public/demos/vehicle-riders/classic-upright/v2"
D = R / "data/vehicle-riders/classic-upright-v2"
CORE = ["build.py", "rider.json", "identity.json", "classic-upright-v1.json"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blender", required=True, type=Path)
    args = parser.parse_args()
    assert json.loads((O / "recipe.json").read_text())["sourceDependencies"] == CORE
    scratch = Path(tempfile.mkdtemp(prefix="declared-only-", dir=D))
    (scratch / "AGENTS.md").write_bytes(b"# Isolated Classic source replay root.\n")
    (scratch / "public").mkdir()
    source = scratch / A.relative_to(R)
    source.mkdir(parents=True)
    for name in CORE:
        shutil.copyfile(A / name, source / name)
    assert sorted(p.name for p in source.iterdir()) == sorted(CORE)
    with (D / "source-only-replay.log").open("w", encoding="utf-8") as log:
        subprocess.run(
            [
                str(args.blender),
                "--background",
                "--factory-startup",
                "--threads",
                "4",
                "--python-exit-code",
                "1",
                "--python",
                str(source / "build.py"),
                "--",
                "--scratch",
            ],
            cwd=scratch,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=True,
            timeout=120,
        )
    generated = scratch / "data/vehicle-riders/classic-upright-v2/replay-final"
    outputs = {}
    for name in ["rider.glb", "atlas.png", "recipe.json"]:
        assert (
            (A / name).read_bytes()
            == (O / name).read_bytes()
            == (generated / "public" / name).read_bytes()
        ), name
        outputs[name] = sha(O / name)
    for name in CORE:
        assert (
            (A / name).read_bytes()
            == (source / name).read_bytes()
            == (generated / "source" / name).read_bytes()
        )
    receipt = {
        "status": "passed",
        "byteIdentical": True,
        "independent": True,
        "freshRepository": True,
        "onlyFourDeclaredConstructorInputs": True,
        "inputHashes": {
            (A / name).relative_to(R).as_posix(): sha(A / name) for name in CORE
        },
        "sharedInputHashes": {},
        "invokedBuilder": (A / "build.py").relative_to(R).as_posix(),
        "arguments": ["--scratch"],
        "outputHashes": outputs,
        "glbSha256": outputs["rider.glb"],
        "atlasSha256": outputs["atlas.png"],
        "recipeSha256": outputs["recipe.json"],
        "scratchInputDependencies": [],
        "existingMasterRead": False,
        "meaning": "Only four retained constructor/config/profile/identity files plus generated empty repository scaffolding. New model/atlas/recipe exact; packed scenes retained without claiming deterministic blend bytes. Standing PNG identity provenance and viewer/fixture diagnostics verified separately.",
    }
    (D / "replay-verification.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
