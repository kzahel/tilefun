"""Static overlap diagnostic using original colors and explicitly uncertain depth.

CPU compositing of CUDA-baked controls or explicitly selected generated meshes.
This is not game/lab integration, human-labelled truth or a performance benchmark.
"""
import argparse
import hashlib
import json
import importlib.metadata
from pathlib import Path
import platform
import subprocess
import time

import numpy as np
from PIL import Image, ImageDraw
import trimesh

from bake import raster


MODES = ["scalar Y+Z", "foot depth", "upright plane", "ground proposal + plane", "ground proposal + body"]
SQRT2 = np.sqrt(2)


def sample(array, anchor, pose, size=96):
    """Nearest samples with one declared phase, preserving fractional world pose."""
    rows, cols = np.indices((size, size))
    x = np.floor(cols + .5 - 48 - pose[0] + anchor[0]).astype(int)
    y = np.floor(rows + .5 - 72 - pose[1] + pose[2] + anchor[1]).astype(int)
    inside = (x >= 0) & (x < array.shape[1]) & (y >= 0) & (y < array.shape[0])
    out = np.zeros((size, size, *array.shape[2:]), dtype=array.dtype)
    out[inside] = array[y[inside], x[inside]]
    return out, inside


def decisions(object_depth, actor_depth, overlap, scalar_hidden, ground):
    known = overlap & np.isfinite(object_depth) & np.isfinite(actor_depth)
    hidden = np.full(overlap.shape, scalar_hidden, dtype=bool)
    hidden[known] = object_depth[known] >= actor_depth[known]
    hidden[ground] = False
    unresolved = overlap & ~known & ~ground
    return hidden & overlap, unresolved


def compose(obj, actor, hidden):
    background = Image.new("RGBA", (96, 96), "#899b81")
    object_image, actor_image = Image.fromarray(obj), Image.fromarray(actor)
    front = Image.alpha_composite(Image.alpha_composite(background, object_image), actor_image)
    back = Image.alpha_composite(Image.alpha_composite(background, actor_image), object_image)
    return Image.fromarray(np.where(hidden[:, :, None], np.array(back), np.array(front)))


def verified_image(bundle, record, expected):
    path = bundle / record["input"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError(f"Input hash mismatch: {record['input']}")
    return np.array(Image.open(path).convert("RGBA"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--oak-run", help="Select a successfully baked generated oak instead of its authored control")
    parser.add_argument("--car-run", help="Select a successfully baked generated car instead of its authored control")
    parser.add_argument("--asset-run", help="Compare just this generated asset with generic diagnostic poses")
    args = parser.parse_args()
    if Path(args.id).name != args.id or args.id in (".", ".."):
        parser.error("id must be a single directory name")
    if args.asset_run and (args.oak_run or args.car_run):
        parser.error("asset-run cannot be combined with oak-run/car-run")
    for run_id in [args.oak_run, args.car_run, args.asset_run]:
        if run_id and (Path(run_id).name != run_id or run_id in (".", "..")):
            parser.error("run IDs must be single directory names")
    destination = args.bundle / "comparisons" / args.id
    destination.mkdir(parents=True, exist_ok=False)
    manifest = json.loads((args.bundle / "inputs.json").read_text())
    actor_record = json.loads((args.bundle / "actor.json").read_text())
    actor = verified_image(args.bundle, actor_record, actor_record["cropSha256"])
    ah, aw = actor.shape[:2]
    rows = np.indices((ah, aw))[0]
    upright = (actor_record["anchor"][1] - (rows + .5)) / SQRT2
    upright[actor[:, :, 3] == 0] = np.nan
    # Capsule is an authored visual depth hypothesis; it does not replace the
    # player's authoritative 10x6 footprint or physicalHeight=12.
    body = trimesh.creation.capsule(height=8, radius=4, count=[8, 12])
    body.apply_scale([1.25, .75, 1])
    body.apply_translation([0, 0, -body.bounds[0, 2]])
    np.testing.assert_allclose(body.bounds[:, 2], [0, 16], atol=1e-6)
    body_depth, body_valid, _ = raster(body.vertices, body.faces, aw, ah, actor_record["anchor"])
    body_depth[~body_valid | (actor[:, :, 3] == 0)] = np.nan
    body.export(destination / "actor-body.glb")
    np.save(destination / "actor-body-depth.npy", body_depth)
    np.save(destination / "actor-plane-depth.npy", upright.astype(np.float32))
    report = {"id": args.id, "status": "diagnostic completed; no quality acceptance", "review": "unreviewed diagnostic; no human overlap labels",
              "tilefunRevision": subprocess.check_output(["git", "-C", str(Path(__file__).resolve().parents[2]), "rev-parse", "HEAD"], text=True).strip(),
              "implementationSha256": {name: hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest() for name in ["compare.py", "bake.py"]},
              "environment": {"python": platform.python_version(), "packages": {name: importlib.metadata.version(name) for name in ["torch", "nvdiffrast", "numpy", "pillow", "trimesh"]}},
              "inputManifestSha256": hashlib.sha256((args.bundle / "inputs.json").read_bytes()).hexdigest(),
              "actor": actor_record, "modes": MODES,
              "depth": "(Y+Z)/sqrt(2), world pixels, larger nearer; pose translation included",
              "scalar": "diagnostic Y+Z reference; object wins ties; excludes production depthAboveProps/support overrides",
              "unknownPolicy": "fall back to scalar reference and explicitly count/highlight unresolved overlap",
              "groundProposal": "unreviewed color heuristic: oak row>=46, G>1.35R, G>1.2B; not a human mask or accepted segmentation",
              "body": {"method": "authored capsule, x radius 5/y radius 3/height 16; original sprite alpha retained",
                       "sourceOpaquePixels": int((actor[:, :, 3] > 0).sum()),
                       "matchedPixels": int(np.isfinite(body_depth).sum()),
                       "bounds": body.bounds.tolist()}, "assets": {}}
    cases = {
        "oak-tree": [("front", [0, 4, 0]), ("side ground", [14, -4, 0]),
                     ("rear trunk", [0, -10, 0]), ("under canopy", [16, -20, 0]),
                     ("jump", [12, -8, 28]), ("raised receiver", [14, -4, 24])],
        "compact-1-side-body": [("near side", [0, 13, 0]), ("far side", [0, -10, 0]),
                               ("roof height 24", [0, 0, 24]), ("jump", [12, -4, 16])],
    }
    if args.asset_run:
        selected = json.loads((args.bundle / "runs" / args.asset_run / "run.json").read_text())
        asset = selected["input"]["asset"]
        entry = next(item for item in manifest["inputs"] if item["id"] == asset)
        width, height = entry["size"]
        cases = {asset: [("front", [0, 4, 0]), ("left edge", [-width / 4, -4, 0]),
                         ("right edge", [width / 4, -4, 0]), ("rear", [0, -height / 4, 0]),
                         ("jump", [width / 6, -8, min(40, height / 3)]), ("raised receiver", [width / 4, -4, 24])]}
        report["poseProtocol"] = "Generic source-size-scaled visual probes; no legal support or contact claim"
    for asset, poses in cases.items():
        entry = next(i for i in manifest["inputs"] if i["id"] == asset)
        obj = verified_image(args.bundle, entry, entry["cropSha256"])
        run_id = args.asset_run or (args.oak_run if asset == "oak-tree" else args.car_run)
        if run_id:
            run_dir = args.bundle / "runs" / run_id
            run_record = json.loads((run_dir / "run.json").read_text())
            if run_record["status"] != "succeeded" or run_record.get("input", {}).get("asset") != asset:
                raise RuntimeError("Selected run does not match this asset")
            if run_record["input"]["manifestSha256"] != report["inputManifestSha256"]:
                raise RuntimeError("Selected run belongs to a different input manifest")
            control_dir = run_dir / "bake"
        else:
            control_dir = args.bundle / "controls" / asset
        control_record = json.loads((control_dir / "bake.json").read_text())
        if control_record["sourceRgbaSha256"] != entry["cropRgbaSha256"]:
            raise RuntimeError("Spatial bake belongs to different source pixels")
        depth = np.load(control_dir / "depth.npy")
        role = np.zeros(depth.shape, dtype=bool)
        if asset == "oak-tree":
            r, g, b = [obj[:, :, k].astype(float) for k in range(3)]
            role = (np.indices(depth.shape)[0] >= 46) & (g > 1.35 * r) & (g > 1.2 * b) & (obj[:, :, 3] > 0)
        Image.fromarray((role * 255).astype(np.uint8)).save(destination / f"{asset}-ground-proposal.png")

        def frame(pose, receiver_z=0):
            object_pose = [0, 0, receiver_z]
            object_pixels, _ = sample(obj, entry["anchor"], object_pose)
            object_d, oi = sample(depth, entry["anchor"], object_pose)
            object_d[~oi] = np.nan
            object_d += receiver_z / SQRT2
            ground, _ = sample(role, entry["anchor"], object_pose)
            actor_pixels, _ = sample(actor, actor_record["anchor"], pose)
            plane_d, ai = sample(upright, actor_record["anchor"], pose)
            capsule_d, _ = sample(body_depth, actor_record["anchor"], pose)
            plane_d[~ai] = np.nan
            capsule_d[~ai] = np.nan
            plane_d += (pose[1] + pose[2]) / SQRT2
            capsule_d += (pose[1] + pose[2]) / SQRT2
            overlap = (object_pixels[:, :, 3] > 0) & (actor_pixels[:, :, 3] > 0)
            scalar_hidden = receiver_z >= pose[1] + pose[2] + actor_record["sortOffsetY"]
            foot_field = np.full(object_d.shape, (pose[1] + pose[2]) / SQRT2)
            states = [(overlap & scalar_hidden, np.zeros_like(overlap))]
            for actor_d, semantic in [(foot_field, np.zeros_like(ground)), (plane_d, np.zeros_like(ground)),
                                      (plane_d, ground), (capsule_d, ground)]:
                states.append(decisions(object_d, actor_d, overlap, scalar_hidden, semantic))
            return object_pixels, actor_pixels, states, overlap

        sheet = Image.new("RGB", (5 * 288, len(poses) * 308), "#19222c")
        records = []
        for row, (label, pose) in enumerate(poses):
            receiver = 24 if label == "raised receiver" else 0
            object_pixels, actor_pixels, states, overlap = frame(pose, receiver)
            item = {"label": label, "pose": pose, "objectZ": receiver, "overlapPixels": int(overlap.sum()), "modes": {}}
            for col, (mode, (hidden, unresolved)) in enumerate(zip(MODES, states)):
                image = compose(object_pixels, actor_pixels, hidden)
                sheet.paste(image.resize((288, 288), Image.Resampling.NEAREST), (col * 288, row * 308 + 20))
                ImageDraw.Draw(sheet).text((col * 288 + 4, row * 308 + 4), f"{label}: {mode}", fill="white")
                item["modes"][mode] = {"hiddenOverlapPixels": int(hidden.sum()), "unresolvedOverlapPixels": int(unresolved.sum()),
                                       "disagreementWithScalar": int((hidden ^ states[0][0]).sum()),
                                       "disagreementWithSemanticPlaneOnResolvedOverlap": int(((hidden ^ states[3][0]) & ~unresolved & ~states[3][1]).sum())}
            records.append(item)
        sheet.save(destination / f"{asset}-overlap.png")
        # Quarter-pixel movement is sampled in world space, then displayed at a
        # fractional zoom. Changed pixels are diagnostic continuity, not errors.
        images, sweep = [], []
        start = time.perf_counter()
        previous = None
        for y in np.arange(-14, 6.01, .25):
            object_pixels, actor_pixels, states, overlap = frame([14 if asset == "oak-tree" else 0, float(y), 0])
            chosen, unresolved = states[3]
            image = compose(object_pixels, actor_pixels, chosen)
            if previous is not None:
                changed = int(np.any(np.array(image) != previous, axis=2).sum())
            else:
                changed = 0
            sweep.append({"y": float(y), "hiddenPixels": int(chosen.sum()), "unresolvedPixels": int(unresolved.sum()), "changedImagePixels": changed})
            previous = np.array(image)
            images.append(image.resize((144, 144), Image.Resampling.NEAREST).convert("RGB"))
        images[0].save(destination / f"{asset}-sweep.gif", save_all=True, append_images=images[1:], duration=80, loop=0)
        object_pixels, actor_pixels, states, _ = frame([14 if asset == "oak-tree" else 0, -4, 0])
        chosen, unresolved = states[3]
        uncertain_view = np.array(compose(object_pixels, actor_pixels, chosen))
        uncertain_view[unresolved] = [255, 170, 35, 255]
        Image.fromarray(uncertain_view).save(destination / f"{asset}-uncertainty.png")
        report["assets"][asset] = {"groundProposalPixels": int(role.sum()), "cases": records, "sweep": sweep,
                                   "spatialSource": {"lane": control_record["lane"], "run": run_id},
                                   "spatialFilesSha256": {name: hashlib.sha256((control_dir / name).read_bytes()).hexdigest() for name in ["depth.npy", "bake.json", "proxy.glb"]},
                                   "sweepSecondsWithImageAndGifPreparation": time.perf_counter() - start}
    (destination / "comparison.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"id": args.id, "body": report["body"], "groundProposalPixels": {asset: value["groundProposalPixels"] for asset, value in report["assets"].items()}}))


if __name__ == "__main__":
    main()
