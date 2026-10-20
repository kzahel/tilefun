"""Retain this proven source pilot; shared runtime/review gates stay explicit."""

from pathlib import Path
import hashlib
import importlib.util
import io
import json
import shutil
import struct
import subprocess
import sys
from PIL import Image

sys.dont_write_bytecode = True

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = ROOT / "scripts/vehicle-bake/sidecar-motorcycle"
A = ROOT / "art-source/vehicle-bake/sidecar-motorcycle/v1"
O = ROOT / "public/demos/vehicle-bake/sidecar-motorcycle/v1"
D = ROOT / "data/vehicle-bake/sidecar-motorcycle"
EXPECTED = "7c1987eb79423b5ebe7adf89fab2134253f45d94d7352b39a57c9cf5c7178f60"


def read(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes((json.dumps(value, indent=2) + "\n").encode())


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def rel(p):
    return p.relative_to(ROOT).as_posix()


report = read(O / "report.json")
assert report["status"] == "draft" and not report.get("sourceImmutable")
cfg = read(S / "family.json")
assert sha(O / "model.glb") == EXPECTED == sha(A / "model.glb")
spec = importlib.util.spec_from_file_location(
    "stable_cycle_catalog", ROOT / "scripts/vehicle-bake/catalog-cycle.py"
)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)
audit = catalog.audit_glb(O / "model.glb", wheel_ids=["F", "R", "SC"])
assert (
    audit["triangles"],
    audit["vertices"],
    audit["meshes"],
    audit["primitives"],
    audit["materials"],
    audit["textures"],
) == (3418, 6460, 4, 4, 1, 1)
assert report["sharedStaticCycleCatalog"] == audit
fit = read(D / "fit-proof.json")
source = read(D / "source-audit.json")
capture = read(D / "raw-capture.json")
pixels = read(D / "pixel-assessment.json")
replay = read(D / "source-only-replay.json")
pod = read(D / "pod-depth-proof.json")
assert pod["status"] == "passed" and pod["glbSha256"] == EXPECTED
assert len(pod["results"]) == 2 and all(
    p["status"] == "passed"
    and p["fillNegative"]["rejected"]
    and p["fillNegative"]["baselineRestoredExact"]
    for p in pod["results"]
)
assert (
    replay["args"] == ["--scratch"]
    and replay["invokedBuilder"] == "scripts/vehicle-bake/sidecar-motorcycle/build.py"
)
for proof in [fit, source, capture, pixels]:
    assert proof["glbSha256"] == EXPECTED
assert fit["status"] == "passed-actual-source-pilot"
assert fit["actualFit"]["status"] == "passed"
assert (
    not fit["actualFit"]["inappropriateIntersections"]
    and not fit["actualFit"]["inappropriateContainments"]
)
assert len(fit["contacts"]) == 5 and fit["profilePlusOneMeasuredMount"]
assert (
    fit["displacedRiderNegative"]["rejected"]
    and fit["displacedRiderNegative"]["baselineRestoredExact"]
)
assert (
    len(fit["wholeFixedBikeAndRiderNeutralRoll"])
    == len(fit["perWheelCollisionNegatives"])
    == 3
)
assert all(
    w["minimumGapWorld"] > 0
    and abs(w["radiusMeasuredWorld"] - w["radiusDeclaredWorld"]) < 1e-4
    and abs(w["groundZWorld"]) < 1e-4
    and w["allNeutralRollAngles"]
    and w["fixedRiderTriangles"] == 1956
    for w in fit["wholeFixedBikeAndRiderNeutralRoll"]
)
assert all(
    w["collisionRejected"]
    and w["baselineRestoredExact"]
    and w["noCandidateTrianglesRemoved"]
    for w in fit["perWheelCollisionNegatives"]
)
assert (
    source["status"] == "passed"
    and source["actualTriangleUVMatches"] == 3418
    and source["actualCornerPositionAndUVMatches"] == 10254
)
for name in ["master.blend", "car.blend"]:
    assert fit["packedScenes"][name]["sha256"] == sha(A / name)
    assert next(p for p in source["packedScenes"] if p["path"] == name)[
        "sha256"
    ] == sha(A / name)
assert (
    capture["status"] == "passed-raw-source-diagnostic"
    and not capture["CarMeshAssetUsed"]
)
assert (
    capture["trueWheelIds"] == ["F", "R", "SC"]
    and len(capture["frames"]) == 192
    and len(capture["depth"]) == 32
)
assert capture["riderHidden32ViewsPixelExact"] and len(capture["paddingParity"]) == 32
assert len(capture["signedPhases"]) == 16 and len(capture["independent"]) == 3
assert all(
    w["actualPivotFixed"]
    and w["signedQuaternionTravelExact"]
    and w["absoluteResetPixelsExact"]
    and w["otherWheelBodyRiderFixed"]
    and w["forwardChangedChannels"] > 0
    and w["reverseChangedChannels"] > 0
    for w in capture["independent"]
)
assert (
    not capture["errors"]
    and capture["desktopMobile"]["mobileNoOverflow"]
    and capture["offline"]["noNetworkRequests"]
)
assert len(capture["offline"]["all32CombinedPixelsExact"]) == 32
for frame in capture["frames"]:
    assert (
        frame["edgePixels"] == 0
        and sha(D / "captures" / frame["image"]) == frame["sha256"]
    )
assert (
    pixels["status"] == "passed"
    and len(pixels["cardinals"]) == 12
    and pixels["paddingOnly32RGBAParity"]
)
coverage = read(D / "coverage-draft1.json")
assert coverage["inputSha256"] == EXPECTED and coverage["inputBytesUnchanged"]
assert all(w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"])
assert coverage["controls"]["bodyRemovalCoveredCounts"] == [0, 0, 0]
assert coverage["controls"]["syntheticBroadPanelPositiveCounts"] == [25, 25, 25]
assert coverage["controls"]["sameSyntheticPanelsOffsetOutsideRegionCounts"] == [0, 0, 0]
assert replay["status"] == "passed" and replay["noIgnoredMasterOrScratchDependencies"]
for p, h in replay["inputHashes"].items():
    assert sha(ROOT / p) == h == sha(A / Path(p).name)
for p, h in replay["sharedInputHashes"].items():
    assert sha(ROOT / p) == h
for name, record in replay["outputs"].items():
    assert record["byteExact"] and record["sha256"] == sha(O / name) == sha(A / name)
for p, h in cfg["riderInputs"].items():
    assert sha(ROOT / p) == h
assert (
    sha(O / "rider-reference.glb")
    == cfg["riderInputs"]["art-source/vehicle-riders/explorer-upright/v1/rider.glb"]
)

# Inspect the actual embedded atlas, not an unrelated palette preview.
data = (O / "model.glb").read_bytes()
length = struct.unpack_from("<I", data, 12)[0]
gltf = json.loads(data[20 : 20 + length])
binary = data[28 + length :]
view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
offset = view.get("byteOffset", 0)
embedded = Image.open(io.BytesIO(binary[offset : offset + view["byteLength"]])).convert(
    "RGBA"
)
atlas = Image.open(O / "atlas.png").convert("RGBA")
assert (
    embedded.size == atlas.size == (512, 512) and embedded.tobytes() == atlas.tobytes()
)
rgba = set(atlas.getdata())
assert all(p[3] == 255 and list(p[:3]) in list(cfg["palette"].values()) for p in rgba)
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in gltf["samplers"]
)
assert (
    gltf["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
    and "KHR_materials_unlit" in gltf["materials"][0]["extensions"]
)

commands = [
    [sys.executable, "-m", "black", "--check", str(S)],
    [sys.executable, "-m", "compileall", "-q", str(S)],
    [shutil.which("npx.cmd") or shutil.which("npx"), "biome", "check", str(S)],
]
checks = []
for command in commands:
    process = subprocess.run(
        command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    assert process.returncode == 0, process.stdout
    checks.append({"command": command, "exitCode": 0, "output": process.stdout})
write(
    D / "scoped-checks.json",
    {
        "status": "passed",
        "commands": checks,
        "sourceHashes": {rel(p): sha(p) for p in sorted(S.iterdir()) if p.is_file()},
    },
)

# All original source views plus explicitly labelled fixed-crop nearest details
# were inspected by this author. This records agent QA, never human approval.
inspected = [
    f"inspection-detail-{view}-{mode}.png"
    for mode in ["study", "engine"]
    for view in ["combined", "bike-alone", "rider-alone", "ownership-mask"]
] + ["inspection-phases.png", "inspection-independent.png", "inspection-wires.png"]
assert all((D / "captures" / p).is_file() for p in inspected)
inspection = {
    "status": "agent-inspected-source-pilot",
    "glbSha256": EXPECTED,
    "actual32StudyGameHeadingsEach": ["combined", "bike-alone", "rider-alone"],
    "signedPhases": 16,
    "wireframes": 6,
    "independentTrueWheels": ["F", "R", "SC"],
    "inspectionImages": {p: sha(D / "captures" / p) for p in inspected},
    "findings": [
        "Recognizable teal/cream classic sidecar; rounded tank, open passenger tub, seat, small blue windscreen, attachment frame and three real fenders read at native density",
        "Immutable Explorer straddles narrow tank/frame; hands and soles align with measured physical supports",
        "Fenders follow all three tire crowns; side profiles preserve visible tires, frame negative spaces and the open well",
        "Actual depth ownership changes coherently through headings; no screenshot overlays or four-wheel stubs",
        "Forward/reverse/reset changes own wheel while fixed bike/rider and other wheels remain fixed; SC observed at180deg where its hub is visible",
        "Desktop/mobile remain square and readable; offline source diagnostic matches all32 combined frames",
    ],
    "formalHumanApproval": False,
    "actualSharedLoaderBrowserReview": "pending parent",
}
write(D / "author-visual-inspection.json", inspection)

for p in sorted(S.iterdir()):
    if p.is_file():
        shutil.copyfile(p, A / p.name)
evidence = A / "evidence"
evidence.mkdir(exist_ok=True)
for name in [
    "fit-proof.json",
    "source-audit.json",
    "raw-capture.json",
    "pixel-assessment.json",
    "source-only-replay.json",
    "rider-measurements.json",
    "scoped-checks.json",
    "author-visual-inspection.json",
    "pod-depth-proof.json",
]:
    shutil.copyfile(D / name, evidence / name)
write(evidence / "replay-verification.json", replay)
coverage["input"] = "public/demos/vehicle-bake/sidecar-motorcycle/v1/model.glb"
write(evidence / "coverage.json", coverage)
for name in ["desktop.png", "mobile.png"]:
    shutil.copyfile(D / name, evidence / name)
capture_out = O / "raw-captures"
capture_out.mkdir(exist_ok=True)
for p in (D / "captures").glob("*.png"):
    shutil.copyfile(p, capture_out / p.name)
diagnostic_shared_paths = [
    "scripts/vehicle-bake/coverage.py",
    "src/rendering/CarMeshProjection.ts",
    "src/rendering/CarPixelOutline.ts",
    "package.json",
    "package-lock.json",
]
diagnostic_shared = {p: sha(ROOT / p) for p in diagnostic_shared_paths}
diagnostic_shared.update(cfg["riderInputs"])
proof_inputs = {**replay["sharedInputHashes"], **diagnostic_shared}
write(
    A / "assembly.json",
    {
        "status": "source-pilot-only",
        "bike": {
            "path": rel(O / "model.glb"),
            "sha256": EXPECTED,
            "triangles": 3418,
            "draws": 4,
            "atlases": 1,
        },
        "rider": {
            "path": "art-source/vehicle-riders/explorer-upright/v1/rider.glb",
            "sha256": capture["riderSha256"],
            "triangles": 1956,
            "draws": 1,
            "atlases": 1,
            "immutable": True,
        },
        "singleMountSource": cfg["riderMountSource"],
        "combined": {
            "triangles": 5374,
            "draws": 5,
            "atlases": 2,
            "oneActualDepthTarget": True,
        },
        "productionQualified": False,
        "normalActivation": False,
    },
)
write(
    A / "source-replay.json",
    {
        **replay,
        "diagnosticSharedInputHashes": diagnostic_shared,
        "diagnosticsAreNotConstructionInputs": True,
        "unusedCycleAdaptersNotPinned": True,
    },
)
write(
    A / "proof-inputs.json",
    {
        "constructionInputHashes": replay["inputHashes"],
        "constructionSharedInputHashes": replay["sharedInputHashes"],
        "diagnosticSharedInputHashes": diagnostic_shared,
        "allActualSharedInputHashes": proof_inputs,
        "sharedCycleCatalog": "stable actual constructor import; static audit only",
        "otherCycleAdapters": "not imported or pinned",
        "componentPackageCycle": "not used or pinned",
        "actualSharedLoaderBrowser": "pending parent",
    },
)
report.update(
    {
        "status": "complete",
        "sourceStage": "complete",
        "sourceImmutable": True,
        "sourcePilot": True,
        "productionQualified": False,
        "normalActivation": False,
        "artReviewStatus": "agent-QA; parent independent review pending; no formal human approval",
        "geometry": audit,
        "actualSharedLoaderBrowserReview": "pending parent",
        "sharedStaticCycleCatalog": audit,
        "CarMeshAssetUsed": False,
        "riderComposition": {
            "immutable": True,
            "mountSource": cfg["riderMountSource"],
            "contacts": 5,
            "combinedTriangles": 5374,
            "combinedDraws": 5,
            "combinedAtlases": 2,
        },
        "actualBounds": fit["actualBikeBounds"],
        "combinedBounds": fit["actualCombinedBounds"],
        "sourceQA": {
            "exactFreshReplay": True,
            "packedSourceAudit": True,
            "allTriangleUVMatches": 3418,
            "wholeBikeRiderRoll": True,
            "threeCollisionNegativeResets": True,
            "displacedRiderNegativeReset": True,
            "fenderCoverageEach": 25,
            "actual32HeadingsEach": ["bike", "rider", "combined"],
            "hiddenRider32Exact": True,
            "depthMasks": True,
            "paddingDensity32Exact": True,
            "standardCardinalPlacementExact": True,
            "desktopMobileOffline": True,
            "actualOpenPodDepthAndFillNegativeReset": True,
            "noPassengerFunctionOrSidecarArticulation": True,
            "scopedChecks": True,
        },
        "sourceInputHashes": replay["inputHashes"],
        "sharedInputHashes": proof_inputs,
        "limitations": [
            "Source pilot only. Actual shared CarMeshAsset loader/browser review remains pending parent",
            "Only immutable Explorer upright/profile measured and fitted; no all-avatar rider identity/AI or occupied fallback qualification",
            "Neutral steering; no suspension, rider pose animation or normal activation claim",
            "Raw GLTF viewer reuses shared camera and outline math, not a copied/forked engine loader",
            "Editable runtime-topology component master; no high-to-low decimation claim",
            "Empty passenger well and static attached sidecar; no passenger function or sidecar articulation qualification",
        ],
    }
)
write(O / "report.json", report)
write(A / "report.json", report)
delivery = {
    "status": "complete",
    "sourceStage": "complete",
    "sourcePilot": True,
    "productionQualified": False,
    "ready": True,
    "sourceImmutable": True,
    "glbSha256": EXPECTED,
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "report": rel(O / "report.json"),
    "normalActivation": False,
    "actualSharedLoaderBrowserReview": "pending parent",
    "proofCommands": [
        "BLENDER --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/sidecar-motorcycle/prove-fit.py",
        "BLENDER --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/sidecar-motorcycle/audit-source.py",
        "BLENDER --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/sidecar-motorcycle/v1/model.glb --config art-source/vehicle-bake/sidecar-motorcycle/v1/coverage-region.json --output data/vehicle-bake/sidecar-motorcycle/recheck-coverage.json",
        "node scripts/vehicle-bake/sidecar-motorcycle/capture-raw.mjs",
        "python scripts/vehicle-bake/sidecar-motorcycle/assess-pixels.py",
        "python scripts/vehicle-bake/sidecar-motorcycle/fresh-replay.py --name parent-fresh-replay --blender BLENDER",
    ],
    "replayInputs": "Six declared files: own build/geometry/family/raw-audit, stable catalog-cycle and immutable upright profile; no master/scratch input",
    "parentNext": "Independent review/replay and eventual actual shared cycle loader/browser qualification; no normal activation",
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
    {
        "status": "passed",
        "files": len(pins),
        "glbSha256": EXPECTED,
        "retainedSourcePublicScriptHashesVerified": True,
        "sharedInputsUnchanged": all(
            sha(ROOT / p) == h for p, h in proof_inputs.items()
        ),
        "noPriorFamilyWrites": True,
    },
)
result = f"""ready: true
status: complete

Sidecar motorcycle source pilot retained immutable. GLB SHA256 {EXPECTED}.
Bike: 3418 triangles, 6460 UV vertices, 4 draws, one opaque512 atlas.
True F/R/SC wheels, radii7.304347826/7.304347826/6.260869565 world. Unchanged Explorer:
1956 triangles, one draw/atlas. Combined: 5374 triangles, 5 draws, 2 atlases.

Actual pod floor depth0.47 and seat above floor0.26 pass all-triangle rays and fill negative/reset.
Packed editable master74 components and low4 meshes; all3418 actual GLB triangle
UVs match own source. All5 profile+single-mount contacts, all fixed bike/rider
intersection and containment checks, displaced-rider negative/reset, all three full
neutral-roll envelopes and individual collision negative/resets pass. All three real
fenders cover25/25 declared samples with removal/offset/positive controls.

Combined, rider-alone and bike-alone32 raw GLTF views each inspected, including
depth masks, signed phases, wires and independent wheel pivot/travel/reverse/reset.
All32 rider-hidden pixels equal independently loaded bike pixels. Padding128→224
and standard192x224 cardinal placement preserve exact pixels at unchanged density.
Desktop/mobile/offline pass. Six declared inputs reproduce model/atlas/recipe
byte exactly in a fresh directory; no master or scratch construction dependency.
Scoped Biome, Black and compile checks pass before pins.

Stable catalog-cycle.py is genuinely imported by the constructor and pinned.
Other cycle adapters and component-package-cycle are unused/unpinned.
ACTUAL SHARED LOADER/BROWSER REVIEW PENDING. Normal activation, rider identity,
AI and occupied fallback remain separately gated. Parent owns independent QA,
review/freeze/runtime. Prior completed family bytes preserved. Awaiting next task.
"""
(D / "result.md").write_text(result, encoding="utf-8")
(D / "progress.md").write_text(result, encoding="utf-8")
print(
    json.dumps(
        {
            "status": "complete",
            "ready": True,
            "glbSha256": EXPECTED,
            "triangles": 3418,
            "retainedFiles": len(pins),
            "actualSharedLoaderBrowserReview": "pending parent",
            "normalActivation": False,
        },
        indent=2,
    )
)
