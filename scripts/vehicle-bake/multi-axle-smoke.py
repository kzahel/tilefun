"""Exercise the multi-axle review tools using an explicitly synthetic scratch GLB.

Clones two real Beetle wheel assemblies outboard in ignored scratch, leaving all
retained assets unchanged. This is a tool control, never a production art candidate.
"""

import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blender", required=True)
    parser.add_argument("--deadline")
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("catalog_v2", Path(__file__).with_name("catalog-v2.py"))
    catalog = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(catalog)
    from catalog import audit_glb
    base = ROOT / "public/demos/vehicle-bake/beetle/v1/model.glb"
    raw = base.read_bytes()
    original_sha = hashlib.sha256(raw).hexdigest()
    assert catalog.audit_glb(base) == audit_glb(base), "Four-wheel audit regression"
    run_id = f"six-wheel-{time.time_ns()}"
    source = ROOT / "public/demos/vehicle-bake/_pipeline-probes" / run_id
    source.mkdir(parents=True)
    size = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20:20 + size])
    chunks = raw[20 + size:]
    nodes = gltf["nodes"]
    for old, new, side in [("FL", "ML", 1), ("FR", "MR", -1)]:
        old_index = next(i for i, node in enumerate(nodes) if node.get("name") == f"Wheel_{old}_Steer")
        parent = next(node for node in nodes if old_index in node.get("children", []))

        def clone(index):
            node = copy.deepcopy(nodes[index])
            node["name"] = node.get("name", "").replace(f"Wheel_{old}", f"Wheel_{new}")
            node["children"] = [clone(child) for child in node.get("children", [])]
            new_index = len(nodes)
            nodes.append(node)
            return new_index

        index = clone(old_index)
        nodes[index]["translation"] = [0, .39000001549720764, 1.5 * side]
        parent["children"].append(index)
    body = json.dumps(gltf, separators=(",", ":")).encode()
    body += b" " * ((-len(body)) % 4)
    model = source / "model.glb"
    model.write_bytes(struct.pack("<III", 0x46546c67, 2, 20 + len(body) + len(chunks)) + struct.pack("<II", len(body), 0x4e4f534a) + body + chunks)
    wheel_ids = ["FL", "FR", "ML", "MR", "RL", "RR"]
    audit = catalog.audit_glb(model, wheel_ids)
    assert len(audit["wheels"]) == 6
    rejected = 0
    for wrong in [wheel_ids[:4], wheel_ids + ["FL"], wheel_ids + ["OTHER"], ["FL", "FR", "RL", "RR"]]:
        try:
            catalog.audit_glb(model, wrong)
        except AssertionError:
            rejected += 1
    assert rejected == 4, "Missing/duplicate/extra wheel inventory accepted"
    shutil.copyfile(base.parent / "atlas.png", source / "atlas.png")
    (source / "report.json").write_bytes((json.dumps({"status": "complete", "method": "Synthetic six-wheel harness control only. Not production art or human review."}) + "\n").encode())
    qa = ROOT / "data/vehicle-bake/multi-axle-smoke" / run_id
    qa.mkdir(parents=True)
    output = "public/demos/original-vehicles/_pipeline-probes/" + run_id
    config = {"id": run_id, "clearanceId": "_pipeline-probes/" + run_id, "name": "Synthetic six-wheel control", "title": "Tool control only", "toolchain": "multi-axle-v2", "wheelIds": wheel_ids, "source": source.relative_to(ROOT).as_posix(), "output": output, "qa": qa.relative_to(ROOT).as_posix(), "offline": (qa / "review.html").relative_to(ROOT).as_posix(), "nativeSize": 224}
    config_path = qa / "config.json"
    config_path.write_bytes((json.dumps(config, indent=2) + "\n").encode())
    command = [sys.executable, "-X", "utf8", str(Path(__file__).with_name("production.py")), str(config_path), "capture", "--blender", args.blender]
    if args.deadline:
        command += ["--deadline", args.deadline]
    subprocess.run(command, cwd=ROOT, check=True)
    capture = json.loads((ROOT / output / "captures/capture.json").read_text())
    proof = json.loads((qa / "clearance.json").read_text())[0]
    assert {wheel["id"] for wheel in capture["rig"]["wheels"]} == set(wheel_ids)
    assert proof["status"] == "passed" and len(proof["clearance"]) == 6
    assert proof["collidingBodyRejected"] and proof["baselineRestored"]
    assert len(proof["perWheelCollisionControls"]) == 6
    # The additive path must also preserve actual frozen four-wheel pixels.
    four_config = json.loads((ROOT / "scripts/vehicle-bake/family-beetle.json").read_text())
    four_output = "public/demos/original-vehicles/_pipeline-probes/" + run_id + "-four"
    four_qa = qa / "four-wheel"
    four_config.update(id=run_id + "-four", toolchain="multi-axle-v2", wheelIds=["FL", "FR", "RL", "RR"], output=four_output, qa=four_qa.relative_to(ROOT).as_posix(), offline=(four_qa / "review.html").relative_to(ROOT).as_posix())
    four_path = qa / "four-config.json"
    four_path.write_bytes((json.dumps(four_config, indent=2) + "\n").encode())
    four_command = command.copy()
    four_command[four_command.index(str(config_path))] = str(four_path)
    subprocess.run(four_command, cwd=ROOT, check=True)
    old_captures = ROOT / "public/demos/original-vehicles/beetle-v1/captures"
    new_captures = ROOT / four_output / "captures"
    names = [f"{camera}-{index}.png" for camera in ["study", "engine"] for index in range(16)]
    names += [f"{camera}-{index}.png" for camera in ["roll", "game-roll"] for index in range(8)]
    names += ["wire-study.png", "wire-engine.png"]
    for name in names:
        assert (old_captures / name).read_bytes() == (new_captures / name).read_bytes(), "Four-wheel pixels changed: " + name
    wrong_manifest = qa / "wrong-clearance-input.json"
    wrong_proof = qa / "wrong-clearance-proof.json"
    wrong_manifest.write_bytes((json.dumps({"candidates": [{"id": "wrong-declaration-control", "glb": (source / "model.glb").relative_to(ROOT / "public/demos/vehicle-bake").as_posix(), "wheelIds": ["FL", "FR", "RL", "RR"]}]}) + "\n").encode())
    with (qa / "wrong-clearance.log").open("w", encoding="utf-8") as log:
        wrong_result = subprocess.run([args.blender, "--background", "--factory-startup", "--threads", "4", "--python-exit-code", "1", "--python", str(Path(__file__).with_name("clearance-v2.py")), "--", str(wrong_manifest), str(wrong_proof)], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=60)
    wrong_record = json.loads(wrong_proof.read_text())[0]
    assert wrong_result.returncode != 0 and wrong_record["status"] == "failed"
    assert "Declared/actual wheels" in wrong_record["error"]
    assert hashlib.sha256(base.read_bytes()).hexdigest() == original_sha
    receipt = {"status": "passed", "syntheticControlOnly": True, "fourWheelAuditExact": True, "frozenFourWheelPNGsExact": len(names), "allSixWheelsCapturedAndQualified": True, "perWheelCollisionNegativeControls": 6, "negativeInventoryControlsRejected": rejected, "wrongClearanceDeclarationRejected": True, "sourceUnchanged": original_sha, "config": config_path.relative_to(ROOT).as_posix()}
    # Keep evidence under data; do not leave test art for Vite's publicDir copy.
    archive = qa / "archive"
    archive.mkdir()
    for path, label, boundary in [(source, "source", "vehicle-bake"), (ROOT / output, "six-wheel-review", "original-vehicles"), (ROOT / four_output, "four-wheel-review", "original-vehicles")]:
        resolved = path.resolve()
        assert resolved.is_relative_to((ROOT / "public/demos" / boundary / "_pipeline-probes").resolve())
        target = (archive / label).resolve()
        assert target.is_relative_to((ROOT / "data").resolve()) and not target.exists()
        shutil.move(str(resolved), str(target))
    receipt["archive"] = archive.relative_to(ROOT).as_posix()
    (qa / "receipt.json").write_bytes((json.dumps(receipt, indent=2) + "\n").encode())
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
