"""Fresh constructor replay from declared retained files, never existing masters."""

from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import argparse

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = ROOT / "scripts/vehicle-bake/retro-scooter"
A = ROOT / "art-source/vehicle-bake/retro-scooter/v1"
O = ROOT / "public/demos/vehicle-bake/retro-scooter/v1"
D = ROOT / "data/vehicle-bake/retro-scooter"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--blender", default="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
)
parser.add_argument("--name", default="fresh-replay-root")
args = parser.parse_args()
assert args.name and all(c.isalnum() or c in "-_" for c in args.name)
fresh = D / args.name
assert not fresh.exists(), "Choose a fresh output directory"
cfg = json.loads((A / "family.json").read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
own = {}
shared = {
    **cfg["constructionSharedInputs"],
    cfg["riderProfile"]["path"]: cfg["riderProfile"]["sha256"],
}
for name in ["build.py", "geometry.py", "family.json", "raw-audit.py"]:
    assert sha(S / name) == sha(A / name), name
    own[f"scripts/vehicle-bake/retro-scooter/{name}"] = sha(A / name)
    dst = fresh / "scripts/vehicle-bake/retro-scooter" / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(A / name, dst)
for rel, expected in shared.items():
    assert sha(ROOT / rel) == expected, rel
    dst = fresh / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / rel, dst)
(fresh / "public").mkdir(exist_ok=True)
(fresh / "AGENTS.md").write_text("Fresh replay root marker only.\n")
initial = sorted(
    p.relative_to(fresh).as_posix() for p in fresh.rglob("*") if p.is_file()
)
assert set(initial) == set(own) | set(shared) | {"AGENTS.md"}
command = [
    args.blender,
    "--background",
    "--factory-startup",
    "--threads",
    "4",
    "--python-exit-code",
    "1",
    "--python",
    str(fresh / "scripts/vehicle-bake/retro-scooter/build.py"),
]
completed = subprocess.run(
    command, cwd=fresh, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
)
(D / f"{args.name}-log.txt").write_text(completed.stdout)
assert completed.returncode == 0, completed.stdout[-6000:]
outputs = {}
for name in ["model.glb", "atlas.png", "recipe.json"]:
    new = fresh / "public/demos/vehicle-bake/retro-scooter/v1" / name
    assert new.read_bytes() == (O / name).read_bytes() == (A / name).read_bytes(), name
    outputs[name] = {"sha256": sha(new), "bytes": new.stat().st_size, "byteExact": True}
receipt = {
    "status": "passed",
    "inputHashes": own,
    "sharedInputHashes": shared,
    "initialFiles": initial,
    "noIgnoredMasterOrScratchDependencies": True,
    "packedMasterNotAConstructionInput": True,
    "riderGLBRecipeReport": "Separate immutable diagnostic inputs; constructor reads profile only",
    "freshRoot": fresh.relative_to(ROOT).as_posix(),
    "command": command,
    "portableCommand": "BLENDER --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/retro-scooter/build.py",
    "outputs": outputs,
    "sharedStaticCycleCatalogActuallyUsed": True,
    "actualSharedLoaderBrowserReview": "pending parent",
    "runtimeActivation": False,
}
(D / "source-only-replay.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(
    json.dumps(
        {"status": "passed", "outputs": outputs, "inputs": len(own) + len(shared)},
        indent=2,
    )
)
