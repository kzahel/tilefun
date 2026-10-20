"""Own finite tread regions for narrow front and wider rear; unchanged shared tool."""

from pathlib import Path
import hashlib
import importlib.util
import json
import sys

sys.dont_write_bytecode = True
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = ROOT / "scripts/vehicle-bake/touring-motorcycle"
D = ROOT / "data/vehicle-bake/touring-motorcycle"
model = ROOT / "public/demos/vehicle-bake/touring-motorcycle/v1/model.glb"
cfg = json.loads((S / "family.json").read_text())
base = json.loads((S / "coverage-region.json").read_text())
spec = importlib.util.spec_from_file_location(
    "unchanged_upper_crown_tool", ROOT / "scripts/vehicle-bake/coverage.py"
)
coverage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
selected = []
raw_hashes = {}
regions = {}
controls = {
    k: []
    for k in [
        "bodyRemovalCoveredCounts",
        "syntheticBroadPanelPositiveCounts",
        "sameSyntheticPanelsOffsetOutsideRegionCounts",
    ]
}
for wid in ["F", "R"]:
    wheel = cfg["wheelSpecs"][wid]
    region = {
        **base,
        "name": f"touring-{wid}-actual-tire-central75pct-halfwidth-v1",
        "treadHalfWidthR": wheel["width"] / (2 * wheel["radius"]),
    }
    raw = coverage.inspect(model, region, region["name"])
    raw["input"] = "public/demos/vehicle-bake/touring-motorcycle/v1/model.glb"
    path = D / f"coverage-{wid}.json"
    path.write_bytes((json.dumps(raw, indent=2) + "\n").encode())
    raw_hashes[path.name] = sha(path)
    index = next(
        i for i, w in enumerate(raw["wheels"]) if w["wheel"] == f"Wheel_{wid}_Roll"
    )
    chosen = raw["wheels"][index]
    assert chosen["coveredCount"] == chosen["sampleCount"] == 25
    selected.append(chosen)
    regions[wid] = region
    for key in controls:
        controls[key].append(raw["controls"][key][index])
assert (
    controls["bodyRemovalCoveredCounts"] == [0, 0]
    and controls["syntheticBroadPanelPositiveCounts"] == [25, 25]
    and controls["sameSyntheticPanelsOffsetOutsideRegionCounts"] == [0, 0]
)
report = {
    "schema": "touring-own-per-wheel-region-composition-v1",
    "status": "evidence-only",
    "input": "public/demos/vehicle-bake/touring-motorcycle/v1/model.glb",
    "inputSha256": sha(model),
    "inputBytesUnchanged": True,
    "region": {
        "method": "Each actual tire half-width, central75percent and same finite longitudinal/support rules; wheel-specific selected raw result, no altered shared metric",
        "byWheel": regions,
    },
    "wheels": selected,
    "controls": {
        **controls,
        "positiveAndNegativeControlsPassed": True,
        "fixtureIsNotCandidateGeometry": True,
    },
    "rawProofHashes": raw_hashes,
    "sharedToolHash": sha(ROOT / "scripts/vehicle-bake/coverage.py"),
    "limitation": "Finite sampled geometric coverage; native all-heading inspection and full-roll clearance remain separate.",
}
(D / "coverage-draft1.json").write_bytes((json.dumps(report, indent=2) + "\n").encode())
print(
    json.dumps(
        {
            "status": "passed",
            "coveredEach": 25,
            "actualTireWidthsSource": {
                k: v["width"] for k, v in cfg["wheelSpecs"].items()
            },
            "rawProofHashes": raw_hashes,
        },
        indent=2,
    )
)
