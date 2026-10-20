"""Replay a retained v3 runtime receipt in a fresh declared-input-only repository.

python scripts/vehicle-bake/replay-runtime.py RECEIPT --qa data/... --blender BLENDER
Historical pins use replay_inputs.py; the immutable exporter runs unmodified.
No outputs are written to the current runtime catalog, assets or receipts.
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile

from replay_inputs import contained, copy_inputs, safe_relative, sha

ROOT = Path(__file__).resolve().parents[2]
EXPORTER = "scripts/vehicle-bake/runtime-export-v3.py"
CATALOG = "src/traffic/original-vehicles.json"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def config_path(pins, scratch, explicit):
    if explicit:
        safe_relative(explicit)
        choices = [explicit] if explicit in pins else []
    else:
        choices = [name for name in pins if name.endswith(".json") and
                   (Path(name).name.startswith("config-runtime") or
                    Path(name).name.startswith("runtime-"))]
        choices = [name for name in choices if
                   {"id", "mesh", "sprite", "receipt", "review"} <= read(scratch / name).keys()]
    if len(choices) != 1:
        raise ValueError("Expected one declared runtime config; supply repository-relative --config")
    return choices[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("--qa", required=True, type=Path)
    parser.add_argument("--blender", required=True, type=Path)
    parser.add_argument("--config", help="Original repository-relative config path, already pinned by the receipt")
    parser.add_argument("--deadline")
    args = parser.parse_args()
    qa = (ROOT / args.qa).resolve()
    if not qa.is_relative_to((ROOT / "data").resolve()):
        raise ValueError("Replay QA must stay under ignored data")
    if not args.blender.is_file():
        raise ValueError("Runtime measurement requires --blender")
    receipt_path = args.receipt.resolve()
    receipt = read(receipt_path)
    pins = receipt["inputs"]
    if EXPORTER not in pins or "scripts/vehicle-bake/runtime-measure.py" not in pins:
        raise ValueError("Receipt must pin the retained v3 exporter and measurement helper")
    qa.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix="runtime-replay-", dir=qa))
    resolution = copy_inputs(ROOT, pins, scratch)
    config_name = config_path(pins, scratch, args.config)
    config = read(scratch / config_name)
    if contained(ROOT, config["receipt"]) != receipt_path:
        raise ValueError("Config receipt path does not identify the supplied committed receipt")
    if "AGENTS.md" in pins or CATALOG in pins:
        raise ValueError("Replay scaffold conflicts with declared inputs")
    (scratch / "AGENTS.md").write_bytes(b"# Isolated declared-input runtime replay root.\n")
    (scratch / "public").mkdir(exist_ok=True)
    catalog_path = scratch / CATALOG
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_bytes(b'{"vehicles":[]}\n')
    output = scratch / "data/runtime-output"
    work = scratch / "data/runtime-measure"
    command = [sys.executable, str(scratch / EXPORTER), "--config", str(scratch / config_name),
               "--blender", str(args.blender.resolve()), "--output-root", str(output), "--work-dir", str(work)]
    timeout = 300
    if args.deadline:
        deadline = datetime.datetime.fromisoformat(args.deadline.replace("Z", "+00:00"))
        timeout = min(timeout, (deadline - datetime.datetime.now(datetime.timezone.utc)).total_seconds())
    if timeout <= 0:
        raise ValueError("Runtime replay deadline reached")
    log_path = qa / "runtime-replay.log"
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(command, cwd=scratch, stdout=log, stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                                   start_new_session=os.name != "nt")
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=False)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise RuntimeError("Runtime exporter exceeded its deadline") from None
    if code:
        raise RuntimeError("Runtime replay failed; inspect " + str(log_path))
    paths = ["public/" + config["mesh"]["path"], "public/" + config["sprite"], config["receipt"]]
    exact = {}
    for name in paths:
        expected = contained(ROOT, name)
        actual = contained(output, name)
        if actual.read_bytes() != expected.read_bytes():
            raise ValueError("Runtime replay output differs: " + name)
        exact[name] = sha(actual)
    generated = read(output / CATALOG)["vehicles"]
    current = [entry for entry in read(ROOT / CATALOG)["vehicles"] if entry["id"] == config["id"]]
    if len(generated) != 1 or len(current) != 1 or generated[0] != current[0]:
        raise ValueError("Selected runtime catalog entry differs")
    result = {"status": "passed", "id": config["id"], "independent": True,
              "exactModelSpriteReceipt": exact, "selectedCatalogEntryExact": True,
              "exporterSha256": pins[EXPORTER], "scratchRoot": scratch.relative_to(ROOT).as_posix(),
              "scratchInputDependencies": [], **resolution}
    (qa / "runtime-replay.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
