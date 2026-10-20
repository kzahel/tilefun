"""Seal this proven scooter source only; parent shared qualification remains pending."""

from pathlib import Path
import hashlib, json, shutil, sys

sys.dont_write_bytecode = True
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
A = ROOT / "art-source/vehicle-bake/retro-scooter/v1"
O = ROOT / "public/demos/vehicle-bake/retro-scooter/v1"
D = ROOT / "data/vehicle-bake/retro-scooter"
EXPECTED = "f396885d9651bad31a6276ae9cb131f39b484293c43504d4bfb55804ab6e2b65"
RIDER = "5a632bf763f08af447bf25f107cd7634f279cdb40738cfaa20697bd26c5e2500"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding="utf-8-sig"))
rel = lambda p: p.relative_to(ROOT).as_posix()


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


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
source = p["source-audit.json"]
pairs = p["contact-pairs-proof.json"]
capture = p["raw-capture.json"]
shape = p["shape-proof.json"]
replay = p["source-only-replay.json"]
assert (
    fit["status"] == "passed-actual-source-pilot"
    and fit["actualFit"]["status"] == "passed"
)
assert len(fit["contacts"]) == 5
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
    and r["fixedBikeTriangles"] == 1416
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
)
assert (
    pairs["negative"]["actualConfiguredShieldCollisionDetected"]
    and pairs["negative"]["resetExact"]
)
selfproof = p["rider-self-contact-proof.json"]
assert selfproof["status"] == "passed" and selfproof["riderSha256"] == RIDER
assert selfproof["footHandGeometry"]["closedVolumetricHandFootComponents"]
assert (
    selfproof["negativeControls"]["collapsedLegsRejected"]
    and selfproof["negativeControls"]["baselineRestored"]
)
assert (
    source["status"] == "passed"
    and source["actualTriangleUVMatches"] == 2280
    and source["actualCornerPositionAndUVMatches"] == 6840
)
for n in ["master.blend", "car.blend"]:
    assert (
        fit["packedScenes"][n]["sha256"]
        == sha(A / n)
        == next(r for r in source["packedScenes"] if r["path"] == n)["sha256"]
    )
assert shape["status"] == "passed" and shape["ownMasterMeshComponents"] == 40
assert shape["floorDepth"]["all9ActualFloorHits"] and shape["floorDepth"]["resetExact"]
assert all(
    not r["floorReached"]
    for key in ["floorRemovalNegative", "opaqueDeckNegative"]
    for r in shape["floorDepth"][key]
)
assert shape["independentDifferentRadiiSource"] == {"F": 0.31, "R": 0.33}
assert (
    capture["riderSha256"] == RIDER
    and len(capture["frames"]) == 192
    and len(capture["wires"]) == 96
)
assert capture["singleDepthTarget"] and capture["riderHidden32ViewsPixelExact"]
assert len(capture["paddingParity"]) == len(capture["depth"]) == 32
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
assert coverage["inputSha256"] == EXPECTED and all(
    w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"]
)
assert coverage["controls"]["positiveAndNegativeControlsPassed"]
api = p["parameter-api-proof.json"]
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
for n, v in replay["outputs"].items():
    assert v["sha256"] == sha(A / n) == sha(O / n) and v["byteExact"]
for n, h in {**replay["inputHashes"], **replay["sharedInputHashes"]}.items():
    assert sha(ROOT / n) == h
normalized = read(D / "replay-verification.json")
generic = read(D / "generic-replay/parent-source-replay.json")
assert (
    normalized["arguments"] == normalized["args"] == ["--scratch"]
    and normalized["glbSha256"] == EXPECTED
)
assert (
    normalized["inputHashes"] == replay["inputHashes"]
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
        "triangles": 2280,
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
        "triangles": 4236,
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
    shutil.copyfile(D / n, A / "evidence" / n)
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
        "ownScooterMorphology": True,
        "packedMaster40Components": True,
        "actualAll2280TriangleUVMatches": True,
        "realOpenStepThroughFloorRaysAndDeckRemovalNegativesReset": True,
        "trueFRDifferentRadii": True,
        "actual5ContactsOnSaddleGripsFloor": True,
        "narrowSemanticPairs": True,
        "bothFullRollCylindersAndNegativeResets": True,
        "intoShieldNegativeReset": True,
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
        "Unchanged Explorer upright only; soles on floor retain accepted straddle pose, no scooter-specific knees-together pose",
        "No other avatar/normal availability/AI/fallback/steering/suspension/rider/equipment animation claim",
        "Corresponding closed palm/grip wrap, sole/floor and pelvis/saddle are finite declared contact exceptions",
        "Dense native wire pixels can merge; packed semantic master and numeric topology/UV evidence retained",
        "Bike and immutable rider stay separate; no combined GLB or normal driver activation",
    ],
)
write(A / "report.json", report)
write(O / "report.json", report)
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
    "triangles": 2280,
    "vertices": 4294,
    "draws": 3,
    "atlases": 1,
    "normalActivation": False,
    "productionQualified": False,
    "humanApproval": False,
    "actualSharedLoaderBrowserReview": "pending parent",
    "parentNext": "Independent actual shared-cycle review/composition/freeze; preserve final source bytes.",
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
message = f"""Source complete and immutable. GLB SHA256 {EXPECTED}; 2280 triangles, 4294 UV vertices, three draws, one opaque unlit nearest 512 atlas. Separate immutable Explorer1956tri; combined4236tri/fourdraws/twoatlases, no combinedGLB.

Original mint/cream scooter: rounded transverse legshield, real continuous recessed step-through floor with raised rails, broad rounded rear cowling cut by an actual wheel arch, long saddle and headlamp nacelle. Actual source span2.68967 x .72 x1.305; fixed80/4.6 density, no angle fitting. True F/R wheels radius.31/.33source, world5.391304/5.739130, wheelbase1.93source.

Actual five contacts pass: hip/saddle, palms/grips, closed boot soles/physical floor. All fixed bike1416 and rider1956 triangles clear both complete neutral-roll cylinders; per-wheel collision negatives/reset and rider-into-shield negative/reset reject. Own crown25/25each and removal/offset/positive controls pass. Nine actualGLB rays reach floor.40source below rails.48; floor removal and opaque upperdeck negatives reject and reset. Narrow semantic contact-pair/self-straddle/closed hand-foot controls pass.

Actual32native combined/bare/rider/mask views,96wires, ordinary-distance and equal-angle signed phases, independent pivots/reset, hidden-rider bare parity,128/224fixed-density parity, desktop/mobile/offline pass. Packed40semanticcomponent master/three-mesh low and all2280triangle/6840UVcorner matches retained. Fresh declared six-input construction and generic --scratch replay reproduce model/atlas/recipe exactly. Config/id API change, bad-id/profile-pin negatives and exact reset pass. All genuine constructor and proof dependencies retained/pinned; {len(pins)} finalfiles.

AtlasSHA {delivery['atlasSha256']}; recipeSHA {delivery['recipeSha256']}. Source complete only: sourcePilot true, humanApproval/normalActivation/productionQualified false; actualSharedLoaderBrowserReview pending parent. Explorer retains unchanged upright straddle anatomy rather than knees-together scooter pose. No AI/fallback/all-avatar/animation/shared qualification claim. Earlier finals unchanged. Awaiting root instruction.
"""
(D / "progress.md").write_text(
    "ready: true\nstatus: complete\n\n" + message, encoding="utf-8"
)
(D / "finalresult.md").write_text(
    "# Retro scooter source pilot\n\n" + message, encoding="utf-8"
)
print(json.dumps({**delivery, "retainedFiles": len(pins)}))
