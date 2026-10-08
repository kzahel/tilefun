"""Fetch only the pinned inference files for the bounded 073 experiment."""
import argparse
import json
import time
from pathlib import Path

from huggingface_hub import HfApi, snapshot_download

MODELS = {
    "flux": ("black-forest-labs/FLUX.2-klein-4B", "e7b7dc27f91deacad38e78976d1f2b499d76a294"),
    "qwen": ("Qwen/Qwen-Image-2.1", "d26bb61231c349cf6b7896fa83353113880e1ba3"),
    "triposg": ("VAST-AI/TripoSG", "2c1c516d22d58db486a058d98d31bb6177344e06"),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, required=True)
    parser.add_argument("--model", choices=MODELS, required=True)
    args = parser.parse_args()
    repo, revision = MODELS[args.model]
    record_path = args.study / f"download-{args.model}.json"
    started = time.perf_counter()
    record = {"repo": repo, "revision": revision, "status": "started"}
    record_path.write_text(json.dumps(record, indent=2) + "\n")
    try:
        info = HfApi().model_info(repo, revision=revision, files_metadata=True)
        names = [x.rfilename for x in info.siblings if x.rfilename == "model_index.json" or "/" in x.rfilename and x.rfilename.endswith((".safetensors", ".json", ".txt", ".model", ".jinja"))]
        record["expectedBytes"] = sum(x.size or 0 for x in info.siblings if x.rfilename in names)
        print(json.dumps({"model": args.model, "bytes": record["expectedBytes"], "status": "downloading"}), flush=True)
        location = snapshot_download(repo, revision=revision, allow_patterns=names, max_workers=2)
        record.update(status="succeeded", snapshot=location, files=names)
    except Exception as error:
        record.update(status="failed", failure=str(error))
        raise
    finally:
        record["seconds"] = time.perf_counter() - started
        record_path.write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps({"model": args.model, "status": record["status"], "seconds": record["seconds"]}), flush=True)


if __name__ == "__main__":
    main()
