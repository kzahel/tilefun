"""Add explicit multi-axle wheel inventory to the immutable original GLB audit.

The four established corner assemblies remain required. Additional axles must be
declared exactly by the caller, so an omitted or duplicate wheel cannot pass.
"""

import json
from pathlib import Path
import re
import struct

from catalog import audit_glb as audit_four_corner_glb

FOUR_CORNERS = ("FL", "FR", "RL", "RR")


def audit_glb(path, wheel_ids=FOUR_CORNERS):
    expected = tuple(wheel_ids)
    assert len(expected) == len(set(expected)) and set(FOUR_CORNERS) <= set(expected)
    assert all(re.fullmatch(r"[A-Z]+", name) for name in expected)
    audit = audit_four_corner_glb(path)
    data = Path(path).read_bytes()
    size, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + size])
    nodes = gltf["nodes"]
    active = []

    def visit(index):
        active.append(index)
        for child in nodes[index].get("children", []):
            visit(child)

    for index in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        visit(index)
    wheels = {}
    for index in active:
        node = nodes[index]
        match = re.fullmatch(r"Wheel_([A-Z]+)_Roll", node.get("name", ""))
        if not match:
            continue
        name = match[1]
        assert name not in wheels, "Duplicate roll assembly: " + name
        extras = node.get("extras", {})
        assert extras.get("wheel_radius", 0) > 0
        assert extras.get("roll_axis_gltf") == [0, 0, -1], (name, extras)
        wheels[name] = extras
    assert set(wheels) == set(expected), ("Declared/actual wheel mismatch", expected, list(wheels))
    audit["wheels"] = {name: wheels[name] for name in expected}
    return audit
