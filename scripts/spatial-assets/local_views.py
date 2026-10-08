"""Pinned, entirely local sprite/reference to six generated views and learned cutouts."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback

from reference import digest, name


MODELS = {
    "base": ["stabilityai/stable-diffusion-xl-base-1.0", "462165984030d82259a11f4367a4eed129e94a7b"],
    "vae": ["madebyollin/sdxl-vae-fp16-fix", "207b116dae70ace3637169f1ddd2434b91b3a8cd"],
    "adapter": ["huanngzh/mv-adapter", "6de4033df6b53366f3c009d22f5ec434bb55e59f"],
}
PROVIDER_REVISION = "4277e0018232bac82bb2c103caf0893cedb711be"
ANGLES = [0, 45, 90, 180, 270, 315]
NEGATIVE = "flat billboard, paper cutout, pixel art, grass patch, ground plane, cast ground shadow, pot, base, text, watermark, multiple trees, deformed, blurry"


def negative_prompt(asset):
    if asset in ("oak-tree", "palm-tree"):
        return NEGATIVE
    return "flat billboard, paper cutout, pixel art, grass patch, ground plane, cast ground shadow, text, watermark, multiple objects, deformed, blurry"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--reference", type=name, help="Registered reference; omitted means original sprite")
    parser.add_argument("--id", type=name, required=True)
    parser.add_argument("--prompt", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--steps", type=int, default=50)
    parser.add_argument("--reference-scale", type=float, default=1, help="Reference-image conditioning strength; lower values let the 3D prompt change the sprite interpretation")
    args = parser.parse_args()
    negative = negative_prompt(args.asset)
    args.bundle = args.bundle.resolve()
    revision = subprocess.check_output(["git", "-C", str(args.provider), "rev-parse", "HEAD"], text=True).strip()
    if revision != PROVIDER_REVISION:
        raise RuntimeError("MV-Adapter checkout revision changed")
    manifest = json.loads((args.bundle / "inputs.json").read_text())
    entry = next(item for item in manifest["inputs"] if item["id"] == args.asset)
    if args.reference:
        reference_path = args.bundle / "references" / args.reference / "reference.json"
        reference = json.loads(reference_path.read_text())
        if reference["asset"] != args.asset or reference["status"] != "registered":
            raise RuntimeError("Wrong registered conditioning reference")
        if reference["inputManifestSha256"] != digest(args.bundle / "inputs.json"):
            raise RuntimeError("Registered reference source manifest changed")
        source = (args.bundle / reference["file"]).resolve()
        source.relative_to(args.bundle)
        expected = reference["sha256"]
    else:
        source, expected = args.bundle / entry["input"], entry["cropSha256"]
    if digest(source) != expected:
        raise RuntimeError("Conditioning image changed")
    directory = args.bundle / "views" / args.id
    directory.mkdir(parents=True, exist_ok=False)
    prompt = args.prompt.read_text().strip()
    (directory / "prompt.txt").write_text(prompt + "\n")
    (directory / "local_views.py").write_bytes(Path(__file__).read_bytes())
    (directory / "input.png").write_bytes(source.read_bytes())
    record = {"id": args.id, "status": "started", "asset": args.asset,
              "provider": {"name": "MV-Adapter", "revision": revision}, "models": MODELS,
              "inputManifestSha256": digest(args.bundle / "inputs.json"),
              "input": {"sha256": expected, "reference": args.reference, "role": "registered generated reference" if args.reference else "original sprite"},
              "prompt": prompt, "negativePrompt": negative,
              "settings": {"seed": args.seed, "steps": args.steps, "size": [768, 768], "guidanceScale": 3,
                           "referenceConditioningScale": args.reference_scale, "scheduler": "DDPM + ShiftSNR interpolated scale 8"},
              "cameras": {"azimuthLabelsDegrees": ANGLES, "actualAzimuthDegrees": [angle - 90 for angle in ANGLES],
                          "elevationDegrees": 0, "distance": 1.8, "orthographicBounds": [-.55, .55, -.55, .55]},
              "review": "unreviewed generated geometry hypotheses; not independent observations",
              "adaptations": ["upstream run_pipeline with pinned local FP16 snapshots; no LoRA", "save individual views and actual masks", "U2Net background removal after generation"],
              "implementationSha256": digest(__file__), "outputs": {},
              "packages": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()}}

    def persist():
        (directory / "views.json").write_text(json.dumps(record, indent=2) + "\n")

    persist()
    start = time.perf_counter()
    try:
        import numpy as np
        import torch
        from diffusers import AutoencoderKL, DDPMScheduler
        from huggingface_hub import snapshot_download
        from PIL import Image
        sys.path.insert(0, str(args.provider.resolve()))
        from mvadapter.pipelines.pipeline_mvadapter_i2mv_sdxl import MVAdapterI2MVSDXLPipeline
        from mvadapter.schedulers.scheduling_shift_snr import ShiftSNRScheduler
        from scripts.inference_i2mv_sdxl import run_pipeline
        from mvadapter.utils import make_image_grid
        download_start = time.perf_counter()
        base = snapshot_download(*MODELS["base"][:1], revision=MODELS["base"][1],
                                 allow_patterns=["model_index.json", "**/*.json", "tokenizer/*", "tokenizer_2/*", "**/*.fp16.safetensors"], max_workers=2)
        vae = snapshot_download(*MODELS["vae"][:1], revision=MODELS["vae"][1],
                                allow_patterns=["config.json", "diffusion_pytorch_model.safetensors"], max_workers=2)
        adapter = snapshot_download(*MODELS["adapter"][:1], revision=MODELS["adapter"][1],
                                    allow_patterns=["mvadapter_i2mv_sdxl.safetensors"], max_workers=2)
        record["downloadSeconds"] = time.perf_counter() - download_start
        load_start = time.perf_counter()
        pipe = MVAdapterI2MVSDXLPipeline.from_pretrained(base, variant="fp16", torch_dtype=torch.float16,
                                                       vae=AutoencoderKL.from_pretrained(vae), add_watermarker=False)
        pipe.scheduler = ShiftSNRScheduler.from_scheduler(pipe.scheduler, shift_mode="interpolated", shift_scale=8,
                                                          scheduler_class=DDPMScheduler)
        pipe.init_custom_adapter(num_views=6)
        pipe.load_custom_adapter(adapter, weight_name="mvadapter_i2mv_sdxl.safetensors")
        pipe.to(device="cuda", dtype=torch.float16)
        pipe.cond_encoder.to(device="cuda", dtype=torch.float16)
        pipe.enable_vae_slicing()
        for tokenizer in (pipe.tokenizer, pipe.tokenizer_2):
            for text in (prompt, negative):
                if len(tokenizer(text, truncation=False)["input_ids"]) > tokenizer.model_max_length:
                    raise RuntimeError("Prompt exceeds CLIP token budget; shorten it instead of silently truncating")
        torch.cuda.synchronize()
        record["loadSeconds"] = time.perf_counter() - load_start
        record["gpu"] = torch.cuda.get_device_name()
        print(f"Loaded pinned local view generator in {record['loadSeconds']:.2f}s", flush=True)
        persist()
        torch.cuda.reset_peak_memory_stats()
        sampling_start = time.perf_counter()
        images, provider_input = run_pipeline(pipe, num_views=6, text=prompt, image=str(source), height=768, width=768,
                                               num_inference_steps=args.steps, guidance_scale=3, seed=args.seed,
                                               negative_prompt=negative, device="cuda", azimuth_deg=ANGLES,
                                               reference_conditioning_scale=args.reference_scale)
        torch.cuda.synchronize()
        record["generationSeconds"] = time.perf_counter() - sampling_start
        record["peakAllocatedBytes"] = torch.cuda.max_memory_allocated()
        record["peakReservedBytes"] = torch.cuda.max_memory_reserved()
        provider_input.save(directory / "provider-input.png")
        make_image_grid(images, rows=2).save(directory / "views.png")
        for angle, image in zip(ANGLES, images):
            image.save(directory / f"view-{angle:03d}.png")
        del pipe
        torch.cuda.empty_cache()
        # CPU segmentation is a recorded learned mask, never painted.
        from rembg import new_session, remove
        session = new_session("u2net", providers=["CPUExecutionProvider"])
        weights = Path(os.environ.get("U2NET_HOME", str(Path.home() / ".u2net"))) / "u2net.onnx"
        record["segmentation"] = {"model": "U2Net", "weightsSha256": digest(weights), "weightsBytes": weights.stat().st_size,
                                  "upstreamDigest": "md5:60024c5c889badc19c04ad937298a77b",
                                  "device": "CPU", "limit": "Unreviewed masks can remove foliage or retain shadow; saved explicitly"}
        cutouts = []
        for angle, image in zip(ANGLES, images):
            output = remove(image, session=session).convert("RGBA")
            alpha = np.array(output)[:, :, 3]
            if not np.any(alpha == 0) or not np.any(alpha > 0):
                raise RuntimeError(f"View {angle} segmentation has no foreground or transparent background")
            output.save(directory / f"cutout-{angle:03d}.png")
            output.getchannel("A").save(directory / f"mask-{angle:03d}.png")
            cutouts.append(output)
        make_image_grid(cutouts, rows=2).save(directory / "cutouts.png")
        record["outputs"] = {file.name: {"sha256": digest(file), "bytes": file.stat().st_size}
                             for file in directory.glob("*.png")}
        record["status"] = "succeeded"
    except Exception:
        record["status"] = "failed"
        record["failure"] = traceback.format_exc()
        raise
    finally:
        record["elapsedSeconds"] = time.perf_counter() - start
        persist()
    print(json.dumps({"id": args.id, "status": record["status"], "seconds": record["elapsedSeconds"]}))


if __name__ == "__main__":
    main()
