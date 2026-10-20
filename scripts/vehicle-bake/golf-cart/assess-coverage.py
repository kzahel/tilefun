"""Portable actual natural nose/rear-fender crown measurements and controls."""

from pathlib import Path
import argparse
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/golf-cart"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--input", default="data/vehicle-bake/golf-cart/coverage-stable.json"
)
args = parser.parse_args()
raw = json.loads((ROOT / args.input).read_text())
model = ROOT / "public/demos/vehicle-bake/golf-cart/v1/model.glb"
sha = hashlib.sha256(model.read_bytes()).hexdigest()
assert raw["inputSha256"] == sha and raw["inputBytesUnchanged"]
assert (
    raw["controls"]["positiveAndNegativeControlsPassed"]
    and raw["controls"]["bodyRemovalInformativeAgainstBaseline"]
)
assert len(raw["wheels"]) == 4 and all(
    w["coveredCount"] == w["sampleCount"] == 25 and w["declaredExpectationMet"]
    for w in raw["wheels"]
)
raw["input"] = model.relative_to(ROOT).as_posix()
portable = (json.dumps(raw, indent=2) + "\n").encode()
(D / "coverage-raw-portable.json").write_bytes(portable)
assessment = {
    "status": "meets-declared-finite-region",
    "glbSha256": sha,
    "allFourCrownsCovered": True,
    "allWheelCoverage": "natural front nose/rear tub fenders over declared central crown region",
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
    "maximumRayDistanceR": 1.15,
    "canopyCannotQualify": True,
    "regionMeaning": "Finite central tread footprint from each own .31source radius and .24source width. Ray limited to1.15R above sampled tread; white canopy is outside this range. Actual natural nose/rear tub body owns covered crowns, no separate fake caps.",
    "portableRawEvidence": "art-source/vehicle-bake/golf-cart/v1/evidence/upper-wheel-coverage-raw.json",
    "portableRawSha256": hashlib.sha256(portable).hexdigest(),
    "limitations": "Finite geometry samples plus all32 native camera and wheel-ID inspection. Does not qualify steering, suspension or continuous coverage outside declared sampled region; whole-body full neutral roll separately mandatory.",
}
(D / "coverage-assessment.json").write_text(json.dumps(assessment, indent=2) + "\n")
print(json.dumps(assessment, indent=2))
