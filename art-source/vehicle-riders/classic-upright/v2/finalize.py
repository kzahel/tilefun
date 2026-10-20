"""Seal only the Classic static source prerequisite after exact source/visual QA."""

import hashlib
import io
import json
from pathlib import Path
import shutil
import struct

from PIL import Image

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = R / "scripts/vehicle-riders/classic-upright-v2"
A = R / "art-source/vehicle-riders/classic-upright/v2"
O = R / "public/demos/vehicle-riders/classic-upright/v2"
D = R / "data/vehicle-riders/classic-upright-v2"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


report = read(O / "report.json")
assert not report["sourceImmutable"], "Completed source revision is immutable"
C = read(S / "rider.json")
core = ["build.py", "rider.json", "identity.json", "classic-upright-v1.json"]
assert read(O / "recipe.json")["sourceDependencies"] == core
for name in core:
    assert (A / name).read_bytes() == (S / name).read_bytes()
for name in ["rider.glb", "atlas.png", "recipe.json"]:
    assert (A / name).read_bytes() == (O / name).read_bytes()
for path, expected in C["identityInputs"].items():
    assert sha(R / path) == expected
assert sha(S / C["contactProfile"]["ownCopy"]) == C["contactProfile"]["sha256"]
model = sha(O / "rider.glb")
features = read(D / "native-feature-proof.json")
comparison = read(D / "v1-geometry-comparison.json")
assert (
    features["status"] == "passed-native-feature-controls"
    and features["riderSha256"] == model
)
assert features["frontTwoSeparateInteriorEyeLandmarksBothCamerasBothOutlines"]
assert features["frontVioletYellowCollarVisibleBothCamerasBothOutlines"]
assert comparison["status"] == "passed" and comparison["profileBytesExact"]
assert len(comparison["exactLowerBodyGeometryFacesUV"]) == 18
proof, capture, replay, identity = [
    read(D / name)
    for name in [
        "contact-proof.json",
        "capture.json",
        "replay-verification.json",
        "identity-inspection.json",
    ]
]
assert all(item["status"] == "passed" for item in [proof, capture, replay, identity])
assert all(item["riderSha256"] == model for item in [proof, capture, identity])
assert all(
    item["profileSha256"] == C["contactProfile"]["sha256"] for item in [proof, capture]
)
assert (
    proof["fixtureSha256"]
    == capture["fixtureSha256"]
    == sha(D / "synthetic-contact-fixture.glb")
)
assert (
    not proof["inappropriateSelfIntersectionPairs"]
    and not proof["inappropriateFixtureIntersectionPairs"]
)
assert len(proof["contactLandmarks"]) == 5 and all(
    row["profileErrorWorld"] < 1e-5 for row in proof["contactLandmarks"]
)
assert len(proof["actualFixedBoneLengthChecks"]) == 8 and all(
    row["errorWorld"] < 1e-4 for row in proof["actualFixedBoneLengthChecks"]
)
assert proof["straddleOpening"]["minimumLegInnerHalfGapWorld"] > 1
negative = proof["negativeControls"]
assert (
    negative["allDisplacedSocketsRejected"]
    and negative["collapsedLegsRejected"]
    and negative["baselineRestored"]
)
assert len(negative["closedPalmSoleControls"]) == 4 and all(
    row["removedActualTriangleRejected"] and row["resetClosed"]
    for row in negative["closedPalmSoleControls"]
)
assert (
    negative["translatedPalmIntoHeadRejected"]["actualTrianglePairs"] > 0
    and negative["translatedPalmIntoHeadRejected"]["resetPairs"] == 0
)
assert len(proof["handFootGeometry"]["actualClosedSolidChecks"]) == 4
assert len(proof["headEarNeckClosedSurfaceControls"]) == 4 and all(
    row["closedSurface"] and row["negativeRejected"] and row["resetExact"]
    for row in proof["headEarNeckClosedSurfaceControls"]
)
for name in ["master.blend", "low.blend"]:
    assert proof["packedSources"][name]["sha256"] == sha(A / name)
assert (
    len(capture["views"]) == 96
    and len(capture["wireViews"]) == 64
    and len(capture["rulerViews"]) == 32
)
assert all(
    row["edgePixels"] == 0
    for key in ["views", "wireViews", "rulerViews"]
    for row in capture[key]
)
assert (
    capture["singleDepthTarget"]
    and capture["sharedProjection"]
    and capture["sourceVioletOutlineAdapter"]
)
assert (
    not capture["CarMeshAssetUsed"]
    and not capture["actualBikePresent"]
    and not capture["productionOutlineUsed"]
)
assert (
    capture["desktopMobileControls"]
    and capture["mobileNoOverflow"]
    and capture["offline"]["exactFixtureCombinedPixels"]
    and capture["offline"]["exactRulerPixels"]
)
assert not capture["errors"] and not capture["offline"]["networkRequests"]
assert (
    replay["byteIdentical"]
    and replay["onlyFourDeclaredConstructorInputs"]
    and replay["freshRepository"]
    and not replay["scratchInputDependencies"]
)
assert replay["outputHashes"] == {
    name: sha(O / name) for name in ["rider.glb", "atlas.png", "recipe.json"]
}
assert (
    len(identity["actualGLBUVInteriorPaletteSamples"]) == 7
    and identity["sourceChartsExact"]
)
assert identity["commonRuler"]["noIndependentFitOrResize"]
raw = (O / "rider.glb").read_bytes()
size = struct.unpack_from("<I", raw, 12)[0]
g = json.loads(raw[20 : 20 + size])
binary = raw[28 + size :]
assert len(g["meshes"]) == len(g["materials"]) == len(g["textures"]) == 1
assert not g.get("animations") and not g.get("skins")
assert all(node.get("name", "").startswith("RiderClassic") for node in g["nodes"])
primitives = g["meshes"][0]["primitives"]
assert len(primitives) == 1
triangles = g["accessors"][primitives[0]["indices"]]["count"] // 3
assert 1500 <= triangles <= 2500 and triangles == report["geometry"]["triangles"]
assert (
    g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
    and "KHR_materials_unlit" in g["materials"][0]["extensions"]
)
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
)
for path, expected in read(D / "protected-prior-inputs.json").items():
    assert sha(R / path) == expected, path
bundle = read(D / "diagnostic-build-pins.json")
assert bundle["noInputChangesDuringBuild"] and bundle["before"] == bundle["after"]
for path, expected in bundle["after"].items():
    assert sha(R / path) == expected
for entry in C["scaleControls"]:
    assert sha(R / entry["path"]) == entry["sha256"]
assert sha(D / "author-view/viewer.js") == bundle["viewBundleSha256"]
visual = read(D / "visual-inspection.json")
assert (
    visual["status"] == "no-blocking-issues-for-source-pilot"
    and visual["humanApproval"] is False
    and visual["riderSha256"] == model
)
for base in [A, O]:
    (base / "evidence").mkdir(exist_ok=True)
    for name in [
        "contact-proof.json",
        "capture.json",
        "identity-inspection.json",
        "replay-verification.json",
        "visual-inspection.json",
        "diagnostic-build-pins.json",
        "diagnostic-inputs.json",
        "fixture-recipe.json",
        "native-feature-proof.json",
        "v1-geometry-comparison.json",
    ]:
        shutil.copyfile(D / name, base / "evidence" / name)
    for name in [
        "identity-comparison.png",
        "common-world-ruler.png",
        "desktop.png",
        "mobile.png",
    ]:
        shutil.copyfile(D / name, base / name)
    for path in D.glob("inspection-*.png"):
        shutil.copyfile(path, base / path.name)
    for path in D.glob("features-*.png"):
        shutil.copyfile(path, base / path.name)
    for name in [
        "v1-failed-control-v2-identity.png",
        "eye-collar-removal-comparison.png",
    ]:
        shutil.copyfile(D / name, base / name)
    shutil.copyfile(
        D / "eye-removal-control/evidence.json",
        base / "evidence/eye-collar-controls.json",
    )
    shutil.copyfile(D / "offline.html", base / "offline.html")
    shutil.copyfile(
        R / "public/assets/sprites/player.png", base / "original-standing-reference.png"
    )
shutil.copytree(D / "captures", O / "captures", dirs_exist_ok=True)
shutil.copytree(D / "eye-removal-control", O / "feature-controls", dirs_exist_ok=True)
for path in S.iterdir():
    if path.is_file():
        shutil.copyfile(path, A / path.name)
report.update(
    status="source-pilot-complete",
    sourceStage="complete",
    sourceImmutable=True,
    humanApproval=False,
    runtime="not integrated",
    normalActivation=False,
    actualBikeQualified=False,
    all27Qualified=False,
    aiOccupantsQualified=False,
    occupiedFallbackQualified=False,
    v1Control="Failed identity-legibility control; immutable, no approval inferred",
    peerIdentityReview="pending parent independent v2 inspection before any retained actual-bike fit",
    actualNativeIdentityFeatures="Two separated interior eye landmarks plus visible violet/yellow collar at front and near-front; original forehead/cheeks/pink pointed ears retained on actual skin. Some side/rear collar cues remain occluded; no exact standing silhouette parity.",
    geometry={**report["geometry"], "sha256": model},
    evidence={
        "actualContacts": 5,
        "fixedBoneChecks": 8,
        "riderNativeHeadings": 32,
        "riderWireHeadings": 32,
        "syntheticFixtureCombinedHeadings": 32,
        "sourceOnlyExactReplay": True,
        "actualPaletteColors": 7,
    },
    profileId=read(S / "classic-upright-v1.json")["id"],
    editableMaster="Named semantic components at runtime topology; joined low; one packed atlas in each. No automatic high-to-low or skeletal animation claim.",
)
for base in [A, O]:
    write(base / "report.json", report)
pins = {
    path.relative_to(R).as_posix(): sha(path)
    for base in [S, A, O]
    for path in base.rglob("*")
    if path.is_file()
    and "__pycache__" not in path.parts
    and path.name != "retained-files.json"
}
write(A / "retained-files.json", pins)
write(
    D / "final-result.json",
    {
        "status": "source-pilot-complete",
        "sourceImmutable": True,
        "humanApproval": False,
        "riderSha256": model,
        "triangles": triangles,
        "retainedFiles": len(pins),
        "retainedPins": (A / "retained-files.json").relative_to(R).as_posix(),
        "actualBikeQualified": False,
        "normalActivation": False,
        "all27Qualified": False,
        "aiOccupantsQualified": False,
        "occupiedFallbackQualified": False,
    },
)
print(
    json.dumps(
        {
            "status": "source-pilot-complete",
            "sha256": model,
            "triangles": triangles,
            "retainedFiles": len(pins),
        }
    )
)
