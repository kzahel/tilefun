"""Source-pilot GLTF inventory only; not shared catalog/runtime qualification."""

from pathlib import Path
import hashlib
import json
import struct


def audit_glb(path):
    data = Path(path).read_bytes()
    assert data[:4] == b"glTF" and struct.unpack_from("<I", data, 4)[0] == 2
    length = struct.unpack_from("<I", data, 12)[0]
    g = json.loads(data[20 : 20 + length])
    nodes = g["nodes"]
    active = []

    def visit(i):
        active.append(i)
        for child in nodes[i].get("children", []):
            visit(child)

    for i in g["scenes"][g.get("scene", 0)]["nodes"]:
        visit(i)
    root = next(n for n in nodes if n.get("name") == "Motorcycle_Root")
    assert root["extras"]["tilefun_motorcycle"] == 1
    assert root["extras"]["wheel_ids"] == ["F", "R"]
    rolls = {
        n["name"]: n
        for n in nodes
        if n.get("name", "").startswith("Wheel_") and n["name"].endswith("_Roll")
    }
    assert set(rolls) == {"Wheel_F_Roll", "Wheel_R_Roll"}
    for wid in ["F", "R"]:
        steer = next(n for n in nodes if n.get("name") == f"Wheel_{wid}_Steer")
        roll = rolls[f"Wheel_{wid}_Roll"]
        assert nodes.index(roll) in steer["children"]
        assert roll["extras"]["wheel_radius"] > 0
        assert roll["extras"]["roll_axis_gltf"] == [0, 0, -1]
        assert len(roll["children"]) == 1 and "mesh" in nodes[roll["children"][0]]
    meshes = [g["meshes"][nodes[i]["mesh"]] for i in active if "mesh" in nodes[i]]
    primitives = [p for m in meshes for p in m["primitives"]]
    triangles = sum(g["accessors"][p["indices"]]["count"] // 3 for p in primitives)
    vertices = sum(
        g["accessors"][p["attributes"]["POSITION"]]["count"] for p in primitives
    )
    assert len(meshes) == len(primitives) == 3
    assert len(g["materials"]) == len(g["textures"]) == len(g["images"]) == 1
    assert "KHR_materials_unlit" in g["materials"][0]["extensions"]
    assert g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
    assert all(
        s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
    )
    return {
        "triangles": triangles,
        "vertices": vertices,
        "meshes": 3,
        "primitives": 3,
        "materials": 1,
        "textures": 1,
        "glbBytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "wheelIds": ["F", "R"],
        "wheels": {wid: rolls[f"Wheel_{wid}_Roll"]["extras"] for wid in ["F", "R"]},
        "rootMarker": root["extras"],
        "qualification": "own raw source inventory; stable cycle catalog audited separately; actual shared loader/browser pending",
    }
