"""Save a repeatable image-generation request, then register its immutable output."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

import numpy as np
from PIL import Image


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def name(value):
    if not value or "/" in value or "\\" in value or Path(value).name != value or value in (".", ".."):
        raise argparse.ArgumentTypeError("Use a single directory name")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    commands = parser.add_subparsers(dest="command", required=True)
    prepare = commands.add_parser("prepare")
    prepare.add_argument("--asset", required=True)
    prepare.add_argument("--id", type=name, required=True)
    prepare.add_argument("--prompt", type=Path, required=True)
    register = commands.add_parser("register")
    register.add_argument("--id", type=name, required=True)
    register.add_argument("--image", type=Path, required=True)
    derive = commands.add_parser("downsample")
    derive.add_argument("--parent", type=name, required=True)
    derive.add_argument("--id", type=name, required=True)
    derive.add_argument("--max-side", type=int, required=True)
    select = commands.add_parser("from-views")
    select.add_argument("--views", type=name, required=True)
    select.add_argument("--angle", type=int, choices=[0, 45, 90, 180, 270, 315], default=0)
    select.add_argument("--id", type=name, required=True)
    args = parser.parse_args()
    directory = args.bundle / "references" / args.id
    manifest_path = args.bundle / "inputs.json"
    manifest = json.loads(manifest_path.read_text())
    if args.command == "prepare":
        entry = next(item for item in manifest["inputs"] if item["id"] == args.asset)
        source = args.bundle / entry["input"]
        if digest(source) != entry["cropSha256"]:
            raise RuntimeError("Original crop changed")
        directory.mkdir(parents=True, exist_ok=False)
        shutil.copyfile(source, directory / "source.png")
        prompt = args.prompt.read_text()
        (directory / "prompt.txt").write_text(prompt)
        record = {"id": args.id, "asset": args.asset, "status": "awaiting-image-generation",
                  "inputManifestSha256": digest(manifest_path), "sourceSha256": digest(source),
                  "sourceRgbaSha256": entry["cropRgbaSha256"], "promptSha256": digest(directory / "prompt.txt"),
                  "prompt": prompt, "generator": "Codex built-in image_gen, reference-conditioned generation",
                  "generationControl": "No exposed seed or immutable model revision; preserve output bytes for downstream replay",
                  "transparentBackground": True, "review": "unreviewed conditioning hypothesis; never replacement sprite art"}
        (directory / "request.json").write_text(json.dumps(record, indent=2) + "\n")
    elif args.command == "register":
        record = json.loads((directory / "request.json").read_text())
        if (directory / "reference.json").exists():
            raise RuntimeError("Reference already registered; use a fresh ID")
        if digest(manifest_path) != record["inputManifestSha256"]:
            raise RuntimeError("Original input manifest changed")
        if digest(directory / "source.png") != record["sourceSha256"] or digest(directory / "prompt.txt") != record["promptSha256"]:
            raise RuntimeError("Generation request changed")
        image = Image.open(args.image)
        if image.mode != "RGBA":
            raise RuntimeError("Generator must return RGBA transparency")
        alpha = np.array(image)[:, :, 3]
        if not np.any(alpha == 0) or not np.any(alpha > 0):
            raise RuntimeError("Expected both foreground and transparent background")
        shutil.copyfile(args.image, directory / "reference.png")
        record.update({"status": "registered", "file": f"references/{args.id}/reference.png",
                       "sha256": digest(directory / "reference.png"), "size": list(image.size),
                       "requestSha256": digest(directory / "request.json"),
                       "alphaPixels": int(np.count_nonzero(alpha)),
                       "semanticLimit": "Removing the painted ground in a generated reference does not label the original shadow pixels"})
        (directory / "reference.json").write_text(json.dumps(record, indent=2) + "\n")
    else:
        if args.command == "downsample":
            if args.max_side < 8:
                parser.error("max-side must be at least eight pixels")
            parent = args.bundle / "references" / args.parent
            parent_record = json.loads((parent / "reference.json").read_text())
            source = args.bundle / parent_record["file"]
            source.resolve().relative_to(args.bundle.resolve())
            if digest(source) != parent_record["sha256"]:
                raise RuntimeError("Parent reference changed")
            image = Image.open(source).convert("RGBA")
            width, height = image.size
            scale = min(1, args.max_side / max(width, height))
            image = image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)
            asset = parent_record["asset"]
            provenance = {"parent": args.parent, "parentRecordSha256": digest(parent / "reference.json"),
                          "method": "LANCZOS downsample, preserve aspect and generated alpha", "maxSide": args.max_side}
            generator = "Deterministic resolution ablation of saved generated reference"
            prompt = parent_record["prompt"]
            control = "Parent output bytes and exact resampling; downstream seed recorded separately"
        else:
            views = args.bundle / "views" / args.views
            parent_record = json.loads((views / "views.json").read_text())
            if parent_record["status"] != "succeeded":
                raise RuntimeError("View generation must have succeeded")
            source = views / f"cutout-{args.angle:03d}.png"
            if digest(source) != parent_record["outputs"][source.name]["sha256"]:
                raise RuntimeError("Selected generated view changed")
            image = Image.open(source).convert("RGBA")
            asset = parent_record["asset"]
            provenance = {"views": args.views, "viewsRecordSha256": digest(views / "views.json"), "angle": args.angle,
                          "input": parent_record["input"], "segmentation": parent_record["segmentation"]}
            generator = "Local MV-Adapter + SDXL, U2Net cutout"
            prompt = parent_record["prompt"]
            control = "Pinned model/code revisions, local seed and camera controls in parent views.json"
        if parent_record["inputManifestSha256"] != digest(manifest_path):
            raise RuntimeError("Parent source manifest changed")
        entry = next(item for item in manifest["inputs"] if item["id"] == asset)
        if digest(args.bundle / entry["input"]) != entry["cropSha256"]:
            raise RuntimeError("Original source pixels changed")
        alpha = np.array(image)[:, :, 3]
        if not np.any(alpha == 0) or not np.any(alpha > 0):
            raise RuntimeError("Expected both foreground and transparent background")
        directory.mkdir(parents=True, exist_ok=False)
        image.save(directory / "reference.png")
        (directory / "source.png").write_bytes((args.bundle / entry["input"]).read_bytes())
        (directory / "prompt.txt").write_text(prompt)
        record = {"id": args.id, "asset": asset, "status": "registered", "generator": generator,
                  "generationControl": control, "provenance": provenance, "prompt": prompt,
                  "inputManifestSha256": digest(manifest_path), "sourceSha256": entry["cropSha256"],
                  "sourceRgbaSha256": entry["cropRgbaSha256"], "promptSha256": digest(directory / "prompt.txt"),
                  "file": f"references/{args.id}/reference.png", "sha256": digest(directory / "reference.png"),
                  "size": list(image.size), "review": "unreviewed conditioning hypothesis; never replacement sprite art",
                  "semanticLimit": "Generated reference alpha does not label original shadow pixels"}
        (directory / "reference.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"id": args.id, "status": record["status"]}))


if __name__ == "__main__":
    main()
