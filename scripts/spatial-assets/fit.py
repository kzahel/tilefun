"""Propose a recorded orthographic registration; silhouette fit is not 3D truth."""
import argparse
import hashlib
import json
from pathlib import Path
import time

import cumesh
import numpy as np
from PIL import Image
import torch
import trimesh

from bake import raster


def shifted(mask, dx, dy):
    result = np.roll(mask, (dy, dx), axis=(0, 1))
    if dy > 0:
        result[:dy] = False
    elif dy < 0:
        result[dy:] = False
    if dx > 0:
        result[:, :dx] = False
    elif dx < 0:
        result[:, dx:] = False
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--run", required=True)
    args = parser.parse_args()
    if Path(args.run).name != args.run or args.run in (".", ".."):
        parser.error("run must be a single directory name")
    directory = args.bundle / "runs" / args.run
    record = json.loads((directory / "run.json").read_text())
    if record["status"] != "succeeded" or "asset" not in record["input"]:
        parser.error("a successful asset inference is required")
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    if digest(args.bundle / "inputs.json") != record["input"]["manifestSha256"]:
        raise RuntimeError("Input manifest changed")
    if digest(directory / "raw.npz") != record["outputSha256"]["raw.npz"]:
        raise RuntimeError("Raw arrays changed")
    manifest = json.loads((args.bundle / "inputs.json").read_text())
    entry = next(item for item in manifest["inputs"] if item["id"] == record["input"]["asset"])
    source_path = args.bundle / entry["input"]
    if digest(source_path) != entry["cropSha256"]:
        raise RuntimeError("Source pixels changed")
    source = np.array(Image.open(source_path).convert("RGBA"))
    alpha = source[:, :, 3] > 0
    height, width = alpha.shape
    rows, cols = np.nonzero(alpha)
    target_size = np.array([cols.max() - cols.min() + 1, rows.max() - rows.min() + 1])
    target_center = np.array([(cols.max() + cols.min() + 1) / 2,
                              (rows.max() + rows.min() + 1) / 2])
    raw = np.load(directory / "raw.npz")
    vertices, faces = raw["vertices"], raw["faces"]
    destination = directory / "fit"
    destination.mkdir(exist_ok=False)
    started = time.perf_counter()
    mesh = cumesh.CuMesh()
    mesh.init(torch.as_tensor(vertices, dtype=torch.float32, device="cuda"),
              torch.as_tensor(faces, dtype=torch.int32, device="cuda"))
    mesh.simplify(50000)
    proxy_vertices, proxy_faces = mesh.read()
    proxy_vertices, proxy_faces = proxy_vertices.cpu().numpy(), proxy_faces.cpu().numpy()
    trimesh.Trimesh(proxy_vertices, proxy_faces, process=False).export(destination / "search-proxy.glb")
    candidates = []
    best = None
    # Rotation/scale/translation only. No source mask painting or vertex repairs.
    for pitch in [0, -15, 15]:
        p = np.deg2rad(pitch)
        rx = np.array([[1, 0, 0], [0, np.cos(p), -np.sin(p)], [0, np.sin(p), np.cos(p)]])
        for yaw in range(0, 360, 15):
            y = np.deg2rad(yaw)
            rz = np.array([[np.cos(y), -np.sin(y), 0], [np.sin(y), np.cos(y), 0], [0, 0, 1]])
            rotation = rx @ rz
            rotated = proxy_vertices @ rotation.T
            projection = np.column_stack([rotated[:, 0], rotated[:, 1] - rotated[:, 2]])
            scale_base = min(target_size / np.ptp(projection, axis=0))
            for factor in [.9, 1, 1.1]:
                scale = scale_base * factor
                points = rotated * scale
                tz = -points[:, 2].min()
                points[:, 2] += tz
                uv = np.column_stack([points[:, 0], points[:, 1] - points[:, 2]])
                offset = target_center - entry["anchor"] - (uv.min(axis=0) + uv.max(axis=0)) / 2
                points[:, :2] += offset
                _, mask, _ = raster(points, proxy_faces, width, height, entry["anchor"])
                local_best = None
                for dy in range(-3, 4):
                    for dx in range(-3, 4):
                        proposal = shifted(mask, dx, dy)
                        intersection = int((proposal & alpha).sum())
                        union = int((proposal | alpha).sum())
                        score = intersection / union
                        if local_best is None or score > local_best[0]:
                            local_best = (score, dx, dy)
                score, dx, dy = local_best
                matrix = np.eye(4)
                matrix[:3, :3] = rotation * scale
                matrix[:3, 3] = [offset[0] + dx, offset[1] + dy, tz]
                candidate = {"iou": score, "yawDegrees": yaw, "pitchDegrees": pitch,
                             "uniformScale": float(scale), "matrix": matrix.tolist()}
                candidates.append(candidate)
                if best is None or score > best["iou"]:
                    best = candidate
    matrix = np.array(best["matrix"])
    transformed = vertices @ matrix[:3, :3].T + matrix[:3, 3]
    _, raw_mask, _ = raster(transformed, faces, width, height, entry["anchor"])
    raw_iou = int((raw_mask & alpha).sum()) / int((raw_mask | alpha).sum())
    extents = np.ptp(vertices, axis=0)
    transform = {**best, "method": "bounded silhouette grid: yaw 15deg, pitch 0/+/-15deg, uniform scale 0.9/1/1.1, integer pixel shifts +/-3",
                 "rawSilhouetteIou": raw_iou, "rawAxisExtents": extents.tolist(),
                 "rawMinMaxExtentRatio": float(min(extents) / max(extents)),
                 "grounding": "minimum proxy vertex Z=0; inferred contact, not physics or accepted support",
                 "searchProxyTriangles": len(proxy_faces), "searchProxySha256": digest(destination / "search-proxy.glb"),
                 "rawArraysSha256": record["outputSha256"]["raw.npz"],
                 "implementationSha256": digest(Path(__file__)),
                 "elapsedSeconds": time.perf_counter() - started,
                 "review": "unreviewed diagnostic registration; no shape acceptance",
                 "limits": ["Full original alpha includes painted ground pixels",
                            "Silhouette alone cannot resolve yaw, hidden geometry or depth",
                            "No nonuniform scaling or per-vertex repair",
                            "Proxy simplification is only used for search; bake uses untouched raw topology"]}
    (destination / "transform.json").write_text(json.dumps(transform, indent=2) + "\n")
    (destination / "candidates.json").write_text(json.dumps(sorted(candidates, key=lambda item: -item["iou"]), indent=2) + "\n")
    Image.fromarray((raw_mask * 255).astype(np.uint8)).save(destination / "raw-silhouette.png")
    print(json.dumps({"run": args.run, "rawSilhouetteIou": raw_iou,
                      "yaw": best["yawDegrees"], "pitch": best["pitchDegrees"], "seconds": transform["elapsedSeconds"]}))


if __name__ == "__main__":
    main()
