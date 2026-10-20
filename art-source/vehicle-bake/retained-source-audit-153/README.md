# Retained source audit — run153

Final **static declaration/hash evidence for exactly 24 sources**: seven bike
styles, nine static rider/bike compounds, two mechanically fitted bikes, and six
rider sources. The rider set includes both **Classic upright v1 and v2**, Explorer
initial/upright, Bear upright and Person7 upright. Classic v3 or later revisions
are excluded and can receive a separate audit. No source art is regenerated here.

All 24 passed: 232 declared-input pin checks, 5,545 retained-file pin checks,
162 retained/public output hash checks, and 81 exact source/public byte pairs.
Counts include repeated declarations across sources; report.json also records
unique path/hash counts. The nine compounds retain their real companion atlases.

- [Report](report.json): final counts, scope, limits and links to each audit.
- [Source index](source-index.json): exact original receipt paths/hashes and
  recorded source flags. Historical report-schema differences are preserved.
- [Per-source audits](sources/): exact, byte-unchanged final checker payloads.
- [Source/public comparisons](source-public-byte-comparisons.json): all81 pairs.
- [Tool pins](tool-pins.json): exact auditor, controls, strict resolver and
  review-requirements SHA256 values; also hashes every raw audit payload.
- [Controls](controls.json): accepted49 synthetic byte/declaration controls.
- [Reproduction commands](commands.json): all24 portable argument lists.

This is **not a fresh construction replay**, hidden-import proof, mesh/contact or
pixel check, human approval, all-avatar/AI/fallback qualification, or normal
activation. All24 original replay receipts record passed historical construction
results; that record is distinct from what this static audit ran. Fresh declared-
input construction remains a separate source-replay.py/family-replay requirement.
No controls or browser cases were rerun just to package this evidence.

## Reproduce the static checks

Use Python3 and the existing pathspec1.1.1 dependency from
scripts/vehicle-bake/requirements-review.txt (the shared review set also pins
Pillow12.2.0). No Blender or browser is needed. First verify current tool bytes
against tool-pins.json; these receipts identify the precise implementation used.
Do not rewrite old source receipts or relax historical snapshot resolution.

From the repository root, run each argv in commands.json. For example:

```sh
python scripts/vehicle-bake/retained-source-audit.py art-source/vehicle-riders/classic-upright/v2/evidence/replay-verification.json --retained art-source/vehicle-riders/classic-upright/v2 --public public/demos/vehicle-riders/classic-upright/v2 --model-name rider.glb --qa data/vehicle-bake/retained-source-audit-153-recheck/classic-upright-v2
```

The recorded commands supply --input-root for local-basename rider inputs and an
explicit model name. They write only new ignored QA results. A Python fragment
can verify the tool pins, execute all24 static commands, and repeat the byte pairs:

```python
from pathlib import Path
import hashlib, json, subprocess
bundle = Path("art-source/vehicle-bake/retained-source-audit-153")
pins = json.loads((bundle / "tool-pins.json").read_text())["inputHashes"]
for name, expected in pins.items():
    assert hashlib.sha256(Path(name).read_bytes()).hexdigest() == expected
for job in json.loads((bundle / "commands.json").read_text())["commands"]:
    subprocess.run(job["argv"], check=True)
for pair in json.loads((bundle / "source-public-byte-comparisons.json").read_text())["pairs"]:
    assert Path(pair["source"]).read_bytes() == Path(pair["public"]).read_bytes()
```

The optional focused control command is recorded in tool-pins.json. Those tests
create synthetic fixtures only under ignored data; they do not reconstruct real
assets. retained-files.json hashes this evidence bundle, excluding itself. The
proposed CI parallel patch remains ignored and unapplied; it is unrelated to this
source evidence. Parent owns any future integration, review and runtime gates.
