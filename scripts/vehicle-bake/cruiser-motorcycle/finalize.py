"""Seal only the proven original cruiser source; runtime qualification is separate."""

from pathlib import Path
import hashlib, json, shutil, sys

sys.dont_write_bytecode = True
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
A = ROOT / "art-source/vehicle-bake/cruiser-motorcycle/v1"
O = ROOT / "public/demos/vehicle-bake/cruiser-motorcycle/v1"
D = ROOT / "data/vehicle-bake/cruiser-motorcycle"
EXPECTED = "da0d617d945ae466a1cf51c070db44d7d81e0310536140b14726d85446e4ad6a"
RIDER = "5a632bf763f08af447bf25f107cd7634f279cdb40738cfaa20697bd26c5e2500"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding="utf-8-sig"))
rel = lambda p: p.relative_to(ROOT).as_posix()


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, indent=2) + "\n")


report = read(O / "report.json")
cfg = read(S / "family.json")
assert not report.get("sourceImmutable")
assert sha(A / "model.glb") == sha(O / "model.glb") == EXPECTED
assert sha(ROOT / cfg["rider"]["glbPath"]) == sha(O / "rider-reference.glb") == RIDER
names = [
    "fit-proof.json",
    "source-audit.json",
    "raw-capture.json",
    "pixel-assessment.json",
    "contact-pairs-proof.json",
    "rider-self-contact-proof.json",
    "source-only-replay.json",
    "scoped-checks.json",
    "shape-proof.json",
    "parameter-api-proof.json",
]
p = {n: read(D / n) for n in names}
for n in [
    "fit-proof.json",
    "source-audit.json",
    "raw-capture.json",
    "pixel-assessment.json",
    "contact-pairs-proof.json",
    "shape-proof.json",
]:
    assert p[n]["glbSha256"] == EXPECTED, n
fit = p["fit-proof.json"]
pairs = p["contact-pairs-proof.json"]
source = p["source-audit.json"]
capture = p["raw-capture.json"]
shape = p["shape-proof.json"]
api = p["parameter-api-proof.json"]
selfproof = p["rider-self-contact-proof.json"]
replay = p["source-only-replay.json"]
assert (
    fit["status"] == "passed-actual-source-pilot"
    and fit["actualFit"]["status"] == "passed"
    and len(fit["contacts"]) == 5
)
assert (
    fit["displacedRiderNegative"]["rejected"]
    and fit["displacedRiderNegative"]["baselineRestoredExact"]
)
assert (
    len(fit["wholeFixedBikeAndRiderNeutralRoll"])
    == len(fit["perWheelCollisionNegatives"])
    == 2
)
assert all(
    r["minimumGapWorld"] > 0
    and r["fixedBikeTriangles"] == 2192
    and r["fixedRiderTriangles"] == 1956
    and r["allNeutralRollAngles"]
    for r in fit["wholeFixedBikeAndRiderNeutralRoll"]
)
assert all(
    r["collisionRejected"] and r["baselineRestoredExact"]
    for r in fit["perWheelCollisionNegatives"]
)
assert (
    pairs["status"] == pairs["baseline"]["status"] == "passed"
    and not pairs["baseline"]["inappropriatePairs"]
    and pairs["negative"]["actualTankCollisionDetected"]
    and pairs["negative"]["resetExact"]
)
assert (
    selfproof["status"] == "passed"
    and selfproof["riderSha256"] == RIDER
    and selfproof["footHandGeometry"]["closedVolumetricHandFootComponents"]
    and selfproof["negativeControls"]["collapsedLegsRejected"]
    and selfproof["negativeControls"]["baselineRestored"]
)
assert (
    source["status"] == "passed"
    and source["actualTriangleUVMatches"] == 3056
    and source["actualCornerPositionAndUVMatches"] == 9168
)
for n in ["master.blend", "car.blend"]:
    assert (
        fit["packedScenes"][n]["sha256"]
        == sha(A / n)
        == next(r for r in source["packedScenes"] if r["path"] == n)["sha256"]
    )
assert (
    shape["status"] == "passed"
    and shape["ownMasterMeshComponents"] == 61
    and shape["tank"]["rings"] == 7
    and shape["fork"]["rakeDegreesFromVertical"] > 48
    and shape["wheelbaseSource"] > 2.59
)
assert shape["independentDifferentRadiiSource"] == {"F": 0.43, "R": 0.46}
assert (
    capture["riderSha256"] == RIDER
    and len(capture["frames"]) == 192
    and len(capture["wires"]) == 96
)
assert (
    capture["singleDepthTarget"]
    and capture["riderHidden32ViewsPixelExact"]
    and len(capture["paddingParity"]) == len(capture["depth"]) == 32
)
assert all(
    r["unionAlphaMismatches"] == 0 and r["riderHiddenBikePixelsExact"]
    for r in capture["depth"]
)
assert all(
    r["actualMeshWireframe"] and r["changedChannelsFromFilled"] > 0
    for r in capture["wires"]
)
assert len(capture["signedPhases"]) == len(capture["equalAnglePhases"]) == 16
assert any(
    abs(r["wheels"][0]["angleRadians"] - r["wheels"][1]["angleRadians"]) > 0.01
    for r in capture["signedPhases"]
)
assert all(
    abs(r["wheelAngles"][0]["angleRadians"] - r["wheelAngles"][1]["angleRadians"])
    < 1e-6
    for r in capture["equalAnglePhases"]
)
assert len(capture["independent"]) == 2 and all(
    r["absoluteResetPixelsExact"]
    and r["actualPivotFixed"]
    and r["otherWheelBodyRiderFixed"]
    for r in capture["independent"]
)
assert (
    capture["offline"]["noNetworkRequests"]
    and len(capture["offline"]["all32CombinedPixelsExact"]) == 32
)
coverage = read(D / "coverage-draft1.json")
assert (
    coverage["inputSha256"] == EXPECTED
    and all(w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"])
    and coverage["controls"]["positiveAndNegativeControlsPassed"]
)
assert api["status"] == "passed" and all(
    api[k]
    for k in [
        "variantIdArgumentWorks",
        "configArgumentWorks",
        "sourceDependenciesDeclareActualConfigPath",
        "actualGLBChanged",
        "atlasUnchanged",
        "mismatchedVariantIdRejected",
        "corruptProfilePinRejected",
        "negativeAttemptsPreservedPriorOutputs",
        "validResetModelAtlasRecipeExact",
    ]
)
assert (
    replay["status"] == "passed"
    and len(replay["inputHashes"]) + len(replay["sharedInputHashes"]) == 6
)
for n, value in replay["outputs"].items():
    assert value["sha256"] == sha(A / n) == sha(O / n) and value["byteExact"]
for n, h in {**replay["inputHashes"], **replay["sharedInputHashes"]}.items():
    assert sha(ROOT / n) == h
normalized = read(D / "replay-verification.json")
generic = read(D / "generic-replay/parent-source-replay.json")
assert (
    normalized["arguments"] == normalized["args"] == ["--scratch"]
    and normalized["glbSha256"] == EXPECTED
    and normalized["inputHashes"] == replay["inputHashes"]
    and normalized["sharedInputHashes"] == replay["sharedInputHashes"]
)
assert (
    generic["status"] == "passed"
    and generic["declaredInputPins"] == 6
    and generic["glbSha256"] == EXPECTED
)
assert p["scoped-checks.json"]["status"] == "passed"
for n, h in p["scoped-checks.json"]["sourceHashes"].items():
    assert sha(ROOT / n) == h

assembly = {
    "status": "source-pilot-only",
    "bike": {
        "path": rel(O / "model.glb"),
        "sha256": EXPECTED,
        "triangles": 3056,
        "draws": 3,
        "atlases": 1,
    },
    "rider": {
        "path": cfg["rider"]["glbPath"],
        "sha256": RIDER,
        "triangles": 1956,
        "draws": 1,
        "atlases": 1,
        "immutable": True,
        "reexported": False,
    },
    "singleMountSource": cfg["riderMountSource"],
    "gltfMountTransform": "S*[x,z,-y], S=80/4.6; rider GLB already carries export scale",
    "combined": {
        "triangles": 5012,
        "draws": 4,
        "atlases": 2,
        "oneActualDepthTarget": True,
        "combinedGLBExported": False,
    },
    "normalActivation": False,
    "productionQualified": False,
    "humanApproval": False,
}
write(A / "assembly.json", assembly)
diagnostic_paths = [
    "scripts/vehicle-bake/coverage.py",
    "scripts/vehicle-bake/source-replay.py",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/CarPixelOutline.ts",
    "package.json",
    "package-lock.json",
    "scripts/vehicle-riders/explorer-upright/rider.json",
    "scripts/vehicle-riders/explorer-upright/profile.json",
    *cfg["riderInputs"],
    "art-source/vehicle-riders/explorer-upright/v1/master.blend",
    "art-source/vehicle-riders/explorer-upright/v1/low.blend",
]
diagnostic = {n: sha(ROOT / n) for n in diagnostic_paths}
bundle = read(D / "diagnostic-bundle.json")
assert all(diagnostic[n] == h for n, h in bundle["helperHashes"].items())
for n in {**replay["sharedInputHashes"], **diagnostic}:
    dest = A / "inputs" / n
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / n, dest)
for q in S.iterdir():
    if q.is_file():
        shutil.copyfile(q, A / q.name)
for n in [
    *names,
    "diagnostic-bundle.json",
    "author-visual-inspection.json",
    "replay-verification.json",
]:
    dest = A / "evidence" / n
    dest.parent.mkdir(exist_ok=True)
    shutil.copyfile(D / n, dest)
write(A / "evidence/generic-source-replay.json", generic)
write(A / "evidence/coverage.json", coverage)
for n in ["desktop.png", "mobile.png"]:
    shutil.copyfile(D / n, A / "evidence" / n)
for q in (D / "captures").glob("*.png"):
    dest = O / "raw-captures" / q.name
    dest.parent.mkdir(exist_ok=True)
    shutil.copyfile(q, dest)
write(
    A / "source-replay.json",
    {
        **replay,
        "diagnosticInputHashes": diagnostic,
        "diagnosticsAreNotConstructionInputs": True,
    },
)
write(
    A / "proof-inputs.json",
    {
        "constructionInputHashes": replay["inputHashes"],
        "constructionSharedInputHashes": replay["sharedInputHashes"],
        "diagnosticInputHashes": diagnostic,
        "actualSharedLoaderBrowserReview": "pending parent",
        "unusedCycleHelpersNotPinned": True,
    },
)
report.update(
    status="complete",
    sourceStage="complete",
    sourceImmutable=True,
    sourcePilot=True,
    normalActivation=False,
    productionQualified=False,
    humanApproval=False,
    actualSharedLoaderBrowserReview="pending parent",
    CarMeshAssetUsed=False,
    rawGLTFDiagnostic=True,
    riderComposition=assembly,
    actualBounds=fit["actualBikeBounds"],
    combinedBounds=fit["actualCombinedBounds"],
    sourceQA={
        "ownOriginalCruiserMorphology": True,
        "packedMaster61Components": True,
        "actualAll3056TriangleUVMatches": True,
        "trueFRDifferentRadii": True,
        "actual5Contacts": True,
        "narrowSemanticPairs": True,
        "bothFullRollCylindersAndNegativeResets": True,
        "intoTankNegativeReset": True,
        "immutableRiderSelfClosedSolidStraddleControls": True,
        "ownCrown25EachControls": True,
        "actual32EachCombinedBareRiderMasks": True,
        "native96Wireframes": True,
        "signedOrdinaryDistanceAndEqualAnglePhases": True,
        "independentPivotsReset": True,
        "riderHidden32PixelExact": True,
        "native128224FixedDensityParity": True,
        "desktopMobileOffline": True,
        "exactSixInputAndGenericScratchReplay": True,
        "parameterAPIConfigAndPinNegativesReset": True,
        "scopedChecks": True,
    },
    sourceInputHashes=replay["inputHashes"],
    sharedInputHashes={**replay["sharedInputHashes"], **diagnostic},
    limitations=[
        "Source complete only; actual parent shared-cycle family capture/loader qualification pending",
        "Unchanged Explorer upright only; no other avatar/normal availability/AI/fallback claim",
        "Static neutral controls; no steering/suspension/rider/equipment animation qualified",
        "Actual corresponding palm/grip closed-solid wrap is a bounded contact exception; no articulated fingers",
        "Dense native wire pixels can merge; packed master and numerical topology/UV evidence retained",
        "Bike and immutable rider stay separate; no combined GLB or normal driver activation",
    ],
)
write(A / "report.json", report)
write(O / "report.json", report)
(A / "README.md").write_text(
    (A / "README.md")
    .read_text()
    .replace(
        "Draft until source proof retention/sealing.",
        "Source complete and immutable after actual proof retention/sealing.",
    )
)
delivery = {
    "status": "complete",
    "sourceStage": "complete",
    "sourceImmutable": True,
    "sourcePilot": True,
    "ready": True,
    "glbSha256": EXPECTED,
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "riderSha256": RIDER,
    "triangles": 3056,
    "vertices": 5652,
    "draws": 3,
    "atlases": 1,
    "normalActivation": False,
    "productionQualified": False,
    "humanApproval": False,
    "actualSharedLoaderBrowserReview": "pending parent",
    "parentNext": "Independent actual shared-cycle family review/composition/freeze; preserve source bytes.",
}
write(A / "delivery.json", delivery)
pins = {
    rel(q): sha(q)
    for base in [S, A, O]
    for q in sorted(base.rglob("*"))
    if q.is_file() and "__pycache__" not in q.parts and q.name != "retained-files.json"
}
write(A / "retained-files.json", pins)
assert all(sha(ROOT / n) == h for n, h in pins.items())
write(
    D / "final-integrity.json",
    {**delivery, "status": "passed", "retainedFiles": len(pins)},
)
(D / "progress.md").write_text(
    f"ready: true\nstatus: complete\n\nImmutable cruiser bike GLB SHA256 {EXPECTED};3056 triangles,5652UVvertices,3draws,oneopaque512atlas. Separate unchanged Explorer1956tri; composite5012tri/4draws/2atlases, no combined GLB.\n\nOwn broad low7ringtank,long stepped saddle,49.46degree raked fork,wide actual V-engine and low twin chrome exhausts. Actual5contacts,part-pair intersections,tank displacement/reset,both full-neutral-roll cylinders/collision negatives/reset, own crown25/25each+controls,rider self/closed hand-foot/straddle controls,32native combined/bare/rider/mask views+96wires,ordinary-distance/equal-angle signed phases,independent pivots/reset,128/224parity,mobile/offline,packed61component master/3mesh low,all3056UVownership and exact6input/generic scratch replay pass. Config/id API positive plus mismatched id/profile-pin negatives and exact reset pass.\n\n{len(pins)}retainedpins stable. Report complete means source only. sourcePilot true; humanApproval/normalActivation/productionQualified false; actual shared-cycle family capture/loader pending parent. No SRC/Git/global/catalog/review or prior immutable edits. Awaiting next instruction.\n"
)
(D / "finalresult.md").write_text(
    f"# Cruiser motorcycle\n\nSource complete and immutable. GLB `{EXPECTED}`;3056tri/5652UVvertices/3draws/one512atlas. Atlas `{delivery['atlasSha256']}`;recipe `{delivery['recipeSha256']}`. Explorer separate unchanged `{RIDER}`.\n\nOriginal maroon/cream low cruiser: actual broad seven-ring tank,1.05source long stepped saddle,49.46degree laidback fork,two real opposing slanted V cylinders/broad crankcase and twin long low chrome exhausts.2.60source wheelbase; independent front/rear radii.43/.46source (world7.47826/8). Own body geometry/UV construction, not a recolor.\n\nActual five contacts and narrow corresponding semantic pair checks pass. Initial thigh/boot engine overlap was corrected with the one mount/control translation while preserving Explorer and the engine. Both full-roll cylinders include every fixed bike and rider triangle; per-wheel collision/reset and into-tank displacement/reset reject correctly. Own crown region25/25each+removal/offset/positive controls;32native study/game sets each for combined/bare/rider/masks,96wires,ordinary-distance and equal-angle signed phases,independent pivots/reset,hidden-rider bike pixel parity,128/224density parity and desktop/mobile/offline pass. Packed61component master/3mesh low and all3056triangle/9168UVcorner matches retained.\n\nFresh physically isolated six-input replay and parent generic --scratch helper reproduce exact model/atlas/recipe. Retained config/id API test changes one control parameter, rejects mismatched id/corrupt profile pin, preserves prior outputs and resets exact. All actual constructor/proof inputs retained and pinned.\n\nStatus complete means source finished only. Human approval/production/normal activation false; actual parent shared-cycle family capture/loader still pending. No AI/fallback/all-avatar/steering/suspension/rider/equipment animation claim. Parent owns independent QA/composer/review/freeze. Prior sources unchanged. Awaiting next instruction.\n"
)
print(json.dumps({**delivery, "retainedFiles": len(pins)}))
