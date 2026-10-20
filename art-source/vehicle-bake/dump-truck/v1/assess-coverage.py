"""Portable actual natural nose/rear-body crown measurements and controls."""

from pathlib import Path
import argparse
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/dump-truck"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--input", default="data/vehicle-bake/dump-truck/coverage-final-qualified.json"
)
args = parser.parse_args()
raw = json.loads((ROOT / args.input).read_text())
model = ROOT / "public/demos/vehicle-bake/dump-truck/v1/model.glb"
sha = hashlib.sha256(model.read_bytes()).hexdigest()
assert raw["inputSha256"] == sha and raw["inputBytesUnchanged"]
assert (
    raw["controls"]["positiveAndNegativeControlsPassed"]
    and raw["controls"]["bodyRemovalInformativeAgainstBaseline"]
)
assert len(raw["wheels"]) == 6 and all(
    w["coveredCount"] == w["sampleCount"] == 25 and w["declaredExpectationMet"]
    for w in raw["wheels"]
)
raw["input"] = model.relative_to(ROOT).as_posix()
portable = (json.dumps(raw, indent=2) + "\n").encode()
(D / "coverage-raw-portable.json").write_bytes(portable)
assessment = {
    "status": "meets-declared-finite-region",
    "glbSha256": sha,
    "allSixCrownsCovered": True,
    "allWheelCoverage": "natural front fenders and rear lower middle/last wheelhouse body over declared central crown region",
    "wheels": [
        {
            "wheel": w["wheel"],
            "coveredCount": w["coveredCount"],
            "sampleCount": w["sampleCount"],
            "declaredExpectationMet": w["declaredExpectationMet"],
        }
        for w in raw["wheels"]
    ],
    "controls": raw["controls"],
    "bodyRemovalInformativeAgainstBaseline": True,
    "maximumRayDistanceR": 1.25,
    "upperBedRimCannotQualify": True,
    "regionMeaning": "Finite central tread footprint from each of six own .50source radius and .36source width wheels. Ray limited to1.25R above sampled tread, excluding upper dump-body rim. Actual natural front fenders and continuous lower middle/last wheelhouse body cover the crowns, no separate caps.",
    "portableRawEvidence": "art-source/vehicle-bake/dump-truck/v1/evidence/upper-wheel-coverage-raw.json",
    "portableRawSha256": hashlib.sha256(portable).hexdigest(),
    "limitations": "Finite geometry samples plus all32 native camera and wheel-ID inspection. Does not qualify steering, suspension or continuous coverage outside declared sampled region; whole-body full neutral roll separately mandatory.",
}
(D / "coverage-assessment.json").write_text(json.dumps(assessment, indent=2) + "\n")
print(json.dumps(assessment, indent=2))
