"""Expose existing control or generated-bake data; performs no fitting or inference."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
import trimesh


def rounded(data):
    array = np.asarray(data)
    return np.where(np.isfinite(array), np.round(array, 3), None).tolist()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--car-run", help="Include a successful fitted and baked generated car")
    args = parser.parse_args()
    if args.car_run and (Path(args.car_run).name != args.car_run or args.car_run in (".", "..")):
        parser.error("car-run must be a single directory name")
    manifest = json.loads((args.bundle / "inputs.json").read_text())
    comparison = args.bundle / "comparisons/control-overlap-004"
    result = {}
    for asset in ["oak-tree", "compact-1-side-body"]:
        entry = next(i for i in manifest["inputs"] if i["id"] == asset)
        directory = args.bundle / "controls" / asset
        depth = np.load(directory / "depth.npy")
        positions = np.load(directory / "positions.npy")
        mesh = trimesh.load(directory / "proxy.glb", force="mesh", process=False)
        rgba = np.array(Image.open(args.bundle / entry["input"]).convert("RGBA"))
        ground = np.array(Image.open(comparison / f"{asset}-ground-proposal.png")) > 0
        result[asset] = {"label": "Oak authored control" if asset == "oak-tree" else "Existing car shell",
                         "width": rgba.shape[1], "height": rgba.shape[0], "anchor": entry["anchor"],
                         "rgba": rgba.reshape(-1, 4).tolist(), "depth": rounded(depth.flatten()),
                         "xyz": rounded(positions.reshape(-1, 3)), "ground": ground.flatten().astype(int).tolist(),
                         "vertices": rounded(mesh.vertices), "faces": mesh.faces.tolist(),
                         "provenance": "bake.py:control" if asset == "oak-tree" else "CarProxy.ts:carProxyPatches",
                         "geometry": "Ellipsoid crown + cylinder trunk" if asset == "oak-tree" else "Existing authored quad patches",
                         "groundMethod": "Row/color rule, manually chosen thresholds" if asset == "oak-tree" else "No ground mask",
                         "depthMethod": "CUDA raster of authored geometry, then original alpha mask"}
    if args.car_run:
        import cumesh
        import torch
        run = args.bundle / "runs" / args.car_run
        record = json.loads((run / "run.json").read_text())
        if record["status"] != "succeeded" or record["input"].get("asset") != "compact-1-side-body":
            raise RuntimeError("A successful car inference is required")
        if record["input"]["manifestSha256"] != hashlib.sha256((args.bundle / "inputs.json").read_bytes()).hexdigest():
            raise RuntimeError("Generated car input manifest changed")
        entry = next(item for item in manifest["inputs"] if item["id"] == "compact-1-side-body")
        directory = run / "bake"
        bake = json.loads((directory / "bake.json").read_text())
        if bake["sourceRgbaSha256"] != entry["cropRgbaSha256"]:
            raise RuntimeError("Generated depth belongs to different source pixels")
        depth = np.load(directory / "depth.npy")
        positions = np.load(directory / "positions.npy")
        positions[~np.isfinite(depth)] = np.nan
        mesh = trimesh.load(run / "fit/search-proxy.glb", force="mesh", process=False)
        display = cumesh.CuMesh()
        display.init(torch.as_tensor(mesh.vertices, dtype=torch.float32, device="cuda"),
                     torch.as_tensor(mesh.faces, dtype=torch.int32, device="cuda"))
        display.simplify(3000)
        v, f = display.read()
        matrix = np.array(bake["transform"]["matrix"])
        vertices = v.cpu().numpy() @ matrix[:3, :3].T + matrix[:3, 3]
        rgba = np.array(Image.open(args.bundle / entry["input"]).convert("RGBA"))
        result["generated-car"] = {"label": "TRELLIS.2 car candidate", "width": rgba.shape[1], "height": rgba.shape[0],
                                   "anchor": entry["anchor"], "rgba": rgba.reshape(-1, 4).tolist(),
                                   "depth": rounded(depth.flatten()), "xyz": rounded(positions.reshape(-1, 3)),
                                   "ground": [0] * depth.size, "vertices": rounded(vertices), "faces": f.cpu().tolist(),
                                   "rawTriangles": bake["triangles"], "provenance": args.car_run,
                                   "geometry": "Generated car; decimated display, full raw topology for depth",
                                   "groundMethod": "No generated segmentation; car object role assumed",
                                   "depthMethod": "CUDA raster of fitted raw mesh + original source alpha",
                                   "rawArraysSha256": record["outputSha256"]["raw.npz"],
                                   "transform": bake["transform"]["matrix"]}
    actor = json.loads((args.bundle / "actor.json").read_text())
    rgba = np.array(Image.open(args.bundle / actor["input"]).convert("RGBA"))
    for kind in ["body", "plane"]:
        depth = np.load(comparison / f"actor-{kind}-depth.npy")
        h, w = depth.shape
        row, col = np.indices(depth.shape)
        delta = row + .5 - actor["anchor"][1]
        positions = np.stack([col + .5 - actor["anchor"][0],
                              (delta + np.sqrt(2) * depth) / 2,
                              (np.sqrt(2) * depth - delta) / 2], axis=-1)
        positions[~np.isfinite(depth)] = np.nan
        if kind == "body":
            mesh = trimesh.load(comparison / "actor-body.glb", force="mesh", process=False)
        else:
            mesh = trimesh.Trimesh(vertices=[[-8, 0, 0], [8, 0, 0], [8, 0, 16], [-8, 0, 16]],
                                   faces=[[0, 1, 2], [0, 2, 3]], process=False)
        result[f"player-{kind}"] = {"label": f"Player {kind} hypothesis", "width": w, "height": h,
                                    "anchor": actor["anchor"], "rgba": rgba.reshape(-1, 4).tolist(),
                                    "depth": rounded(depth.flatten()), "xyz": rounded(positions.reshape(-1, 3)),
                                    "ground": [0] * (w * h), "vertices": rounded(mesh.vertices), "faces": mesh.faces.tolist(),
                                    "provenance": "compare.py actor depth",
                                    "geometry": "Capsule, visual height 16" if kind == "body" else "Upright rectangle with sprite alpha",
                                    "groundMethod": "No ground mask",
                                    "depthMethod": "CUDA raster + original alpha" if kind == "body" else "Height above sprite anchor / sqrt(2)"}
    destination = args.bundle / "inspection"
    destination.mkdir(exist_ok=True)
    stem = "candidate" if args.car_run else "control"
    (destination / f"{stem}-data.json").write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    template = (Path(__file__).parent / "inspect.html").read_text()
    fragment = template.replace('"__SPATIAL_DATA__"', json.dumps(result, separators=(",", ":"), allow_nan=False))
    (destination / f"spatial-{stem}-data.html").write_text(fragment)
    print("Exported existing RGBA, masks, depth, positions, vertices and faces; display values rounded to 0.001")


if __name__ == "__main__":
    main()
