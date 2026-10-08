"""Pinned TRELLIS.2 512-resolution smoke runner. Models live outside Tilefun."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time
import traceback

from checkpoints import download_encoder, download_public, verify_local_encoder


def digest(path):
    sha256 = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            sha256.update(block)
    return sha256.hexdigest()


def git_revision(path):
    return subprocess.check_output(["git", "-C", str(path), "rev-parse", "HEAD"], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--asset", default="oak-tree")
    parser.add_argument("--example", type=Path)
    parser.add_argument("--reference-record", type=Path, help="Registered generated conditioning image; original sprite remains the fitting target")
    parser.add_argument("--id", required=True)
    parser.add_argument("--checkpoint-revision", required=True)
    parser.add_argument("--encoder-revision", required=True)
    parser.add_argument("--encoder-dir", type=Path, help="Local encoder snapshot downloaded through the authorized browser")
    parser.add_argument("--structure-revision", required=True)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--steps", type=int, default=12)
    parser.add_argument("--input-mode", choices=["original", "nn512"], default="nn512")
    args = parser.parse_args()
    if args.example and args.reference_record:
        parser.error("example and reference-record are mutually exclusive")
    if Path(args.id).name != args.id or args.id in (".", ".."):
        parser.error("id must be a single directory name")
    args.bundle = args.bundle.resolve()
    run = args.bundle / "runs" / args.id
    run.mkdir(parents=True, exist_ok=False)
    record = {
        "id": args.id,
        "status": "started",
        "review": "unreviewed diagnostic; generated geometry, no promotion",
        "provider": {"name": "TRELLIS.2", "revision": git_revision(args.provider)},
        "imageEncoder": {"name": "facebook/dinov3-vitl16-pretrain-lvd1689m", "revision": args.encoder_revision},
        "tilefunRevision": git_revision(Path(__file__).resolve().parents[2]),
        "implementationSha256": {name: digest(Path(__file__).parent / name)
                                 for name in ["infer.py", "checkpoints.py"]},
        "checkpoint": {"name": "microsoft/TRELLIS.2-4B", "revision": args.checkpoint_revision,
                       "structureDecoderRevision": args.structure_revision},
        "settings": {"seed": args.seed, "steps": args.steps, "pipelineType": "512",
                     "attention": "xformers", "convolution": "flex_gemm", "lowVram": True},
        "startedUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "environment": {"python": platform.python_version(), "platform": platform.platform(),
                        "packages": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()}},
        "artifacts": {},
        "failures": [],
        "corrections": [],
    }
    start = time.perf_counter()
    torch = None
    for name in ["infer.py", "checkpoints.py"]:
        (run / name).write_bytes((Path(__file__).parent / name).read_bytes())
    (run / "run.json").write_text(json.dumps(record, indent=2) + "\n")
    try:
        os.environ["ATTN_BACKEND"] = "xformers"
        os.environ["SPARSE_ATTN_BACKEND"] = "xformers"
        os.environ["SPARSE_CONV_BACKEND"] = "flex_gemm"
        os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
        sys.path.insert(0, str(args.provider.resolve()))
        import torch
        import numpy as np
        import trimesh
        from PIL import Image
        from trellis2.pipelines import Trellis2ImageTo3DPipeline, rembg

        if not torch.cuda.is_available():
            raise RuntimeError("CUDA unavailable")
        record["environment"].update({"torch": torch.__version__, "cudaRuntime": torch.version.cuda,
                                      "gpu": torch.cuda.get_device_name(),
                                      "gpuMemoryBytes": torch.cuda.get_device_properties(0).total_memory,
                                      "freeVramBeforeBytes": torch.cuda.mem_get_info()[0]})
        record["environment"]["nvidiaSmi"] = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,driver_version,memory.total,memory.free", "--format=csv,noheader"],
            text=True).strip()
        if args.example:
            source = args.example.resolve()
            record["input"] = {"role": "provider smoke example", "sha256": digest(source)}
        else:
            manifest = json.loads((args.bundle / "inputs.json").read_text())
            entry = next(item for item in manifest["inputs"] if item["id"] == args.asset)
            if args.reference_record:
                reference = json.loads(args.reference_record.read_text())
                if reference["status"] != "registered" or reference["asset"] != args.asset:
                    raise RuntimeError("Reference does not belong to requested asset")
                if reference["inputManifestSha256"] != digest(args.bundle / "inputs.json"):
                    raise RuntimeError("Reference belongs to a different source manifest")
                source = (args.bundle / reference["file"]).resolve()
                source.relative_to(args.bundle)
                expected = reference["sha256"]
                mode = "generated-reference"
                record["conditioningReference"] = reference
                (run / "reference.json").write_bytes(args.reference_record.read_bytes())
            else:
                input_key = "input" if args.input_mode == "original" else "enlarged"
                source = args.bundle / entry[input_key]
                expected = entry["cropSha256"] if args.input_mode == "original" else entry["enlargedSha256"]
                mode = args.input_mode
            if digest(source) != expected:
                raise RuntimeError("Input hash mismatch")
            record["input"] = {"asset": args.asset, "mode": mode, "manifestSha256": digest(args.bundle / "inputs.json"),
                               "file": str(source.relative_to(args.bundle)), "sha256": expected, "source": entry}
        (run / "input.png").write_bytes(source.read_bytes())
        record["artifacts"]["input"] = "input.png"
        checkpoint_start = time.perf_counter()
        # Gate preflight first: do not download large generators when access is unavailable.
        if args.encoder_dir:
            encoder = str(args.encoder_dir.resolve())
            files = list(Path(encoder).glob("*.safetensors"))
            if not (Path(encoder) / "config.json").is_file() or not files:
                raise RuntimeError("Local encoder requires config.json and safetensors weights")
            record["imageEncoder"]["verifiedLocalFiles"] = verify_local_encoder(encoder, args.encoder_revision)
            record["imageEncoder"]["verification"] = "local sizes and Git/LFS checksums match Hub metadata at the requested immutable revision"
        else:
            encoder = download_encoder(args.encoder_revision)
            record["imageEncoder"]["verifiedLocalFiles"] = verify_local_encoder(encoder, args.encoder_revision)
            record["imageEncoder"]["verification"] = "Hub snapshot sizes and Git/LFS checksums match the requested immutable revision"
        checkpoint, structure = download_public(args.checkpoint_revision, args.structure_revision)
        # Record the exact configuration adaptation; upstream code/weights stay untouched.
        config = json.loads((Path(checkpoint) / "pipeline.json").read_text())
        original_config_sha = digest(Path(checkpoint) / "pipeline.json")
        model_names = [k for k in config["args"]["models"] if "1024" not in k]
        for k in model_names:
            value = config["args"]["models"][k]
            config["args"]["models"][k] = str(Path(structure) / "ckpts/ss_dec_conv3d_16l8_fp16") if k == "sparse_structure_decoder" else str(Path(checkpoint) / value)
        config["args"]["models"] = {k: config["args"]["models"][k] for k in model_names}
        config["args"]["image_cond_model"]["args"]["model_name"] = encoder
        config["args"]["rembg_model"] = {"name": "AlphaProvided", "args": {}}
        config["args"]["low_vram"] = True
        config["args"]["default_pipeline_type"] = "512"
        rembg.AlphaProvided = lambda: None
        (run / "pipeline.json").write_text(json.dumps(config, indent=2))
        record["configuration"] = {"upstreamSha256": original_config_sha,
                                   "adaptations": ["load 512 models only", "pin all weight paths", "skip unused gated background remover; require source RGBA alpha", "low VRAM"]}
        record["downloadSeconds"] = time.perf_counter() - checkpoint_start
        load_start = time.perf_counter()
        pipeline = Trellis2ImageTo3DPipeline.from_pretrained(str(run))
        pipeline.cuda()
        torch.cuda.synchronize()
        record["loadSeconds"] = time.perf_counter() - load_start
        record["loadPeakAllocatedBytes"] = torch.cuda.max_memory_allocated()
        record["loadPeakReservedBytes"] = torch.cuda.max_memory_reserved()
        print(f"Loaded pinned pipeline in {record['loadSeconds']:.2f}s", flush=True)
        original_image = Image.open(source)
        if original_image.mode != "RGBA" or np.all(np.array(original_image)[:, :, 3] == 255):
            raise RuntimeError("This runner requires existing transparent alpha; background removal is a separate lane")
        image = pipeline.preprocess_image(original_image)
        image.save(run / "provider-input.png")
        record["artifacts"]["providerInput"] = "provider-input.png"
        record["preprocessing"] = "TRELLIS.2 alpha bbox >0.8, square crop with no extra padding, alpha composite on black; encoder Lanczos to 512; saved provider crop"
        torch.cuda.reset_peak_memory_stats()
        record["memoryMeasurement"] = "load peak recorded separately; final peak counters cover inference and export"
        inference_start = time.perf_counter()
        outputs = pipeline.run(image, seed=args.seed, pipeline_type="512", preprocess_image=False,
                               sparse_structure_sampler_params={"steps": args.steps},
                               shape_slat_sampler_params={"steps": args.steps},
                               tex_slat_sampler_params={"steps": args.steps})
        torch.cuda.synchronize()
        record["inferenceSeconds"] = time.perf_counter() - inference_start
        result = outputs[0]
        record["voxel"] = {"origin": result.origin.cpu().tolist(), "size": result.voxel_size,
                           "shape": list(result.voxel_shape),
                           "layout": {key: [value.start, value.stop] for key, value in result.layout.items()}}
        vertices = result.vertices.cpu().numpy()
        faces = result.faces.cpu().numpy()
        if len(faces) == 0:
            raise RuntimeError("Empty generated mesh")
        # Preserve untouched arrays and vertex attributes before any fit/simplification.
        np.savez_compressed(run / "raw.npz", vertices=vertices, faces=faces,
                            coords=result.coords.cpu().numpy(), attrs=result.attrs.cpu().numpy())
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        mesh.export(run / "raw.glb")
        record["artifacts"].update({"rawArrays": "raw.npz", "rawMesh": "raw.glb"})
        record["mesh"] = {"vertices": len(vertices), "triangles": len(faces),
                          "bounds": mesh.bounds.tolist(), "watertight": bool(mesh.is_watertight),
                          "materials": 0, "textures": 0, "axisConvention": "provider raw; fit recorded separately",
                          "appearance": "PBR voxel attributes in raw.npz; geometry-only GLB"}
        record["outputSha256"] = {name: digest(run / name) for name in ["raw.npz", "raw.glb", "provider-input.png"]}
        record["status"] = "succeeded"
    except Exception:
        record["status"] = "failed"
        record["failures"].append(traceback.format_exc())
        traceback.print_exc()
    finally:
        record["elapsedSeconds"] = time.perf_counter() - start
        if torch is not None and torch.cuda.is_available():
            record["peakAllocatedBytes"] = torch.cuda.max_memory_allocated()
            record["peakReservedBytes"] = torch.cuda.max_memory_reserved()
        (run / "run.json").write_text(json.dumps(record, indent=2) + "\n")
        print(json.dumps({k: record[k] for k in ["id", "status", "elapsedSeconds"]}))
    return 0 if record["status"] == "succeeded" else 1


if __name__ == "__main__":
    sys.exit(main())
