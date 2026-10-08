"""Separate inspectable shape exports; raw/provider exports remain untouched."""
import argparse
import json
from pathlib import Path
import numpy as np
import torch
import trimesh
import cumesh
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    for directory in sorted((args.bundle / "runs").glob("triposg-*")):
        record = json.loads((directory / "run.json").read_text())
        if record["status"] != "succeeded":
            continue
        output = directory / "export-inspection"
        if output.exists():
            continue
        if digest(directory / "raw.npz") != record["outputSha256"]["raw.npz"]:
            raise RuntimeError("Raw geometry changed")
        data = np.load(directory / "raw.npz")
        mesh = trimesh.Trimesh(data["vertices"], data["faces"], process=False)
        mesh.remove_unreferenced_vertices()
        input_faces, input_vertices = len(mesh.faces), len(mesh.vertices)
        if len(mesh.faces) > 50000:
            gpu = cumesh.CuMesh()
            gpu.init(torch.tensor(mesh.vertices, dtype=torch.float32, device="cuda"), torch.tensor(mesh.faces, dtype=torch.int32, device="cuda"))
            gpu.simplify(50000)
            vertices, faces = gpu.read()
            mesh = trimesh.Trimesh(vertices.cpu().numpy(), faces.cpu().numpy(), process=False)
            mesh.remove_unreferenced_vertices()
        mesh.visual.vertex_colors = np.tile(np.array([180, 192, 210, 255], dtype=np.uint8), (len(mesh.vertices), 1))
        output.mkdir()
        mesh.export(output / "candidate.glb")
        export = {"sha256": digest(output / "candidate.glb"), "triangles": len(mesh.faces), "vertices": len(mesh.vertices), "inputTriangles": input_faces, "inputReferencedVertices": input_vertices, "textureSize": "none (shape only)", "rawArraysSha256": record["outputSha256"]["raw.npz"], "method": "Remove unreferenced vertices and CuMesh simplify to 50k only for bounded inspection; no repairs or remeshing", "axisConversion": "identity; raw TripoSG Y-up convention confirmed by provider smoke capture", "implementationSha256": digest(__file__), "review": "Unreviewed diagnostic shape; raw mesh and full provider export remain available"}
        (output / "export.json").write_text(json.dumps(export, indent=2) + "\n")
        print(json.dumps({"run": directory.name, "triangles": len(mesh.faces)}), flush=True)


if __name__ == "__main__":
    main()
