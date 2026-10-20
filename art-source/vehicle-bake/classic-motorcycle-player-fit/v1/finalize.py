"""Seal the inspected Classic v3 fit source pilot, never normal qualification."""

from pathlib import Path
import hashlib
import json
import shutil

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = Path(__file__).parent
A = R / "art-source/vehicle-bake/classic-motorcycle-player-fit/v1"
O = R / "public/demos/vehicle-bake/classic-motorcycle-player-fit/v1"
D = R / "data/vehicle-bake/classic-motorcycle-player-fit"
GLB = "38d2be5c55aee8c93d3e0c09625b5b6d65fe1441d78b4f93d146ea4103a5bc63"
RIDER = "911ee94cf11c2e674eddfe2a09f51ef64e0a05c5d5b7bf0795d364f60f6d132e"
BASE = "43704c934d2e56ab20e23411737cc989cf70495d362b817c33c41615516bf7b1"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding="utf-8-sig"))
rel = lambda p: p.relative_to(R).as_posix()


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, indent=2) + "\n")


def portable(v):
    if isinstance(v, dict):
        return {k: portable(x) for k, x in v.items()}
    if isinstance(v, list):
        return [portable(x) for x in v]
    if isinstance(v, str):
        return (
            v.replace(str(R), "REPOSITORY")
            .replace(R.as_posix(), "REPOSITORY")
            .replace(
                "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe", "BLENDER"
            )
        )
    return v


c = read(S / "family.json")
report = read(O / "report.json")
assert not report.get("sourceImmutable")
assert sha(A / "model.glb") == sha(O / "model.glb") == GLB
assert sha(R / c["rider"]["glbPath"]) == sha(O / "rider-reference.glb") == RIDER
prior = read(D / "protected-prior-inputs-fit.json")
assert all(sha(R / p) == h for p, h in prior.items())
basepins = read(A / "base-provenance.json")["inputHashes"]
assert all(sha(R / p) == h == sha(A / "base-inputs" / p) for p, h in basepins.items())
names = [
    "fit-proof.json",
    "source-audit.json",
    "raw-capture.json",
    "pixel-assessment.json",
    "contact-pairs-proof.json",
    "rider-self-contact-proof.json",
    "base-component-comparison.json",
    "mechanics-proof.json",
    "contact-rays-proof.json",
    "steer-diagnostic.json",
    "source-only-replay.json",
    "scoped-checks.json",
    "unchanged-controls-fit.json",
    "parameter-api-proof.json",
    "author-visual-inspection.json",
    "replay-verification.json",
    "diagnostic-bundle.json",
]
proof = {n: read(D / n) for n in names}
for n in [
    "fit-proof.json",
    "source-audit.json",
    "raw-capture.json",
    "pixel-assessment.json",
    "contact-pairs-proof.json",
    "mechanics-proof.json",
    "contact-rays-proof.json",
    "steer-diagnostic.json",
]:
    assert proof[n]["glbSha256"] == GLB, n
fit = proof["fit-proof.json"]
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
    x["minimumGapWorld"] > 0
    and x["fixedRiderTriangles"] == 1766
    and x["allNeutralRollAngles"]
    for x in fit["wholeFixedBikeAndRiderNeutralRoll"]
)
assert all(
    x["collisionRejected"] and x["baselineRestoredExact"]
    for x in fit["perWheelCollisionNegatives"]
)
pairs = proof["contact-pairs-proof.json"]
assert (
    pairs["status"] == "passed"
    and not pairs["baseline"]["inappropriatePairs"]
    and pairs["negative"]["actualTankCollisionDetected"]
    and pairs["negative"]["resetExact"]
)
selfproof = proof["rider-self-contact-proof.json"]
assert selfproof["status"] == "passed" and selfproof["riderSha256"] == RIDER
assert (
    selfproof["handFootGeometry"]["closedVolumetricPalmsBoots"]
    and selfproof["negativeControls"]["collapsedLegsRejected"]
    and selfproof["negativeControls"]["baselineRestored"]
)
comparison = proof["base-component-comparison.json"]
assert comparison["baseModelSha256"] == BASE and comparison["variantModelSha256"] == GLB
assert (
    len(comparison["exactFloatUnchangedComponents"])
    == comparison["unchangedComponents"]
    == 49
)
assert (
    len(comparison["changedSemanticComponents"])
    == len(comparison["addedSemanticComponents"])
    == 6
)
assert (
    comparison["atlasBytesExactToObservedBase"]
    and not comparison["nominallyUnchangedActualFloatDeltas"]
)
assert proof["source-audit.json"]["actualTriangleUVMatches"] == 2602
assert proof["contact-rays-proof.json"]["status"] == "passed"
assert len(proof["contact-rays-proof.json"]["contacts"]) == 5
assert all(
    x["removedContactSurfaceNegativeRejected"] and x["resetExact"]
    for x in proof["contact-rays-proof.json"]["contacts"]
)
assert (
    proof["mechanics-proof.json"]["status"] == "passed"
    and proof["mechanics-proof.json"]["loweredRiserTankNegative"]["rejected"]
)
failed = proof["unchanged-controls-fit.json"]
assert (
    failed["immutableFinalBaseSha256"] == BASE
    and failed["immutableRiderSha256"] == RIDER
    and failed["status"] == "unchanged-classic-controls-fail-configured-rider-fit"
)
capture = proof["raw-capture.json"]
assert (
    capture["riderSha256"] == RIDER
    and len(capture["frames"]) == 192
    and len(capture["wires"]) == 96
)
assert capture["singleDepthTarget"] and capture["riderHidden32ViewsPixelExact"]
assert len(capture["paddingParity"]) == len(capture["depth"]) == 32
assert all(
    x["unionAlphaMismatches"] == 0 and x["riderHiddenBikePixelsExact"]
    for x in capture["depth"]
)
assert all(
    x["actualMeshWireframe"] and x["changedChannelsFromFilled"] > 0
    for x in capture["wires"]
)
assert (
    capture["offline"]["noNetworkRequests"]
    and len(capture["offline"]["all32CombinedPixelsExact"]) == 32
)
assert len(capture["independent"]) == 2 and all(
    x["absoluteResetPixelsExact"] for x in capture["independent"]
)
assert len(proof["steer-diagnostic.json"]["frames"]) == 24
coverage = read(D / "coverage-final.json")
assert coverage["inputSha256"] == GLB and all(
    x["coveredCount"] == x["sampleCount"] == 25 for x in coverage["wheels"]
)
assert coverage["controls"]["positiveAndNegativeControlsPassed"]
replay = proof["source-only-replay.json"]
assert (
    replay["status"] == "passed"
    and len(replay["inputHashes"]) + len(replay["sharedInputHashes"]) == 6
)
for p, h in {**replay["inputHashes"], **replay["sharedInputHashes"]}.items():
    assert sha(R / p) == h
for n, x in replay["outputs"].items():
    assert x["sha256"] == sha(A / n) == sha(O / n) and x["byteExact"]
assert proof["replay-verification.json"]["arguments"] == ["--scratch"]
generic = read(D / "generic-replay/parent-source-replay.json")
assert (
    generic["status"] == "passed"
    and generic["declaredInputPins"] == 6
    and generic["glbSha256"] == GLB
)
assert (
    proof["parameter-api-proof.json"]["actualGLBChanged"]
    and proof["parameter-api-proof.json"]["atlasUnchanged"]
)
assert (
    proof["author-visual-inspection.json"]["exportedPixelsInspected"]
    and proof["scoped-checks.json"]["status"] == "passed"
)
assert all(
    sha(R / p) == h for p, h in proof["scoped-checks.json"]["sourceHashes"].items()
)

assembly = {
    "status": "source-pilot-complete-not-production",
    "bike": {
        "path": rel(O / "model.glb"),
        "sha256": GLB,
        "triangles": 2602,
        "draws": 3,
        "atlases": 1,
    },
    "rider": {
        "path": c["rider"]["glbPath"],
        "sha256": RIDER,
        "triangles": 1766,
        "draws": 1,
        "atlases": 1,
        "immutable": True,
        "reexported": False,
    },
    "singleMountSource": c["riderMountSource"],
    "mountWorldBlender": [v * c["exportWorldScale"] for v in c["riderMountSource"]],
    "mountTransform": "Translation only; source XYZ maps to glTF X,Z,-Y. No rider scaling/repose/profile change.",
    "combined": {
        "triangles": 4368,
        "draws": 4,
        "atlases": 2,
        "oneActualDepthTarget": True,
        "combinedGLBExported": False,
    },
    "humanApproval": False,
    "normalActivation": False,
    "actualSharedLoaderQualification": "pending parent",
}
write(A / "assembly.json", assembly)
diagnostic_paths = [
    "scripts/vehicle-bake/coverage.py",
    "scripts/vehicle-bake/source-replay.py",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/CarPixelOutline.ts",
    "package.json",
    "package-lock.json",
    *c["riderInputs"],
    *[
        f"scripts/vehicle-riders/classic-upright-v3/{n}"
        for n in ["rider.json", "classic-upright-v1.json", "build.py", "identity.json"]
    ],
    *[
        f"art-source/vehicle-riders/classic-upright/v3/{n}"
        for n in ["master.blend", "low.blend", "atlas.png"]
    ],
]
diagnostic = {p: sha(R / p) for p in diagnostic_paths}
for p in {**replay["sharedInputHashes"], **diagnostic}:
    dst = A / "inputs" / p
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(R / p, dst)
for p in S.iterdir():
    if p.is_file():
        shutil.copyfile(p, A / p.name)
for n, x in proof.items():
    write(A / "evidence" / n, portable(x))
write(A / "evidence/generic-source-replay.json", generic)
write(A / "evidence/coverage.json", coverage)
write(
    A / "evidence/prior-file-integrity.json",
    {"status": "passed", "unchangedFiles": len(prior), "inputHashes": prior},
)
for name in ["desktop.png", "mobile.png"]:
    shutil.copyfile(D / name, A / "evidence" / name)
for p in (D / "captures").glob("*.png"):
    dst = O / "raw-captures" / p.name
    dst.parent.mkdir(exist_ok=True)
    shutil.copyfile(p, dst)
for p in (D / "unchanged-controls/captures").glob("*.png"):
    dst = A / "evidence/unchanged-controls-captures" / p.name
    dst.parent.mkdir(exist_ok=True)
    shutil.copyfile(p, dst)
write(
    A / "evidence/unchanged-controls-raw-capture.json",
    read(D / "unchanged-controls/raw-capture.json"),
)
write(
    A / "source-replay.json",
    portable(
        {
            **replay,
            "diagnosticSharedInputHashes": diagnostic,
            "diagnosticsAreNotConstructionInputs": True,
        }
    ),
)
write(
    A / "proof-inputs.json",
    {
        "constructionInputHashes": replay["inputHashes"],
        "constructionSharedInputHashes": replay["sharedInputHashes"],
        "diagnosticInputHashes": diagnostic,
        "baseProvenanceInputHashes": basepins,
        "rawGLTFOnly": True,
        "sharedLoaderReview": "pending parent",
    },
)
report.update(
    status="complete",
    sourceStage="source-pilot-complete",
    sourceImmutable=True,
    sourcePilot=True,
    normalActivation=False,
    productionQualified=False,
    humanApproval=False,
    actualSharedLoaderBrowserReview="pending parent",
    riderComposition=assembly,
    actualBounds=fit["actualBikeBounds"],
    combinedBounds=fit["actualCombinedBounds"],
    sourceInputHashes=replay["inputHashes"],
    sharedInputHashes={**replay["sharedInputHashes"], **diagnostic},
    sourceQA={
        "actualFiveContacts": True,
        "narrowSemanticContactExceptions": True,
        "actualTankAndMechanicalConnections": True,
        "neutralWheelCylindersNegativeReset": 2,
        "crownSamplesEach": 25,
        "actualNativeHeadingsPerView": 32,
        "rawFrames": 192,
        "nativeWires": 96,
        "signedIndependentTravelReset": True,
        "diagnosticSteerFrames": 24,
        "nonzeroSteeringClearanceQualified": False,
        "desktopMobileOffline": True,
        "exactSixInputFreshReplay": True,
    },
    limitations=[
        "Source-only isolated Classic v3 fit; parent actual shared-loader composition/review pending",
        "No human approval, normal/AI/fallback/all27/standing-parity qualification",
        "Empty-bike and rider-hidden masks are diagnostics, not normal occupancy behavior",
        "Shared 58/58/80 combined outline unchanged; own violet source adapter is separate",
        "Neutral rigid source fit; nonzero steering is a raw rig diagnostic, not operating fork/rider animation or clearance qualification",
    ],
)
write(A / "report.json", report)
write(O / "report.json", report)
assert (A / "README.md").is_file()
delivery = {
    "ready": True,
    "status": "complete-source-pilot",
    "sourceImmutable": True,
    "glbSha256": GLB,
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "riderSha256": RIDER,
    "baseSha256": BASE,
    "triangles": {"bike": 2602, "rider": 1766, "combined": 4368},
    "combinedDraws": 4,
    "combinedAtlases": 2,
    "mountSource": c["riderMountSource"],
    "contacts": fit["contacts"],
    "components": {
        "exactUnchanged": 49,
        "changed": c["expectedChangedComponents"],
        "added": c["expectedAddedComponents"],
    },
    "report": rel(A / "report.json"),
    "assembly": rel(A / "assembly.json"),
    "proofs": rel(A / "evidence"),
    "offline": rel(O / "offline-raw.html"),
    "humanApproval": False,
    "normalActivation": False,
    "all27AIAndFallbackQualified": False,
    "sharedLoaderReview": "pending parent",
    "parentNext": "Independent shared-loader composition, visual review and freeze",
}
write(A / "delivery.json", delivery)
pins = {
    rel(p): sha(p)
    for base in [S, A, O]
    for p in sorted(base.rglob("*"))
    if p.is_file() and "__pycache__" not in p.parts and p.name != "retained-files.json"
}
write(A / "retained-files.json", pins)
assert all(sha(R / p) == h for p, h in pins.items())
write(
    D / "final-integrity.json",
    {
        "status": "passed",
        "retainedFiles": len(pins),
        "priorFilesUnchanged": len(prior),
        "glbSha256": GLB,
        "sourceImmutable": True,
    },
)
write(
    R / "data/vehicle-bake/autonomous-153/runtime-classic-player-fit-result.json",
    {**delivery, "retainedFiles": len(pins), "priorFilesUnchanged": len(prior)},
)
summary = f"Source complete and immutable. GLB {GLB};2602 bike+1766 unchanged rider=4368 triangles,4draws/2atlases. One mount [.10,0,1.0605]. Actual five contacts, strict intersections, mechanical connections/tank clearance, self/closed/straddle, both wheel-cylinder negative/reset, crown25each controls, all32native combined/bare/rider/masks,96wires,signed independent roll,steer diagnostic/reset,density/192x224 placement,mobile/offline and two fresh six-input exact replays pass. {len(pins)} retained pins;{len(prior)} prior files unchanged.\n\nSource-only; parent actual shared-loader composition/review pending. Human/normal/AI/fallback/all27/standing parity false. No global suites or Git. Await parent.\n"
(D / "progress.md").write_text(summary)
(D / "finalresult.md").write_text(summary)
print(
    json.dumps(
        {
            "status": "source-complete-immutable",
            "glbSha256": GLB,
            "retainedFiles": len(pins),
            "priorFilesUnchanged": len(prior),
        }
    )
)
