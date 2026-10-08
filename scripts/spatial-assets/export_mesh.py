"""Export a separate simplified PBR candidate from untouched TRELLIS.2 arrays."""
import argparse
import json
from pathlib import Path
import sys
import subprocess
import time

from reference import digest, name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--provider", type=Path, required=True)
    parser.add_argument("--run", type=name, required=True)
    parser.add_argument("--triangles", type=int, default=50000)
    parser.add_argument("--texture-size", type=int, default=1024)
    parser.add_argument("--id", type=name, default="export", help="Fresh export directory within the run")
    parser.add_argument("--remesh", action="store_true", help="Upstream narrow-band remesh, band=1, project=0")
    args = parser.parse_args()
    run = args.bundle / "runs" / args.run
    record = json.loads((run / "run.json").read_text())
    if record["status"] != "succeeded" or "voxel" not in record:
        raise RuntimeError("Successful inference with recorded voxel metadata is required")
    if digest(run / "raw.npz") != record["outputSha256"]["raw.npz"]:
        raise RuntimeError("Raw arrays changed")
    revision = subprocess.check_output(["git", "-C", str(args.provider), "rev-parse", "HEAD"], text=True).strip()
    if revision != record["provider"]["revision"]:
        raise RuntimeError("Export provider differs from inference provider")
    destination = run / args.id
    destination.mkdir(exist_ok=False)
    import numpy as np
    import torch
    sys.path.insert(0, str(args.provider.resolve()))
    import o_voxel
    raw = np.load(run / "raw.npz")
    started = time.perf_counter()
    torch.cuda.reset_peak_memory_stats()
    mesh = o_voxel.postprocess.to_glb(
        vertices=torch.as_tensor(raw["vertices"], device="cuda"),
        faces=torch.as_tensor(raw["faces"], device="cuda"),
        attr_volume=torch.as_tensor(raw["attrs"], device="cuda"),
        coords=torch.as_tensor(raw["coords"], device="cuda"),
        attr_layout={key: slice(*value) for key, value in record["voxel"]["layout"].items()},
        voxel_size=record["voxel"]["size"], aabb=[[-.5] * 3, [.5] * 3],
        decimation_target=args.triangles, texture_size=args.texture_size, remesh=args.remesh,
        remesh_band=1, remesh_project=0, verbose=True)
    mesh.export(destination / "candidate.glb")
    torch.cuda.synchronize()
    export = {"run": args.run, "provider": record["provider"], "implementationSha256": digest(__file__),
              "rawArraysSha256": record["outputSha256"]["raw.npz"], "sha256": digest(destination / "candidate.glb"),
              "triangles": len(mesh.faces), "vertices": len(mesh.vertices), "targetTriangles": args.triangles,
              "textureSize": args.texture_size, "remesh": args.remesh, "remeshBand": 1, "remeshProject": 0,
              "seconds": time.perf_counter() - started,
              "axisConversion": "Raw Z-up [x,y,z] becomes GLB Y-up [x,z,-y] in upstream to_glb",
              "peakAllocatedBytes": torch.cuda.max_memory_allocated(), "peakReservedBytes": torch.cuda.max_memory_reserved(),
              "review": "unreviewed generated appearance and simplified geometry; no promotion",
              "method": "upstream cleaning, decimation, UV unwrapping and PBR voxel-attribute baking",
              "limits": ["Separate export changes topology; raw arrays and clipping bake remain unchanged",
                         "Generated appearance is not original sprite artwork", "Upstream GLB material defaults opaque"]}
    (destination / "export.json").write_text(json.dumps(export, indent=2) + "\n")
    print(json.dumps(export))


if __name__ == "__main__":
    main()
