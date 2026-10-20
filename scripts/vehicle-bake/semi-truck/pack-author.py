"""Build ignored self-contained author inspection from exact current captures."""

from pathlib import Path
import importlib.util
import json
import sys

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
spec = importlib.util.spec_from_file_location(
    "family_package", ROOT / "scripts/vehicle-bake/family-package-v2.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
cfg = json.loads((ROOT / "data/vehicle-bake/semi-truck/author-config.json").read_text())
(ROOT / cfg["offline"]).write_text(
    module.load_package(cfg).offline_html(cfg), encoding="utf-8"
)
