"""Focused controls for exact historical registration and safe input replay."""

import json
from pathlib import Path
import tempfile
import unittest

from replay_inputs import CATALOG, SNAPSHOTS, copy_inputs, resolve_input, sha


class ReplayInputsTests(unittest.TestCase):
    def setUp(self):
        parent = Path(__file__).resolve().parents[2] / "data/vehicle-bake/replay-input-controls"
        parent.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.name = "src/rendering/CarMeshAsset.ts"
        self.current = self.root / self.name
        self.current.parent.mkdir(parents=True)
        self.current.write_bytes(b"new renderer\n")
        self.snapshot_name = SNAPSHOTS + "/old/src/rendering/CarMeshAsset.ts"
        self.snapshot = self.root / self.snapshot_name
        self.snapshot.parent.mkdir(parents=True)
        self.snapshot.write_bytes(b"historical renderer\n")
        self.old_hash = sha(self.snapshot)
        self.entry = {"path": self.name, "sha256": self.old_hash, "snapshot": self.snapshot_name}
        self.register([self.entry])

    def register(self, entries, version=1):
        (self.root / CATALOG).write_text(json.dumps({"version": version, "inputs": entries}), encoding="utf-8")

    def test_current_bytes_win_even_without_catalog(self):
        (self.root / CATALOG).unlink()
        actual = resolve_input(self.root, self.name, sha(self.current))
        self.assertEqual(actual.source, self.current)
        self.assertIsNone(actual.snapshot)

    def test_exact_snapshot_and_catalog_evidence(self):
        actual = resolve_input(self.root, self.name, self.old_hash)
        self.assertEqual(actual.source, self.snapshot)
        self.assertEqual(actual.evidence()["catalogSha256"], sha(self.root / CATALOG))
        self.assertEqual(actual.evidence()["snapshot"], self.snapshot_name)

    def test_missing_current_can_use_registered_snapshot(self):
        self.current.unlink()
        self.assertEqual(resolve_input(self.root, self.name, self.old_hash).source, self.snapshot)

    def test_copy_restores_original_path_and_preserves_live_bytes(self):
        scratch = self.root / "data/scratch"
        result = copy_inputs(self.root, {self.name: self.old_hash}, scratch)
        self.assertEqual((scratch / self.name).read_bytes(), self.snapshot.read_bytes())
        self.assertEqual(self.current.read_bytes(), b"new renderer\n")
        self.assertEqual(result["historicalInputs"][0]["path"], self.name)
        self.assertFalse((scratch / self.snapshot_name).exists())

    def test_unregistered_path_with_identical_hash_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unregistered"):
            resolve_input(self.root, "src/rendering/Other.ts", self.old_hash)

    def test_unregistered_hash_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unregistered"):
            resolve_input(self.root, self.name, "1" * 64)

    def test_snapshot_tamper_rejected(self):
        self.snapshot.write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "tampered"):
            resolve_input(self.root, self.name, self.old_hash)

    def test_snapshot_missing_rejected(self):
        self.snapshot.unlink()
        with self.assertRaisesRegex(ValueError, "Missing/tampered"):
            resolve_input(self.root, self.name, self.old_hash)

    def test_unregistered_current_mismatch_rejected(self):
        (self.root / CATALOG).unlink()
        with self.assertRaisesRegex(ValueError, "no snapshot catalog"):
            resolve_input(self.root, self.name, self.old_hash)

    def test_unsafe_original_paths_rejected(self):
        for name in ("../escape", "/absolute", "C:/drive", "src\\bad", "src/../bad", ".", "src//bad", "data/bad", "test-results/bad"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                resolve_input(self.root, name, self.old_hash)

    def test_snapshot_outside_retained_directory_rejected(self):
        for name in ("src/rendering/CarMeshAsset.ts", "../escape", SNAPSHOTS + "/../escape", SNAPSHOTS):
            with self.subTest(name=name):
                self.register([{**self.entry, "snapshot": name}])
                with self.assertRaises(ValueError):
                    resolve_input(self.root, self.name, self.old_hash)

    def test_duplicate_registration_rejected(self):
        self.register([self.entry, self.entry])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            resolve_input(self.root, self.name, self.old_hash)

    def test_bad_hash_format_rejected(self):
        for expected in ("bad", "A" * 64, None, 123):
            with self.subTest(expected=expected), self.assertRaises(ValueError):
                resolve_input(self.root, self.name, expected)

    def test_wrong_catalog_version_rejected(self):
        self.register([self.entry], version=2)
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            resolve_input(self.root, self.name, self.old_hash)

    def test_malformed_registration_rejected(self):
        for entry in ({"path": self.name}, {**self.entry, "extra": True}, {**self.entry, "sha256": "wrong"}):
            with self.subTest(entry=entry):
                self.register([entry])
                with self.assertRaises(ValueError):
                    resolve_input(self.root, self.name, self.old_hash)

    def test_all_pins_resolve_before_copy(self):
        scratch = self.root / "data/scratch"
        with self.assertRaises(ValueError):
            copy_inputs(self.root, {self.name: self.old_hash, "src/absent.ts": "1" * 64}, scratch)
        self.assertFalse(scratch.exists())


if __name__ == "__main__":
    unittest.main()
