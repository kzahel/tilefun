"""Offline CUDA raster diagnostics; original RGBA remains the color authority.

Game axes are X right, Y toward viewer on ground, Z up. Source depth is signed
world-pixel distance (Y+Z)/sqrt(2), increasing toward the camera. A pixel's
surface reconstructs as X=u-anchorX, Y=((v-anchorY)+sqrt(2)*depth)/2,
Z=(sqrt(2)*depth-(v-anchorY))/2. Invalid pixels are NaN, never guessed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import time

import numpy as np
from PIL import Image, ImageDraw
import torch
import trimesh
import nvdiffrast.torch as dr


def raster(vertices, faces, width, height, anchor, basis=None):
    """Return nearest world-space surfaces at pixel centers, top-left image order."""
    v = torch.as_tensor(vertices, dtype=torch.float32, device="cuda")
    f = torch.as_tensor(faces.astype(np.int32), device="cuda")
    if basis is None:
        u = anchor[0] + v[:, 0]
        row = anchor[1] + v[:, 1] - v[:, 2]
        depth = (v[:, 1] + v[:, 2]) / np.sqrt(2)
    else:
        axes = torch.tensor(basis, dtype=torch.float32, device="cuda")
        projected = v @ axes.T
        u = anchor[0] + projected[:, 0]
        row = anchor[1] - projected[:, 1]
        depth = projected[:, 2]
    # Symmetric near/far, consistent sign: the closest surface has smaller NDC Z.
    clip = torch.stack([u * 2 / width - 1, 1 - row * 2 / height,
                        -depth / 128, torch.ones_like(depth)], dim=-1).unsqueeze(0)
    rast, _ = dr.rasterize(dr.RasterizeCudaContext(), clip, f, [height, width])
    positions, _ = dr.interpolate(v.unsqueeze(0).contiguous(), rast, f)
    near, _ = dr.interpolate(depth[None, :, None].contiguous(), rast, f)
    valid = (rast[0, :, :, 3] > 0).flip(0).cpu().numpy()
    positions = positions[0].flip(0).cpu().numpy()
    near = near[0, :, :, 0].flip(0).cpu().numpy()
    near[~valid] = np.nan
    positions[~valid] = np.nan
    return near, valid, positions


def control(asset, bundle):
    if asset == "oak-tree":
        # Small authored volume control, explicitly inferred rather than generated.
        crown = trimesh.creation.icosphere(subdivisions=2)
        crown.apply_scale([30, 12, 21])
        crown.apply_translation([0, -5, 35])
        trunk = trimesh.creation.cylinder(radius=6, height=30, sections=12)
        trunk.apply_translation([0, -5, 15])
        return trimesh.util.concatenate([crown, trunk])
    record = json.loads((bundle / "car-control.json").read_text())
    vertices, faces = [], []
    for patch in record["patches"]:
        offset = len(vertices)
        vertices.extend(patch["vertices"])
        faces.extend([[offset, offset + 1, offset + 2], [offset, offset + 2, offset + 3]])
    return trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces), process=False)


def false_color(depth, valid):
    data = np.zeros((*depth.shape, 4), dtype=np.uint8)
    if valid.any():
        d = depth[valid]
        lo, hi = d.min(), d.max()
        t = (d - lo) / max(hi - lo, 1e-6)
        data[valid, 0] = (255 * t).astype(np.uint8)
        data[valid, 1] = (180 * (1 - np.abs(t * 2 - 1))).astype(np.uint8)
        data[valid, 2] = (255 * (1 - t)).astype(np.uint8)
        data[valid, 3] = 255
    return Image.fromarray(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--run", help="Successful run ID; omitted means authored control")
    parser.add_argument("--transform", type=Path, help="Explicit raw-to-game 4x4 transform JSON")
    args = parser.parse_args()
    if not args.run and args.asset not in ("oak-tree", "compact-1-side-body"):
        parser.error("Only oak/car have authored controls; other assets require a generated run")
    if args.run and (Path(args.run).name != args.run or args.run in (".", "..")):
        parser.error("run must be a single directory name")
    manifest = json.loads((args.bundle / "inputs.json").read_text())
    entry = next(item for item in manifest["inputs"] if item["id"] == args.asset)
    if args.run:
        run = args.bundle / "runs" / args.run
        record = json.loads((run / "run.json").read_text())
        if record["status"] != "succeeded" or record.get("input", {}).get("asset") != args.asset:
            parser.error("run must be a successful inference of this asset")
        manifest_sha = hashlib.sha256((args.bundle / "inputs.json").read_bytes()).hexdigest()
        if record["input"]["manifestSha256"] != manifest_sha:
            parser.error("Current input manifest differs from the inference record")
        mesh = trimesh.load(run / "raw.glb", force="mesh", process=False)
        if not args.transform:
            parser.error("Generated meshes require an explicit recorded transform")
        matrix = np.array(json.loads(args.transform.read_text())["matrix"])
        if matrix.shape != (4, 4) or not np.isfinite(matrix).all():
            parser.error("transform must be a finite 4x4 matrix")
        mesh.apply_transform(matrix)
        destination = run / "bake"
    else:
        mesh = control(args.asset, args.bundle)
        destination = args.bundle / "controls" / args.asset
    destination.mkdir(parents=True, exist_ok=False)
    mesh.export(destination / "proxy.glb")
    source_path = args.bundle / entry["input"]
    if hashlib.sha256(source_path.read_bytes()).hexdigest() != entry["cropSha256"]:
        raise RuntimeError("Source hash mismatch")
    source = Image.open(source_path).convert("RGBA")
    w, h = source.size
    started = time.perf_counter()
    depth, valid, positions = raster(mesh.vertices, mesh.faces, w, h, entry["anchor"])
    torch.cuda.synchronize()
    elapsed = time.perf_counter() - started
    alpha = np.array(source)[:, :, 3] > 0
    # Source alpha holes always remain holes; unmatched opaque colors remain uncertain.
    accepted = valid & alpha
    accepted_depth = np.where(accepted, depth, np.nan)
    np.save(destination / "depth.npy", accepted_depth)
    np.save(destination / "positions.npy", positions)
    Image.fromarray((accepted * 255).astype(np.uint8)).save(destination / "validity.png")
    false_color(depth, valid).save(destination / "source-depth.png")
    overlay = np.array(source).copy()
    overlay[alpha & ~valid] = [255, 70, 70, 255]
    overlay[valid & ~alpha] = [50, 220, 240, 255]
    Image.fromarray(overlay).save(destination / "coverage.png")
    wire = source.copy()
    draw = ImageDraw.Draw(wire)
    uv = np.column_stack([entry["anchor"][0] + mesh.vertices[:, 0], entry["anchor"][1] + mesh.vertices[:, 1] - mesh.vertices[:, 2]])
    # Dense generated topology is sampled for legibility; this is not simplification.
    for face in mesh.faces[::max(1, len(mesh.faces) // 250)]:
        points = [tuple(uv[i]) for i in [*face, face[0]]]
        draw.line(points, fill=(255, 190, 80, 160))
    origin = tuple(entry["anchor"])
    for endpoint, color in [((origin[0] + 12, origin[1]), "red"), ((origin[0], origin[1] + 12), "green"), ((origin[0], origin[1] - 12), "blue")]:
        draw.line([origin, endpoint], fill=color, width=1)
    wire.save(destination / "wire.png")
    center_z = float(mesh.bounds[1, 2] / 2)
    panels = [("source", source), ("depth", false_color(depth, valid)), ("coverage", Image.fromarray(overlay)), ("wire + axes", wire)]
    views = {
        "side": [[1, 0, 0], [0, 0, 1], [0, 1, 0]],
        "top": [[1, 0, 0], [0, -1, 0], [0, 0, 1]],
        "front": [[0, -1, 0], [0, 0, 1], [-1, 0, 0]],
        "back": [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
        "oblique": [[0.7071, -0.7071, 0], [-0.40825, -0.40825, 0.8165], [0.57735, 0.57735, 0.57735]],
    }
    for name, basis in views.items():
        d, mask, _ = raster(mesh.vertices, mesh.faces, 96, 96, [48, 48 + center_z * basis[1][2]], basis)
        view = false_color(d, mask)
        view.save(destination / f"{name}.png")
        panels.append((name, view))
    sheet = Image.new("RGB", (3 * 320, 3 * 344), "#19222c")
    for i, (label, image) in enumerate(panels):
        left, top = (i % 3) * 320, (i // 3) * 344
        scale = min(320 // image.width, 320 // image.height)
        image = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
        sheet.paste(image, (left + (320 - image.width) // 2, top + 24), image)
        ImageDraw.Draw(sheet).text((left + 8, top + 6), label, fill="white")
    sheet.save(destination / "inspection.png")
    result = {
        "asset": args.asset, "lane": "generated fitted mesh" if args.run else "authored spatial control",
        "transform": json.loads(args.transform.read_text()) if args.run else "authored control in game axes",
        "review": "unreviewed diagnostic, no ground-truth overlap labels or production integration",
        "sourceRgbaSha256": entry["cropRgbaSha256"], "anchor": entry["anchor"],
        "depth": {"file": "depth.npy", "encoding": "float32 signed ray distance in world pixels; larger is nearer; NaN invalid", "ray": [0, 0.7071067811865475, 0.7071067811865475], "clipRangeWorldPixels": [-128, 128], "sample": "pixel center; no antialiasing"},
        "projection": manifest["projection"], "axes": manifest["axes"],
        "sourceOpaquePixels": int(alpha.sum()), "matchedPixels": int(accepted.sum()),
        "sourceUnmatchedPixels": int((alpha & ~valid).sum()), "meshOutsideAlphaPixels": int((valid & ~alpha).sum()),
        "triangles": len(mesh.faces), "vertices": len(mesh.vertices), "firstRasterSeconds": elapsed,
        "runtimeDepthBytes": accepted_depth.nbytes, "validityBytesUncompressed": accepted.nbytes,
        "semanticRoles": "unassigned: geometry alone does not establish ground shadow versus object",
        "knownFailures": ["No segmentation; painted ground pixels require explicit receiver semantics", "Alpha holes preserve observed view only", "No ground-truth overlap labels", "Depth colors are normalized per view; inspect geometry rather than comparing their color values"],
    }
    (destination / "bake.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
