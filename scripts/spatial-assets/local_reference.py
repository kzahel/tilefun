"""Local SDXL img2img interpretation of original sprite, with saved U2Net alpha."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import time
import traceback

from reference import digest, name
from local_views import MODELS, negative_prompt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--id", type=name, required=True)
    parser.add_argument("--prompt", type=Path, required=True)
    parser.add_argument("--strength", type=float, default=.8)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    negative = negative_prompt(args.asset)
    if not 0 < args.strength <= 1:
        parser.error("strength must be in (0,1]")
    directory = args.bundle / "references" / args.id
    directory.mkdir(parents=True, exist_ok=False)
    manifest_path = args.bundle / "inputs.json"
    manifest = json.loads(manifest_path.read_text())
    entry = next(item for item in manifest["inputs"] if item["id"] == args.asset)
    original = args.bundle / entry["input"]
    enlarged = args.bundle / entry["enlarged"]
    if digest(original) != entry["cropSha256"] or digest(enlarged) != entry["enlargedSha256"]:
        raise RuntimeError("Original/enlarged source pixels changed")
    prompt = args.prompt.read_text().strip()
    record = {"id": args.id, "status": "started", "asset": args.asset,
              "generator": "Local SDXL img2img + U2Net", "models": {key: MODELS[key] for key in ("base", "vae")},
              "inputManifestSha256": digest(manifest_path), "sourceSha256": entry["cropSha256"],
              "sourceRgbaSha256": entry["cropRgbaSha256"], "enlargedSha256": entry["enlargedSha256"],
              "prompt": prompt, "negativePrompt": negative, "implementationSha256": digest(__file__),
              "settings": {"seed": args.seed, "steps": 50, "strength": args.strength, "guidanceScale": 5, "size": [1024, 1024]},
              "review": "unreviewed conditioning hypothesis; never replacement sprite art",
              "semanticLimit": "Generated alpha does not label the original painted shadow",
              "packages": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()}}
    (directory / "source.png").write_bytes(original.read_bytes())
    (directory / "prompt.txt").write_text(prompt + "\n")
    (directory / "local_reference.py").write_bytes(Path(__file__).read_bytes())
    for helper in ("local_views.py", "reference.py"):
        source = Path(__file__).with_name(helper)
        (directory / helper).write_bytes(source.read_bytes())
    record["helperSha256"] = {helper: digest(Path(__file__).with_name(helper)) for helper in ("local_views.py", "reference.py")}

    def persist():
        (directory / "generation.json").write_text(json.dumps(record, indent=2) + "\n")

    persist()
    started = time.perf_counter()
    try:
        import numpy as np
        from PIL import Image
        import torch
        from huggingface_hub import snapshot_download
        from diffusers import AutoencoderKL, StableDiffusionXLImg2ImgPipeline
        base = snapshot_download(MODELS["base"][0], revision=MODELS["base"][1],
                                 allow_patterns=["model_index.json", "**/*.json", "tokenizer/*", "tokenizer_2/*", "**/*.fp16.safetensors"], max_workers=2)
        vae = snapshot_download(MODELS["vae"][0], revision=MODELS["vae"][1],
                                allow_patterns=["config.json", "diffusion_pytorch_model.safetensors"], max_workers=2)
        pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(base, variant="fp16", torch_dtype=torch.float16,
                                                               vae=AutoencoderKL.from_pretrained(vae), add_watermarker=False)
        pipe.to(device="cuda", dtype=torch.float16)
        pipe.enable_vae_slicing()
        for tokenizer in (pipe.tokenizer, pipe.tokenizer_2):
            for text in (prompt, negative):
                if len(tokenizer(text, truncation=False)["input_ids"]) > tokenizer.model_max_length:
                    raise RuntimeError("Prompt exceeds CLIP token budget")
        input_image = Image.open(enlarged).convert("RGBA").resize((1024, 1024), Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", input_image.size, (128, 128, 128, 255))
        canvas.alpha_composite(input_image)
        canvas = canvas.convert("RGB")
        canvas.save(directory / "provider-input.png")
        record["preprocessing"] = "Manifest NN512 RGBA input, nearest to 1024, original alpha over neutral RGB128"
        record["gpu"] = torch.cuda.get_device_name()
        record["loadAndDownloadSeconds"] = time.perf_counter() - started
        print("Loaded local SDXL img2img", flush=True)
        torch.cuda.reset_peak_memory_stats()
        sampling_start = time.perf_counter()
        output = pipe(prompt=prompt, negative_prompt=negative, image=canvas, strength=args.strength,
                      num_inference_steps=50, guidance_scale=5,
                      generator=torch.Generator(device="cuda").manual_seed(args.seed)).images[0]
        torch.cuda.synchronize()
        record["generationSeconds"] = time.perf_counter() - sampling_start
        record["peakAllocatedBytes"] = torch.cuda.max_memory_allocated()
        record["peakReservedBytes"] = torch.cuda.max_memory_reserved()
        output.save(directory / "generated-rgb.png")
        del pipe
        torch.cuda.empty_cache()
        from rembg import new_session, remove
        session = new_session("u2net", providers=["CPUExecutionProvider"])
        cutout = remove(output, session=session).convert("RGBA")
        alpha = np.array(cutout)[:, :, 3]
        if not np.any(alpha > 0) or not np.any(alpha == 0):
            raise RuntimeError("Segmentation must produce foreground and transparent background")
        cutout.save(directory / "reference.png")
        cutout.getchannel("A").save(directory / "mask.png")
        weights = Path(os.environ.get("U2NET_HOME", str(Path.home() / ".u2net"))) / "u2net.onnx"
        record.update({"status": "registered", "file": f"references/{args.id}/reference.png",
                       "sha256": digest(directory / "reference.png"), "size": list(cutout.size),
                       "generationControl": "Pinned local model revisions, seed, strength and preprocessing",
                       "segmentation": {"model": "U2Net", "weightsSha256": digest(weights),
                                        "upstreamDigest": "md5:60024c5c889badc19c04ad937298a77b", "device": "CPU"},
                       "outputs": {file.name: digest(file) for file in directory.glob("*.png")}})
    except Exception:
        record["status"] = "failed"
        record["failure"] = traceback.format_exc()
        raise
    finally:
        record["elapsedSeconds"] = time.perf_counter() - started
        persist()
        if record["status"] == "registered":
            (directory / "reference.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"id": args.id, "status": record["status"], "seconds": record["elapsedSeconds"]}))


if __name__ == "__main__":
    main()
