"""Direct TripoSG geometry; original alpha, official preprocessing, raw outputs."""
import argparse
import importlib.metadata
import json
import subprocess
import sys
import time
import traceback
from pathlib import Path

from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--assets", nargs="+")
    parser.add_argument("--references", nargs="+", help="Additional registered references, instead of original sprites")
    parser.add_argument("--decoder", choices=["flash", "hierarchical"], default="flash")
    parser.add_argument("--example", type=Path, help="Explicit alpha-preserving provider smoke input")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--jobs", type=Path, help="Frozen job list: reference, id, seed, optional prepared image and hash")
    args = parser.parse_args()
    import torch
    import numpy as np
    import trimesh
    from PIL import Image
    sys.path.insert(0, str(args.provider.resolve()))
    sys.path.insert(0, str(args.provider.resolve() / "scripts"))
    from triposg.pipelines.pipeline_triposg import TripoSGPipeline
    from image_process import prepare_image
    manifest_path = args.bundle / "inputs.json"
    manifest = json.loads(manifest_path.read_text())
    plan = json.loads((args.bundle / "plan.json").read_text())
    if digest(manifest_path) != plan["inputManifestSha256"]:
        raise RuntimeError("Frozen manifest changed")
    download = json.loads((args.bundle / "download-triposg.json").read_text())
    if download["status"] != "succeeded":
        raise RuntimeError("Weights incomplete")
    jobs = []
    if args.jobs:
        for job in json.loads(args.jobs.read_text()):
            ref = job["reference"]
            r = json.loads((args.bundle / "references" / ref / "reference.json").read_text())
            if r["status"] != "registered" or r["inputManifestSha256"] != digest(manifest_path):
                raise RuntimeError("Invalid registered reference")
            jobs.append((r["asset"], args.bundle / r["file"], r["sha256"], ref, job))
    elif args.example:
        jobs.append(("provider-example", args.example, digest(args.example), "smoke"))
    elif args.references:
        for ref in args.references:
            r = json.loads((args.bundle / "references" / ref / "reference.json").read_text())
            if r["status"] != "registered" or r["inputManifestSha256"] != digest(manifest_path):
                raise RuntimeError("Invalid registered reference")
            jobs.append((r["asset"], args.bundle / r["file"], r["sha256"], ref))
    else:
        for asset in args.assets or plan["assets"]:
            entry = next(x for x in manifest["inputs"] if x["id"] == asset)
            jobs.append((asset, args.bundle / entry["input"], entry["cropSha256"], "original"))
    started = time.perf_counter()
    pipe = TripoSGPipeline.from_pretrained(download["snapshot"], torch_dtype=torch.float16, local_files_only=True).to("cuda", torch.float16)
    load_seconds = time.perf_counter() - started
    revision = subprocess.check_output(["git", "-C", str(args.provider), "rev-parse", "HEAD"], text=True).strip()
    results = []
    for entry in jobs:
        asset, source, expected, label = entry[:4]
        job = entry[4] if len(entry) > 4 else {}
        seed = job.get("seed", args.seed)
        if digest(source) != expected:
            raise RuntimeError("Input changed")
        case_id = f"triposg-{asset}-{label}" + ("-hierarchical" if args.decoder == "hierarchical" else "")
        if seed != 42:
            case_id += f"-s{seed}"
        case_id = job.get("id", case_id)
        directory = args.bundle / "runs" / case_id
        if directory.exists():
            print(json.dumps({"id": case_id, "status": "already-recorded"}), flush=True)
            continue
        directory.mkdir(parents=True)
        (directory / Path(__file__).name).write_bytes(Path(__file__).read_bytes())
        alpha = np.asarray(Image.open(source).convert("RGBA"))[:, :, 3]
        if (alpha < 13).mean() < .01 or (alpha >= 243).mean() < .01:
            raise RuntimeError("TripoSG supplied-alpha histogram would trigger learned segmentation")
        (directory / "input.png").write_bytes(source.read_bytes())
        record = {"id": case_id, "status": "started", "provider": {"name": "TripoSG", "revision": revision}, "checkpoint": {"name": download["repo"], "revision": download["revision"]}, "input": {"asset": asset, "mode": label, "manifestSha256": digest(manifest_path), "sha256": expected}, "settings": {"seed": seed, "steps": 50, "guidanceScale": 7, "tokens": 2048, "flashOctreeDepth": 9, "dtype": "float16"}, "loadSeconds": load_seconds, "preprocessing": "Official prepare_image: validated supplied alpha, all-foreground bbox, white composite, 10 percent padding; unused learned RMBG is not loaded", "preprocessingSha256": digest(args.provider / "scripts/image_process.py"), "implementationSha256": digest(__file__), "packages": {d.metadata["Name"]: d.version for d in importlib.metadata.distributions()}, "review": "Unreviewed shape hypothesis; raw geometry has no generated texture"}
        if args.jobs:
            record.update(job=job, jobListSha256=digest(args.jobs))
        def persist():
            (directory / "run.json").write_text(json.dumps(record, indent=2) + "\n")
        persist()
        begin = time.perf_counter()
        torch.cuda.reset_peak_memory_stats()
        print(json.dumps({"id": case_id, "status": "sampling"}), flush=True)
        try:
            if job.get("preparedImage"):
                prepared = args.bundle / job["preparedImage"]
                if digest(prepared) != job["preparedSha256"]:
                    raise RuntimeError("Prepared input changed")
                image = Image.open(prepared).convert("RGB")
                record["preprocessing"] = "Frozen common-frame RGB supplied directly; white composite/padding as official prepare_image, bbox fixed across masks"
                record["framingProtocol"] = job["framingProtocol"]
            else:
                image = prepare_image(str(source), bg_color=np.array([1., 1., 1.]), rmbg_net=None)
            image.save(directory / "provider-input.png")
            record["settings"].update(decoder=args.decoder, denseOctreeDepth=7 if args.decoder == "hierarchical" else None, hierarchicalOctreeDepth=8 if args.decoder == "hierarchical" else None)
            outputs = pipe(image=image, generator=torch.Generator("cuda").manual_seed(seed), num_inference_steps=50, guidance_scale=7., use_flash_decoder=args.decoder == "flash", dense_octree_depth=7, hierarchical_octree_depth=8).samples[0]
            torch.cuda.synchronize()
            vertices, faces = outputs[0].astype(np.float32), np.ascontiguousarray(outputs[1]).astype(np.int32)
            np.savez_compressed(directory / "raw.npz", vertices=vertices, faces=faces)
            mesh = trimesh.Trimesh(vertices, faces, process=False)
            mesh.export(directory / "raw.glb")
            record.update(status="succeeded", mesh={"vertices": len(vertices), "triangles": len(faces), "bounds": mesh.bounds.tolist(), "watertight": bool(mesh.is_watertight), "appearance": "geometry only; no generated texture", "axisConvention": "raw provider axes"}, outputSha256={n: digest(directory / n) for n in ["raw.npz", "raw.glb", "provider-input.png"]})
            export = directory / "export"
            export.mkdir()
            # Unreferenced vertices affect renderer bounds but do not define any surface.
            mesh.remove_unreferenced_vertices()
            mesh.visual.vertex_colors = np.tile(np.array([180, 192, 210, 255], dtype=np.uint8), (len(mesh.vertices), 1))
            mesh.export(export / "candidate.glb")
            (export / "export.json").write_text(json.dumps({"sha256": digest(export / "candidate.glb"), "triangles": len(faces), "textureSize": "none (shape only)", "transform": "identity; raw provider axes; inspect orientation before alignment", "postprocessing": "Remove unreferenced vertices for bounds only; raw arrays preserved", "review": record["review"]}, indent=2) + "\n")
        except Exception:
            record.update(status="failed", failure=traceback.format_exc())
            traceback.print_exc()
        finally:
            record.update(elapsedSeconds=time.perf_counter() - begin, peakAllocatedBytes=torch.cuda.max_memory_allocated(), peakReservedBytes=torch.cuda.max_memory_reserved())
            persist()
            results.append({"id": case_id, "asset": asset, "status": record["status"], "seconds": record["elapsedSeconds"]})
            (args.bundle / f"triposg-{args.decoder}-execution.json").write_text(json.dumps(results, indent=2) + "\n")
            print(json.dumps(results[-1]), flush=True)


if __name__ == "__main__":
    main()
