"""Inspect untouched generated geometry in declared orthographic cameras."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from bake import false_color, raster


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--run", required=True)
    args = parser.parse_args()
    if Path(args.run).name != args.run or args.run in (".", ".."):
        parser.error("run must be a single directory name")
    directory = args.bundle / "runs" / args.run
    record = json.loads((directory / "run.json").read_text())
    if record["status"] != "succeeded":
        parser.error("run must have succeeded")
    raw_path = directory / "raw.npz"
    digest = hashlib.sha256(raw_path.read_bytes()).hexdigest()
    if digest != record["outputSha256"]["raw.npz"]:
        raise RuntimeError("Raw array hash mismatch")
    raw = np.load(raw_path)
    vertices, faces = raw["vertices"], raw["faces"]
    centered = vertices - (vertices.min(axis=0) + vertices.max(axis=0)) / 2
    destination = directory / "inspection"
    destination.mkdir(exist_ok=False)
    q = 1 / np.sqrt(2)
    views = {
        "yaw0-pitch45": [[1, 0, 0], [0, -q, q], [0, q, q]],
        "yaw180-pitch45": [[-1, 0, 0], [0, q, q], [0, -q, q]],
        "front": [[1, 0, 0], [0, 0, 1], [0, 1, 0]],
        "side": [[0, -1, 0], [0, 0, 1], [1, 0, 0]],
        "top": [[1, 0, 0], [0, -1, 0], [0, 0, 1]],
        "oblique": [[q, -q, 0], [-1 / np.sqrt(6), -1 / np.sqrt(6), 2 / np.sqrt(6)],
                    [1 / np.sqrt(3)] * 3],
    }
    panels = [("original input", Image.open(directory / "input.png").convert("RGBA")),
              ("provider crop", Image.open(directory / "provider-input.png").convert("RGBA"))]
    cameras = {}
    for name, basis in views.items():
        projected = centered @ np.asarray(basis).T
        scale = 110 / max(np.ptp(projected[:, 0]), np.ptp(projected[:, 1]))
        depth, valid, _ = raster(centered * scale, faces, 128, 128, [64, 64], basis)
        view = false_color(depth, valid)
        view.save(destination / f"{name}.png")
        panels.append((name, view))
        cameras[name] = {"basis": basis, "uniformDisplayScale": float(scale),
                         "visiblePixels": int(valid.sum())}
    sheet = Image.new("RGB", (4 * 320, 2 * 344), "#19222c")
    for index, (label, panel) in enumerate(panels):
        left, top = index % 4 * 320, index // 4 * 344
        factor = min(304 / panel.width, 304 / panel.height)
        panel = panel.resize((round(panel.width * factor), round(panel.height * factor)), Image.Resampling.NEAREST)
        sheet.paste(panel, (left + (320 - panel.width) // 2, top + 32), panel)
        ImageDraw.Draw(sheet).text((left + 8, top + 8), label, fill="white")
    sheet.save(destination / "raw-geometry.png")
    evidence = {"run": args.run, "rawArraysSha256": digest, "cameras": cameras,
                "implementationSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                "review": "unreviewed raw geometry; no camera fit, repair or simplification",
                "appearance": "depth false colors, normalized independently per view; generated texture not shown",
                "limits": ["Display centers raw bounds and scales each camera to fit",
                           "Yaw0 is a declared provider-axis view, not a verified source camera",
                           "Hidden-surface plausibility and opacity have no human quality judgment"]}
    (destination / "inspection.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps({"run": args.run, "triangles": len(faces), "inspection": "inspection/raw-geometry.png"}))


if __name__ == "__main__":
    main()
