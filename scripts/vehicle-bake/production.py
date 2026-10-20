"""Run the existing original-family QA stages, with explicit visual inspection.

Capture never freezes. Freeze requires a separately written visual-inspection.json.
All rendering/proof work is delegated to the established, receipt-pinned tools.
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def utc(value):
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def inspection_sheets(config, qa):
    """Compose existing capture pixels for inspection; never change public art."""
    folder = ROOT / config["output"] / "captures"
    size = config.get("nativeSize", 128)
    for mode in ["study", "engine"]:
        sheet = Image.new("RGBA", (size * 4, size * 4), (224, 226, 228, 255))
        labels = ImageDraw.Draw(sheet)
        for index in range(16):
            frame = Image.open(folder / f"{mode}-{index}.png").convert("RGBA")
            assert frame.size == (size, size)
            x, y = index % 4 * size, index // 4 * size
            sheet.alpha_composite(frame, (x, y))
            labels.text((x + 5, y + 5), str(index), fill=(40, 40, 55, 255))
        sheet.save(qa / f"parent-{mode}.png")
    phases = []
    for mode, prefix in [("study", "roll"), ("engine", "game-roll")]:
        frames = [Image.open(folder / f"{prefix}-{index}.png").convert("RGBA") for index in range(8)]
        bounds = [frame.getbbox() for frame in frames]
        assert all(bounds), "Empty phase capture"
        # One common region per camera preserves absolute registration across phases.
        box = (min(b[0] for b in bounds) - 5, min(b[1] for b in bounds) - 5,
               max(b[2] for b in bounds) + 5, max(b[3] for b in bounds) + 5)
        for index, frame in enumerate(frames):
            crop = frame.crop(box)
            phases.append((f"{mode} {index}", crop.resize((crop.width * 2, crop.height * 2), Image.Resampling.NEAREST)))
    width = max(250, max(frame.width for _, frame in phases) + 12)
    height = max(260, max(frame.height for _, frame in phases) + 36)
    sheet = Image.new("RGBA", (width * 4, height * 4), (224, 226, 228, 255))
    labels = ImageDraw.Draw(sheet)
    for index, (label, frame) in enumerate(phases):
        x, y = index % 4 * width, index // 4 * height
        labels.text((x + 5, y + 5), label, fill=(40, 40, 55, 255))
        sheet.alpha_composite(frame, (x + (width - frame.width) // 2, y + 30))
    sheet.save(qa / "parent-phases.png")
    sheet = Image.new("RGBA", (size * 2, size), (224, 226, 228, 255))
    for index, mode in enumerate(["study", "engine"]):
        sheet.alpha_composite(Image.open(folder / f"wire-{mode}.png").convert("RGBA"), (index * size, 0))
    sheet.save(qa / "parent-wireframes.png")
    print(json.dumps({"id": config["id"], "status": "inspection sheets prepared", "qa": config["qa"]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path)
    parser.add_argument("action", choices=["capture", "inspect", "freeze", "verify"])
    parser.add_argument("--blender", type=Path)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--deadline", help="UTC ISO timestamp; refuse work at or after it")
    args = parser.parse_args()
    os.chdir(ROOT)
    config = read(args.config)
    toolchain = config.get("toolchain", "four-wheel-v1")
    assert toolchain in ["four-wheel-v1", "multi-axle-v2"], "Unknown review toolchain"
    suffix = "-v2" if toolchain == "multi-axle-v2" else ""
    qa = ROOT / config["qa"]
    qa.mkdir(parents=True, exist_ok=True)
    deadline = utc(args.deadline) if args.deadline else None
    if deadline and datetime.datetime.now(datetime.timezone.utc) >= deadline:
        raise RuntimeError("Production deadline reached")
    if args.action == "inspect":
        inspection_sheets(config, qa)
        return
    sequence = []

    def run(name, command):
        remaining = 900
        if deadline:
            remaining = min(
                remaining,
                (deadline - datetime.datetime.now(datetime.timezone.utc)).total_seconds(),
            )
            if remaining <= 0:
                raise RuntimeError("Production deadline reached")
        log = qa / f"production-{args.action}-{name}.log"
        started = time.monotonic()
        with log.open("w", encoding="utf-8") as output:
            process = subprocess.Popen(
                [str(part) for part in command],
                cwd=ROOT,
                stdout=output,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            try:
                code = process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                if process.poll() is None:
                    if os.name == "nt":
                        subprocess.run(
                            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                            capture_output=True,
                            check=False,
                        )
                    else:
                        process.kill()
                    process.wait()
                raise RuntimeError(f"Stage exceeded its bound: {name}") from None
        sequence.append({"stage": name, "exitCode": code, "seconds": round(time.monotonic() - started, 2)})
        print(json.dumps(sequence[-1]), flush=True)
        if code:
            print("\n".join(log.read_text(encoding="utf-8", errors="replace").splitlines()[-35:]))
            raise RuntimeError(f"Stage failed: {name}; see {log}")

    python = [sys.executable, "-X", "utf8"]
    package = python + [f"scripts/vehicle-bake/family-package{suffix}.py", args.config]
    capture = ["node", f"scripts/vehicle-bake/family-capture{suffix}.mjs", args.config]
    frozen = ROOT / config["output"] / "review-manifest.json"
    if args.action == "capture":
        assert not frozen.exists(), "Existing review is frozen; do not recapture"
        assert args.blender and args.blender.is_file(), "Capture requires --blender"
        run("prepare", package + ["prepare"])
        run("build", ["node", "scripts/vehicle-bake/family-build.mjs", config["output"]])
        run("capture", capture)
        run("clearance", [
            args.blender, "--background", "--factory-startup", "--threads", "4",
            "--python-exit-code", "1", "--python", f"scripts/vehicle-bake/clearance{suffix}.py",
            "--", qa / "clearance-input.json", qa / "clearance.json",
        ])
        run("assemble", package + ["assemble"])
        run("browser", capture + ["--qa-only"])
        print("Ready for independent image inspection; this command did not freeze or integrate.")
    elif args.action == "freeze":
        assert not frozen.exists(), "Existing review is frozen"
        visual = read(qa / "visual-inspection.json")
        assert visual.get("humanApproval") is False, "Record honest agent inspection, not human approval"
        assert visual.get("status") == "no-blocking-issues", "Resolve visual blockers first"
        run("freeze", package + ["freeze"])
        run("offline", package + ["offline"])
    if args.action in ["freeze", "verify"]:
        verify = python + [f"scripts/vehicle-bake/family-verify{suffix}.py", args.config]
        if args.baseline:
            verify += ["--baseline", args.baseline]
        run("verify", verify)
    (qa / f"production-{args.action}.json").write_bytes(
        (json.dumps({"id": config["id"], "action": args.action, "stages": sequence}, indent=2) + "\n").encode()
    )


if __name__ == "__main__":
    main()
