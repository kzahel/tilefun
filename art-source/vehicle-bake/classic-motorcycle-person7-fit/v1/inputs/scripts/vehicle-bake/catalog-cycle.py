"""Explicit motorcycle-v1 GLB audit: true F/R or F/R/SC, never corner stubs.

The material/mesh counting contract is deliberately copied from catalog.py;
calling that immutable four-corner audit would incorrectly require fake wheels.
This adapter adds strict active-graph, marked-root and wheel ownership checks.
"""

import hashlib
import json
import math
from pathlib import Path
import re
import struct

SUPPORTED = (("F", "R"), ("F", "R", "SC"))


def validate_ids(wheel_ids):
    assert isinstance(wheel_ids, (list, tuple)), "Explicit cycle wheelIds required"
    expected = tuple(wheel_ids)
    assert expected in SUPPORTED, (
        "Supported cycle inventories: F/R or F/R/SC",
        expected,
    )
    return expected


def number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def read_glb(path):
    data = Path(path).read_bytes()
    assert len(data) >= 20, "Truncated GLB"
    magic, version, length = struct.unpack_from("<III", data)
    assert (
        magic == 0x46546C67 and version == 2 and length == len(data)
    ), "Invalid GLB header"
    size, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A and size <= len(data) - 20, "Invalid GLB JSON chunk"
    return data, json.loads(data[20 : 20 + size])


def audit_glb(path, wheel_ids):
    expected = validate_ids(wheel_ids)
    data, gltf = read_glb(path)
    nodes = gltf.get("nodes", [])
    active, parents, seen = [], {}, set()

    def visit(index, parent=None):
        assert (
            isinstance(index, int)
            and not isinstance(index, bool)
            and 0 <= index < len(nodes)
        )
        assert index not in seen, "Cycle or multiple parents in exported graph"
        seen.add(index)
        active.append(index)
        parents[index] = parent
        for child in nodes[index].get("children", []):
            visit(child, index)

    for index in gltf["scenes"][gltf.get("scene", 0)].get("nodes", []):
        visit(index)
    roots = [
        i
        for i in active
        if nodes[i].get("name") == "Motorcycle_Root"
        or "tilefun_motorcycle" in nodes[i].get("extras", {})
    ]
    assert len(roots) == 1, "Exactly one marked Motorcycle_Root required"
    root = roots[0]
    extras = nodes[root].get("extras", {})
    assert nodes[root].get("name") == "Motorcycle_Root", "Misnamed motorcycle root"
    assert (
        number(extras.get("tilefun_motorcycle")) and extras["tilefun_motorcycle"] == 1
    ), "Motorcycle marker must be numeric 1"
    assert extras.get("wheel_ids") == list(
        expected
    ), "Root/config wheel inventory mismatch"
    assert not any(
        "tilefun_watercraft" in nodes[i].get("extras", {}) for i in active
    ), "Ambiguous boat/cycle markers"

    def descendant(index, ancestor):
        while index is not None:
            if index == ancestor:
                return True
            index = parents[index]
        return False

    rolls, steers = {}, {}
    for i in active:
        node = nodes[i]
        name = node.get("name", "")
        roll = re.fullmatch(r"Wheel_(.+)_Roll", name)
        steer = re.fullmatch(r"Wheel_(.+)_Steer", name)
        for match, inventory, label in [
            (roll, rolls, "roll"),
            (steer, steers, "steer"),
        ]:
            if match:
                wid = match[1]
                assert wid not in inventory, "Duplicate cycle " + label + ": " + wid
                inventory[wid] = i
                assert descendant(i, root), "Cycle wheel outside marked root: " + name
        metadata = node.get("extras", {})
        if "wheel_radius" in metadata or "roll_axis_gltf" in metadata:
            assert roll, "Wheel metadata on non-roll node: " + name
    assert set(rolls) == set(steers) == set(expected), (
        "Declared/actual cycle wheels",
        expected,
        list(rolls),
        list(steers),
    )
    wheels = {}
    for wid in expected:
        i, steer = rolls[wid], steers[wid]
        assert parents[i] == steer, "Cycle requires Steer>Roll parent: " + wid
        assert not any(
            other != i and descendant(other, i) for other in rolls.values()
        ), "Nested cycle rolls"
        metadata = nodes[i].get("extras", {})
        radius, axis = metadata.get("wheel_radius"), metadata.get("roll_axis_gltf")
        assert number(radius) and radius > 0, "Invalid cycle radius: " + wid
        assert (
            isinstance(axis, list)
            and len(axis) == 3
            and all(number(v) for v in axis)
            and axis == [0, 0, -1]
        ), ("Invalid cycle roll axis: " + wid)
        assert any("mesh" in nodes[j] and descendant(j, i) for j in active), (
            "Empty cycle wheel: " + wid
        )
        wheels[wid] = metadata

    meshes = primitives = triangles = vertices = 0
    materials, images = set(), set()
    for i in active:
        node = nodes[i]
        if "mesh" not in node:
            continue
        assert descendant(i, root), "Mesh outside marked motorcycle root"
        meshes += 1
        for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
            assert primitive.get("mode", 4) == 4, "Expected triangulated mesh"
            position = primitive["attributes"]["POSITION"]
            count = gltf["accessors"][primitive.get("indices", position)]["count"]
            assert isinstance(count, int) and count > 0 and count % 3 == 0
            triangles += count // 3
            vertices += gltf["accessors"][position]["count"]
            primitives += 1
            material = primitive["material"]
            materials.add(material)
            mat = gltf["materials"][material]
            assert "KHR_materials_unlit" in mat.get(
                "extensions", {}
            ), "Non-unlit cycle material"
            texture = mat.get("pbrMetallicRoughness", {}).get("baseColorTexture")
            if texture:
                images.add(gltf["textures"][texture["index"]]["source"])
    assert meshes and primitives, "Empty motorcycle scene"
    return {
        "triangles": triangles,
        "vertices": vertices,
        "meshes": meshes,
        "primitives": primitives,
        "materials": len(materials),
        "textures": len(images),
        "glbBytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "wheels": wheels,
        "wheelIds": list(expected),
        "toolchain": "motorcycle-v1",
        "motorcycleRoot": "Motorcycle_Root",
    }
