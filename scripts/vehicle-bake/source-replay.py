"""Rebuild an asset using only its declared retained inputs in a fresh workspace.

Modern replay receipts supply inputHashes and optional sharedInputHashes. Geometry
constructors default to Blender --scratch. Pure Python assembly receipts may set
runner=python, invokedBuilder and arguments. Only newly generated data outputs can
qualify; existing retained GLBs are never counted as replay outputs.
"""

import argparse
import datetime
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile

from replay_inputs import copy_inputs, safe_relative

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("--qa", required=True, type=Path)
    parser.add_argument("--blender", type=Path)
    parser.add_argument("--builder")
    parser.add_argument("--input-root", help="Repository-relative retained directory for receipts with local basenames")
    parser.add_argument("--deadline")
    args = parser.parse_args()
    receipt = json.loads(args.receipt.read_text(encoding="utf-8-sig"))
    aliases = receipt.get("outputs")
    if isinstance(aliases, dict):
        aliases = {
            name: value.get("sha256") if isinstance(value, dict) else value
            for name, value in aliases.items()
        }
    if isinstance(aliases, dict) and all(isinstance(value, str) and re.fullmatch("[0-9a-f]{64}", value) for value in aliases.values()):
        receipt.setdefault("outputHashes", aliases)
        models = [value for name, value in aliases.items() if name.endswith(".glb")]
        assert len(models) == 1
        receipt.setdefault("glbSha256", models[0])
        receipt.setdefault("atlasSha256", aliases["atlas.png"])
        if "recipe.json" in aliases:
            receipt.setdefault("recipeSha256", aliases["recipe.json"])
    assert receipt.get("inputHashes"), "Use the historical family command for a legacy role-map receipt"
    assert receipt.get("scratchInputDependencies", []) == []
    pins = dict(receipt["inputHashes"])
    for name, expected in receipt.get("sharedInputHashes", {}).items():
        assert name not in pins or pins[name] == expected
        pins[name] = expected
    if args.input_root:
        safe_relative(args.input_root)
        pins = {f"{args.input_root}/{name}" if "/" not in name else name: value for name, value in pins.items()}
    builder = args.builder or receipt.get("invokedBuilder")
    if not builder:
        choices = [name for name in pins if name.endswith("/build.py")]
        assert len(choices) == 1, "Declare --builder or invokedBuilder"
        builder = choices[0]
    assert builder in pins and builder.endswith(".py")
    qa = (ROOT / args.qa).resolve()
    assert qa.is_relative_to((ROOT / "data").resolve()), "Replay artifacts must stay under ignored data"
    qa.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="retained-replay-", dir=qa))
    try:
        resolution = copy_inputs(ROOT, pins, scratch)
    except ValueError as error:
        # Preserve this CLI's existing rejection contract for callers/controls.
        raise AssertionError(str(error)) from error
    (scratch / "AGENTS.md").write_bytes(b"# Isolated retained-input source replay root.\n")
    (scratch / "public").mkdir(exist_ok=True)
    arguments = receipt.get("arguments", ["--scratch"])
    assert isinstance(arguments, list) and all(isinstance(value, str) for value in arguments)
    runner = receipt.get("runner", "blender")
    if runner == "blender":
        assert args.blender and args.blender.is_file(), "Blender constructor requires --blender"
        command = [str(args.blender), "--background", "--factory-startup", "--threads", "4", "--python-exit-code", "1", "--python", str(scratch / builder), "--", *arguments]
    else:
        assert runner == "python", "Unknown constructor runner"
        command = [sys.executable, str(scratch / builder), *arguments]
    timeout = 300
    if args.deadline:
        deadline = datetime.datetime.fromisoformat(args.deadline.replace("Z", "+00:00"))
        timeout = min(timeout, (deadline - datetime.datetime.now(datetime.timezone.utc)).total_seconds())
    assert timeout > 0, "Source replay deadline reached"
    log_path = qa / "parent-source-replay.log"
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(command, cwd=scratch, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=False)
            else:
                process.kill()
            process.wait()
            raise RuntimeError("Owned source constructor exceeded its deadline") from None
    assert code == 0, "Source replay failed; inspect " + str(log_path)
    outputs = receipt.get("outputHashes")
    if outputs is None:
        outputs = {"atlas.png": receipt["atlasSha256"]}
        if "recipeSha256" in receipt:
            outputs["recipe.json"] = receipt["recipeSha256"]
        candidates = [path for name in ["model.glb", "rider.glb"] for path in (scratch / "data").rglob(name) if sha(path) == receipt["glbSha256"]]
        assert candidates, "No fresh data GLB matches the retained receipt"
        outputs[candidates[0].name] = receipt["glbSha256"]
    assert any(name.endswith(".glb") and value == receipt["glbSha256"] for name, value in outputs.items()), "Output map must qualify the actual model"
    assert outputs.get("atlas.png") == receipt["atlasSha256"], "Output map must qualify the primary atlas"
    if "recipeSha256" in receipt:
        assert outputs.get("recipe.json") == receipt["recipeSha256"]
    paths = {}
    for name, expected in outputs.items():
        assert Path(name).name == name, "Output hashes use basenames"
        matches = sorted(path for path in (scratch / "data").rglob(name) if sha(path) == expected)
        assert matches, "No freshly generated exact output: " + name
        paths[name] = matches[0].relative_to(scratch).as_posix()
    result = {"status": "passed", "independent": True, "declaredInputPins": len(pins), "glbSha256": receipt["glbSha256"], "exactOutputs": paths, "scratchRoot": scratch.relative_to(ROOT).as_posix(), "scratchInputDependencies": []}
    result.update(resolution)
    (qa / "parent-source-replay.json").write_bytes((json.dumps(result, indent=2) + "\n").encode())
    print(json.dumps(result))


if __name__ == "__main__":
    main()
