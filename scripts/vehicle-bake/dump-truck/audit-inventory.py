"""Actual six-wheel v2 inventory audit and wrong-declaration negatives."""

from pathlib import Path
import hashlib
import importlib.util
import json
import sys

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
spec = importlib.util.spec_from_file_location(
    "dump_inventory_catalog_v2", ROOT / "scripts/vehicle-bake/catalog-v2.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
cfg = json.loads(Path(__file__).with_name("family.json").read_text())
ids = cfg["wheelIds"]
path = ROOT / "public/demos/vehicle-bake/dump-truck/v1/model.glb"
before = hashlib.sha256(path.read_bytes()).hexdigest()
audit = module.audit_glb(path, wheel_ids=ids)
assert len(audit["wheels"]) == 6 and audit["meshes"] == audit["primitives"] == 7
cases = []
for name, wrong in [
    ("omitted-middle-pair", ["FL", "FR", "RL", "RR"]),
    ("omitted-MR", [w for w in ids if w != "MR"]),
    ("duplicate-ML", ids + ["ML"]),
    ("unexpected-extra-XL", ids + ["XL"]),
]:
    rejected = False
    try:
        module.audit_glb(path, wheel_ids=wrong)
    except AssertionError:
        rejected = True
    assert rejected, name
    cases.append({"case": name, "declaredWheelIds": wrong, "rejected": True})
assert hashlib.sha256(path.read_bytes()).hexdigest() == before
out = {
    "status": "passed",
    "glbSha256": before,
    "toolchain": "multi-axle-v2",
    "wheelIds": ids,
    "actualAudit": audit,
    "wrongInventoryControls": cases,
    "inputBytesUnchanged": True,
    "catalogV2Sha256": hashlib.sha256(
        (ROOT / "scripts/vehicle-bake/catalog-v2.py").read_bytes()
    ).hexdigest(),
    "underlyingCatalogSha256": hashlib.sha256(
        (ROOT / "scripts/vehicle-bake/catalog.py").read_bytes()
    ).hexdigest(),
}
(ROOT / "data/vehicle-bake/dump-truck/inventory-controls.json").write_text(
    json.dumps(out, indent=2) + "\n"
)
print(json.dumps(out, indent=2))
