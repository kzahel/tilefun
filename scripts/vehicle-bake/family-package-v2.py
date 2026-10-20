"""Explicit multi-axle adapter around the immutable family review packager."""

import argparse
import functools
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("catalog_v2", Path(__file__).with_name("catalog-v2.py"))
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


def load_package(config):
    wheel_ids = config["wheelIds"]
    assert config["toolchain"] == "multi-axle-v2"
    spec = importlib.util.spec_from_file_location("family_package_v1", Path(__file__).with_name("family-package.py"))
    package = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(package)
    package.audit_glb = functools.partial(catalog.audit_glb, wheel_ids=wheel_ids)
    return package


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path)
    parser.add_argument("action", choices=["prepare", "assemble", "freeze", "offline"])
    args = parser.parse_args()
    import json
    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    package = load_package(config)
    if args.action == "prepare":
        package.prepare(config)
        path = package.ROOT / config["qa"] / "clearance-input.json"
        manifest = package.read(path)
        for row in manifest["candidates"]:
            row["wheelIds"] = config["wheelIds"]
        package.write(path, manifest)
    else:
        {"assemble": package.assemble, "freeze": package.freeze, "offline": package.frozen_offline}[args.action](config)
