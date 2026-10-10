"""Prepare reference bytes and execute the actual native-pixel GPU shader."""
import argparse
from pathlib import Path
import subprocess
from PIL import Image
from pipeline import ROOT, write
from pixel_style import ink

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=False)
image = Image.new("RGBA", (7, 7))
for y in range(2, 5):
    for x in range(2, 5):
        image.putpixel((x, y), (80, 167, 232, 255))
image.putpixel((2, 3), (20, 25, 30, 255))
image.putpixel((3, 2), (80, 167, 232, 180))
image.putpixel((4, 3), (80, 58, 58, 255))
image.putpixel((0, 0), (255, 0, 0, 127))
image.putpixel((6, 6), (10, 20, 30, 128))
write(out / "shader-fixture.json", {"width": 7, "height": 7, "input": list(image.tobytes()),
      "expected": {mode: list(ink(image, mode=mode).tobytes()) for mode in ["off", "inner", "outer"]}})
subprocess.run(["node", str(ROOT / "scripts/authored-assets/verify_pixel_style.mjs"), str(out)], cwd=ROOT, check=True)
