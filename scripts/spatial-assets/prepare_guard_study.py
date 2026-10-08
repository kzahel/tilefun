"""Freeze 073 editor outputs for prop alpha guards and 074 tree framing controls."""
import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from reference import digest

PROPS = ["shed", "picnic-table", "tent-blue"]
TREE_MODES = ["native-clean", "native-hard", "sam2-points"]


def write(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--masks", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    bundle = args.bundle
    if (bundle / "inputs.json").exists():
        raise RuntimeError("Use a fresh immutable study")
    bundle.mkdir(parents=True, exist_ok=True)
    for name in ["inputs", "prompts"]:
        shutil.copytree(args.source / name, bundle / name)
    for name in ["inputs.json", "actor.json", "download-triposg.json"]:
        shutil.copyfile(args.source / name, bundle / name)
    plan = {"assets": PROPS + ["oak-tree"], "imageSeeds": [42], "meshSeeds": [42, 43],
            "inputManifestSha256": digest(bundle / "inputs.json"),
            "sourceBundle": str(args.source), "maskBundle": str(args.masks),
            "protocol": "No editor regeneration. Props: identical RGB128 composite, native alpha versus alpha<32 zeroed, seed42 on both providers. Trees: three frozen 074 masks, default mask-dependent framing versus common native-clean alpha>0 bbox, seeds42/43; reuse default seed42 controls. Optional two texture probes selected after inspecting geometry.",
            "review": "Unreviewed offline experiments, no runtime promotion"}
    write(bundle / "plan.json", plan)
    refs = []
    controls = []
    for asset in PROPS + ["oak-tree"]:
        parent_id = f"qwen-{asset}-s42"
        parent = args.source / "references" / parent_id
        generation = json.loads((parent / "generation.json").read_text())
        for file, expected in generation["outputs"].items():
            if digest(parent / file) != expected:
                raise RuntimeError("Frozen generation changed")
        shutil.copytree(parent, bundle / "references" / parent_id)
        if asset == "oak-tree":
            for mode in TREE_MODES:
                ref = f"mask-{asset}-{mode}"
                shutil.copytree(args.masks / "references" / ref, bundle / "references" / ref)
                run = f"triposg-{asset}-{ref}-hierarchical"
                root = args.masks / "runs" / run
                controls.append({"asset": asset, "mode": mode, "seed": 42, "framing": "default",
                                 "bundle": str(args.masks), "id": run,
                                 "files": {str(p.relative_to(args.masks)): digest(p) for p in root.rglob("*") if p.is_file()}})
            continue
        native = Image.open(parent / "generated-native.png").convert("RGBA")
        alpha = np.array(native.getchannel("A"))
        rgb = Image.alpha_composite(Image.new("RGBA", native.size, (128, 128, 128, 255)), native).convert("RGB")
        for mode in ["native-clean", "native-floor32"]:
            mask = alpha if mode == "native-clean" else np.where(alpha < 32, 0, alpha).astype(np.uint8)
            if not np.array_equal(mask > 204, alpha > 204):
                raise RuntimeError("TRELLIS crop must be unchanged")
            ref_id = f"mask-{asset}-{mode}"
            root = bundle / "references" / ref_id
            root.mkdir()
            image = rgb.convert("RGBA")
            image.putalpha(Image.fromarray(mask))
            image.save(root / "reference.png")
            Image.fromarray(mask).save(root / "mask.png")
            rgb.save(root / "mask-input.png")
            ys, xs = np.where(mask > 204)
            record = {"id": ref_id, "asset": asset, "status": "registered", "generator": generation["generator"],
                      "parent": parent_id, "parentGenerationSha256": digest(parent / "generation.json"),
                      "inputManifestSha256": plan["inputManifestSha256"], "sourceSha256": generation["sourceSha256"],
                      "file": f"references/{ref_id}/reference.png", "sha256": digest(root / "reference.png"),
                      "size": list(image.size), "rgbSha256": digest(root / "mask-input.png"),
                      "maskSha256": digest(root / "mask.png"), "implementationSha256": digest(__file__),
                      "segmentation": {"mode": mode, "rule": "Native alpha unchanged" if mode == "native-clean" else "alpha<32 becomes 0; other alpha and RGB unchanged"},
                      "metrics": {"zeroedLowAlphaPixels": int(((alpha > 0) & (mask == 0)).sum()),
                                  "providerAlphaGt08Bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]},
                      "composite": "PIL native RGBA over RGB128; attach selected alpha. Semi-transparent edges composited again by provider.",
                      "review": plan["review"]}
            write(root / "reference.json", record)
            (root / Path(__file__).name).write_bytes(Path(__file__).read_bytes())
            refs.append(record)
        for provider, run in [("TRELLIS", f"trellis-qwen-{asset}-s42"), ("TripoSG", f"triposg-{asset}-{parent_id}-hierarchical")]:
            # Earlier raw-native controls have different RGB treatment and are contextual, not matched pairs.
            root = args.source / "runs" / run
            if not root.exists():
                raise RuntimeError(f"Missing control: {root}")
            controls.append({"asset": asset, "provider": provider, "id": run, "bundle": str(args.source),
                             "files": {str(p.relative_to(args.source)): digest(p) for p in root.rglob("*") if p.is_file()}})
    shutil.copytree(args.masks / "implementation/by-sha", bundle / "implementation/by-sha")
    shutil.copytree(args.masks / "mask-analysis/oak-tree", bundle / "mask-analysis/oak-tree")
    shutil.copyfile(args.masks / "environment.json", bundle / "mask-environment.json")
    shutil.copyfile(args.masks / "point-mask-execution.json", bundle / "inherited-point-masks.json")
    write(bundle / "mask-execution.json", refs)
    write(bundle / "controls.json", controls)
    print(json.dumps({"references": len(refs), "controls": len(controls)}))


if __name__ == "__main__":
    main()
