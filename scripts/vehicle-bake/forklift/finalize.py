"""Pin the qualified source checkpoint inside this family's exclusive paths.

No frozen review registration or runtime activation. Run only after exact-export
proofs, actual visual inspection and retained-source-only scratch replay.
"""

from pathlib import Path
import hashlib
import io
import json
import shutil
import struct
import sys

from PIL import Image

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
sys.path.insert(0, str(ROOT / "scripts/vehicle-bake"))
from catalog import audit_glb

S = ROOT / "scripts/vehicle-bake/forklift"
A = ROOT / "art-source/vehicle-bake/forklift/v1"
O = ROOT / "public/demos/vehicle-bake/forklift/v1"
D = ROOT / "data/vehicle-bake/forklift"


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path):
    return path.relative_to(ROOT).as_posix()


report = read(O / "report.json")
assert report["status"] == "draft", "Completed source checkpoint is immutable"
audit = audit_glb(O / "model.glb")
assert (
    audit["sha256"]
    == "bc71a5ba5eef5f417c311bb01f2e906a716b14d71c224196c261df266e44e533"
)
assert audit["triangles"] == 2940
assert (
    audit["meshes"],
    audit["primitives"],
    audit["materials"],
    audit["textures"],
) == (5, 5, 1, 1)
assert (A / "model.glb").read_bytes() == (O / "model.glb").read_bytes()

clear = read(D / "clearance-final.json")[0]
assert clear["status"] == "passed" and clear["glbSha256"] == audit["sha256"]
assert all(
    clear[k]
    for k in ["allNeutralRollAngles", "collidingBodyRejected", "baselineRestored"]
)
coverage = read(D / "coverage-stable.json")
assert coverage["inputSha256"] == audit["sha256"] and coverage["inputBytesUnchanged"]
assert len(coverage["wheels"]) == 4
front = [
    w for w in coverage["wheels"] if w["wheel"] in ["Wheel_FL_Roll", "Wheel_FR_Roll"]
]
rear = [
    w for w in coverage["wheels"] if w["wheel"] in ["Wheel_RL_Roll", "Wheel_RR_Roll"]
]
assert len(front) == len(rear) == 2
assert all(
    w["coveredCount"] == 0
    and w["sampleCount"] == 25
    and not w["declaredExpectationMet"]
    for w in front
)
assert all(
    w["coveredCount"] == 25 and w["sampleCount"] == 25 and w["declaredExpectationMet"]
    for w in rear
)
assessment = read(D / "coverage-assessment.json")
assert (
    assessment["glbSha256"] == audit["sha256"]
    and not assessment["allFourCrownsCovered"]
)
assert assessment["frontCoverage"] == "not-applicable/intentionally-open"
assert assessment["rearCoverage"] == "meets-declared-finite-region"
assert assessment["portableRawSha256"] == sha(D / "coverage-raw-portable.json")
assert coverage["controls"]["positiveAndNegativeControlsPassed"]
capture = read(D / "author-view/captures/capture.json")
assert capture["status"] == "passed" and capture["glbSha256"] == audit["sha256"]
assert len(capture["views"]) == 32 and capture["nativeSize"] == 224
assert len(capture["phases"]) == 8 and not capture["errors"]
assert all(v["edgePixels"] == 0 for v in capture["views"])
assert all(v["mismatchedChannels"] == 0 for v in capture["centered128GameCropProof"])
assert capture["rig"]["forwardReverseAbsoluteReset"]
assert all(
    all(
        w[k]
        for k in [
            "quarterTurn",
            "pivotFixed",
            "independent",
            "reverseQuarterTurn",
            "absoluteReset",
        ]
    )
    for w in capture["rig"]["wheels"]
)
source = read(D / "packed-source-audit.json")
assert source["status"] == "passed"
for name in ["master.blend", "car.blend"]:
    assert source["results"][name]["sha256"] == sha(A / name)
assert source["results"]["fixedEquipment"]["noMotionMetadata"]
equipment = source["results"]["fixedEquipment"]
assert equipment["staticMastForksOnly"] and equipment["noLiftingGameplayClaim"]
assert (
    equipment["fourGuardPillars"] == 4
    and equipment["twoMastRails"] == 2
    and len(equipment["twoActualForkBlades"]) == 2
)
geometry = source["results"]["actualGLBEquipmentGeometryUV"]
assert geometry["status"] == "passed" and geometry["glbSha256"] == audit["sha256"]
assert (
    geometry["actualTriangleUvMatches"] == 1700
    and geometry["exactFourRoadRollNodes"]
    and geometry["noEquipmentAnimation"]
)
for proof in [
    source["results"]["sourceNegativeSpaces"],
    source["results"]["actualGLBNegativeSpaces"],
]:
    assert proof["status"] == "passed" and proof["allCandidateTriangleCount"] == 2940
    assert len(proof["fourFootwellFloorRays"]) == 4 and all(
        abs(r["depthBelowSeatSource"] - 0.44) < 1e-5
        for r in proof["fourFootwellFloorRays"]
    )
    assert (
        proof["openMastRays"] == 8
        and proof["openGuardRays"] == 6
        and proof["separateForkGapRays"] == 2
    )
    assert len(proof["fillNegativeControls"]) == 4 and all(
        c["rejected"] for c in proof["fillNegativeControls"]
    )
    assert proof["baselineRestoredExact"]
assert source["results"]["actualGLBAttachments"]["glbSha256"] == audit["sha256"]
assert source["results"]["actualGLBBounds"]["glbSha256"] == audit["sha256"]
controls = read(D / "clearance-controls.json")
assert controls["status"] == "passed" and controls["glbSha256"] == audit["sha256"]
assert (
    controls["allFourNegativeResetPassed"]
    and len(controls["perWheelCollisionControls"]) == 4
)
fit = read(D / "fit-assessment.json")
assert fit["status"] == "passed" and fit["glbSha256"] == audit["sha256"]
assert fit["scale"] == 1 and fit["familyExtraPadding"] == 0
assert (
    fit["standardCardinalPlacementPixelExact"]
    and len(fit["cardinalExactPixelProof"]) == 4
)
for c in fit["cardinalExactPixelProof"]:
    assert c["allOccupiedPixelsExact"] and c["opaquePixelsLost"] == 0
    assert sha(D / "author-view/captures" / Path(c["image"]).name) == c["sha256"]
independent = read(D / "independent-visual.json")
assert independent["status"] == "passed" and independent["glbSha256"] == audit["sha256"]
assert len(independent["results"]) == 4
assert all(
    w["absoluteResetPixelsExact"]
    and w["allOtherMeshesFixed"]
    and w["changedChannels"] > 0
    and w["reverseChangedChannels"] > 0
    for w in independent["results"]
)
mixed = read(D / "wheel-visual.json")
assert mixed["status"] == "passed" and mixed["glbSha256"] == audit["sha256"]
assert len(mixed["phases"]) == 16 and len(mixed["wheelIdViews"]) == 32
assert all(len(p["wheels"]) == 4 and p["fixedBody"] for p in mixed["phases"])
browser = read(D / "author-qa/browser-qa.json")
assert browser["status"] == "passed" and browser["glbSha256"] == audit["sha256"]
assert browser["offline"]["exactGlbSha256"] == audit["sha256"]
assert not browser["offline"]["networkRequests"]
visual = read(D / "visual-inspection.json")
assert (
    visual["status"] == "no-blocking-issues" and visual["glbSha256"] == audit["sha256"]
)

b = (O / "model.glb").read_bytes()
n = struct.unpack_from("<I", b, 12)[0]
g = json.loads(b[20 : 20 + n])
binary = b[28 + n :]
assert "KHR_materials_unlit" in g["materials"][0]["extensions"]
assert g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
)
view = g["bufferViews"][g["images"][0]["bufferView"]]
png = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
atlas = Image.open(O / "atlas.png").convert("RGBA")
assert atlas.size == (512, 512) and atlas.getchannel("A").getextrema() == (255, 255)
assert atlas.tobytes() == Image.open(io.BytesIO(png)).convert("RGBA").tobytes()
assert {p[:3] for p in atlas.getdata()} <= {
    tuple(c) for c in read(S / "family.json")["palette"].values()
}

inputs = [
    "build.py",
    "geometry.py",
    "family.json",
    "coverage-region.json",
    "review.json",
]
for name in inputs:
    assert (
        (S / name).read_bytes()
        == (A / name).read_bytes()
        == (D / "replay/source" / name).read_bytes()
    )
for name in ["model.glb", "atlas.png", "recipe.json"]:
    assert (O / name).read_bytes() == (D / "replay/public" / name).read_bytes()
shared = [
    ROOT / "scripts/vehicle-bake" / n
    for n in [
        "catalog.py",
        "clearance.py",
        "coverage.py",
        "family-viewer.mjs",
        "family-build.mjs",
        "family-capture.mjs",
        "family-package.py",
        "family-review.html",
        "family-review.css",
    ]
]
shared += [
    ROOT / p
    for p in [
        "scripts/authored-assets/runtime/wheel-rig.mjs",
        "src/rendering/CarMeshAsset.ts",
        "src/rendering/CarPixelOutline.ts",
        "src/rendering/CarMeshProjection.ts",
        "src/rendering/VehicleGeometryBatches.ts",
        "package.json",
        "package-lock.json",
    ]
]
shared.append(ROOT / read(S / "review.json")["styleReference"])
assert all(p.is_file() for p in shared)
replay = {
    "status": "passed",
    "byteIdentical": True,
    "glbSha256": audit["sha256"],
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "invokedBuilder": rel(A / "build.py"),
    "inputHashes": {rel(A / name): sha(A / name) for name in inputs},
    "sharedInputHashes": {rel(p): sha(p) for p in shared},
    "scratchInputDependencies": [],
    "blender": "5.2.2 LTS d13f752e3b9c; factory startup; background; 4 threads; python exit code 1",
    "meaning": "Retained constructor, family geometry and configs plus repository catalog helper only. Scratch contains outputs, not inputs. Exact GLB, atlas and recipe reproduced; packed scene bytes retained, not asserted deterministic across saves.",
}
for name in [
    *inputs,
    "capture.mjs",
    "sheets.py",
    "audit-source.py",
    "clearance-controls.py",
    "independent-visual.mjs",
    "wheel-visual.mjs",
    "assess-coverage.py",
    "assess-fit.py",
    "finalize.py",
]:
    shutil.copyfile(S / name, A / name)
for src, dst in [
    ("clearance-final.json", "shared-clearance.json"),
    ("clearance-input.json", "clearance-input.json"),
    ("clearance-controls.json", "clearance-controls.json"),
    ("packed-source-audit.json", "packed-source-audit.json"),
    ("fit-assessment.json", "fit-assessment.json"),
    ("visual-inspection.json", "author-visual-inspection.json"),
    ("author-view/captures/capture.json", "engine-capture.json"),
    ("author-qa/browser-qa.json", "author-browser-qa.json"),
]:
    shutil.copyfile(D / src, A / "evidence" / dst)
shutil.copyfile(
    D / "coverage-raw-portable.json", A / "evidence/upper-wheel-coverage-raw.json"
)
write(A / "evidence/wheel-coverage-assessment.json", assessment)
for record in mixed["phases"] + mixed["wheelIdViews"]:
    record["image"] = "engine/" + Path(record["image"]).name
write(A / "evidence/wheel-visual.json", mixed)
write(A / "evidence/replay-verification.json", replay)
for wheel in independent["results"]:
    wheel["images"] = ["engine/" + Path(p).name for p in wheel["images"]]
write(A / "evidence/independent-visual.json", independent)
(O / "engine").mkdir(exist_ok=True)
for p in (D / "author-view/captures").glob("*.png"):
    if p.name.startswith(
        (
            "study-",
            "engine-",
            "roll-",
            "game-roll-",
            "wire-",
            "inspection-",
            "independent-",
            "equal-phase-",
            "wheel-id-",
            "fallback-",
        )
    ):
        shutil.copyfile(p, O / "engine" / p.name)
shutil.copyfile(D / "author-view/captures/capture.json", O / "engine/capture.json")
write(O / "engine/independent-visual.json", independent)
write(O / "engine/wheel-visual.json", mixed)

blender = "& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python "
commands = [
    blender + "art-source/vehicle-bake/forklift/v1/build.py -- --scratch",
    "node scripts/vehicle-bake/forklift/capture.mjs",
    "node scripts/vehicle-bake/forklift/independent-visual.mjs",
    "node scripts/vehicle-bake/forklift/wheel-visual.mjs",
    "python scripts/vehicle-bake/forklift/sheets.py",
    blender + "scripts/vehicle-bake/forklift/audit-source.py",
    blender + "scripts/vehicle-bake/forklift/clearance-controls.py",
    blender
    + "scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/forklift/v1/evidence/clearance-input.json data/vehicle-bake/forklift/recheck-clearance.json",
    blender
    + "scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/forklift/v1/model.glb --config art-source/vehicle-bake/forklift/v1/coverage-region.json --output data/vehicle-bake/forklift/recheck-coverage.json",
    "python scripts/vehicle-bake/forklift/assess-coverage.py --input data/vehicle-bake/forklift/recheck-coverage.json",
    "python scripts/vehicle-bake/forklift/assess-fit.py",
    "python scripts/vehicle-bake/family-package.py data/vehicle-bake/forklift/author-config.json assemble",
    "node scripts/vehicle-bake/family-capture.mjs data/vehicle-bake/forklift/author-config.json --qa-only",
]
report.update(
    status="complete",
    artReviewStatus="agent-QA; no formal human approval fabricated",
    runtime="parent-owned integration pending; review/catalog registration on parent hold",
    authorization="autonomous-153",
    geometry=audit,
    triangles=audit["triangles"],
    vertexCount=audit["vertices"],
    meshCount=5,
    primitiveCount=5,
    materialCount=1,
    textureCount=1,
    glbBytes=audit["glbBytes"],
    atlasBytes=(O / "atlas.png").stat().st_size,
    glbSha256=audit["sha256"],
    atlasSha256=sha(O / "atlas.png"),
    sharedClearance=clear,
    coverageEvidence=rel(A / "evidence/wheel-coverage-assessment.json"),
    rawCoverageEvidence=rel(A / "evidence/upper-wheel-coverage-raw.json"),
    coverageAssessment=assessment,
    engineEvidence="engine/capture.json",
    independentWheelVisualEvidence="engine/independent-visual.json",
    actualBounds=source["results"]["actualGLBBounds"],
    actualFixedBodyGeometryUV=geometry,
    negativeSpaceEvidence=source["results"]["actualGLBNegativeSpaces"],
    fixedEquipmentEvidence=equipment,
    perWheelCollisionControls=controls,
    frameFit=read(D / "fit-assessment.json"),
    attachmentEvidence=source["results"]["actualGLBAttachments"],
    wheelVisualEvidence="engine/wheel-visual.json",
    replayCommands=commands,
    visualInspection=visual["observations"],
    validation={
        "actualGLBAudit": True,
        "actualKHRMaterialsUnlit": True,
        "oneOpaque512Atlas": True,
        "embeddedAtlasPixelsMatch": True,
        "actualSharedEngine32HeadingViews": True,
        "eightSignedPhasesPerCamera": True,
        "bothWireframes": True,
        "independentWheelsFixedBodyReverseAbsoluteReset": True,
        "independentWheelVisualPhases": True,
        "allWheelRadiusesMatchOwnGeometry": True,
        "twoRealLowForkBladesTwinMastAndFourGuardPillarsStaticOnly": True,
        "realFootwellSeatMastGuardNegativeSpaces": True,
        "actualEquipmentTrianglePositionAndUVMatch": True,
        "sourceAndActualGLBOpenSpaceFillNegativesReset": True,
        "allFourIndividualCollisionNegativeControlsReset": True,
        "exact192x224CardinalPixelPlacement": True,
        "actualAsymmetricAndCenteredBoundsIncludeEquipment": True,
        "standard224AndFallback192x224FitWithoutScaling": True,
        "allFourEqualAngleSignedPhaseViews": True,
        "wheelId32HeadingDiagnostics": True,
        "allNeutralRollWholeBodyClearance": True,
        "collidingBodyRejectedAndBaselineRestored": True,
        "crownCoverage": "rear counterweight25/25each; front0/25 raw intentionally-open/N-A",
        "guardRoofOutsideCoverageRayRange": True,
        "bodyRemovalInformativeAgainstBaseline": True,
        "allFourCrownsCovered": False,
        "retainedSourceOnlyReplayByteIdentical": True,
        "packedSourcesVerified": True,
        "authorDesktopMobileOffline": True,
        "scopedBiomeAndPythonCompile": "passed",
        "globalTests": "Not run; explicitly parent-owned",
        "independentFrozenReview": "parent-owned",
    },
    limitations=[
        "Economical editable semantic component master uses runtime topology; no high-to-low transfer claim.",
        "Rear crown coverage qualifies its declared finite central tread region only. Front wheels are intentionally exposed outboard of narrow chassis; raw0/25 and failed covered-expectation metrics retained, no universal four-crown pass asserted. Native headings independently inspected.",
        "Full neutral roll only; nonzero steering/suspension and equipment motion unqualified. Ordinary four-wheel drive contract; no special forklift steering or lifting gameplay.",
        "Open seat/guard has no glass or visible occupant geometry; ordinary hidden-driver convention, no rider/standing-person claim.",
        "Mast, crossbars, guard, seat and two forks are rigid Body_static geometry. Thin forks/guard/hub marks have heading-dependent native aliasing, no enlarged or per-angle fit.",
        "Actual fork-inclusive span and centered2*maxAbs bounds retained at unchanged root/scale. Asymmetric fork extension makes centered collision length larger than physical span; parent owns runtime footprint/road-fit QA.",
        "Actual occupied pixels fit224 and standard192x224 fallback placement without scaling; parent owns independent runtime export/QA.",
        "Source complete and immutable; parent owns frozen review, registration and runtime integration.",
    ],
    sourceHashes={
        rel(p): sha(p)
        for p in sorted(A.rglob("*"))
        if p.is_file() and p.name not in ["delivery.json", "retained-files.json"]
    },
)
write(O / "report.json", report)
write(
    A / "delivery.json",
    {
        "status": "complete",
        "artReviewStatus": report["artReviewStatus"],
        "runtime": report["runtime"],
        "report": rel(O / "report.json"),
        "glbSha256": audit["sha256"],
        "atlasSha256": sha(O / "atlas.png"),
        "replayCommands": commands,
    },
)
write(
    A / "retained-files.json",
    {
        rel(p): sha(p)
        for p in sorted([*A.rglob("*"), *O.rglob("*")])
        if p.is_file() and p.name != "retained-files.json"
    },
)
print(json.dumps({"status": "complete", "audit": audit, "replay": replay}, indent=2))
