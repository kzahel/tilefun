"""Retain a fully inspected tiger and append its exact pending Workshop identity.

One-shot authoring step, never a build step or a human approval submission.
"""
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[3]
OUT = ROOT / "public/demos/wildlife-v2/tiger/pilot-v1"
assert not (SOURCE / "receipt.json").exists(), "Frozen identity already retained"
review = json.loads((SOURCE / "review.json").read_text())
audit = json.loads((OUT / "source-audit.json").read_text())
capture = json.loads((ROOT / "data/tiger-131/browser/capture.json").read_text())
replay = json.loads((ROOT / "data/tiger-131/replay-result.json").read_text())
assert review["result"] == "pilot-ready; human review pending"
assert audit["poses"] == 116
assert len(capture["results"]) == 2
assert all(not row["errors"] and row["chronologicalPoses"] == 29 for row in capture["results"])
assert replay["status"] == "byte-identical"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


notes = "# Tiger pilot v1 — agent observations\n\nHuman review: pending.\n\n"
for name, observation in review["checks"].items():
    notes += f"## {name}\n\n{observation}\n\n"
notes += "## Limits\n\n" + review["limits"] + "\n"
(OUT / "review-observations.md").write_text(notes)
public_files = ["sheet.png", "sprite.json", "scene-native.png", "scene-background.png",
                "scale-reference-native.png", "contact-sheet-native.png", "preview.gif",
                "preview-native.gif", "scene-native.gif", "playback.js", "index.html",
                "review-observations.md", "source-audit.json", "validation.json"]
dependencies = [ROOT / "art-source/wildlife-v2/camera.json",
                ROOT / "public/assets/tilesets/me-complete.png",
                ROOT / "public/demos/pixel-characters/person-32.png",
                ROOT / "public/demos/wildlife-v2/elephant/pilot-v2/sheet.png",
                ROOT / "public/demos/wildlife-v2/elephant/pilot-v2/sprite.json"]
files = [p for p in SOURCE.iterdir() if p.is_file() and p.name != "receipt.json"]
files += [OUT / name for name in public_files] + dependencies
receipt = {"identity": "tiger-pilot-v1", "status": "draft-ready", "reviewStatus": "pending",
           "motionContract": "body-motion-20261004", "visualReview": review,
           "sourceAudit": audit, "browser": capture, "replay": replay,
           "artifacts": {str(p.relative_to(ROOT)).replace("\\", "/"): sha(p) for p in files}}
(SOURCE / "receipt.json").write_text(json.dumps(receipt, indent=2)+"\n")
registry_path = ROOT / "src/wildlife/reviews.json"
registry = json.loads(registry_path.read_text())
assert not any(row["id"] == "tiger-pilot-v1" for row in registry)
definition = {"id": "tiger-pilot-v1", "animalId": "tiger", "revision": "pilot-v1",
              "name": "Tiger", "batchId": "wildlife-v2-tiger-131",
              "galleryUrl": "/tilefun/demos/wildlife-v2/tiger/pilot-v1/"}
for key, filename in [("sheet", "sheet.png"), ("scene", "scene-native.png"), ("contact", "contact-sheet-native.png")]:
    path = OUT / filename
    w, h = Image.open(path).size
    definition[key] = {"id": f"wildlife-v2-tiger-pilot-v1{'' if key == 'sheet' else '-'+key}",
                       "name": "Tiger " + key, "image": str(path.relative_to(ROOT / "public")).replace("\\", "/"),
                       "width": w, "height": h, "tileSize": 16, "fingerprint": sha(path),
                       "source": "art-source/wildlife-v2/tiger/pilot-v1"}
definition["preview"] = "demos/wildlife-v2/tiger/pilot-v1/preview.gif"
definition["files"] = [{"path": str((OUT / name).relative_to(ROOT / "public")).replace("\\", "/"),
                        "sha256": sha(OUT / name)} for name in public_files]
registry.append(definition)
registry_path.write_text(json.dumps(registry, indent=2)+"\n")
shutil.copyfile(registry_path, ROOT / "public/demos/wildlife-v2/reviews.json")
batch_path = ROOT / "art-source/wildlife-v2/tiger-batch.json"
batch = json.loads(batch_path.read_text())
batch.update(state="draft-ready", stage="Exact Blender/pixel pilot delivered; human review pending")
batch_path.write_text(json.dumps(batch, indent=2)+"\n")
print("Retained tiger pilot; exact human review remains pending")
