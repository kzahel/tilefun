"""Existing mesh + registered reference -> TRELLIS texture, keeping shape provenance."""
import argparse
import json
import os
from pathlib import Path
import sys
import time
import traceback

from reference import digest, name
from checkpoints import CHECKPOINT, ENCODER, download_encoder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--mesh", type=Path, required=True, help="Mesh in GLB Y-up axes")
    parser.add_argument("--reference", type=name, required=True)
    parser.add_argument("--id", type=name, required=True)
    parser.add_argument("--preserve-uv", action="store_true", help="Retain provided UVs across upstream normalization; avoid unnecessary CuMesh unwrap")
    args = parser.parse_args()
    directory = args.bundle / "runs" / args.id
    directory.mkdir(parents=True, exist_ok=False)
    record = {"id": args.id, "status": "started", "generator": "TRELLIS.2 existing-mesh texturing", "implementationSha256": digest(__file__), "meshInputSha256": digest(args.mesh), "meshInput": str(args.mesh), "settings": {"resolution": 512, "textureSize": 1024, "steps": 12, "seed": 42}, "checkpointRevision": CHECKPOINT, "encoderRevision": ENCODER, "review": "Unreviewed inferred texture; existing mesh shape is the input"}
    start = time.perf_counter()
    torch = None
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
        from huggingface_hub import snapshot_download
        from trellis2.pipelines import Trellis2TexturingPipeline, rembg
        checkpoint = snapshot_download("microsoft/TRELLIS.2-4B", revision=CHECKPOINT, allow_patterns=["texturing_pipeline.json", "ckpts/shape_enc_next_dc_f16c32_fp16.*", "ckpts/tex_dec_next_dc_f16c32_fp16.*", "ckpts/slat_flow_imgshape2tex_dit_1_3B_512_bf16.*"], max_workers=2)
        config = json.loads((Path(checkpoint) / "texturing_pipeline.json").read_text())
        config["args"]["models"] = {key: str(Path(checkpoint) / value) for key, value in config["args"]["models"].items() if "1024" not in key}
        config["args"]["image_cond_model"]["args"]["model_name"] = download_encoder()
        config["args"]["rembg_model"] = {"name": "AlphaProvided", "args": {}}
        config["args"]["low_vram"] = True
        rembg.AlphaProvided = lambda: None
        (directory / "pipeline.json").write_text(json.dumps(config, indent=2) + "\n")
        reference_path = args.bundle / "references" / args.reference / "reference.json"
        reference = json.loads(reference_path.read_text())
        source = args.bundle / reference["file"]
        if reference["inputManifestSha256"] != digest(args.bundle / "inputs.json") or digest(source) != reference["sha256"]:
            raise RuntimeError("Registered source changed")
        record["input"] = {"asset": reference["asset"], "mode": "existing-shape-texturing", "reference": args.reference, "sha256": reference["sha256"], "manifestSha256": digest(args.bundle / "inputs.json")}
        (directory / "input.png").write_bytes(source.read_bytes())
        (directory / "texture_shape_alternatives.py").write_bytes(Path(__file__).read_bytes())
        pipeline = Trellis2TexturingPipeline.from_pretrained(str(directory))
        pipeline.cuda()
        if args.preserve_uv:
            import hashlib
            import inspect
            import textwrap
            import types
            upstream_preprocess = pipeline.preprocess_mesh
            def retain_uv(mesh):
                normalized = upstream_preprocess(mesh)
                if getattr(mesh.visual, "uv", None) is None:
                    raise RuntimeError("UV-preserving route requires supplied UVs")
                if not np.array_equal(normalized.faces, mesh.faces):
                    raise RuntimeError("Normalization changed face order")
                normalized.visual = trimesh.visual.texture.TextureVisuals(uv=mesh.visual.uv.copy())
                return normalized
            pipeline.preprocess_mesh = retain_uv
            # The provided-UV branch mutates Trimesh's read-only normal array.
            original_postprocess = textwrap.dedent(inspect.getsource(pipeline.postprocess_mesh))
            if original_postprocess.count("normals = mesh.vertex_normals") != 1:
                raise RuntimeError("Upstream postprocessor changed; review adaptation")
            adapted = original_postprocess.replace("normals = mesh.vertex_normals", "normals = mesh.vertex_normals.copy()")
            namespace = pipeline.postprocess_mesh.__func__.__globals__.copy()
            exec(compile(adapted, "adapted_postprocess_mesh.py", "exec"), namespace)
            pipeline.postprocess_mesh = types.MethodType(namespace["postprocess_mesh"], pipeline)
            (directory / "adapted_postprocess_mesh.py").write_text(adapted)
            record["postprocessAdaptation"] = {"upstreamSha256": hashlib.sha256(original_postprocess.encode()).hexdigest(), "adaptedSha256": hashlib.sha256(adapted.encode()).hexdigest()}
            record["adaptations"] = ["Retain existing per-vertex UVs across upstream mesh normalization; upstream reconstructs Trimesh without UVs. No geometry changes; skip unnecessary unwrap.", "Copy read-only Trimesh vertex normals before the upstream GLB axis conversion; provider checkout remains unchanged."]
        image = pipeline.preprocess_image(Image.open(source))
        image.save(directory / "provider-input.png")
        mesh = trimesh.load(args.mesh, force="mesh")
        torch.cuda.reset_peak_memory_stats()
        textured = pipeline.run(mesh, image, seed=42, resolution=512, texture_size=1024, preprocess_image=False, tex_slat_sampler_params={"steps": 12})
        torch.cuda.synchronize()
        textured.export(directory / "raw.glb")
        np.savez_compressed(directory / "raw.npz", vertices=textured.vertices, faces=textured.faces)
        # Verify that texturing only normalizes/duplicates surface vertices, rather than deforming shape.
        from scipy.spatial import cKDTree
        source_vertices = mesh.vertices.copy()
        center = (source_vertices.min(axis=0) + source_vertices.max(axis=0)) / 2
        scale = .99999 / np.ptp(source_vertices, axis=0).max()
        normalized_vertices = (source_vertices - center) * scale
        errors = cKDTree(normalized_vertices).query(textured.vertices)[0]
        record["shapePreservation"] = {"normalizationCenter": center.tolist(), "normalizationScale": scale, "maximumVertexDistance": float(errors.max()), "inputTriangles": len(mesh.faces), "outputTriangles": len(textured.faces), "measurement": "Nearest normalized input vertex; UV duplicates allowed. Does not establish artwork fidelity."}
        output = directory / "export"
        output.mkdir()
        textured.export(output / "candidate.glb")
        (output / "export.json").write_text(json.dumps({"sha256": digest(output / "candidate.glb"), "triangles": len(textured.faces), "textureSize": 1024, "parentMeshSha256": record["meshInputSha256"], "method": "TRELLIS existing-mesh shape encoding, texture generation and UV atlas; no shape diffusion", "review": record["review"]}, indent=2) + "\n")
        record.update(status="succeeded", outputSha256={n: digest(directory / n) for n in ["raw.npz", "raw.glb", "provider-input.png"]})
    except Exception:
        record.update(status="failed", failure=traceback.format_exc())
        traceback.print_exc()
    finally:
        record["elapsedSeconds"] = time.perf_counter() - start
        if torch is not None and torch.cuda.is_available():
            record.update(peakAllocatedBytes=torch.cuda.max_memory_allocated(), peakReservedBytes=torch.cuda.max_memory_reserved())
        (directory / "run.json").write_text(json.dumps(record, indent=2) + "\n")
        print(json.dumps({"id": args.id, "status": record["status"], "seconds": record["elapsedSeconds"]}), flush=True)


if __name__ == "__main__":
    main()
