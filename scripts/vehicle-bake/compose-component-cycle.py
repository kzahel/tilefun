"""Attach a static companion inside the marked cycle root without moving geometry.

The immutable general composer retains all buffers. This adapter explicitly
appends its mount to Motorcycle_Root, compensating the root's uniform rigid
transform. Every existing node is unchanged except that root's child list.
"""

import copy
import importlib.util
import math
from pathlib import Path


def load(name, filename):
    spec = importlib.util.spec_from_file_location(
        name, Path(__file__).with_name(filename)
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base_composer = load("cycle_base_composer", "compose-component.py")
cycle_catalog = load("cycle_companion_catalog", "catalog-cycle.py")


def identity():
    return [[float(row == column) for column in range(4)] for row in range(4)]


def multiply(a, b):
    return [
        [sum(a[row][k] * b[k][column] for k in range(4)) for column in range(4)]
        for row in range(4)
    ]


def inverse(matrix):
    rows = [list(row) + ident for row, ident in zip(matrix, identity())]
    for column in range(4):
        pivot = max(range(column, 4), key=lambda row: abs(rows[row][column]))
        assert abs(rows[pivot][column]) > 1e-12, "Singular cycle root transform"
        rows[column], rows[pivot] = rows[pivot], rows[column]
        divisor = rows[column][column]
        rows[column] = [value / divisor for value in rows[column]]
        for row in range(4):
            if row == column:
                continue
            factor = rows[row][column]
            rows[row] = [a - factor * b for a, b in zip(rows[row], rows[column])]
    return [row[4:] for row in rows]


def local_matrix(node):
    if "matrix" in node:
        values = node["matrix"]
        assert len(values) == 16 and all(math.isfinite(value) for value in values)
        assert not any(key in node for key in ["translation", "rotation", "scale"])
        return [[values[column * 4 + row] for column in range(4)] for row in range(4)]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    tx, ty, tz = node.get("translation", [0, 0, 0])
    assert all(math.isfinite(value) for value in [x, y, z, w, sx, sy, sz, tx, ty, tz])
    # Match THREE.Matrix4.compose, including its original quaternion values.
    x2, y2, z2 = x + x, y + y, z + z
    xx, xy, xz, yy, yz, zz = x * x2, x * y2, x * z2, y * y2, y * z2, z * z2
    wx, wy, wz = w * x2, w * y2, w * z2
    return [
        [(1 - (yy + zz)) * sx, (xy - wz) * sy, (xz + wy) * sz, tx],
        [(xy + wz) * sx, (1 - (xx + zz)) * sy, (yz - wx) * sz, ty],
        [(xz - wy) * sx, (yz + wx) * sy, (1 - (xx + yy)) * sz, tz],
        [0, 0, 0, 1],
    ]


def root_world(document, root):
    matrices = {}

    def visit(index, parent):
        assert index not in matrices, "Invalid cycle parent graph"
        matrix = multiply(parent, local_matrix(document["nodes"][index]))
        matrices[index] = matrix
        for child in document["nodes"][index].get("children", []):
            visit(child, matrix)

    for index in document["scenes"][document.get("scene", 0)]["nodes"]:
        visit(index, identity())
    result = matrices[root]
    columns = [[result[row][column] for row in range(3)] for column in range(3)]
    lengths = [sum(value * value for value in column) for column in columns]
    assert min(lengths) > 1e-12
    assert (
        max(lengths) - min(lengths) < max(lengths) * 1e-8
    ), "Nonuniform cycle root needs a different assembly contract"
    for a, b in [(0, 1), (0, 2), (1, 2)]:
        assert (
            abs(sum(x * y for x, y in zip(columns[a], columns[b])))
            < max(lengths) * 1e-8
        ), "Sheared cycle root unsupported"
    return result


def compose(base_path, component_path, mount, prefix):
    base, binary, _ = base_composer.unpack(base_path)
    roots = [
        i
        for i, node in enumerate(base["nodes"])
        if node.get("extras", {}).get("tilefun_motorcycle") == 1
    ]
    assert len(roots) == 1
    root = roots[0]
    cycle_catalog.audit_glb(base_path, base["nodes"][root]["extras"]["wheel_ids"])
    packed, proof = base_composer.compose(base_path, component_path, mount, prefix)
    # The result is still unretained in memory. No input model is rewritten.
    import json
    import struct

    size = struct.unpack_from("<I", packed, 12)[0]
    document = json.loads(packed[20 : 20 + size])
    combined_binary = packed[28 + size :]
    mount_index = len(document["nodes"]) - 1
    assert document["nodes"][mount_index]["name"] == prefix + "_Mount"
    desired = identity()
    for row, value in enumerate([mount[0], mount[2], -mount[1]]):
        desired[row][3] = value
    world = root_world(base, root)
    relative = multiply(inverse(world), desired)
    node = document["nodes"][mount_index]
    del node["translation"]
    node["matrix"] = [relative[row][column] for column in range(4) for row in range(4)]
    document["scenes"][0]["nodes"].remove(mount_index)
    document["nodes"][root].setdefault("children", []).append(mount_index)
    for key in base_composer.ARRAYS:
        expected = copy.deepcopy(base.get(key, []))
        if key == "nodes":
            expected[root].setdefault("children", []).append(mount_index)
        assert document.get(key, [])[: len(expected)] == expected, (
            "Undeclared base mutation: " + key
        )
    assert combined_binary[: len(binary)] == binary
    reconstructed = multiply(world, relative)
    assert (
        max(
            abs(reconstructed[row][column] - desired[row][column])
            for row in range(4)
            for column in range(4)
        )
        < 1e-8
    )
    proof.update(
        {
            "baseArraysPreserved": [
                key for key in base_composer.ARRAYS if key != "nodes"
            ],
            "baseNodesPreservedExceptRootChildAppend": True,
            "rootAttachment": {
                "node": root,
                "name": base["nodes"][root]["name"],
                "appendedMount": mount_index,
            },
            "componentWorldSocketPreserved": True,
            "cycleRootWorldMatrix": world,
            "method": "Append companion inside existing marked root, compensating its uniform rigid transform; original geometry/paint buffers and all other node data unchanged",
        }
    )
    return base_composer.pack(document, combined_binary), proof
