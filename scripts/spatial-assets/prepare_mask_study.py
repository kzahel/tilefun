"""Freeze Qwen outputs and compare masks on one properly composited RGB canvas."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

import numpy as np
from PIL import Image
from reference import digest

ASSETS = ["compact-1-east", "oak-tree"]
MODES = ["native-clean", "native-hard", "u2net-clean", "sam2-box"]
SAM_REVISION = "ee5bba1d82bb8749febdf90f45e84b687142ba03"


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    args = parser.parse_args()
    if (args.bundle / "inputs.json").exists():
        raise RuntimeError("Use a fresh study; frozen outputs are immutable")
    args.bundle.mkdir(parents=True, exist_ok=True)
    for name in ["inputs", "prompts"]:
        shutil.copytree(args.source / name, args.bundle / name)
    for name in ["inputs.json", "actor.json", "download-triposg.json"]:
        shutil.copyfile(args.source / name, args.bundle / name)
    manifest = json.loads((args.bundle / "inputs.json").read_text())
    plan = {"assets": ASSETS, "imageSeeds": [42], "meshSeed": 42, "modes": MODES,
            "inputManifestSha256": digest(args.bundle / "inputs.json"),
            "sourceBundle": str(args.source), "sourcePlanSha256": digest(args.source / "plan.json"),
            "protocol": "Same PIL native RGBA composite over RGB128 for all four masks; no editor regeneration. Native-clean keeps original alpha; native-hard thresholds it at 128; U2Net and SAM see exactly the same composited RGB. SAM box is native alpha>=128 bbox plus 8px, no hand points or masks.",
            "review": "Unreviewed diagnostic outputs; no runtime promotion"}
    save_json(args.bundle / "plan.json", plan)
    from huggingface_hub import hf_hub_download
    from rembg import new_session, remove
    import torch
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    checkpoint = Path(hf_hub_download("facebook/sam2.1-hiera-small", "sam2.1_hiera_small.pt", revision=SAM_REVISION))
    config = "configs/sam2.1/sam2.1_hiera_s.yaml"
    predictor = SAM2ImagePredictor(build_sam2(config, str(checkpoint), device="cuda", apply_postprocessing=False))
    session = new_session("u2net", providers=["CPUExecutionProvider"])
    u2net = Path(os.environ.get("U2NET_HOME", str(Path.home() / ".u2net"))) / "u2net.onnx"
    environment = {"sam": {"repo": "facebook/sam2.1-hiera-small", "revision": SAM_REVISION,
                    "checkpointSha256": digest(checkpoint), "config": config,
                    "providerRevision": subprocess.check_output(["git", "-C", str(args.provider), "rev-parse", "HEAD"], text=True).strip(),
                    "postprocessing": "disabled; no CUDA connected-components extension"},
                   "u2netSha256": digest(u2net), "packages": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()},
                   "implementationSha256": digest(__file__)}
    save_json(args.bundle / "environment.json", environment)
    records = []
    for asset in ASSETS:
        parent_id = f"qwen-{asset}-s42"
        parent = args.source / "references" / parent_id
        shutil.copytree(parent, args.bundle / "references" / parent_id)
        generation = json.loads((parent / "generation.json").read_text())
        for file, expected in generation["outputs"].items():
            if digest(parent / file) != expected:
                raise RuntimeError("Original generation bytes changed")
        native = Image.open(parent / "generated-native.png").convert("RGBA")
        alpha = np.array(native.getchannel("A"))
        rgb = Image.alpha_composite(Image.new("RGBA", native.size, (128, 128, 128, 255)), native).convert("RGB")
        analysis = args.bundle / "mask-analysis" / asset
        analysis.mkdir(parents=True)
        rgb.save(analysis / "clean-rgb.png")
        native.getchannel("A").save(analysis / "native-alpha.png")
        ys, xs = np.where(alpha >= 128)
        box = np.array([max(0, xs.min()-8), max(0, ys.min()-8), min(native.width-1, xs.max()+8), min(native.height-1, ys.max()+8)], dtype=np.float32)
        begin = time.perf_counter()
        u2_mask = np.array(remove(rgb, session=session).getchannel("A"))
        u2_seconds = time.perf_counter() - begin
        begin = time.perf_counter()
        torch.cuda.reset_peak_memory_stats()
        with torch.inference_mode(), torch.autocast("cuda", dtype=torch.bfloat16):
            predictor.set_image(np.array(rgb))
            masks, scores, low_logits = predictor.predict(box=box, multimask_output=False)
        torch.cuda.synchronize()
        sam_seconds = time.perf_counter() - begin
        np.savez_compressed(analysis / "sam-output.npz", mask=masks[0], predicted_score=scores, low_resolution_logits=low_logits, box_xyxy=box)
        mask_values = {"native-clean": alpha, "native-hard": (alpha >= 128).astype(np.uint8)*255,
                       "u2net-clean": u2_mask, "sam2-box": masks[0].astype(np.uint8)*255}
        for mode, mask in mask_values.items():
            ref_id = f"mask-{asset}-{mode}"
            directory = args.bundle / "references" / ref_id
            directory.mkdir()
            output = rgb.convert("RGBA")
            output.putalpha(Image.fromarray(mask))
            output.save(directory / "reference.png")
            Image.fromarray(mask).save(directory / "mask.png")
            rgb.save(directory / "mask-input.png")
            core, selected = alpha >= 243, mask >= 128
            weak = alpha < 13
            mask_ys, mask_xs = np.where(mask > 204)
            metrics = {"selectedPixels": int(selected.sum()), "nativeCoreRetainedFraction": float((selected & core).sum()/core.sum()),
                       "selectedInNativeNearTransparentPixels": int((selected & weak).sum()),
                       "nativeBinaryAgreementIoU": float((selected & (alpha>=128)).sum()/(selected | (alpha>=128)).sum()),
                       "providerAlphaGt08Bbox": [int(mask_xs.min()), int(mask_ys.min()), int(mask_xs.max()), int(mask_ys.max())],
                       "limit": "Agreement with returned alpha is not segmentation ground truth"}
            record = {"id": ref_id, "asset": asset, "status": "registered", "generator": generation["generator"],
                      "parent": parent_id, "parentGenerationSha256": digest(parent / "generation.json"),
                      "inputManifestSha256": plan["inputManifestSha256"], "sourceSha256": generation["sourceSha256"],
                      "file": f"references/{ref_id}/reference.png", "sha256": digest(directory / "reference.png"),
                      "size": list(output.size), "rgbSha256": digest(directory / "mask-input.png"),
                      "maskSha256": digest(directory / "mask.png"), "segmentation": {"mode": mode,
                      "seconds": sam_seconds if mode == "sam2-box" else u2_seconds if mode == "u2net-clean" else 0,
                      "samBox": box.tolist() if mode == "sam2-box" else None,
                      "predictedMaskScore": float(scores[0]) if mode == "sam2-box" else None,
                      "environmentSha256": digest(args.bundle / "environment.json")}, "metrics": metrics,
                      "implementationSha256": digest(__file__), "review": plan["review"],
                      "composite": "PIL native RGBA over RGB128, then attach this mask. Native-clean retains original alpha; semi-transparent edges are composited again by geometry provider."}
            save_json(directory / "reference.json", record)
            records.append(record)
            print(json.dumps({"id": ref_id, "metrics": metrics}), flush=True)
    save_json(args.bundle / "mask-execution.json", records)


if __name__ == "__main__":
    main()
