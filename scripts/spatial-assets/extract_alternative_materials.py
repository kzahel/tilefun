"""Expose embedded GLB textures and UV arrays as inspectable, hashed data."""
import argparse
import json
from pathlib import Path
import numpy as np
import trimesh
from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    for file in sorted((args.bundle / "runs").glob("*/export/candidate.glb")):
        mesh = trimesh.load(file, force="mesh", process=False)
        if getattr(mesh.visual, "uv", None) is None:
            continue
        directory = file.parent / "materials"
        if directory.exists():
            continue
        directory.mkdir()
        np.savez_compressed(directory / "uv-mesh.npz", vertices=mesh.vertices, faces=mesh.faces, uv=mesh.visual.uv, normals=mesh.vertex_normals)
        material = mesh.visual.material
        names = {"baseColorTexture": "base-color.png", "metallicRoughnessTexture": "metallic-roughness.png", "normalTexture": "normal.png", "image": "diffuse.png"}
        files = {"uv-mesh.npz": digest(directory / "uv-mesh.npz")}
        for key, name in names.items():
            image = getattr(material, key, None)
            if image is not None:
                image.save(directory / name)
                files[name] = digest(directory / name)
        record = {"exportSha256": digest(file), "implementationSha256": digest(__file__), "reader": f"trimesh {trimesh.__version__}; process=False; GLB scene transformed into one mesh", "files": files, "review": "Extracted material data from actual GLB; no new generation or changes to the export"}
        (directory / "index.json").write_text(json.dumps(record, indent=2) + "\n")
        print(json.dumps({"run": file.parent.parent.name, "files": list(files)}))


if __name__ == "__main__":
    main()
