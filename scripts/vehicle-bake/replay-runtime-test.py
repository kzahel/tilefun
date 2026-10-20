"""Wrapper policy controls with a deliberately tiny synthetic exporter.

These exercise isolation and rejection, not geometry or retained v3 fidelity.
Actual retained v3/Blender replays are separate qualification commands.
"""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from replay_inputs import sha

SPEC = importlib.util.spec_from_file_location("runtime_replay_control", Path(__file__).with_name("replay-runtime.py"))
REPLAY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REPLAY)


class RuntimeReplayControls(unittest.TestCase):
    def setUp(self):
        parent = Path(__file__).resolve().parents[2] / "data/vehicle-bake/runtime-replay-controls"
        parent.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.exporter = self.root / REPLAY.EXPORTER
        self.exporter.parent.mkdir(parents=True)
        self.config_name = "scripts/vehicle-bake/runtime-control-v1.json"
        self.receipt_name = "art-source/vehicle-bake/runtime-control-v1.json"
        self.proof_name = "src/proof.txt"
        self.helper_name = "scripts/vehicle-bake/runtime-measure.py"
        self.config = {"id": "control", "mesh": {"path": "assets/control.glb"},
                       "sprite": "assets/control.png", "receipt": self.receipt_name, "review": {}}
        self.write(self.config_name, json.dumps(self.config).encode())
        self.write(self.proof_name, b"input")
        self.write(self.helper_name, b"# synthetic helper\n")
        self.exporter.write_text('''import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser()
for name in ['config','blender','output-root','work-dir']:p.add_argument('--'+name,required=True)
a=p.parse_args();r=Path(__file__).resolve().parents[2];out=Path(a.output_root)
assert json.loads((r/'src/traffic/original-vehicles.json').read_text())=={'vehicles':[]}
assert (r/'AGENTS.md').is_file() and (r/'public').is_dir()
proof=(r/'src/proof.txt').read_bytes();c=json.loads(Path(a.config).read_text())
names=[Path(a.config).relative_to(r).as_posix(),'scripts/vehicle-bake/runtime-export-v3.py','scripts/vehicle-bake/runtime-measure.py','src/proof.txt']
receipt={'inputs':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in names}}
files={'public/'+c['mesh']['path']:b'model'+proof,'public/'+c['sprite']:b'sprite'+proof,c['receipt']:(json.dumps(receipt,indent=2)+'\\n').encode(),'src/traffic/original-vehicles.json':b'{"vehicles":[{"id":"control"}]}'}
for name,value in files.items():
 target=out/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(value)
''', encoding="utf-8")
        names = [self.config_name, REPLAY.EXPORTER, self.helper_name, self.proof_name]
        self.receipt = {"inputs": {name: sha(self.root / name) for name in names}}
        self.save_receipt()
        self.write("public/assets/control.glb", b"modelinput")
        self.write("public/assets/control.png", b"spriteinput")
        self.write(REPLAY.CATALOG, b'{"vehicles":[{"id":"control"},{"id":"untouched"}]}')
        self.qa = self.root / "data/qa"

    def write(self, name, value):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(value)

    def save_receipt(self):
        self.write(self.receipt_name, (json.dumps(self.receipt, indent=2) + "\n").encode())

    def invoke(self, extra=()):
        arguments = ["replay-runtime.py", str(self.root / self.receipt_name), "--qa", str(self.qa),
                     "--blender", str(self.exporter), *extra]
        with patch.object(REPLAY, "ROOT", self.root), patch("sys.argv", arguments), contextlib.redirect_stdout(io.StringIO()):
            REPLAY.main()

    def test_fresh_declared_only_replay_and_selected_entry(self):
        before = {p: (self.root / p).read_bytes() for p in
                  [self.receipt_name, REPLAY.CATALOG, "public/assets/control.glb", "public/assets/control.png"]}
        self.invoke()
        result = json.loads((self.qa / "runtime-replay.json").read_text())
        self.assertTrue(result["selectedCatalogEntryExact"])
        self.assertEqual(result["historicalInputs"], [])
        self.assertEqual(result["declaredInputPins"], 4)
        for name, value in before.items():
            self.assertEqual((self.root / name).read_bytes(), value)

    def test_explicit_declared_config(self):
        self.invoke(["--config", self.config_name])

    def test_unpinned_config_rejected(self):
        with self.assertRaisesRegex(ValueError, "Expected one declared"):
            self.invoke(["--config", "scripts/unregistered.json"])

    def test_missing_declared_dependency_fails_in_scratch(self):
        del self.receipt["inputs"][self.proof_name]
        self.save_receipt()
        with self.assertRaisesRegex(RuntimeError, "Runtime replay failed"):
            self.invoke()
        log = (self.qa / "runtime-replay.log").read_text()
        self.assertIn("FileNotFoundError", log)
        self.assertIn("proof.txt", log)
        self.assertFalse((self.qa / "runtime-replay.json").exists())

    def test_missing_exporter_pin_rejected(self):
        del self.receipt["inputs"][REPLAY.EXPORTER]
        self.save_receipt()
        with self.assertRaisesRegex(ValueError, "must pin"):
            self.invoke()

    def test_current_input_tamper_rejected_before_export(self):
        self.write(self.proof_name, b"tampered")
        with self.assertRaisesRegex(ValueError, "Missing/stale"):
            self.invoke()
        self.assertFalse((self.qa / "runtime-replay.log").exists())

    def test_model_bytes_mismatch_rejected(self):
        self.write("public/assets/control.glb", b"wrong")
        with self.assertRaisesRegex(ValueError, "output differs"):
            self.invoke()

    def test_receipt_bytes_mismatch_rejected(self):
        self.receipt["unreproducibleExtra"] = True
        self.save_receipt()
        with self.assertRaisesRegex(ValueError, "output differs"):
            self.invoke()

    def test_catalog_entry_mismatch_rejected(self):
        self.write(REPLAY.CATALOG, b'{"vehicles":[{"id":"control","wrong":true}]}')
        with self.assertRaisesRegex(ValueError, "catalog entry differs"):
            self.invoke()

    def test_qa_outside_ignored_data_rejected(self):
        self.qa = self.root / "public/unsafe"
        with self.assertRaisesRegex(ValueError, "ignored data"):
            self.invoke()

    def test_expired_deadline_rejected(self):
        with self.assertRaisesRegex(ValueError, "deadline reached"):
            self.invoke(["--deadline", "2000-01-01T00:00:00Z"])


if __name__ == "__main__":
    unittest.main()
