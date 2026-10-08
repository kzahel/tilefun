"""Install a toolkit-only CUDA 12.4.1 prefix without changing WSL's GPU driver."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("prefix", type=Path)
args = parser.parse_args()
prefix = args.prefix.resolve()
prefix.mkdir(parents=True, exist_ok=True)
base = "https://developer.download.nvidia.com/compute/cuda/redist/"
with urllib.request.urlopen(base + "redistrib_12.4.1.json") as response:
    manifest = json.load(response)
records = {}
for name in ["cuda_nvcc", "cuda_cudart", "cuda_cccl", "cuda_nvrtc"]:
    package = manifest[name]["linux-x86_64"]
    archive = prefix / Path(package["relative_path"]).name
    if not archive.exists():
        urllib.request.urlretrieve(base + package["relative_path"], archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != package["sha256"]:
        raise RuntimeError(f"Hash mismatch: {name}")
    with tarfile.open(archive) as tar:
        # Extract validated official archives into their named top-level directory.
        tar.extractall(prefix, filter="data")
        top = prefix / tar.getmembers()[0].name.split("/")[0]
    for child in top.iterdir():
        target = prefix / child.name
        if child.is_dir():
            shutil.copytree(child, target, dirs_exist_ok=True, symlinks=True)
        elif child.is_file():
            shutil.copy2(child, target)
    records[name] = package
    print(f"Installed {name}", flush=True)
(prefix / "toolkit-record.json").write_text(json.dumps(records, indent=2) + "\n")
