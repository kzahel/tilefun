"""Retain exact receipts after the separately authored visual review and capture."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
shared = ROOT / "art-source/wildlife-v2/pets"
batch_path = ROOT / "art-source/wildlife-v2/pet-batch.json"
batch = json.loads(batch_path.read_text())
review = json.loads((shared / "review.json").read_text())
capture = json.loads((ROOT / "data/wildlife-pets-084/browser/capture.json").read_text())
for pet in batch["pets"]:
    source = ROOT / f"art-source/wildlife-v2/{pet['id']}/{batch['revision']}"
    output = ROOT / f"public/demos/wildlife-v2/{pet['id']}/{batch['revision']}"
    audit = json.loads((output / "source-audit.json").read_text())
    assert audit["identity"] == f"{pet['id']}-{batch['revision']}"
    samples = [r for r in capture["results"] if r["pet"] == pet["id"]]
    assert len(samples) == 2 and all(not r["errors"] for r in samples)
    text = f"""# {pet['name']} — draft-v1

Human review: pending. Agent visual inspection: 2026-10-10, coordinator.

{review['pets'][pet['id']]}

"""
    for name, observation in review["checks"].items():
        text += f"## {name}\n\n{observation}\n\n"
    text += f"## Limits\n\n{review['limits']}\n\n"
    text += "Fresh saved-scene integrity evidence is in source-audit.json. It is not art approval.\n"
    (output / "review-observations.md").write_text(text, encoding="utf-8")
    (source / "README.md").write_text(f"""# {pet['name']} draft-v1

Authorized by tactical 084. Natural quadruped draft; human approval pending.
The retained animal.blend is editable, with source-driven torso weight transfer,
moving-hip limb solves, world-grounded soles and stabilized fixed-volume skull.
masters.json is the authored four-facing idle/walk/action pixel source.
provenance.json identifies the retained base anatomy and motion contract.

Rebuild (never overwrite this identity after review registration):

```sh
blender --background --factory-startup --python-exit-code 1 --python art-source/wildlife-v2/pets/build.py -- {pet['id']}
python art-source/wildlife-v2/pets/finish.py {pet['id']}
blender --background --factory-startup art-source/wildlife-v2/{pet['id']}/draft-v1/animal.blend --python-exit-code 1 --python art-source/wildlife-v2/pets/audit.py -- {pet['id']}
```

The builder regenerates ignored evaluated guides; --render-guides also exports
Blender studies. Shared scripts read the immutable original anatomy but never
write those sources or old receipts. New breeds/coats remain explicitly bounded
by pet-batch.json. Native pixels, pending review artifacts and exact source
hashes are retained; large QA panels/captures stay in ignored local evidence.

Animation timing: idle/action 160ms, walk 80ms; physical preview travel is
{4 if pet['species']=='cat' else 6}px per walk cycle. Gameplay flee doubles speed
and halves walk timing without inventing a new gait. Original pets stay unchanged.
""", encoding="utf-8")
    files = list(shared.glob("*.py")) + [shared / "review.json", shared / "playback.js", shared / "index.html"]
    files += [source / f for f in ["animal.blend", "masters.json", "provenance.json", "README.md"]]
    files += [output / f for f in ["sheet.png", "sprite.json", "scene-native.png", "scene-background.png", "contact-sheet-native.png", "preview.gif", "preview-native.gif", "scene-native.gif", "source-audit.json", "validation.json", "playback.js", "index.html", "review-observations.md"]]
    receipt = {
        "identity": f"{pet['id']}-{batch['revision']}", "status": "draft-ready",
        "reviewStatus": "pending", "motionContract": "body-motion-20261004",
        "visualReview": {"observer": review["observer"], "date": review["date"], "checks": review["checks"], "coat": review["pets"][pet["id"]], "limits": review["limits"]},
        "browser": {"version": capture["browser"], "results": samples},
        "sourceAudit": audit,
        "artifacts": {str(f.relative_to(ROOT)).replace("\\", "/"): hashlib.sha256(f.read_bytes()).hexdigest() for f in files},
    }
    (source / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    pet["state"] = "draft-ready"
batch_path.write_text(json.dumps(batch, indent=2) + "\n", encoding="utf-8")
print("Four exact pending pet receipts retained")
