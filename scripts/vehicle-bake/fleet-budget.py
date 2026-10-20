"""Measure retained normal-fleet GLBs without Blender, rendering or asset writes.

python scripts/vehicle-bake/fleet-budget.py > data/vehicle-bake/fleet-budget.json
python scripts/vehicle-bake/fleet-budget.py --check art-source/vehicle-bake/fleet-budget-153.json
"""

import argparse
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def measure():
    catalog_bytes = (ROOT / "src/traffic/original-vehicles.json").read_bytes()
    rows = []
    for vehicle in json.loads(catalog_bytes)["vehicles"]:
        path = ROOT / "public" / vehicle["mesh"]["path"]
        assert path.resolve().is_relative_to((ROOT / "public/assets").resolve())
        raw = path.read_bytes()
        magic, version, total, size, kind = struct.unpack_from("<IIIII", raw)
        assert (magic, version, total, kind) == (0x46546C67, 2, len(raw), 0x4E4F534A)
        gltf = json.loads(raw[20 : 20 + size])
        triangles = vertices = primitives = 0
        for mesh in gltf["meshes"]:
            for primitive in mesh["primitives"]:
                assert (
                    primitive.get("mode", 4) == 4
                ), "Budget requires triangle primitives"
                count = gltf["accessors"][primitive["attributes"]["POSITION"]]["count"]
                elements = (
                    gltf["accessors"][primitive["indices"]]["count"]
                    if "indices" in primitive
                    else count
                )
                assert elements % 3 == 0
                triangles += elements // 3
                vertices += count
                primitives += 1
        rows.append(
            {
                "id": vehicle["id"],
                "path": vehicle["mesh"]["path"],
                "glbSha256": sha(raw),
                "triangles": triangles,
                "uvSplitVertices": vertices,
                "sourcePrimitives": primitives,
                "glbFileBytes": len(raw),
                "textures": len(gltf.get("textures", [])),
            }
        )
    assert rows
    return {
        "schema": "tilefun-normal-vehicle-budget-v1",
        "catalogSha256": sha(catalog_bytes),
        "measurement": "Actual retained GLB triangle indices, POSITION accessor vertices and source primitives; excludes dynamic contact-shadow/outline passes and does not estimate total GPU cost",
        "summary": {
            "models": len(rows),
            "minTriangles": min(row["triangles"] for row in rows),
            "maxTriangles": max(row["triangles"] for row in rows),
            "totalTriangles": sum(row["triangles"] for row in rows),
            "glbFileBytes": sum(row["glbFileBytes"] for row in rows),
        },
        "vehicles": rows,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    result = measure()
    if args.check:
        assert result == json.loads(
            args.check.read_bytes()
        ), "Retained fleet budget is stale"
        print(json.dumps({"status": "passed", **result["summary"]}))
    else:
        print(json.dumps(result, indent=2))
