"""Seal only this independently proved Person7-control source variant."""

from pathlib import Path
import hashlib
import json
import shutil
import sys

sys.dont_write_bytecode = True
ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
A = ROOT / "art-source/vehicle-bake/classic-motorcycle-person7-fit/v1"
O = ROOT / "public/demos/vehicle-bake/classic-motorcycle-person7-fit/v1"
D = ROOT / "data/vehicle-bake/classic-motorcycle-person7-fit"
BASE = "43704c934d2e56ab20e23411737cc989cf70495d362b817c33c41615516bf7b1"
RIDER = "7b9396dfdff8dc8bca9a3d368ac253b2a0ae36e51b8669a254e535b8ff2e4c99"
EXPECTED = "f9c26d3965c00f1cb1ae63a275b06619846fbd41f17f05645389c2fdb586cd63"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding="utf-8-sig"))
rel = lambda p: p.relative_to(ROOT).as_posix()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


report = read(O / "report.json")
assert not report.get("sourceImmutable")
cfg = read(S / "family.json")
assert cfg["baseProvenance"]["parentConfirmedImmutable"]
assert cfg["baseProvenance"]["glbSha256"] == BASE
base_pins = read(A / "base-provenance.json")["inputHashes"]
assert all(
    sha(ROOT / p) == h == sha(A / "base-inputs" / p) for p, h in base_pins.items()
)
assert sha(A / "model.glb") == sha(O / "model.glb") == EXPECTED
assert sha(ROOT / "art-source/vehicle-riders/person7-upright/v1/rider.glb") == RIDER
assert sha(O / "rider-reference.glb") == RIDER
proofs = {
    n: read(D / n)
    for n in [
        "fit-proof.json",
        "source-audit.json",
        "raw-capture.json",
        "pixel-assessment.json",
        "contact-pairs-proof.json",
        "rider-self-contact-proof.json",
        "base-component-comparison.json",
        "source-only-replay.json",
        "scoped-checks.json",
        "unchanged-controls-fit.json",
    ]
}
for n in [
    "fit-proof.json",
    "source-audit.json",
    "raw-capture.json",
    "pixel-assessment.json",
    "contact-pairs-proof.json",
]:
    assert proofs[n]["glbSha256"] == EXPECTED, n
fit = proofs["fit-proof.json"]
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
    and r["fixedRiderTriangles"] == 1984
    and r["allNeutralRollAngles"]
    for r in fit["wholeFixedBikeAndRiderNeutralRoll"]
)
assert all(
    r["collisionRejected"] and r["baselineRestoredExact"]
    for r in fit["perWheelCollisionNegatives"]
)
pairs = proofs["contact-pairs-proof.json"]
assert pairs["status"] == pairs["baseline"]["status"] == "passed"
assert (
    not pairs["baseline"]["inappropriatePairs"]
    and pairs["negative"]["actualTankCollisionDetected"]
    and pairs["negative"]["resetExact"]
)
selfproof = proofs["rider-self-contact-proof.json"]
assert selfproof["status"] == "passed" and selfproof["riderSha256"] == RIDER
assert (
    selfproof["handFootGeometry"]["closedVolumetricPalmsBoots"]
    and selfproof["negativeControls"]["collapsedLegsRejected"]
)
assert selfproof["negativeControls"]["baselineRestored"]
comparison = proofs["base-component-comparison.json"]
assert comparison["baseFinalConfirmed"] and comparison["baseModelSha256"] == BASE
assert (
    comparison["variantModelSha256"] == EXPECTED
    and comparison["unchangedComponents"] == 49
)
failed = proofs["unchanged-controls-fit.json"]
assert (
    failed["immutableFinalBaseSha256"] == BASE
    and failed["immutableRiderSha256"] == RIDER
)
assert failed["status"] == "unchanged-classic-controls-fail-configured-rider-fit"
assert failed["attempts"][1]["actualGeometryFit"]["inappropriateIntersections"]
source = proofs["source-audit.json"]
assert source["status"] == "passed" and source["actualTriangleUVMatches"] == 2434
for n in ["master.blend", "car.blend"]:
    assert fit["packedScenes"][n]["sha256"] == sha(A / n)
    assert next(r for r in source["packedScenes"] if r["path"] == n)["sha256"] == sha(
        A / n
    )
capture = proofs["raw-capture.json"]
assert (
    capture["riderSha256"] == RIDER
    and len(capture["frames"]) == 192
    and len(capture["wires"]) == 96
)
assert capture["singleDepthTarget"] and capture["riderHidden32ViewsPixelExact"]
assert len(capture["paddingParity"]) == 32 and len(capture["depth"]) == 32
assert all(
    r["unionAlphaMismatches"] == 0 and r["riderHiddenBikePixelsExact"]
    for r in capture["depth"]
)
assert all(
    r["actualMeshWireframe"] and r["changedChannelsFromFilled"] > 0
    for r in capture["wires"]
)
assert (
    capture["offline"]["noNetworkRequests"]
    and len(capture["offline"]["all32CombinedPixelsExact"]) == 32
)
assert len(capture["independent"]) == 2 and all(
    r["absoluteResetPixelsExact"] for r in capture["independent"]
)
coverage = read(D / "coverage-draft1.json")
assert coverage["inputSha256"] == EXPECTED and all(
    w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"]
)
assert coverage["controls"]["positiveAndNegativeControlsPassed"]
replay = proofs["source-only-replay.json"]
assert (
    replay["status"] == "passed"
    and len(replay["inputHashes"]) + len(replay["sharedInputHashes"]) == 6
)
for p, h in {**replay["inputHashes"], **replay["sharedInputHashes"]}.items():
    assert sha(ROOT / p) == h
for n, result in replay["outputs"].items():
    assert result["sha256"] == sha(A / n) == sha(O / n) and result["byteExact"]
normalized = read(D / "replay-verification.json")
assert normalized["arguments"] == ["--scratch"] and normalized["glbSha256"] == EXPECTED
assert (
    normalized["inputHashes"] == replay["inputHashes"]
    and normalized["sharedInputHashes"] == replay["sharedInputHashes"]
)
generic = read(D / "generic-replay/parent-source-replay.json")
assert (
    generic["status"] == "passed"
    and generic["declaredInputPins"] == 6
    and generic["glbSha256"] == EXPECTED
)
assert proofs["scoped-checks.json"]["status"] == "passed"
for p, h in proofs["scoped-checks.json"]["sourceHashes"].items():
    assert sha(ROOT / p) == h

api = read(D / "parameter-api-proof.json")
assert (
    api["status"] == "passed"
    and api["variantIdArgumentWorks"]
    and api["configArgumentWorks"]
    and api["sourceDependenciesDeclareActualConfigPath"]
    and api["actualGLBChanged"]
    and api["atlasUnchanged"]
)
assembly = {
    "status": "prototype-source-complete-not-production",
    "bike": {
        "path": rel(O / "model.glb"),
        "sha256": EXPECTED,
        "triangles": 2434,
        "draws": 3,
        "atlases": 1,
    },
    "rider": {
        "path": "art-source/vehicle-riders/person7-upright/v1/rider.glb",
        "sha256": RIDER,
        "triangles": 1984,
        "draws": 1,
        "atlases": 1,
        "immutable": True,
        "reexported": False,
    },
    "singleMountSource": cfg["riderMountSource"],
    "mountWorldBlender": [v * cfg["exportWorldScale"] for v in cfg["riderMountSource"]],
    "gltfMountTransform": "S * [sourceX, sourceZ, -sourceY]; rider GLB already has its export scale",
    "combined": {
        "triangles": 4418,
        "draws": 4,
        "atlases": 2,
        "oneActualDepthTarget": True,
        "combinedGLBExported": False,
    },
    "qualifiedComposer": "Parent may compose later after independent shared loader qualification",
    "productionQualified": False,
    "normalActivation": False,
    "humanApproval": False,
}
write(A / "assembly.json", assembly)
diagnostic_paths = [
    "scripts/vehicle-bake/coverage.py",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/CarPixelOutline.ts",
    "package.json",
    "package-lock.json",
    "scripts/vehicle-bake/source-replay.py",
    "scripts/vehicle-riders/person7-upright/rider.json",
    "scripts/vehicle-riders/person7-upright/explorer-upright-v1.json",
    "scripts/vehicle-riders/person7-upright/person7-upright-v1.json",
    "art-source/vehicle-riders/profiles/upright-v1.json",
    *cfg["riderInputs"],
    "art-source/vehicle-riders/person7-upright/v1/master.blend",
    "art-source/vehicle-riders/person7-upright/v1/low.blend",
]
diagnostic = {p: sha(ROOT / p) for p in diagnostic_paths}
for p in {**replay["sharedInputHashes"], **diagnostic}:
    dest = A / "inputs" / p
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / p, dest)
for p in sorted(S.iterdir()):
    if p.is_file():
        shutil.copyfile(p, A / p.name)
for n in [
    *proofs,
    "base-final-pins.json",
    "diagnostic-bundle.json",
    "author-visual-inspection.json",
    "parameter-api-proof.json",
    "replay-verification.json",
]:
    dest = A / "evidence" / n
    dest.parent.mkdir(exist_ok=True)
    shutil.copyfile(D / n, dest)
write(A / "evidence/generic-source-replay.json", generic)
write(A / "evidence/coverage.json", coverage)
for n in ["desktop.png", "mobile.png"]:
    shutil.copyfile(D / n, A / "evidence" / n)
for p in (D / "captures").glob("*.png"):
    dest = O / "raw-captures" / p.name
    dest.parent.mkdir(exist_ok=True)
    shutil.copyfile(p, dest)
for p in (D / "unchanged-controls/captures").glob("*.png"):
    dest = A / "evidence/unchanged-controls-captures" / p.name
    dest.parent.mkdir(exist_ok=True)
    shutil.copyfile(p, dest)
shutil.copyfile(
    D / "unchanged-controls/raw-capture.json",
    A / "evidence/unchanged-controls-raw-capture.json",
)
write(
    A / "source-replay.json",
    {
        **replay,
        "diagnosticSharedInputHashes": diagnostic,
        "diagnosticsAreNotConstructionInputs": True,
        "baseConstructorForkProvenance": cfg["baseProvenance"],
        "unusedCycleAdaptersNotPinned": True,
    },
)
write(
    A / "proof-inputs.json",
    {
        "constructionInputHashes": replay["inputHashes"],
        "constructionSharedInputHashes": replay["sharedInputHashes"],
        "diagnosticInputHashes": diagnostic,
        "baseProvenanceInputHashes": base_pins,
        "rawGLTFOnly": True,
        "sharedLoaderReview": "pending parent",
    },
)
report.update(
    status="complete",
    sourceStage="complete",
    sourceImmutable=True,
    sourcePilot=True,
    productionQualified=False,
    normalActivation=False,
    humanApproval=False,
    actualSharedLoaderBrowserReview="pending parent",
    riderComposition=assembly,
    baseProvenance=cfg["baseProvenance"],
    actualBounds=fit["actualBikeBounds"],
    combinedBounds=fit["actualCombinedBounds"],
    sourceQA={
        "exactFreshSixInputReplay": True,
        "allActualTriangleUVMatches": 2434,
        "packedMasterComponents": 55,
        "trueFRRig": True,
        "actualFiveContacts": True,
        "narrowSemanticPairExceptionsOnly": True,
        "actualUnchangedBasePerson7FailureRetained": True,
        "twoWholeBodyRiderCylinderNegativeResets": True,
        "displacedIntoTankNegativeReset": True,
        "unchangedPerson7SelfClosedPawStraddleControls": True,
        "crownCoverageEach": 25,
        "actual32HeadingsEach": ["combined", "bike-alone", "rider-alone"],
        "all32WireframesEach": True,
        "riderHidden32PixelExact": True,
        "depthMasksAndSingleTarget": True,
        "native128224FixedDensityParity": True,
        "signedIndependentRoll": True,
        "desktopMobileOffline": True,
        "scopedChecks": True,
    },
    sourceInputHashes=replay["inputHashes"],
    sharedInputHashes={**replay["sharedInputHashes"], **diagnostic},
    limitations=[
        "Prototype source only; actual shared motorcycle loader/browser qualification remains pending parent",
        "Only unchanged Brown Person7 measured profile fitted; no other-avatar, AI, occupied fallback or normal availability claim",
        "Neutral static control geometry; no steering, suspension, rider/equipment animation qualification",
        "Grip/paw closed-solid overlap is the explicitly bounded wrapping contact; fingers are not articulated",
        "Raw GLTF uses shared projection/outline math; no normal CarMeshAsset used",
        "Original base and Person7 remain immutable; own bike geometry reexport is not binary base preservation",
    ],
)
write(O / "report.json", report)
write(A / "report.json", report)
readme = (
    (A / "README.md")
    .read_text()
    .replace(
        "draft until final proof retention/sealing",
        "complete and immutable after proof retention/sealing",
    )
    .replace("— draft prototype", "— immutable source prototype")
    .replace(
        "This package is not sealed: final base provenance awaits the parent's explicit immutable-base confirmation.",
        "The parent confirmed the immutable final base; this separately proved source package is sealed.",
    )
    .replace(
        "and will be packed after the base pin is confirmed",
        "and are packed with this source",
    )
)
(A / "README.md").write_text(readme)
delivery = {
    "status": "complete",
    "sourceImmutable": True,
    "ready": True,
    "glbSha256": EXPECTED,
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "baseSha256": BASE,
    "riderSha256": RIDER,
    "report": rel(O / "report.json"),
    "humanApproval": False,
    "normalActivation": False,
    "sharedLoaderReview": "pending parent",
    "replayInputs": "Own build.py/geometry.py/family.json/raw-audit.py; stable catalog-cycle.py; unchanged Person7 measured profile. Exactly six files, no masters/scratch/Person7 GLB construction input.",
    "parentNext": "Independent actual shared motorcycle composition/review and freeze; preserve all source bytes.",
}
write(A / "delivery.json", delivery)
pins = {
    rel(p): sha(p)
    for base in [S, A, O]
    for p in sorted(base.rglob("*"))
    if p.is_file() and "__pycache__" not in p.parts and p.name != "retained-files.json"
}
write(A / "retained-files.json", pins)
assert all(sha(ROOT / p) == h for p, h in pins.items())
write(
    D / "final-integrity.json",
    {**delivery, "status": "passed", "files": len(pins), "sourceImmutable": True},
)
(D / "progress.md").write_text(
    f"ready: true\nstatus: complete\n\nImmutable bike GLB SHA256 {EXPECTED}; 2434 triangles, 4510 UV vertices, 3 draws, one opaque512 atlas. Separate unchanged {cfg['rider']['label']} SHA256 {RIDER}, {cfg['rider']['triangles']} triangles. Composition 4418 triangles / 4 draws / 2 atlases; no combined GLB.\n\n49 of55 base semantic components exactly unchanged, including all saddle pieces. Six changed components are connected riser/crossbar, two grips and two pegs, parameterized from the measured profile and one mount {cfg['riderMountSource']}. No avatar scale/anatomy changes. Actual unchanged-bike failure, all5 actual contacts, bounded part-pair intersections, both wheel cylinders and per-wheel negative/reset, into-tank negative/reset, rider self/closed-palm/boot/straddle controls, crown25/25each+controls,32native combined/bare/rider/mask sets plus96 wires, signed independent travel/pivots,128/224 parity,desktop/mobile/offline and exact six-input generic scratch replay pass. Parameter API fixture confirms alternate config/id and meaningful grip geometry change with same atlas.\n\nReport status complete means source finished only. Source immutable; sourcePilot true; normalActivation/productionQualified/humanApproval false; actual shared loader/browser pending parent. {len(pins)} retained pins verified. No global/Git/catalog/runtime/normal availability/AI/fallback/all-avatar/animation claim.\n"
)
(D / "finalresult.md").write_text(
    f"# Classic motorcycle Person7 fit\n\nSource complete and immutable. Bike GLB `{EXPECTED}`; 2434 triangles / 3 draws / one512 atlas. Atlas `{delivery['atlasSha256']}`; recipe `{delivery['recipeSha256']}`. Unchanged separate Person7 `{RIDER}`.\n\nThe actual unchanged final classic bike fails Person7 with best upright translation, actual saddle-contact mount and proper-rigid least-squares controls. Retained actual geometry shows tank/cooling-fin intersections and missed controls. The own variant leaves49of55 components exact, including saddle/tank/engine/fenders/wheels. It changes only connected riser/crossbar, two grips and two pegs using measured configuration. No avatar scale, limb or original-source modifications.\n\nAll5 actual contacts and narrow corresponding semantic pair exceptions, local rider self/closed-solid/straddle controls, whole fixed bike+rider vs both full-roll cylinders, targeted per-wheel collisions/reset and displaced-into-tank/reset pass.32native study/game sets each for bare/combined/rider plus masks,96actual native wires,signed independent motion/pivot/reset,hidden-rider exact bike parity,crown25/25each+controls,128/224density parity,desktop/mobile/offline pass. Packed master55components/low3meshes and exact six-input source replay retained. The modern normalized receipt also passes parent generic --scratch replay.\n\nNew owned parameterized builder accepts variant-id/config arguments; actual config/profile are declared dependencies. An isolated config/id/grip-dimension fixture passes; README documents inputs another authorized avatar must change. No broader avatar rollout.\n\nStatus complete means source only. Human approval/normal activation/production qualification false; raw actual-fit/view diagnostics remain pending parent shared motorcycle loader review. No AI/fallback/all27/steering/suspension/rider-animation claim. Parent owns independent QA/composition/freeze. Awaiting next instruction.\n"
)
print(json.dumps({**delivery, "retainedFiles": len(pins)}))
