"""Read-only verification for retained Classic v1/v2 comparison evidence."""

import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--inputs", action="store_true")
args = parser.parse_args()
package = Path(__file__).resolve().parents[1]
root = next(p for p in package.parents if (p / "package.json").is_file())
read = lambda p: json.loads(p.read_text(encoding="utf-8"))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = read(package / "retained-files.json")
assert manifest
for name, expected in manifest.items():
    path = (package / name).resolve()
    path.relative_to(package)
    assert sha(path) == expected, name
actual = {p.relative_to(package).as_posix() for p in package.rglob("*") if p.is_file()}
assert actual == set(manifest) | {
    "retained-files.json"
}, "Unexpected/missing retained file"
count = 0
if args.inputs:
    pins = read(package / "provenance.json")["inputHashes"]
    for name, expected in pins.items():
        path = (root / name).resolve()
        path.relative_to(root)
        assert sha(path) == expected, name
    count = len(pins)
print(
    json.dumps(
        {
            "status": "passed",
            "retainedFiles": len(manifest),
            "inputs": count,
            "sourceOnly": True,
            "normalQualified": False,
        }
    )
)
