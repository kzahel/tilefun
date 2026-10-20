"""Preserve raw uncovered crown measurements under the explicit family exception."""

from pathlib import Path
import argparse
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = ROOT / "data/vehicle-bake/monster-truck"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--input", default="data/vehicle-bake/monster-truck/coverage-final.json"
)
args = parser.parse_args()
raw = json.loads((ROOT / args.input).read_text())
model = ROOT / "public/demos/vehicle-bake/monster-truck/v1/model.glb"
sha = hashlib.sha256(model.read_bytes()).hexdigest()
assert raw["inputSha256"] == sha and raw["inputBytesUnchanged"]
assert raw["controls"]["positiveAndNegativeControlsPassed"]
assert not raw["controls"]["bodyRemovalInformativeAgainstBaseline"]
assert len(raw["wheels"]) == 4
assert all(
    w["coveredCount"] == 0
    and w["sampleCount"] == 25
    and not w["declaredExpectationMet"]
    for w in raw["wheels"]
)
raw["input"] = model.relative_to(ROOT).as_posix()
portable = (json.dumps(raw, indent=2) + "\n").encode()
(D / "coverage-raw-portable.json").write_bytes(portable)
assessment = {
    "status": "assessment",
    "glbSha256": sha,
    "allFourCrownsCovered": False,
    "allWheelCoverage": "not-applicable/intentionally-exposed",
    "ownerAuthorizedException": True,
    "policy": "All four massive tires deliberately project beyond the narrow raised body. No fake crown caps or passed geometry coverage metric. Raw 0/25 expectation failures retained unchanged.",
    "wheels": [
        {
            "wheel": w["wheel"],
            "applicability": "not-applicable/intentionally-exposed",
            "rawCoveredCount": w["coveredCount"],
            "rawSampleCount": w["sampleCount"],
            "rawDeclaredExpectationMet": w["declaredExpectationMet"],
        }
        for w in raw["wheels"]
    ],
    "controls": raw["controls"],
    "bodyRemovalInformativeAgainstBaseline": False,
    "controlMeaning": "Synthetic positive/offset fixtures exercise bookkeeping only. Removing already-uncovered body is not informative and no geometry pass is inferred.",
    "portableRawEvidence": "art-source/vehicle-bake/monster-truck/v1/evidence/upper-wheel-coverage-raw.json",
    "portableRawSha256": hashlib.sha256(portable).hexdigest(),
    "separateRequirements": "All-four full neutral rolling clearance, collision negative/reset, actual32 headings and independent wheel attachment/visibility remain mandatory.",
}
(D / "coverage-assessment.json").write_text(json.dumps(assessment, indent=2) + "\n")
print(json.dumps(assessment, indent=2))
