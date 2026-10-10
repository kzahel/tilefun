"""Exercise the real Blender baker against visibility/UV-ambiguity fixtures."""
import argparse
from pathlib import Path
import subprocess

from PIL import Image

from pipeline import HERE, ROOT, bake, digest, read, write

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--blender", type=Path, required=True)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=False)
source = out / "red.png"
Image.new("RGBA", (16, 16), (255, 0, 0, 255)).save(source)
recipe = {"schema": "authored-assets-v1", "assetId": "projection-fixture", "canvas": [16, 16],
          "projection": {"atlasSize": 16, "material": "Projection target"},
          "views": [{"id": "east", "source": str(source), "sourceSha256": digest(source), "offset": [0, 0],
                     "camera": {"azimuth": -90, "elevation": 45, "horizontalScale": 1, "verticalStretch": 1,
                                "origin": [8, 8]}}]}
write(out / "recipe.json", recipe)
with (out / "fixture.log").open("w", encoding="utf-8") as log:
    subprocess.run([str(args.blender.resolve()), "--background", "--factory-startup", "--python-exit-code", "1",
                    "--python", str(HERE / "projection_fixture.py"), "--", str(out)],
                   cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
results = {}
for case, expected_status in [("occluded", "2"), ("visible", "1"), ("overlap", "3")]:
    run = out / case
    bake(out / "recipe.json", out / (case+".blend"), args.blender.resolve(), run)
    counts = read(run / "coverage.json")["counts"]
    assert counts[expected_status] == 256, (case, counts)
    if case == "visible":
        with Image.open(run / "projection-draft.png") as im:
            assert im.tobytes() == bytes([255, 0, 0, 255])*256, "Original source bytes changed"
    results[case] = counts
write(out / "results.json", results)
# A region's explicit source owner wins even when another visible view appears first.
green = out / "green.png"
Image.new("RGBA", (16, 16), (0, 255, 0, 255)).save(green)
recipe["views"].append({**recipe["views"][0], "id": "other", "source": str(green), "sourceSha256": digest(green)})
recipe["projection"]["sourceViews"] = {"Observed plane": ["other"]}
write(out / "owned-recipe.json", recipe)
bake(out / "owned-recipe.json", out / "visible.blend", args.blender.resolve(), out / "owned-view")
with Image.open(out / "owned-view/projection-draft.png") as im:
    assert im.tobytes() == bytes([0, 255, 0, 255])*256, "Explicit region source ownership was ignored"
results["owned-view"] = read(out / "owned-view/coverage.json")["counts"]
write(out / "results.json", results)
print("Real Blender visibility, exact bytes, overlapping UV and region-source checks passed.")
