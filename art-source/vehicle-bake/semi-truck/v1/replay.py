"""Fresh isolated replay using only declared retained constructor inputs.

All writes are confined to this family's ignored data directory. The empty
AGENTS/public sentinels locate a miniature repository; they provide no geometry.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
A = ROOT / "art-source/vehicle-bake/semi-truck/v1"
O = ROOT / "public/demos/vehicle-bake/semi-truck/v1"
D = ROOT / "data/vehicle-bake/semi-truck"
INPUTS = [
    "build.py",
    "family.json",
    "coverage-region.json",
    "surface-regions.json",
    "coupling-region.json",
    "review.json",
]
SHARED = ["scripts/vehicle-bake/catalog.py", "scripts/vehicle-bake/catalog-v2.py"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blender", required=True)
    parser.add_argument("--name", default="fresh-declared-replay")
    args = parser.parse_args()
    assert args.name and Path(args.name).name == args.name
    stage = D / args.name
    assert not stage.exists(), "Use a fresh output name; previous proof is retained"
    stage.mkdir(parents=True)
    (stage / "AGENTS.md").write_text("Replay root sentinel; no model input.\n")
    (stage / "public").mkdir()
    pins = {}
    for src in [*[A / n for n in INPUTS], *[ROOT / n for n in SHARED]]:
        relative = src.relative_to(ROOT)
        dest = stage / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        pins[relative.as_posix()] = sha(src)
    builder = stage / A.relative_to(ROOT) / "build.py"
    command = [
        args.blender,
        "--background",
        "--factory-startup",
        "--threads",
        "4",
        "--python-exit-code",
        "1",
        "--python",
        str(builder),
        "--",
        "--scratch",
    ]
    with (D / f"{args.name}.log").open("w", encoding="utf-8") as log:
        subprocess.run(
            command, cwd=stage, stdout=log, stderr=subprocess.STDOUT, check=True
        )
    actual = stage / "data/vehicle-bake/semi-truck/replay/public"
    outputs = {}
    for name in ["model.glb", "atlas.png", "recipe.json"]:
        assert (O / name).read_bytes() == (actual / name).read_bytes(), name
        outputs[name] = sha(actual / name)
    for relative, expected in pins.items():
        assert sha(stage / relative) == expected, relative
        assert sha(ROOT / relative) == expected, relative
    receipt = {
        "status": "passed",
        "byteIdentical": True,
        "inputHashes": {k: v for k, v in pins.items() if k not in SHARED},
        "sharedInputHashes": {k: pins[k] for k in SHARED},
        "outputs": outputs,
        "scratchInputDependencies": [],
        "isolatedRoot": stage.relative_to(ROOT).as_posix(),
        "bootstrap": "Empty AGENTS.md/public root sentinels only; no vehicle inputs",
        "meaning": "Fresh miniature repository contains only listed inputs. GLB, atlas and recipe match byte for byte; packed blend determinism is not claimed.",
    }
    (D / "fresh-replay-verification.json").write_text(
        json.dumps(receipt, indent=2) + "\n"
    )
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
