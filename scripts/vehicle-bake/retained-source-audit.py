"""Read-only modern source declaration/hash audit; never a construction replay.

Usage: python scripts/vehicle-bake/retained-source-audit.py RECEIPT
       --retained DIR [--public DIR] [--input-root DIR]
       [--model-name {model.glb,rider.glb}] --qa data/...

Review dependencies are pinned in scripts/vehicle-bake/requirements-review.txt
(Pillow 12.2.0/pathspec 1.1.1). This checker uses pathspec for .gitignore rules.
Scalar-only modern receipts require --model-name and all three scalar SHA256
pins: glbSha256, atlasSha256, recipeSha256. Filenames are never guessed/scanned.
Basename construction pins require explicit --input-root (use . for repo root).
All retained-files.json keys are repository-relative, regardless of input-root.
Only QA/retained-source-audit.json is written. Use source-replay.py separately for
fresh construction; this checker cannot detect hidden imports, prove geometry,
contacts or pixels, grant human approval, or authorize normal activation.
"""

import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True

from replay_inputs import CATALOG, resolve_input, safe_relative, valid_hash

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_NAMES = {
    "model.glb",
    "rider.glb",
    "atlas.png",
    "recipe.json",
    "companion-atlas.png",
}
LIMITS = [
    "STATIC HASH/DECLARATION audit only; no constructor or imported builder executed",
    "Fresh declared-input construction with source-replay.py remains mandatory separately",
    "No hidden-import, mesh, contact, pixel, human-approval or normal-activation qualification",
    "Repository .gitignore rules checked; Git index, global ignores and tracked exceptions not consulted",
    "Only declared retained-files entries audited; no assertion that the map inventories every unlisted file",
    "Receipt byteExact/status fields are historical metadata, not fresh replay evidence",
    "Supplemental diagnostic hash maps are not constructor declarations and are listed separately as unaudited",
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def read_json(path):
    return json.loads(
        path.read_text(encoding="utf-8-sig"), object_pairs_hook=unique_object
    )


def repo_path(root, value):
    value = Path(value)
    path = (root / value).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Path escapes repository: " + str(value))
    return path


class IgnorePolicy:
    def __init__(self, root):
        try:
            from pathspec import GitIgnoreSpec
        except ImportError as error:
            raise ValueError(
                "Install review dependencies from scripts/vehicle-bake/requirements-review.txt "
                "to provide pathspec for .gitignore rules"
            ) from error
        self.root = root
        self.spec_type = GitIgnoreSpec
        self.specs = {}
        self.hashes = {}

    def spec(self, directory):
        if directory not in self.specs:
            path = directory / ".gitignore"
            if path.is_file():
                if not path.resolve().is_relative_to(self.root):
                    raise ValueError("Ignore rules escape repository: " + str(path))
                self.hashes[path.relative_to(self.root).as_posix()] = sha(path)
                self.specs[directory] = self.spec_type.from_lines(
                    path.read_text(encoding="utf-8-sig").splitlines()
                )
            else:
                self.specs[directory] = None
        return self.specs[directory]

    def check(self, name):
        relative = safe_relative(name)
        if any(p in {".git", ".hg", ".svn"} for p in relative.parts):
            raise ValueError("Repository metadata is not a retained pin: " + name)
        # Walk parents too: a child negation cannot reopen an ignored directory.
        ignored = False
        for i in range(1, len(relative.parts) + 1):
            target = self.root.joinpath(*relative.parts[:i])
            is_directory = i < len(relative.parts) or target.is_dir()
            for depth in range(i):
                directory = self.root.joinpath(*relative.parts[:depth])
                spec = self.spec(directory)
                if spec is not None:
                    local = target.relative_to(directory).as_posix()
                    match = spec.check_file(local + ("/" if is_directory else ""))
                    if match.include is not None:
                        ignored = match.include
            if ignored:
                raise ValueError("Ignored retained dependency: " + name)
        resolved = (self.root / name).resolve()
        if not resolved.is_relative_to(self.root):
            raise ValueError("Retained dependency escapes repository: " + name)
        physical = resolved.relative_to(self.root).as_posix()
        if physical != name:
            # Reject aliases into ignored paths, including in-repo data symlinks.
            self.check_physical(physical)

    def check_physical(self, name):
        # The resolved path has no further symlinks, so recursion terminates.
        self.check(name)


def hash_record(value):
    if isinstance(value, str):
        valid_hash(value)
        return {"sha256": value}
    if not isinstance(value, dict) or "sha256" not in value:
        raise ValueError("Output pin must be SHA256 or an object containing sha256")
    if set(value) - {"sha256", "bytes", "byteExact"}:
        raise ValueError("Unsupported output metadata: " + repr(sorted(value)))
    valid_hash(value["sha256"])
    if "bytes" in value and (type(value["bytes"]) is not int or value["bytes"] < 0):
        raise ValueError("Output bytes must be a nonnegative integer")
    if "byteExact" in value and type(value["byteExact"]) is not bool:
        raise ValueError("Historical byteExact metadata must be boolean")
    return dict(value)


def normalize_outputs(receipt, model_name=None):
    if model_name is not None and model_name not in {"model.glb", "rider.glb"}:
        raise ValueError("--model-name must be model.glb or rider.glb")
    outputs = {}

    def merge(name, value):
        if name not in OUTPUT_NAMES:
            raise ValueError("Unsupported output basename: " + str(name))
        record = hash_record(value)
        old = outputs.setdefault(name, {})
        for key, value in record.items():
            if key in old and old[key] != value:
                raise ValueError("Conflicting output declaration: " + name + ":" + key)
            old[key] = value

    for field in ["outputs", "outputHashes"]:
        if field in receipt:
            mapping = receipt[field]
            if not isinstance(mapping, dict) or not mapping:
                raise ValueError(field + " must be a nonempty output map")
            for name, value in mapping.items():
                merge(name, value)
    models = [name for name in outputs if name in {"model.glb", "rider.glb"}]
    if len(models) > 1:
        raise ValueError("Declare exactly one model.glb or rider.glb in an output map")
    if models:
        if model_name is not None and model_name != models[0]:
            raise ValueError(
                "Explicit --model-name contradicts mapped model: " + models[0]
            )
        primary = models[0]
    else:
        if model_name is None:
            raise ValueError(
                "Declare exactly one model.glb or rider.glb in an output map, "
                "or supply --model-name for scalar-only modern receipts"
            )
        for field in ["glbSha256", "atlasSha256", "recipeSha256"]:
            if field not in receipt:
                raise ValueError("Scalar-only receipt requires scalar SHA256: " + field)
            valid_hash(receipt[field])
        primary = model_name
    for field, name in [
        ("glbSha256", primary),
        ("atlasSha256", "atlas.png"),
        ("recipeSha256", "recipe.json"),
    ]:
        if field in receipt:
            merge(name, receipt[field])
    if not {"atlas.png", "recipe.json"}.issubset(outputs):
        raise ValueError("Outputs must declare atlas.png and recipe.json")
    return outputs


def audit(root, receipt_path, retained, public=None, input_root=None, model_name=None):
    """Read files only. Paths may be absolute inside root or root-relative."""
    root = Path(root).resolve()
    receipt_path = repo_path(root, receipt_path)
    retained = repo_path(root, retained)
    public = repo_path(root, public) if public is not None else None
    input_root = repo_path(root, input_root) if input_root is not None else None
    policy = IgnorePolicy(root)
    watched = {receipt_path: sha(receipt_path)}
    receipt = read_json(receipt_path)
    if not isinstance(receipt, dict) or not receipt.get("inputHashes"):
        raise ValueError(
            "Legacy role-map/undeclared receipt unsupported. Use its retained "
            "replay.md or result.md family command; source-replay.py requires "
            "an explicitly authored modern inputHashes receipt."
        )
    for field in ["scratchInputDependencies", "sharedInputDependencies"]:
        if receipt.get(field, []) != []:
            raise ValueError(
                "Undeclared dependencies require explicit hash pins: " + field
            )
    pins = {}
    folded = set()
    for field in ["inputHashes", "sharedInputHashes"]:
        mapping = receipt.get(field, {})
        if not isinstance(mapping, dict):
            raise ValueError(field + " must be a SHA256 map")
        for name, expected in mapping.items():
            safe_relative(name)
            valid_hash(expected)
            if "/" not in name:
                if input_root is None:
                    raise ValueError(
                        "Basename pin requires explicit --input-root: " + name
                    )
                name = (input_root / name).relative_to(root).as_posix()
            if name.casefold() in folded:
                raise ValueError("Duplicate/conflicting normalized input pin: " + name)
            folded.add(name.casefold())
            pins[name] = expected
    outputs = normalize_outputs(receipt, model_name)
    resolved = []
    expectations = {}

    def resolve(name, expected):
        key = name.casefold()
        if key in expectations and expectations[key] != expected:
            raise ValueError("Conflicting input/retained-files pin: " + name)
        expectations[key] = expected
        policy.check(name)
        item = resolve_input(root, name, expected)
        if item.snapshot:
            # The pinned resolver checks registration structure/path/hash; also
            # reject raw duplicate JSON keys rather than accepting JSON's last key.
            read_json(root / CATALOG)
        policy.check(item.source.relative_to(root).as_posix())
        watched[item.source] = expected
        resolved.append(item)
        return item.evidence()

    inputs = [resolve(name, expected) for name, expected in pins.items()]
    manifest_path = retained / "retained-files.json"
    watched[manifest_path] = sha(manifest_path)
    manifest = read_json(manifest_path)
    if not isinstance(manifest, dict) or not manifest:
        raise ValueError(
            "retained-files.json must be a nonempty repository-path/SHA256 map"
        )
    inventory = []
    folded = set()
    for name, expected in manifest.items():
        safe_relative(name)
        valid_hash(expected)
        if name.casefold() in folded:
            raise ValueError("Duplicate normalized retained-files pin: " + name)
        folded.add(name.casefold())
        inventory.append(resolve(name, expected))
    checked_outputs = []
    for label, directory in [("retained", retained), ("public", public)]:
        if directory is None:
            continue
        for name, record in outputs.items():
            path = directory / name
            rel = path.relative_to(root).as_posix()
            policy.check(rel)
            if not path.is_file() or sha(path) != record["sha256"]:
                raise ValueError("Missing/mismatched " + label + " output: " + rel)
            if "bytes" in record and path.stat().st_size != record["bytes"]:
                raise ValueError("Incorrect declared output byte count: " + rel)
            if manifest.get(rel) != record["sha256"]:
                raise ValueError(
                    "Output missing/conflicting in retained-files.json: " + rel
                )
            watched[path] = record["sha256"]
            checked_outputs.append(
                {
                    "location": label,
                    "path": rel,
                    "sha256": sha(path),
                    "bytes": path.stat().st_size,
                }
            )
    catalog_hashes = {item.catalog_sha256 for item in resolved if item.snapshot}
    if len(catalog_hashes) > 1:
        raise ValueError("Snapshot catalog changed during static audit")
    if catalog_hashes:
        watched[root / CATALOG] = next(iter(catalog_hashes))
    for rel, expected in policy.hashes.items():
        watched[root / rel] = expected
    for path, expected in watched.items():
        if not path.is_file() or sha(path) != expected:
            raise ValueError("Input/output changed during static audit: " + str(path))
    return {
        "status": "passed",
        "auditKind": "static-hash-declaration",
        "auditorSha256": sha(Path(__file__)),
        "receipt": receipt_path.relative_to(root).as_posix(),
        "receiptSha256": watched[receipt_path],
        "retained": retained.relative_to(root).as_posix(),
        "public": public.relative_to(root).as_posix() if public else None,
        "inputRoot": input_root.relative_to(root).as_posix() if input_root else None,
        "explicitModelName": model_name,
        "declaredInputPins": len(inputs),
        "auditedReceiptPinMaps": ["inputHashes", "sharedInputHashes"],
        "supplementalReceiptHashMapsNotAudited": [
            name
            for name in receipt
            if name.endswith("InputHashes")
            and name not in {"inputHashes", "sharedInputHashes"}
        ],
        "inputs": inputs,
        "normalizedOutputs": outputs,
        "checkedOutputs": checked_outputs,
        "retainedFilePins": len(inventory),
        "retainedFilesSha256": watched[manifest_path],
        "retainedFiles": inventory,
        "historicalResolutions": [
            item.evidence() for item in resolved if item.snapshot
        ],
        "ignoreRuleHashes": policy.hashes,
        "resolverSha256": sha(Path(__file__).with_name("replay_inputs.py")),
        "freshConstructionPerformed": False,
        "qualificationGranted": False,
        "limits": LIMITS,
    }


def qa_directory(root, value):
    root = root.resolve()
    value = Path(value)
    if ".." in value.parts:
        raise ValueError("QA path must not contain traversal")
    base = root / "data"
    if base.resolve() != base:
        raise ValueError("Repository data directory must not redirect elsewhere")
    path = repo_path(root, value)
    if path == base or not path.is_relative_to(base):
        raise ValueError(
            "QA directory must be strictly inside ignored repository data/"
        )
    output = path / "retained-source-audit.json"
    if output.resolve() != output:
        raise ValueError("QA result must not be a symlink")
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("--retained", required=True, type=Path)
    parser.add_argument("--public", type=Path)
    parser.add_argument("--input-root", type=Path)
    parser.add_argument(
        "--model-name",
        choices=["model.glb", "rider.glb"],
        help="Explicit primary filename for scalar-only modern receipts; must agree with any output map",
    )
    parser.add_argument("--qa", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        qa = qa_directory(ROOT, args.qa)
    except ValueError as error:
        parser.error(str(error))
    try:
        result = audit(
            ROOT,
            args.receipt,
            args.retained,
            args.public,
            args.input_root,
            args.model_name,
        )
        code = 0
    except (ValueError, OSError) as error:
        result = {
            "status": "failed",
            "auditKind": "static-hash-declaration",
            "auditorSha256": sha(Path(__file__)),
            "error": str(error),
            "freshConstructionPerformed": False,
            "qualificationGranted": False,
            "limits": LIMITS,
        }
        code = 1
    qa.mkdir(parents=True, exist_ok=True)
    (qa / "retained-source-audit.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                key: result[key]
                for key in result
                if key not in {"inputs", "retainedFiles"}
            }
        )
    )
    return code


if __name__ == "__main__":
    raise SystemExit(main())
