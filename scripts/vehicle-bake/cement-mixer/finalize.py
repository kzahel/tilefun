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
import importlib.util

catalog_spec = importlib.util.spec_from_file_location(
    "mixer_finalize_catalog_v2", ROOT / "scripts/vehicle-bake/catalog-v2.py"
)
catalog_v2 = importlib.util.module_from_spec(catalog_spec)
catalog_spec.loader.exec_module(catalog_v2)
IDS = ["FL", "FR", "ML", "MR", "RL", "RR"]


def audit_glb(path):
    return catalog_v2.audit_glb(path, wheel_ids=IDS)


S = ROOT / "scripts/vehicle-bake/cement-mixer"
A = ROOT / "art-source/vehicle-bake/cement-mixer/v1"
O = ROOT / "public/demos/vehicle-bake/cement-mixer/v1"
D = ROOT / "data/vehicle-bake/cement-mixer"


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
    == "a030392b8faa8a04bc57488e02d4e97f1442080ed75437402e196c5bb01f9b63"
)
assert audit["triangles"] == 3842
assert (
    audit["meshes"],
    audit["primitives"],
    audit["materials"],
    audit["textures"],
) == (7, 7, 1, 1)
assert (A / "model.glb").read_bytes() == (O / "model.glb").read_bytes()

clear = read(D / "clearance-final.json")[0]
assert clear["status"] == "passed" and clear["glbSha256"] == audit["sha256"]
assert all(
    clear[k]
    for k in ["allNeutralRollAngles", "collidingBodyRejected", "baselineRestored"]
)
coverage = read(D / "coverage-final-qualified.json")
assert coverage["inputSha256"] == audit["sha256"] and coverage["inputBytesUnchanged"]
assert len(coverage["wheels"]) == 6
assert all(
    w["coveredCount"] == 25 and w["sampleCount"] == 25 and w["declaredExpectationMet"]
    for w in coverage["wheels"]
)
assert coverage["controls"]["bodyRemovalInformativeAgainstBaseline"]
assessment = read(D / "coverage-assessment.json")
assert assessment["glbSha256"] == audit["sha256"] and assessment["allSixCrownsCovered"]
assert assessment["status"] == "meets-declared-finite-region"
assert assessment["portableRawSha256"] == sha(D / "coverage-raw-portable.json")
assert coverage["controls"]["positiveAndNegativeControlsPassed"]
capture = read(D / "author-view/captures/capture.json")
assert capture["status"] == "passed" and capture["glbSha256"] == audit["sha256"]
assert len(capture["views"]) == 32 and capture["nativeSize"] == 256
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
assert (
    equipment["staticRestPoseOnly"]
    and equipment["noMixingHingeOrConcreteGameplayClaim"]
)
assert len(equipment["hopper"]) == 5 and len(equipment["chute"]) == 2
assert source["results"]["actualGLBSixAttachments"]["glbSha256"] == audit["sha256"]
assert len(source["results"]["actualGLBSixAttachments"]["results"]) == 6
assert source["results"]["actualGLBBounds"]["glbSha256"] == audit["sha256"]
drum = source["results"]["actualGLBDrumGeometryUV"]
assert drum["glbSha256"] == audit["sha256"]
for proof in [drum, source["results"]["sourceDrumGeometryUV"]]:
    assert proof["actualDrumTriangles"] == 320 and proof["actualSideTriangles"] == 288
    assert proof["ringCount"] == 9 and proof["segmentsPerRing"] == 18
    assert (
        proof["longitudinalAngularUVsMatchGeometry"]
        and proof["viewIndependentSurfacePaint"]
    )
    assert (
        proof["flattenedDrumNegativeRejected"]
        and proof["collapsedUvStripeNegativeRejected"]
    )
    assert (
        proof["uvVertexChecks"] == 864 and proof["triangleBarycentricSamples"] == 1152
    )
    assert all(
        proof["sampledPaletteRoles"][r] > 0
        for r in ["cream", "paint", "floorLight", "ink"]
    )
inventory = read(D / "inventory-controls.json")
assert inventory["status"] == "passed" and inventory["glbSha256"] == audit["sha256"]
assert inventory["wheelIds"] == IDS and len(inventory["wrongInventoryControls"]) == 4
assert all(case["rejected"] for case in inventory["wrongInventoryControls"])
assert len(clear["perWheelCollisionControls"]) == 6
assert {c["wheel"] for c in clear["perWheelCollisionControls"]} == {
    f"Wheel_{w}_Roll" for w in IDS
}
assert all(c["collidingBodyRejected"] for c in clear["perWheelCollisionControls"])
assert len(capture["rig"]["wheels"]) == 6
assert {w["id"] for w in capture["rig"]["wheels"]} == set(IDS)
fit = read(D / "fit-assessment.json")
assert fit["status"] == "passed" and fit["glbSha256"] == audit["sha256"]
assert fit["scale"] == 1 and fit["familyExtraPadding"] == 32
assert (
    fit["standardCardinalPlacementPixelExact"]
    and len(fit["cardinalExactPixelProof"]) == 4
)
for cardinal in fit["cardinalExactPixelProof"]:
    assert cardinal["allOccupiedPixelsExact"] and cardinal["opaquePixelsLost"] == 0
    assert (
        sha(D / "author-view/captures" / Path(cardinal["image"]).name)
        == cardinal["sha256"]
    )
independent = read(D / "independent-visual.json")
assert independent["status"] == "passed" and independent["glbSha256"] == audit["sha256"]
assert len(independent["results"]) == 6
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
assert all(len(p["wheels"]) == 6 and p["fixedBody"] for p in mixed["phases"])
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
        "catalog-v2.py",
        "clearance-v2.py",
        "coverage.py",
        "family-viewer.mjs",
        "family-build.mjs",
        "family-capture-v2.mjs",
        "family-package.py",
        "family-package-v2.py",
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
    "meaning": "Retained constructor, family geometry/configs plus versioned catalog-v2 and underlying catalog helper. Scratch contains outputs, not inputs. Exact GLB, atlas and recipe reproduced; packed scene bytes retained, not asserted deterministic across saves.",
    "toolchain": "multi-axle-v2",
    "wheelIds": IDS,
    "parentFrozenVerification": {
        "status": "parent-owned; not run while review/catalog hold remains",
        "tool": "scripts/vehicle-bake/family-verify-v2.py",
        "sha256": sha(ROOT / "scripts/vehicle-bake/family-verify-v2.py"),
        "dependencies": [
            "scripts/vehicle-bake/family-package-v2.py",
            "scripts/vehicle-bake/family-package.py",
            "scripts/vehicle-bake/catalog-v2.py",
            "scripts/vehicle-bake/catalog.py",
        ],
        "commandAfterParentFreezes": "python scripts/vehicle-bake/family-verify-v2.py PARENT_FROZEN_CONFIG",
    },
}
for name in [
    *inputs,
    "capture.mjs",
    "sheets.py",
    "audit-source.py",
    "audit-inventory.py",
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
    ("packed-source-audit.json", "packed-source-audit.json"),
    ("inventory-controls.json", "inventory-controls.json"),
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
    blender + "art-source/vehicle-bake/cement-mixer/v1/build.py -- --scratch",
    "node scripts/vehicle-bake/cement-mixer/capture.mjs",
    "node scripts/vehicle-bake/cement-mixer/independent-visual.mjs",
    "node scripts/vehicle-bake/cement-mixer/wheel-visual.mjs",
    "python scripts/vehicle-bake/cement-mixer/sheets.py",
    "python scripts/vehicle-bake/cement-mixer/audit-inventory.py",
    blender + "scripts/vehicle-bake/cement-mixer/audit-source.py",
    blender
    + "scripts/vehicle-bake/clearance-v2.py -- art-source/vehicle-bake/cement-mixer/v1/evidence/clearance-input.json data/vehicle-bake/cement-mixer/recheck-clearance.json",
    blender
    + "scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/cement-mixer/v1/model.glb --config art-source/vehicle-bake/cement-mixer/v1/coverage-region.json --output data/vehicle-bake/cement-mixer/recheck-coverage.json",
    "python scripts/vehicle-bake/cement-mixer/assess-coverage.py --input data/vehicle-bake/cement-mixer/recheck-coverage.json",
    "python scripts/vehicle-bake/cement-mixer/assess-fit.py",
    "python scripts/vehicle-bake/family-package-v2.py data/vehicle-bake/cement-mixer/author-config.json assemble",
    "node scripts/vehicle-bake/family-capture-v2.mjs data/vehicle-bake/cement-mixer/author-config.json --qa-only",
]
report.update(
    status="complete",
    artReviewStatus="agent-QA; no formal human approval fabricated",
    runtime="parent-owned integration pending; review/catalog registration on parent hold",
    authorization="autonomous-153",
    geometry=audit,
    toolchain="multi-axle-v2",
    wheelIds=IDS,
    triangles=audit["triangles"],
    vertexCount=audit["vertices"],
    meshCount=7,
    primitiveCount=7,
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
    drumGeometryUVStripeEvidence=drum,
    inventoryEvidence=inventory,
    parentFrozenVerification=replay["parentFrozenVerification"],
    fixedStaticEquipmentEvidence=equipment,
    frameFit=read(D / "fit-assessment.json"),
    attachmentEvidence=source["results"]["actualGLBSixAttachments"],
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
        "actualRoundTapered18Segment9RingStaticDrum": True,
        "actualSourceAndGLBDrumUVAndTriangleSurfaceStripeSamples": True,
        "actualSixWheelV2Inventory": True,
        "wrongInventoryControlsRejected": True,
        "sixPerWheelCollisionNegativeControls": True,
        "exactStandard192x224CardinalPixels": True,
        "actualCenteredBoundsIncludeAllSixWheelsAndEquipment": True,
        "native256PaddingAndFallback192x224FitWithoutScaling": True,
        "allSixEqualAngleSignedPhaseViews": True,
        "wheelId32HeadingDiagnostics": True,
        "allSixNeutralRollWholeBodyClearance": True,
        "collidingBodyRejectedAndBaselineRestored": True,
        "crownCoverage": "natural front coachwork and rear lower middle/last axle wheelhouse body;25/25 each declared central footprint",
        "upperDrumOutsideCoverageRayRange": True,
        "bodyRemovalInformativeAgainstBaseline": True,
        "allSixCrownsCovered": True,
        "retainedSourceOnlyReplayByteIdentical": True,
        "packedSourcesVerified": True,
        "authorDesktopMobileOffline": True,
        "scopedBiomeAndPythonCompile": "passed",
        "globalTests": "Not run; explicitly parent-owned",
        "independentFrozenReview": "parent-owned",
    },
    limitations=[
        "Economical editable semantic component master uses runtime topology; no high-to-low transfer claim.",
        "Crown coverage qualifies declared finite central tread region only; ray limit1.25R excludes raised drum. Synthetic fixtures qualify bookkeeping, actual body-removal zeroes all samples. Camera headings inspected separately.",
        "Full neutral roll only; nonzero steering, suspension and equipment motion unqualified.",
        "No new gameplay features; ordinary drive contract.",
        "Round tapered drum, hopper and chute are rigid static rest pose only. Minor grille/hub/stripe edge aliasing varies with heading; native far-crown views inspected separately from finite geometry rays.",
        "Drum, hopper, bearing supports and chute are static Body_static geometry only. No mixing, hinged equipment, concrete gameplay, steering or suspension qualification.",
        "Actual six-wheel/drum/equipment extents retained at unchanged root/scale. Span and centered2*maxAbs extents measured, standard192x224 cardinal pixel placement exact; parent owns actual runtime export/footprint QA.",
        "Multi-axle-v2 frozen-review verifier is pinned for parent-owned later review/freeze; not claimed run during review/catalog hold.",
        "Actual occupied pixels fit256 and standard192x224 fallback placement without scaling; parent owns independent runtime export/QA.",
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
