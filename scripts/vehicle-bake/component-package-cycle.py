"""Versioned true-cycle adapter of the retained static component package.

Uses catalog-cycle for explicit F/R[/SC]; the pinned car packager is unchanged.

The two component GLBs remain the geometry sources; their own packed masters and
constructor replay receipts stay linked. This does not claim a high-to-low bake.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil

from functools import partial

ROOT = Path(__file__).resolve().parents[2]
cycle_spec = importlib.util.spec_from_file_location(
    "component_cycle_audit", Path(__file__).with_name("catalog-cycle.py")
)
cycle_catalog = importlib.util.module_from_spec(cycle_spec)
cycle_spec.loader.exec_module(cycle_catalog)
spec = importlib.util.spec_from_file_location(
    "component_composer", Path(__file__).with_name("compose-component-cycle.py")
)
composer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(composer)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, indent=2) + "\n").encode())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path)
    parser.add_argument("--scratch", action="store_true")
    parser.add_argument("--finalize", action="store_true")
    args = parser.parse_args()
    config = read(args.config)
    wheel_ids = cycle_catalog.validate_ids(config["wheelIds"])
    audit_glb = partial(cycle_catalog.audit_glb, wheel_ids=wheel_ids)
    art, public = ROOT / config["retained"], ROOT / config["public"]
    assert art.resolve().is_relative_to(ROOT / "art-source/vehicle-bake")
    assert public.resolve().is_relative_to(ROOT / "public/demos/vehicle-bake")
    if args.finalize:
        assert not args.scratch
        report = read(public / "report.json")
        assert report["status"] == "draft", "Retained source is immutable"
        proof = read(ROOT / config["qa"] / "parent-source-replay.json")
        expected = read(art / "evidence/replay-verification.json")
        assert proof["status"] == "passed" and proof["independent"]
        assert proof["glbSha256"] == expected["glbSha256"] == sha(public / "model.glb")
        for name, value in expected["outputHashes"].items():
            assert sha(public / name) == value
        for name, value in expected["inputHashes"].items():
            assert sha(ROOT / name) == value
        expected.update(status="passed", byteIdentical=True)
        write(art / "evidence/replay-verification.json", expected)
        report.update(status="complete", sourceImmutable=True)
        write(public / "report.json", report)
        write(art / "report.json", report)
        files = dict(expected["inputHashes"])
        for directory in [art, public]:
            for path in directory.rglob("*"):
                if path.is_file() and path.name != "retained-files.json":
                    files[path.relative_to(ROOT).as_posix()] = sha(path)
        write(art / "retained-files.json", files)
        print(
            json.dumps(
                {
                    "status": "retained-prototype",
                    "id": config["id"],
                    "files": len(files),
                }
            )
        )
        return
    destination = ROOT / config["scratch"] if args.scratch else public
    assert not (
        destination / "report.json"
    ).exists(), "Use a fresh source revision/workspace"
    if args.scratch:
        assert destination.resolve().is_relative_to(ROOT / "data")
    destination.mkdir(parents=True, exist_ok=True)
    names = [
        config["canonicalConfig"],
        "scripts/vehicle-bake/component-package-cycle.py",
        "scripts/vehicle-bake/compose-component.py",
        "scripts/vehicle-bake/compose-component-cycle.py",
        "scripts/vehicle-bake/catalog-cycle.py",
    ]
    names += config.get("additionalInputs", [])
    for role in ["base", "component"]:
        child = config[role]
        names += [child[key] for key in ["model", "atlas", "master", "replay"]]
        replay = read(ROOT / child["replay"])
        assert replay["byteIdentical"] and replay["scratchInputDependencies"] == []
        assert sha(ROOT / child["model"]) == replay["glbSha256"]
        assert sha(ROOT / child["atlas"]) == replay["atlasSha256"]
    pins = {name: sha(ROOT / name) for name in names}
    model, preservation = composer.compose(
        ROOT / config["base"]["model"],
        ROOT / config["component"]["model"],
        config["mountBlenderWorldPixels"],
        config["prefix"],
    )
    (destination / "model.glb").write_bytes(model)
    shutil.copyfile(ROOT / config["base"]["atlas"], destination / "atlas.png")
    shutil.copyfile(
        ROOT / config["component"]["atlas"], destination / "companion-atlas.png"
    )
    recipe = {
        "method": "Exact static GLB component graph/buffer assembly; child authored master/constructor proofs retained separately",
        "config": config,
        "inputs": pins,
        "preservation": preservation,
    }
    write(destination / "recipe.json", recipe)
    write(destination / "composition.json", preservation)
    size = config["nativeSize"]
    report = {
        "status": "draft",
        "sourceImmutable": False,
        "humanApproval": False,
        "runtime": "not integrated",
        "method": config["method"],
        "audit": audit_glb(destination / "model.glb"),
        "sourceHashes": pins,
        "assemblyMasters": [config["base"]["master"], config["component"]["master"]],
        "render": {
            "nativeSize": size,
            "meshRadius": size / 2,
            "studyGroundOrigin": [size / 2, size / 2 + 28],
            "engineGroundOrigin": [size / 2, size / 2],
        },
        "limits": config["limits"],
    }
    write(destination / "report.json", report)
    if not args.scratch:
        art.mkdir(parents=True, exist_ok=True)
        for path in destination.iterdir():
            if path.is_file():
                shutil.copyfile(path, art / path.name)
        outputs = {
            name: sha(destination / name)
            for name in ["model.glb", "atlas.png", "companion-atlas.png", "recipe.json"]
        }
        write(
            art / "evidence/replay-verification.json",
            {
                "status": "expected-outputs-not-replayed",
                "byteIdentical": False,
                "runner": "python",
                "invokedBuilder": "scripts/vehicle-bake/component-package-cycle.py",
                "arguments": [config["canonicalConfig"], "--scratch"],
                "inputHashes": pins,
                "sharedInputHashes": {},
                "scratchInputDependencies": [],
                "glbSha256": outputs["model.glb"],
                "atlasSha256": outputs["atlas.png"],
                "recipeSha256": outputs["recipe.json"],
                "outputHashes": outputs,
            },
        )
    print(
        json.dumps(
            {
                "status": "built-prototype-pending-source-replay",
                "id": config["id"],
                "modelSha256": sha(destination / "model.glb"),
            }
        )
    )


if __name__ == "__main__":
    main()
