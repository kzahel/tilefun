"""Batch reference editing with isolated pinned FLUX/Qwen checkpoints."""
import argparse
import importlib.metadata
import json
import time
import traceback
from pathlib import Path

from download_alternatives import MODELS
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--model", choices=["flux", "qwen"], required=True)
    parser.add_argument("--assets", nargs="+")
    parser.add_argument("--seeds", nargs="+", type=int, default=[42, 43])
    args = parser.parse_args()
    import torch
    import numpy as np
    from PIL import Image
    from diffusers import Flux2KleinPipeline, QwenImage21Pipeline
    manifest_path = args.bundle / "inputs.json"
    manifest = json.loads(manifest_path.read_text())
    plan = json.loads((args.bundle / "plan.json").read_text())
    if digest(manifest_path) != plan["inputManifestSha256"]:
        raise RuntimeError("Frozen manifest changed")
    download = json.loads((args.bundle / f"download-{args.model}.json").read_text())
    repo, revision = MODELS[args.model]
    if download["status"] != "succeeded" or download["revision"] != revision:
        raise RuntimeError("Download incomplete or wrong revision")
    start = time.perf_counter()
    cls = Flux2KleinPipeline if args.model == "flux" else QwenImage21Pipeline
    pipe = cls.from_pretrained(download["snapshot"], torch_dtype=torch.bfloat16, local_files_only=True)
    pipe.enable_model_cpu_offload()
    if hasattr(pipe.vae, "enable_tiling"):
        pipe.vae.enable_tiling()
    load_seconds = time.perf_counter() - start
    packages = {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()}
    results = []
    for asset in args.assets or plan["assets"]:
        entry = next(x for x in manifest["inputs"] if x["id"] == asset)
        if digest(args.bundle / entry["input"]) != entry["cropSha256"] or digest(args.bundle / entry["enlarged"]) != entry["enlargedSha256"]:
            raise RuntimeError("Frozen image changed")
        rgba = Image.open(args.bundle / entry["enlarged"]).convert("RGBA").resize((1024, 1024), Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", rgba.size, (128, 128, 128, 255))
        canvas.alpha_composite(rgba)
        canvas = canvas.convert("RGB")
        prompt = (args.bundle / "prompts" / f"{asset}.txt").read_text().strip()
        if args.model == "qwen":
            prompt = "This is an RGBA image with transparency. " + prompt.replace("isolated on plain neutral gray", "isolated with transparent background") + " The image has alpha channel and the background is transparent."
        for seed in args.seeds:
            case_id = f"{args.model}-{asset}-s{seed}"
            directory = args.bundle / "references" / case_id
            if directory.exists():
                prior = json.loads((directory / "generation.json").read_text())
                print(json.dumps({"id": case_id, "status": "already-recorded", "priorStatus": prior["status"]}), flush=True)
                continue
            directory.mkdir(parents=True)
            canvas.save(directory / "provider-input.png")
            (directory / "source.png").write_bytes((args.bundle / entry["input"]).read_bytes())
            (directory / "prompt.txt").write_text(prompt + "\n")
            (directory / "edit_alternatives.py").write_bytes(Path(__file__).read_bytes())
            record = {"id": case_id, "asset": asset, "status": "started", "generator": repo, "revision": revision, "prompt": prompt, "inputManifestSha256": digest(manifest_path), "sourceSha256": entry["cropSha256"], "providerInputSha256": digest(directory / "provider-input.png"), "settings": {"seed": seed, "steps": 4 if args.model == "flux" else 40, "size": [1024, 1024], "precision": "bfloat16", "cpuOffload": True, "vaeTiling": True}, "loadSeconds": load_seconds, "packages": packages, "gpu": torch.cuda.get_device_name(), "implementationSha256": digest(__file__), "review": "Unreviewed diagnostic reference; no promotion"}
            def persist():
                (directory / "generation.json").write_text(json.dumps(record, indent=2) + "\n")
            persist()
            started = time.perf_counter()
            torch.cuda.reset_peak_memory_stats()
            print(json.dumps({"id": case_id, "status": "sampling"}), flush=True)
            try:
                kwargs = {"image": canvas, "prompt": prompt, "height": 1024, "width": 1024, "num_inference_steps": record["settings"]["steps"], "generator": torch.Generator("cuda").manual_seed(seed)}
                if args.model == "flux":
                    kwargs["guidance_scale"] = 1.0
                else:
                    kwargs["output_resolution"] = 1024
                output = pipe(**kwargs).images[0]
                torch.cuda.synchronize()
                output.save(directory / "generated-native.png")
                output.convert("RGB").save(directory / "generated-rgb.png")
                record.update(status="generated", outputMode=output.mode, actualSize=list(output.size))
                if output.mode == "RGBA":
                    alpha = np.asarray(output)[:, :, 3]
                    output.getchannel("A").save(directory / "native-alpha.png")
                    record["nativeAlpha"] = {"transparentPixels": int((alpha == 0).sum()), "opaquePixels": int((alpha == 255).sum()), "valid": bool((alpha < 128).any() and (alpha > 128).any())}
                    if record["nativeAlpha"]["valid"]:
                        output.save(directory / "reference.png")
                        record.update(status="registered", file=f"references/{case_id}/reference.png", sha256=digest(directory / "reference.png"), size=list(output.size), segmentation={"model": "native Qwen alpha", "extraMasking": False})
                        (directory / "reference.json").write_text(json.dumps(record, indent=2) + "\n")
                record["outputs"] = {p.name: digest(p) for p in directory.glob("*.png")}
            except Exception:
                record.update(status="failed", failure=traceback.format_exc())
                traceback.print_exc()
            finally:
                record.update(seconds=time.perf_counter() - started, peakAllocatedBytes=torch.cuda.max_memory_allocated(), peakReservedBytes=torch.cuda.max_memory_reserved())
                persist()
                if record["status"] == "registered":
                    (directory / "reference.json").write_text(json.dumps(record, indent=2) + "\n")
                results.append({"id": case_id, "status": record["status"], "seconds": record["seconds"]})
                (args.bundle / f"edit-{args.model}.json").write_text(json.dumps(results, indent=2) + "\n")
                print(json.dumps(results[-1]), flush=True)


if __name__ == "__main__":
    main()
