"""Freeze the five-asset alternatives benchmark from audited 070/071 sources."""
import argparse
import json
from pathlib import Path
import shutil

from reference import digest

ASSETS = ["oak-tree", "shed", "compact-1-east", "picnic-table", "tent-blue"]
DETAILS = {
    "oak-tree": "A broad green oak canopy, visible brown trunk and branches. Keep all canopy lobes and the trunk. Do not add a pot, platform, scenery or different species.",
    "shed": "A small shed. The large blue tiled upper section is its pitched ROOF, not vertical wall cladding. Preserve the roof color and tile pattern, lower walls, complete front door, its window and trim at their original positions.",
    "compact-1-east": "The compact blue car faces LEFT. Preserve its compact body, hood, roof, white stripe, windows and visible wheel positions. Do not redesign it into a modern hatchback or add mirrors, roof accessories or new trim.",
    "picnic-table": "A wooden picnic table with attached benches, supporting legs, plates, jug and small containers on its top. Preserve the entire table and benches, not just the dishes. Preserve open space between legs and beneath the tabletop.",
    "tent-blue": "A blue camping tent with brown lower fabric and entrance and thin support poles. Keep both blue and brown fabric, the entrance opening, ropes and poles at the original positions. Do not replace it with a draped canopy or remove its lower fabric.",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--study", type=Path, help="Fresh output bundle; default ROOT/073")
    args = parser.parse_args()
    study = args.study or args.root / "073"
    if (study / "inputs.json").exists():
        raise RuntimeError("Frozen study already exists")
    study.mkdir(exist_ok=True)
    (study / "inputs").mkdir()
    (study / "prompts").mkdir()
    entries, origins = [], []
    for asset in ASSETS + ["compact-1-north", "compact-1-south", "compact-1-west"]:
        source = args.root / ("070" if asset == "oak-tree" or asset.endswith(("north", "south", "west")) else "071")
        manifest = json.loads((source / "inputs.json").read_text())
        entry = next(x for x in manifest["inputs"] if x["id"] == asset)
        for field, checksum in [("input", "cropSha256"), ("enlarged", "enlargedSha256")]:
            if digest(source / entry[field]) != entry[checksum]:
                raise RuntimeError(f"Changed frozen source: {asset}")
            shutil.copyfile(source / entry[field], study / entry[field])
        entries.append(entry)
        origins.append({"asset": asset, "bundle": source.name, "manifestSha256": digest(source / "inputs.json"), "sourceSha256": entry["cropSha256"]})
        if asset in ASSETS:
            prompt = "Edit the supplied sprite into a clean, softly shaded solid 3D game-asset reference. Keep the EXACT original orthographic camera, outer silhouette, object size, proportions, colors and feature positions. Add only material clarity and volume shading; preserve the design. " + DETAILS[asset] + " Full object, no cropping, no scene or ground plane, isolated on plain neutral gray."
            (study / "prompts" / f"{asset}.txt").write_text(prompt + "\n")
    base = json.loads((args.root / "071/inputs.json").read_text())
    base.update(version="073-alternatives-v1", inputs=entries, frozenOrigins=origins)
    (study / "inputs.json").write_text(json.dumps(base, indent=2) + "\n")
    shutil.copyfile(args.root / "071/actor.json", study / "actor.json")
    shutil.copyfile(args.root / "071/inputs/player-idle.png", study / "inputs/player-idle.png")
    plan = {"assets": ASSETS, "imageSeeds": [42, 43], "meshSeed": 42, "branches": ["flux", "qwen", "triposg", "fitted-car"], "inputManifestSha256": digest(study / "inputs.json"), "review": "Unreviewed offline diagnostic experiment; no production changes", "origins": origins}
    (study / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    print(json.dumps({"status": "frozen", "assets": ASSETS, "manifestSha256": plan["inputManifestSha256"]}))


if __name__ == "__main__":
    main()
