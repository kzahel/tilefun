"""Compose static embedded GLBs while preserving the base mesh/paint buffers.

The component mount is in Blender world-pixel coordinates (+Z up/-X forward).
This container operation does not fit, resize, decimate or re-export geometry.
It supports the pipeline's single-buffer static assets, not skins or animation.
"""

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
ARRAYS = ("bufferViews", "accessors", "samplers", "images", "textures", "materials", "meshes", "nodes")


def unpack(path):
    data = Path(path).read_bytes()
    magic, version, total = struct.unpack_from("<III", data)
    assert magic == 0x46546C67 and version == 2 and total == len(data)
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + size])
    binary_size, binary_kind = struct.unpack_from("<II", data, 20 + size)
    assert binary_kind == 0x004E4942 and 28 + size + binary_size == len(data)
    binary = data[28 + size:]
    assert len(doc["buffers"]) == 1 and "uri" not in doc["buffers"][0]
    assert doc["buffers"][0]["byteLength"] <= len(binary)
    assert not doc.get("animations") and not doc.get("skins") and not doc.get("cameras")
    assert not doc.get("extensions"), "Root extension indices need explicit support"
    for view in doc.get("bufferViews", []):
        assert view.get("buffer", 0) == 0 and not view.get("extensions")
    for accessor in doc.get("accessors", []):
        assert "sparse" not in accessor, "Sparse accessor remapping is not supported"
    for image in doc.get("images", []):
        assert "bufferView" in image and "uri" not in image
    for texture in doc.get("textures", []):
        assert not texture.get("extensions"), "Compressed texture indices need explicit support"
    for mesh in doc.get("meshes", []):
        for primitive in mesh["primitives"]:
            assert not primitive.get("targets") and not primitive.get("extensions")
    for node in doc.get("nodes", []):
        assert "skin" not in node and "camera" not in node
    return doc, binary, hashlib.sha256(data).hexdigest()


def pack(doc, binary):
    doc = copy.deepcopy(doc)
    doc["buffers"] = [{"byteLength": len(binary)}]
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    return (struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(binary))
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def compose(base_path, component_path, mount, prefix):
    base, base_binary, base_sha = unpack(base_path)
    component, component_binary, component_sha = unpack(component_path)
    assert len(base["scenes"]) == len(component["scenes"]) == 1
    assert len(mount) == 3 and all(isinstance(value, (int, float)) and math.isfinite(value) for value in mount)
    assert isinstance(prefix, str) and prefix and all(node.get("name") != prefix + "_Mount" for node in base.get("nodes", [])), "Component mount namespace already exists"
    result = copy.deepcopy(base)
    offsets = {key: len(base.get(key, [])) for key in ARRAYS}
    addition = copy.deepcopy(component)
    for view in addition.get("bufferViews", []):
        view["byteOffset"] = view.get("byteOffset", 0) + len(base_binary)
        view["buffer"] = 0
    for accessor in addition.get("accessors", []):
        if "bufferView" in accessor:
            accessor["bufferView"] += offsets["bufferViews"]
    for image in addition.get("images", []):
        image["bufferView"] += offsets["bufferViews"]
    for texture in addition.get("textures", []):
        texture["source"] += offsets["images"]
        if "sampler" in texture:
            texture["sampler"] += offsets["samplers"]
    for material in addition.get("materials", []):
        material["name"] = prefix + ":" + material.get("name", "material")
        pbr = material.get("pbrMetallicRoughness", {})
        for owner, names in [(material, ("normalTexture", "emissiveTexture", "occlusionTexture")), (pbr, ("baseColorTexture", "metallicRoughnessTexture"))]:
            for name in names:
                if name in owner:
                    owner[name]["index"] += offsets["textures"]
    for mesh in addition.get("meshes", []):
        for primitive in mesh["primitives"]:
            primitive["attributes"] = {key: value + offsets["accessors"] for key, value in primitive["attributes"].items()}
            if "indices" in primitive:
                primitive["indices"] += offsets["accessors"]
            if "material" in primitive:
                primitive["material"] += offsets["materials"]
    for node in addition.get("nodes", []):
        node["name"] = prefix + ":" + node.get("name", "part")
        if "mesh" in node:
            node["mesh"] += offsets["meshes"]
        if "children" in node:
            node["children"] = [index + offsets["nodes"] for index in node["children"]]
    for key in ARRAYS:
        if key in addition:
            result.setdefault(key, []).extend(addition[key])
    component_roots = component["scenes"][0].get("nodes", [])
    mount_index = len(result["nodes"])
    # Blender-to-glTF basis: [x,y,z] -> [x,z,-y]. Both assets keep their own
    # authored transforms; only this explicit companion socket is new.
    result["nodes"].append({"name": prefix + "_Mount", "children": [index + offsets["nodes"] for index in component_roots], "translation": [mount[0], mount[2], -mount[1]]})
    result["scenes"][0].setdefault("nodes", []).append(mount_index)
    for key in ["extensionsUsed", "extensionsRequired"]:
        for value in component.get(key, []):
            if value not in result.setdefault(key, []):
                result[key].append(value)
    result["asset"] = {**result["asset"], "generator": "Tilefun static GLB component composer v1"}
    result.setdefault("extras", {})["tilefunComposite"] = {"schema": 1, "baseSha256": base_sha, "componentSha256": component_sha, "mountBlenderWorldPixels": list(mount), "componentPrefix": prefix}
    for key in ARRAYS:
        assert result.get(key, [])[:offsets[key]] == base.get(key, []), "Base graph changed: " + key
    binary = base_binary + component_binary
    assert binary[:len(base_binary)] == base_binary
    return pack(result, binary), {"baseSha256": base_sha, "componentSha256": component_sha, "baseArraysPreserved": list(ARRAYS), "baseBinaryPrefixExact": True, "mountBlenderWorldPixels": list(mount), "componentPrefix": prefix}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--component", required=True, type=Path)
    parser.add_argument("--mount", nargs=3, type=float, required=True)
    parser.add_argument("--prefix", default="Companion")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    assert not args.output.exists(), "Use a fresh output; retained revisions are immutable"
    assert args.output.resolve() not in [args.base.resolve(), args.component.resolve()]
    data, receipt = compose(args.base, args.component, args.mount, args.prefix)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    receipt.update(status="composed-not-qualified", modelSha256=hashlib.sha256(data).hexdigest(), modelBytes=len(data))
    args.output.with_suffix(".composition.json").write_bytes((json.dumps(receipt, indent=2) + "\n").encode())
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
