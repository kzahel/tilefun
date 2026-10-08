"""Save the common U2Net mask independently of editor RGB/native alpha."""
import argparse
import json
import os
from pathlib import Path
import time

from reference import digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args()
    from PIL import Image
    from rembg import new_session, remove
    session = new_session("u2net", providers=["CPUExecutionProvider"])
    weights = Path(os.environ.get("U2NET_HOME", str(Path.home() / ".u2net"))) / "u2net.onnx"
    for path in sorted((args.bundle / "references").glob("*/generated-rgb.png")):
        generation = json.loads((path.parent / "generation.json").read_text())
        if generation["status"] not in ("generated", "registered"):
            continue
        case_id = path.parent.name + "-u2net"
        directory = path.parent.with_name(case_id)
        if directory.exists():
            continue
        directory.mkdir()
        started = time.perf_counter()
        output = remove(Image.open(path), session=session).convert("RGBA")
        output.save(directory / "reference.png")
        output.getchannel("A").save(directory / "mask.png")
        record = {"id": case_id, "asset": generation["asset"], "status": "registered", "generator": generation["generator"], "parent": path.parent.name, "parentGenerationSha256": digest(path.parent / "generation.json"), "inputManifestSha256": generation["inputManifestSha256"], "sourceSha256": generation["sourceSha256"], "file": f"references/{case_id}/reference.png", "sha256": digest(directory / "reference.png"), "size": list(output.size), "rgbSha256": digest(path), "segmentation": {"model": "U2Net", "weightsSha256": digest(weights), "device": "CPU"}, "seconds": time.perf_counter() - started, "implementationSha256": digest(__file__), "review": "Unreviewed diagnostic mask; no promotion"}
        (directory / "reference.json").write_text(json.dumps(record, indent=2) + "\n")
        print(json.dumps({"id": case_id, "seconds": record["seconds"]}), flush=True)


if __name__ == "__main__":
    main()
