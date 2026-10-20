"""Focused static-audit controls. Fixtures/results only under ignored data/."""

import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
SPEC = importlib.util.spec_from_file_location(
    "retained_audit_control", Path(__file__).with_name("retained-source-audit.py")
)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / "data/vehicle-bake/retained-source-audit-controls"


def digest(data):
    return hashlib.sha256(data).hexdigest()


class RetainedAuditControls(unittest.TestCase):
    def setUp(self):
        QA.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix="static-control-", dir=QA)).resolve()
        assert self.root.is_relative_to(QA.resolve())
        self.write(".gitignore", b"data/\nnode_modules/\n*.blend1\nignored/\n")
        self.retained = "art-source/control/v1"
        self.public = "public/control/v1"
        self.builder = "scripts/control/build.py"
        self.write(self.builder, b"raise RuntimeError('Never execute this fixture')\n")
        self.outputs = {
            "model.glb": b"fake-model-byte-control-not-GLB-validation",
            "atlas.png": b"fake-atlas-byte-control",
            "recipe.json": b"{}",
        }
        self.receipt = {
            "inputHashes": {self.builder: AUDIT.sha(self.root / self.builder)},
            "sharedInputHashes": {},
            "outputHashes": {n: digest(v) for n, v in self.outputs.items()},
        }
        for directory in [self.retained, self.public]:
            for name, value in self.outputs.items():
                self.write(directory + "/" + name, value)
        self.write(self.retained + "/report.json", b"retained-extra-file")
        self.manifest = {
            p.relative_to(self.root).as_posix(): AUDIT.sha(p)
            for p in self.root.rglob("*")
            if p.is_file() and p.name != ".gitignore"
        }
        self.receipt_path = self.retained + "/source-replay.json"

    def write(self, name, value):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(value)
        return p

    def json(self, name, value):
        return self.write(name, (json.dumps(value) + "\n").encode())

    def invoke(self, receipt=None, public=True, input_root=None, model_name=None):
        self.json(self.receipt_path, self.receipt if receipt is None else receipt)
        self.json(self.retained + "/retained-files.json", self.manifest)
        return AUDIT.audit(
            self.root,
            self.receipt_path,
            self.retained,
            self.public if public else None,
            input_root,
            model_name,
        )

    def scalar_receipt(self):
        self.receipt.pop("outputHashes")
        self.receipt.update(
            glbSha256=digest(self.outputs["model.glb"]),
            atlasSha256=digest(self.outputs["atlas.png"]),
            recipeSha256=digest(self.outputs["recipe.json"]),
        )

    def test_scalar_only_with_explicit_model_name_passes(self):
        self.scalar_receipt()
        result = self.invoke(model_name="model.glb")
        self.assertEqual(result["explicitModelName"], "model.glb")
        self.assertEqual(len(result["checkedOutputs"]), 6)

    def test_scalar_only_with_explicit_rider_name_passes(self):
        self.scalar_receipt()
        for directory in [self.retained, self.public]:
            path = self.write(directory + "/rider.glb", self.outputs["model.glb"])
            self.manifest[path.relative_to(self.root).as_posix()] = AUDIT.sha(path)
        result = self.invoke(model_name="rider.glb")
        self.assertIn("rider.glb", result["normalizedOutputs"])
        self.assertNotIn("model.glb", result["normalizedOutputs"])

    def test_scalar_only_missing_explicit_name_rejected(self):
        self.scalar_receipt()
        with self.assertRaisesRegex(ValueError, "supply --model-name"):
            self.invoke()

    def test_scalar_only_requires_three_scalar_hashes(self):
        self.scalar_receipt()
        for field in ["glbSha256", "atlasSha256", "recipeSha256"]:
            receipt = copy.deepcopy(self.receipt)
            receipt.pop(field)
            with self.subTest(field=field), self.assertRaisesRegex(
                ValueError, "requires scalar SHA256"
            ):
                self.invoke(receipt, model_name="model.glb")

    def test_scalar_only_invalid_or_structured_hash_rejected(self):
        self.scalar_receipt()
        for field in ["glbSha256", "atlasSha256", "recipeSha256"]:
            for value in ["invalid", {"sha256": self.receipt[field]}]:
                receipt = copy.deepcopy(self.receipt)
                receipt[field] = value
                with self.subTest(field=field, value=value), self.assertRaisesRegex(
                    ValueError, "Expected a lowercase SHA256"
                ):
                    self.invoke(receipt, model_name="model.glb")

    def test_scalar_only_wrong_model_choice_rejected(self):
        self.scalar_receipt()
        with self.assertRaisesRegex(ValueError, "Missing/mismatched retained output"):
            self.invoke(model_name="rider.glb")

    def test_scalar_only_wrong_output_bytes_rejected(self):
        self.scalar_receipt()
        self.receipt["glbSha256"] = digest(b"different-model")
        with self.assertRaisesRegex(ValueError, "Missing/mismatched retained output"):
            self.invoke(model_name="model.glb")

    def test_explicit_model_name_cannot_override_mapped_name(self):
        with self.assertRaisesRegex(ValueError, "contradicts mapped model"):
            self.invoke(model_name="rider.glb")

    def test_explicit_model_name_cannot_override_scalar_conflict(self):
        self.receipt["glbSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "Conflicting output"):
            self.invoke(model_name="model.glb")

    def test_scalar_and_nonmodel_map_alias_conflict_rejected(self):
        self.scalar_receipt()
        self.receipt["outputs"] = {"atlas.png": "0" * 64}
        with self.assertRaisesRegex(ValueError, "Conflicting output"):
            self.invoke(model_name="model.glb")

    def test_model_name_does_not_admit_legacy_receipt(self):
        with self.assertRaisesRegex(ValueError, "Legacy.*replay.md or result.md"):
            self.invoke({"inputs": {"builder": self.builder}}, model_name="model.glb")

    def historical_src(self, registered=True, tampered=False):
        name = "src/rendering/CarMeshAsset.ts"
        old = b"registered-old-renderer-control"
        expected = digest(old)
        self.write(name, b"new-renderer-control")
        self.manifest[name] = expected
        snapshot = "art-source/vehicle-bake/replay-inputs/old/src/CarMeshAsset.ts"
        self.write(snapshot, b"tampered" if tampered else old)
        self.json(
            AUDIT.CATALOG,
            {
                "version": 1,
                "inputs": (
                    [{"path": name, "sha256": expected, "snapshot": snapshot}]
                    if registered
                    else []
                ),
            },
        )

    def test_static_positive_does_not_execute_builder(self):
        r = self.invoke()
        self.assertEqual(r["declaredInputPins"], 1)
        self.assertEqual(len(r["checkedOutputs"]), 6)
        self.assertFalse(r["freshConstructionPerformed"])
        self.assertFalse(r["qualificationGranted"])

    def test_optional_public_is_not_implied(self):
        self.write(self.public + "/model.glb", b"tamper")
        # Unrequested public outputs remain checked if present in the manifest.
        self.manifest.pop(self.public + "/model.glb")
        r = self.invoke(public=False)
        self.assertIsNone(r["public"])
        self.assertEqual(len(r["checkedOutputs"]), 3)

    def test_wrong_input_rejected(self):
        self.write(self.builder, b"wrong-input")
        with self.assertRaisesRegex(ValueError, "Missing/stale retained input"):
            self.invoke()

    def test_missing_input_rejected(self):
        self.receipt["inputHashes"] = {"scripts/control/missing.py": "0" * 64}
        with self.assertRaisesRegex(ValueError, "Missing/stale retained input"):
            self.invoke()

    def test_wrong_retained_output_rejected(self):
        self.write(self.retained + "/model.glb", b"wrong-model")
        with self.assertRaises(ValueError):
            self.invoke()

    def test_missing_retained_output_rejected(self):
        self.receipt["outputHashes"]["rider.glb"] = self.receipt["outputHashes"].pop(
            "model.glb"
        )
        with self.assertRaisesRegex(ValueError, "Missing/mismatched retained output"):
            self.invoke()

    def test_wrong_public_output_rejected(self):
        self.write(self.public + "/atlas.png", b"wrong-atlas")
        with self.assertRaises(ValueError):
            self.invoke()

    def test_unpinned_output_rejected(self):
        self.manifest.pop(self.retained + "/recipe.json")
        with self.assertRaisesRegex(ValueError, "Output missing/conflicting"):
            self.invoke()

    def test_retained_nonoutput_tamper_rejected(self):
        self.write(self.retained + "/report.json", b"wrong-report")
        with self.assertRaises(ValueError):
            self.invoke()

    def test_ignored_data_input_rejected(self):
        p = self.write("data/hidden.py", b"hidden")
        self.receipt["sharedInputHashes"]["data/hidden.py"] = AUDIT.sha(p)
        with self.assertRaisesRegex(ValueError, "Ignored input dependency"):
            self.invoke()

    def test_gitignored_backup_rejected(self):
        p = self.write("scripts/control/master.blend1", b"backup")
        self.receipt["inputHashes"]["scripts/control/master.blend1"] = AUDIT.sha(p)
        with self.assertRaisesRegex(ValueError, "Ignored retained dependency"):
            self.invoke()

    def test_gitignored_retained_pin_rejected(self):
        p = self.write("node_modules/hidden.js", b"hidden")
        self.manifest["node_modules/hidden.js"] = AUDIT.sha(p)
        with self.assertRaisesRegex(ValueError, "Ignored retained dependency"):
            self.invoke()

    def test_ignored_parent_cannot_be_reopened_by_child(self):
        self.write(".gitignore", b"ignored/\n!ignored/child.py\n")
        p = self.write("ignored/child.py", b"hidden")
        self.receipt["inputHashes"]["ignored/child.py"] = AUDIT.sha(p)
        with self.assertRaisesRegex(ValueError, "Ignored retained dependency"):
            self.invoke()

    def test_nested_ignore_rules_rejected(self):
        self.write("scripts/control/.gitignore", b"secret.json\n")
        p = self.write("scripts/control/secret.json", b"hidden")
        self.receipt["inputHashes"]["scripts/control/secret.json"] = AUDIT.sha(p)
        with self.assertRaisesRegex(ValueError, "Ignored retained dependency"):
            self.invoke()

    def test_registered_historical_src_pin_passes(self):
        self.historical_src()
        r = self.invoke()
        self.assertEqual(len(r["historicalResolutions"]), 1)
        self.assertEqual(
            r["historicalResolutions"][0]["path"], "src/rendering/CarMeshAsset.ts"
        )

    def test_unregistered_historical_src_pin_rejected(self):
        self.historical_src(registered=False)
        with self.assertRaisesRegex(ValueError, "Unregistered historical"):
            self.invoke()

    def test_registered_history_cannot_hide_cross_manifest_conflict(self):
        self.historical_src()
        name = "src/rendering/CarMeshAsset.ts"
        self.receipt["inputHashes"][name] = AUDIT.sha(self.root / name)
        with self.assertRaisesRegex(ValueError, "Conflicting input/retained-files pin"):
            self.invoke()

    def test_tampered_historical_snapshot_rejected(self):
        self.historical_src(tampered=True)
        with self.assertRaisesRegex(ValueError, "Missing/tampered historical"):
            self.invoke()

    def test_duplicate_snapshot_registration_rejected(self):
        self.historical_src()
        p = self.root / AUDIT.CATALOG
        value = json.loads(p.read_text())
        value["inputs"].append(copy.deepcopy(value["inputs"][0]))
        self.json(AUDIT.CATALOG, value)
        with self.assertRaisesRegex(ValueError, "Duplicate replay-input registration"):
            self.invoke()

    def test_duplicate_catalog_json_key_rejected(self):
        self.historical_src()
        p = self.root / AUDIT.CATALOG
        p.write_text(
            p.read_text().replace('"version": 1', '"version": 1, "version": 1')
        )
        with self.assertRaisesRegex(ValueError, "Duplicate JSON key"):
            self.invoke()

    def test_duplicate_input_across_maps_rejected_even_equal(self):
        self.receipt["sharedInputHashes"] = dict(self.receipt["inputHashes"])
        with self.assertRaisesRegex(ValueError, "Duplicate/conflicting"):
            self.invoke()

    def test_conflicting_input_across_maps_rejected(self):
        self.receipt["sharedInputHashes"] = {self.builder: "0" * 64}
        with self.assertRaisesRegex(ValueError, "Duplicate/conflicting"):
            self.invoke()

    def test_duplicate_json_keys_rejected(self):
        p = self.write(self.receipt_path, b'{"inputHashes": {}, "inputHashes": {}}')
        with self.assertRaisesRegex(ValueError, "Duplicate JSON key"):
            AUDIT.audit(self.root, p, self.retained)

    def test_conflicting_output_alias_rejected(self):
        self.receipt["outputs"] = {"atlas.png": "0" * 64}
        with self.assertRaisesRegex(ValueError, "Conflicting output"):
            self.invoke()

    def test_conflicting_scalar_alias_rejected(self):
        self.receipt["glbSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "Conflicting output"):
            self.invoke()

    def test_structured_output_aliases_and_companion_atlas_pass(self):
        name, value = "companion-atlas.png", b"companion"
        for directory in [self.retained, self.public]:
            p = self.write(directory + "/" + name, value)
            self.manifest[p.relative_to(self.root).as_posix()] = AUDIT.sha(p)
        self.outputs[name] = value
        self.receipt["outputHashes"][name] = digest(value)
        self.receipt["outputs"] = {
            n: {"sha256": digest(v), "bytes": len(v), "byteExact": True}
            for n, v in self.outputs.items()
        }
        self.receipt["atlasSha256"] = {"sha256": digest(self.outputs["atlas.png"])}
        r = self.invoke()
        self.assertEqual(len(r["checkedOutputs"]), 8)

    def test_structured_output_hash_map_passes(self):
        self.receipt["outputHashes"] = {
            n: {"sha256": h} for n, h in self.receipt["outputHashes"].items()
        }
        self.assertEqual(self.invoke()["status"], "passed")

    def test_bad_alias_not_ignored_when_other_map_valid(self):
        self.receipt["outputs"] = {"atlas.png": {"hash": "0" * 64}}
        with self.assertRaisesRegex(ValueError, "containing sha256"):
            self.invoke()

    def test_unknown_structured_metadata_rejected(self):
        self.receipt["outputs"] = {"atlas.png": {"sha256": "0" * 64, "mystery": True}}
        with self.assertRaisesRegex(ValueError, "Unsupported output metadata"):
            self.invoke()

    def test_wrong_structured_byte_count_rejected(self):
        self.receipt["outputs"] = {
            "atlas.png": {"sha256": digest(self.outputs["atlas.png"]), "bytes": 999}
        }
        with self.assertRaisesRegex(ValueError, "Incorrect declared output byte count"):
            self.invoke()

    def test_missing_recipe_declaration_rejected(self):
        self.receipt["outputHashes"].pop("recipe.json")
        with self.assertRaisesRegex(ValueError, "declare atlas.png and recipe.json"):
            self.invoke()

    def test_ambiguous_model_declaration_rejected(self):
        self.receipt["outputHashes"]["rider.glb"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "exactly one"):
            self.invoke()

    def test_legacy_role_map_rejected_with_guidance(self):
        with self.assertRaisesRegex(ValueError, "Legacy.*replay.md or result.md"):
            self.invoke({"inputs": {"builder": self.builder}})

    def test_local_five_input_pose_requires_explicit_root(self):
        local = {}
        for name in [
            "build.py",
            "rider.json",
            "identity.json",
            "profile.json",
            "pose.json",
        ]:
            path = self.write("scripts/control/" + name, name.encode())
            local[name] = AUDIT.sha(path)
            self.manifest[path.relative_to(self.root).as_posix()] = AUDIT.sha(path)
        self.receipt["inputHashes"] = local
        with self.assertRaisesRegex(ValueError, "--input-root"):
            self.invoke()
        self.assertEqual(
            self.invoke(input_root="scripts/control")["declaredInputPins"], 5
        )

    def test_local_and_full_alias_duplicate_rejected(self):
        self.receipt["inputHashes"]["build.py"] = self.receipt["inputHashes"][
            self.builder
        ]
        with self.assertRaisesRegex(ValueError, "Duplicate/conflicting"):
            self.invoke(input_root="scripts/control")

    def test_nonempty_unhashed_dependency_declaration_rejected(self):
        self.receipt["scratchInputDependencies"] = ["data/hidden.py"]
        with self.assertRaisesRegex(ValueError, "Undeclared dependencies"):
            self.invoke()

    def test_qa_outside_data_or_traversal_rejected(self):
        for value in [
            "art-source/qa",
            "data",
            "data/../data/qa",
            self.root.parent / "outside",
        ]:
            with self.subTest(path=str(value)), self.assertRaises(ValueError):
                AUDIT.qa_directory(self.root, value)

    def test_cli_writes_static_failure_inside_qa(self):
        self.invoke()
        self.write(self.builder, b"tamper")
        with patch.object(AUDIT, "ROOT", self.root), contextlib.redirect_stdout(
            io.StringIO()
        ):
            code = AUDIT.main(
                [
                    self.receipt_path,
                    "--retained",
                    self.retained,
                    "--qa",
                    "data/qa",
                ]
            )
        self.assertEqual(code, 1)
        result = json.loads(
            (self.root / "data/qa/retained-source-audit.json").read_text()
        )
        self.assertEqual(result["status"], "failed")
        self.assertFalse(result["freshConstructionPerformed"])


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RetainedAuditControls)
    names = [test.id().rsplit(".", 1)[-1] for test in suite]
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "controls.json").write_text(
        json.dumps(
            {
                "status": "passed" if result.wasSuccessful() else "failed",
                "controlsRun": result.testsRun,
                "controls": names,
                "failures": [(test.id(), trace) for test, trace in result.failures],
                "errors": [(test.id(), trace) for test, trace in result.errors],
                "skipped": [(test.id(), reason) for test, reason in result.skipped],
                "scope": "Synthetic byte/declaration controls only; not asset geometry or fresh replay",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    raise SystemExit(0 if result.wasSuccessful() else 1)
