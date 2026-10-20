"""Honest per-axle assessment of unmodified shared coverage ray results."""

from pathlib import Path
import argparse
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/forklift"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--input", default="data/vehicle-bake/forklift/coverage-stable.json"
)
args = parser.parse_args()
raw = json.loads((ROOT / args.input).read_text())
model = ROOT / "public/demos/vehicle-bake/forklift/v1/model.glb"
sha = hashlib.sha256(model.read_bytes()).hexdigest()
assert raw["inputSha256"] == sha and raw["inputBytesUnchanged"]
assert raw["controls"]["positiveAndNegativeControlsPassed"]
front = [w for w in raw["wheels"] if w["wheel"] in ["Wheel_FL_Roll", "Wheel_FR_Roll"]]
rear = [w for w in raw["wheels"] if w["wheel"] in ["Wheel_RL_Roll", "Wheel_RR_Roll"]]
assert len(front) == len(rear) == 2
assert all(
    w["coveredCount"] == 0
    and w["sampleCount"] == 25
    and not w["declaredExpectationMet"]
    for w in front
)
assert all(
    w["coveredCount"] == w["sampleCount"] == 25 and w["declaredExpectationMet"]
    for w in rear
)
# Only the input path is made portable; every raw metric/expectation stays intact.
raw["input"] = model.relative_to(ROOT).as_posix()
portable = json.dumps(raw, indent=2) + "\n"
(D / "coverage-raw-portable.json").write_bytes(portable.encode("utf-8"))
assessment = {
    "status": "assessment",
    "glbSha256": sha,
    "allFourCrownsCovered": False,
    "frontCoverage": "not-applicable/intentionally-open",
    "rearCoverage": "meets-declared-finite-region",
    "familyDeclaredFrontException": True,
    "policy": "Forklift front .32source wheels are intentionally exposed outboard of its narrow chassis. No front fender caps or claim of supported front crowns. Raw shared expected-fraction failures are retained, not changed to passes.",
    "regionMeaning": "Finite region is declared for the rear .25source tire tread with .20source width. Front samples remain raw diagnostics only and do not qualify front tread coverage.",
    "front": [
        {
            "wheel": w["wheel"],
            "applicability": "not-applicable/intentionally-open",
            "rawCoveredCount": w["coveredCount"],
            "rawSampleCount": w["sampleCount"],
            "rawDeclaredExpectationMet": w["declaredExpectationMet"],
        }
        for w in front
    ],
    "rear": [
        {
            "wheel": w["wheel"],
            "applicability": "covered rear fender",
            "coveredCount": w["coveredCount"],
            "sampleCount": w["sampleCount"],
            "declaredExpectationMet": w["declaredExpectationMet"],
        }
        for w in rear
    ],
    "controls": raw["controls"],
    "portableRawEvidence": "art-source/vehicle-bake/forklift/v1/evidence/upper-wheel-coverage-raw.json",
    "portableRawSha256": hashlib.sha256(portable.encode()).hexdigest(),
    "separateRequirements": "All-four whole-fixed-body neutral rolling clearance and collision negative/reset mandatory; all32 native study/game views and wheel-ID diagnostics separately inspect exposed front attachment and rear occlusion. No universal coverage pass asserted.",
}
(D / "coverage-assessment.json").write_text(json.dumps(assessment, indent=2) + "\n")
print(json.dumps(assessment, indent=2))
