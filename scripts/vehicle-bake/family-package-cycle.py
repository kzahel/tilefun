"""Motorcycle-v1 adapter injecting the strict cycle audit into pinned old packaging.

No pinned tool is edited. Static prepare is allowed; assemble/freeze require
actual shared-loader capture. This adapter never activates a runtime catalog.
"""

import argparse
import functools
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "catalog_cycle", Path(__file__).with_name("catalog-cycle.py")
)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


def load_package(config):
    assert config["toolchain"] == "motorcycle-v1", "Explicit motorcycle-v1 required"
    expected = catalog.validate_ids(config["wheelIds"])
    spec = importlib.util.spec_from_file_location(
        "family_package_cycle_base", Path(__file__).with_name("family-package.py")
    )
    package = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(package)
    package.audit_glb = functools.partial(catalog.audit_glb, wheel_ids=expected)
    original_prepare, original_assemble, original_freeze, original_verify = (
        package.prepare,
        package.assemble,
        package.freeze,
        package.verify_frozen,
    )

    def prepare(cfg):
        original_prepare(cfg)
        path = package.ROOT / cfg["qa"] / "clearance-input.json"
        manifest = package.read(path)
        for row in manifest["candidates"]:
            row.update(toolchain="motorcycle-v1", wheelIds=list(expected))
        package.write(path, manifest)

    def capture_guard(cfg, frozen=False):
        folder = package.ROOT / cfg["output"]
        capture = package.read(folder / "captures/capture.json")
        assert (
            capture.get("sharedLoaderQualification")
            == "passed-actual-shared-CarMeshAsset"
        ), "Cycle shared-loader/browser qualification pending"
        assert (
            capture.get("toolchain") == "motorcycle-v1"
            and capture.get("status") == "passed"
        )
        assert {w["id"] for w in capture["rig"]["wheels"]} == set(expected) and len(
            capture["rig"]["wheels"]
        ) == len(expected)
        for w in capture["rig"]["wheels"]:
            assert all(
                w[k]
                for k in [
                    "quarterTurn",
                    "pivotFixed",
                    "independent",
                    "reverseQuarterTurn",
                    "absoluteReset",
                ]
            )
        if frozen:
            clear = package.read(folder / "clearance.json")[0]
        else:
            clear = package.read(package.ROOT / cfg["qa"] / "clearance.json")[0]
        assert (
            clear["status"] == "passed"
            and clear.get("inputBytesUnchanged")
            and clear.get("toolchain") == "motorcycle-v1"
        )
        assert len(clear["clearance"]) == len(expected) and {
            w["wheel"] for w in clear["clearance"]
        } == {f"Wheel_{wid}_Roll" for wid in expected}
        controls = clear["perWheelCollisionControls"]
        assert len(controls) == len(expected) and {w["wheel"] for w in controls} == {
            f"Wheel_{wid}_Roll" for wid in expected
        }
        assert all(
            w["collidingBodyRejected"] and w["baselineRestored"] for w in controls
        )

    def assemble(cfg):
        capture_guard(cfg)
        return original_assemble(cfg)

    def freeze(cfg):
        capture_guard(cfg)
        browser = package.read(package.ROOT / cfg["qa"] / "browser-qa.json")
        assert (
            browser.get("sharedLoaderQualification")
            == "passed-actual-shared-CarMeshAsset"
        )
        return original_freeze(cfg)

    def verify(cfg):
        result = original_verify(cfg)
        capture_guard(cfg, frozen=True)
        return result

    package.prepare, package.assemble, package.freeze, package.verify_frozen = (
        prepare,
        assemble,
        freeze,
        verify,
    )
    return package


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path)
    parser.add_argument("action", choices=["prepare", "assemble", "freeze", "offline"])
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    package = load_package(config)
    {
        "prepare": package.prepare,
        "assemble": package.assemble,
        "freeze": package.freeze,
        "offline": package.frozen_offline,
    }[args.action](config)
