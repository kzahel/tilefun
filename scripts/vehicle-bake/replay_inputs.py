"""Resolve retained input pins without changing historical receipts.

Current bytes take precedence. Historical bytes require an exact path/hash entry
in the retained replay-input catalog, and are copied to their original paths.
"""

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil

SNAPSHOTS = "art-source/vehicle-bake/replay-inputs"
CATALOG = SNAPSHOTS + "/catalog.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def safe_relative(name):
    if not isinstance(name, str) or not name:
        raise ValueError("Input path must be a nonempty repository-relative path")
    path = PurePosixPath(name)
    if (path.is_absolute() or ".." in path.parts or ":" in name or "\\" in name
            or path.as_posix() != name or not path.parts):
        raise ValueError("Unsafe input path: " + name)
    if path.parts[0] in ("data", "test-results"):
        raise ValueError("Ignored input dependency: " + name)
    return path


def contained(root, name):
    path = (root / safe_relative(name)).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Input escapes repository: " + name)
    return path


def valid_hash(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("Expected a lowercase SHA256 input pin")


@dataclass(frozen=True)
class ResolvedInput:
    path: str
    sha256: str
    source: Path
    snapshot: str | None = None
    catalog_sha256: str | None = None

    def evidence(self):
        record = {"path": self.path, "sha256": self.sha256,
                  "resolution": "historical" if self.snapshot else "current"}
        if self.snapshot:
            record.update(snapshot=self.snapshot, catalogSha256=self.catalog_sha256)
        return record


def resolve_input(root, name, expected, catalog=CATALOG):
    root = Path(root).resolve()
    valid_hash(expected)
    current = contained(root, name)
    if current.is_file() and sha(current) == expected:
        return ResolvedInput(name, expected, current)
    catalog_path = contained(root, catalog)
    if not catalog_path.is_file():
        raise ValueError("Missing/stale retained input; no snapshot catalog: " + name)
    # Hash and parse the same bytes so QA identifies the catalog actually used.
    catalog_bytes = catalog_path.read_bytes()
    catalog_sha = hashlib.sha256(catalog_bytes).hexdigest()
    registry = json.loads(catalog_bytes.decode("utf-8-sig"))
    if registry.get("version") != 1 or not isinstance(registry.get("inputs"), list):
        raise ValueError("Unsupported replay-input catalog")
    entries = {}
    snapshot_root = root / SNAPSHOTS
    for entry in registry["inputs"]:
        if not isinstance(entry, dict) or set(entry) != {"path", "sha256", "snapshot"}:
            raise ValueError("Malformed replay-input registration")
        safe_relative(entry["path"])
        valid_hash(entry["sha256"])
        snapshot = contained(root, entry["snapshot"])
        if not snapshot.is_relative_to(snapshot_root) or snapshot == snapshot_root:
            raise ValueError("Snapshot must stay under " + SNAPSHOTS)
        key = (entry["path"], entry["sha256"])
        if key in entries:
            raise ValueError("Duplicate replay-input registration")
        entries[key] = (entry["snapshot"], snapshot)
    match = entries.get((name, expected))
    if match is None:
        raise ValueError("Unregistered historical input path/hash: " + name)
    snapshot_name, snapshot = match
    if not snapshot.is_file() or sha(snapshot) != expected:
        raise ValueError("Missing/tampered historical snapshot: " + snapshot_name)
    return ResolvedInput(name, expected, snapshot, snapshot_name, catalog_sha)


def copy_inputs(root, pins, scratch, catalog=CATALOG):
    if not isinstance(pins, dict) or not pins:
        raise ValueError("Replay requires declared input pins")
    resolved = [resolve_input(root, name, expected, catalog) for name, expected in pins.items()]
    if len({item.catalog_sha256 for item in resolved if item.snapshot}) > 1:
        raise ValueError("Replay-input catalog changed while resolving pins")
    scratch = Path(scratch).resolve()
    for item in resolved:
        target = contained(scratch, item.path)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(item.source, target)
        if sha(target) != item.sha256:
            raise ValueError("Input changed while copying: " + item.path)
    historical = [item.evidence() for item in resolved if item.snapshot]
    return {"declaredInputPins": len(resolved), "historicalInputs": historical,
            "snapshotCatalogSha256": historical[0]["catalogSha256"] if historical else None}
