"""Byte-contract controls; real geometry/native-pixel proofs remain separate.

Run with: python scripts/vehicle-bake/test_pipeline_helpers.py
All temporary fixtures and outputs stay under ignored data.
"""

import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


REPLAY = module("replay_control", "source-replay.py")
COMPOSER = module("composer_control", "compose-component.py")


class ReplayControls(unittest.TestCase):
    def setUp(self):
        parent = (ROOT / "data/vehicle-bake/pipeline-helper-controls").resolve()
        assert parent.is_relative_to((ROOT / "data").resolve())
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.root = Path(self.temporary.name).resolve()
        assert self.root.is_relative_to(parent)
        self.addCleanup(self.temporary.cleanup)
        self.source = self.root / "art-source/control/build.py"
        self.source.parent.mkdir(parents=True)
        # Intentionally small byte fixtures: these tests exercise replay policy,
        # not GLB/PNG decoding, which actual retained-asset proofs cover.
        self.outputs = {"model.glb": b"model-control", "atlas.png": b"atlas-control", "recipe.json": b"{}"}
        builder = (
            "from pathlib import Path\n"
            "p=Path('data/output'); p.mkdir(parents=True,exist_ok=True)\n"
            f"outputs={self.outputs!r}\n"
            "for name,value in outputs.items(): (p/name).write_bytes(value)\n"
        )
        self.source.write_text(builder, encoding="utf-8")
        self.receipt = {
            "inputHashes": {"art-source/control/build.py": self.sha(self.source.read_bytes())},
            "invokedBuilder": "art-source/control/build.py",
            "runner": "python",
            "arguments": [],
            "glbSha256": self.sha(self.outputs["model.glb"]),
            "atlasSha256": self.sha(self.outputs["atlas.png"]),
            "recipeSha256": self.sha(self.outputs["recipe.json"]),
            "outputHashes": {name: self.sha(value) for name, value in self.outputs.items()},
        }

    @staticmethod
    def sha(value):
        return hashlib.sha256(value).hexdigest()

    def invoke(self, receipt=None, extra=()):
        path = self.root / "receipt.json"
        path.write_text(json.dumps(receipt or self.receipt), encoding="utf-8")
        with patch.object(REPLAY, "ROOT", self.root), patch(
            "sys.argv", ["source-replay.py", str(path), "--qa", "data/qa", *extra]
        ), contextlib.redirect_stdout(io.StringIO()):
            REPLAY.main()

    def test_fresh_constructor_outputs_qualify(self):
        self.invoke()
        proof = json.loads((self.root / "data/qa/parent-source-replay.json").read_text())
        self.assertEqual(proof["status"], "passed")
        self.assertEqual(proof["declaredInputPins"], 1)
        self.assertTrue(all(name.startswith("data/") for name in proof["exactOutputs"].values()))

    def test_stale_retained_input_rejected(self):
        self.source.write_text("raise SystemExit(0)\n", encoding="utf-8")
        with self.assertRaisesRegex(AssertionError, "Missing/stale retained input"):
            self.invoke()

    def test_ignored_input_dependency_rejected(self):
        receipt = copy.deepcopy(self.receipt)
        receipt["inputHashes"]["data/hidden.json"] = "0" * 64
        with self.assertRaisesRegex(AssertionError, "Ignored input dependency"):
            self.invoke(receipt)

    def test_undeclared_dependency_is_unavailable(self):
        hidden = self.source.parent / "hidden.json"
        hidden.write_text("{}", encoding="utf-8")
        self.source.write_text("from pathlib import Path\nPath('art-source/control/hidden.json').read_bytes()\n", encoding="utf-8")
        self.receipt["inputHashes"]["art-source/control/build.py"] = self.sha(self.source.read_bytes())
        with self.assertRaisesRegex(AssertionError, "Source replay failed"):
            self.invoke()

    def test_existing_outputs_do_not_substitute_for_new_outputs(self):
        stale = self.root / "data/stale"
        stale.mkdir(parents=True)
        for name, value in self.outputs.items():
            (stale / name).write_bytes(value)
        self.source.write_text("pass\n", encoding="utf-8")
        self.receipt["inputHashes"]["art-source/control/build.py"] = self.sha(self.source.read_bytes())
        with self.assertRaisesRegex(AssertionError, "No freshly generated exact output"):
            self.invoke()

    def test_expired_deadline_rejected(self):
        with self.assertRaisesRegex(AssertionError, "deadline reached"):
            self.invoke(extra=["--deadline", "2000-01-01T00:00:00Z"])

    def test_local_basename_receipt_qualifies(self):
        receipt = copy.deepcopy(self.receipt)
        receipt["inputHashes"] = {"build.py": self.sha(self.source.read_bytes())}
        del receipt["invokedBuilder"]
        self.invoke(receipt, ["--input-root", "art-source/control"])


class ComponentControls(unittest.TestCase):
    def test_actual_assets_keep_base_graph_and_binary(self):
        base = ROOT / "public/demos/original-vehicles/classic-roadster-v1/inputs/model.glb"
        rider = ROOT / "art-source/vehicle-riders/explorer/v1/rider.glb"
        original, binary, _ = COMPOSER.unpack(base)
        combined, proof = COMPOSER.compose(base, rider, [2, -3, 4], "Control")
        parent = (ROOT / "data/vehicle-bake/pipeline-helper-controls").resolve()
        parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            target = Path(directory).resolve() / "combined.glb"
            assert target.is_relative_to(parent)
            target.write_bytes(combined)
            result, result_binary, _ = COMPOSER.unpack(target)
        for name in COMPOSER.ARRAYS:
            self.assertEqual(result.get(name, [])[:len(original.get(name, []))], original.get(name, []))
        self.assertEqual(result_binary[:len(binary)], binary)
        self.assertEqual(result["nodes"][-1]["translation"], [2, 4, 3])
        self.assertTrue(proof["baseBinaryPrefixExact"])

    def test_nonfinite_mount_rejected(self):
        base = ROOT / "public/demos/original-vehicles/classic-roadster-v1/inputs/model.glb"
        rider = ROOT / "art-source/vehicle-riders/explorer/v1/rider.glb"
        with self.assertRaises(AssertionError):
            COMPOSER.compose(base, rider, [0, float("nan"), 0], "Control")


if __name__ == "__main__":
    unittest.main()
