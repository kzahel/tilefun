"""Exercise generic --config/--variant-id in an isolated ignored fixture root."""

from pathlib import Path
import hashlib
import json
import shutil
import subprocess

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
D = ROOT / "data/vehicle-bake/retro-scooter"
fresh = D / "parameter-api-control"
assert not fresh.exists()
cfg = json.loads((S / "family.json").read_text())
original_half_length = cfg["controlVariant"]["gripHalfLength"]
cfg["id"] = "parameter-api-fixture"
cfg["family"] = cfg["id"]
cfg["controlVariant"]["gripHalfLength"] += 0.01
core = ["build.py", "geometry.py", "raw-audit.py"]
for n in core:
    p = fresh / S.relative_to(ROOT) / n
    p.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(S / n, p)
profile = cfg["riderProfile"]
shared = {**cfg["constructionSharedInputs"], profile["path"]: profile["sha256"]}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for rel, h in shared.items():
    assert sha(ROOT / rel) == h
    p = fresh / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / rel, p)
config_path = fresh / "configs/explicit-fit-control.json"
config_path.parent.mkdir(parents=True)
config_path.write_text(json.dumps(cfg, indent=2) + "\n")
(fresh / "AGENTS.md").write_text(
    "Isolated parameter API fixture, not an authored family.\n"
)
(fresh / "public").mkdir()
command = [
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
    "--background",
    "--factory-startup",
    "--threads",
    "4",
    "--python-exit-code",
    "1",
    "--python",
    str(fresh / S.relative_to(ROOT) / "build.py"),
    "--",
    "--config",
    str(config_path),
    "--variant-id",
    cfg["id"],
    "--scratch",
]
run = subprocess.run(command, cwd=fresh, capture_output=True, text=True)
(D / "parameter-api-control.log").write_text(run.stdout + run.stderr)
assert run.returncode == 0, run.stdout + run.stderr
out = fresh / "data/vehicle-bake/parameter-api-fixture/replay/public"
recipe = json.loads((out / "recipe.json").read_text())
assert (
    recipe["id"] == cfg["id"]
    and recipe["controlVariant"]["gripHalfLength"] == original_half_length + 0.01
)
assert "configs/explicit-fit-control.json" in recipe["sourceDependencies"]
assert sha(out / "model.glb") != sha(
    ROOT / "public/demos/vehicle-bake/retro-scooter/v1/model.glb"
)
assert (out / "atlas.png").read_bytes() == (
    ROOT / "public/demos/vehicle-bake/retro-scooter/v1/atlas.png"
).read_bytes()
expected_outputs = {n: sha(out / n) for n in ["model.glb", "atlas.png", "recipe.json"]}
bad_id = command.copy()
bad_id[bad_id.index("--variant-id") + 1] = "mismatched-fixture-id"
rejected_id = subprocess.run(bad_id, cwd=fresh, capture_output=True, text=True)
assert rejected_id.returncode != 0
assert all(sha(out / n) == h for n, h in expected_outputs.items())
broken = json.loads(json.dumps(cfg))
broken["riderProfile"]["sha256"] = "0" * 64
config_path.write_text(json.dumps(broken, indent=2) + "\n")
rejected_pin = subprocess.run(command, cwd=fresh, capture_output=True, text=True)
assert rejected_pin.returncode != 0
assert all(sha(out / n) == h for n, h in expected_outputs.items())
config_path.write_text(json.dumps(cfg, indent=2) + "\n")
reset = subprocess.run(command, cwd=fresh, capture_output=True, text=True)
assert reset.returncode == 0
assert all(sha(out / n) == h for n, h in expected_outputs.items())
(D / "parameter-api-negative-reset.log").write_text(
    rejected_id.stdout
    + rejected_id.stderr
    + rejected_pin.stdout
    + rejected_pin.stderr
    + reset.stdout
    + reset.stderr
)
result = {
    "status": "passed",
    "separateFixtureNotAnAvatarOrFamilyRollout": True,
    "onlyIgnoredOwnedFreshRootWritten": True,
    "configArgumentWorks": True,
    "variantIdArgumentWorks": True,
    "sourceDependenciesDeclareActualConfigPath": True,
    "measuredProfileAndAvatarUnchanged": True,
    "gripHalfLengthControlSource": [original_half_length, original_half_length + 0.01],
    "actualGLBChanged": True,
    "atlasUnchanged": True,
    "mismatchedVariantIdRejected": True,
    "corruptProfilePinRejected": True,
    "negativeAttemptsPreservedPriorOutputs": True,
    "validResetModelAtlasRecipeExact": True,
    "inputFiles": sorted(
        p.relative_to(fresh).as_posix()
        for p in fresh.rglob("*")
        if p.is_file()
        and not p.is_relative_to(fresh / "data")
        and not p.is_relative_to(fresh / "art-source/vehicle-bake")
    ),
    "fixtureModelSha256": sha(out / "model.glb"),
}
(D / "parameter-api-proof.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
