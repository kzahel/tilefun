"""Retain the proven flatbed-truck. Never writes shared manifests or marks human approval."""

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

S = ROOT / "scripts/vehicle-bake/flatbed-truck"
A = ROOT / "art-source/vehicle-bake/flatbed-truck/v1"
O = ROOT / "public/demos/vehicle-bake/flatbed-truck/v1"
D = ROOT / "data/vehicle-bake/flatbed-truck"


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
    == "eec6fd7d85d2bca6c8c408fec76cc6d47765bbb8efe01e13d89de7094ee0f7b0"
)
assert audit["triangles"] == 2534 and audit["vertices"] == 4964
assert (
    audit["meshes"],
    audit["primitives"],
    audit["materials"],
    audit["textures"],
) == (5, 5, 1, 1)
assert (A / "model.glb").read_bytes() == (O / "model.glb").read_bytes()
clear = read(D / "clearance-final.json")[0]
assert clear["status"] == "passed" and clear["glbSha256"] == audit["sha256"]
assert (
    clear["allNeutralRollAngles"]
    and clear["collidingBodyRejected"]
    and clear["baselineRestored"]
)
coverage = read(D / "coverage-final.json")
assert coverage["inputSha256"] == audit["sha256"] and coverage["inputBytesUnchanged"]
assert all(w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"])
assert coverage["controls"]["positiveAndNegativeControlsPassed"]
deck = read(D / "deck-final.json")
assert deck["status"] == "passed" and deck["glbSha256"] == audit["sha256"]
assert deck["inputBytesUnchanged"] and len(deck["actualFlatDeck"]) == 9
assert deck["controls"]["raisedObstructionRejected"]
assert (
    deck["controls"]["zeroThicknessDeckRejected"]
    and deck["controls"]["baselineRestored"]
)
fit = read(D / "native-fit.json")
assert fit["status"] == "passed" and fit["glbSha256"] == audit["sha256"]
assert len(fit["headings"]) == 32 and all(
    c["fitsWithoutPixelLoss"] for c in fit["cardinals"]
)
capture = read(D / "author-view/captures/capture.json")
assert capture["status"] == "passed" and capture["glbSha256"] == audit["sha256"]
assert len(capture["views"]) == 32 and capture["nativeSize"] == 224
assert len(capture["phases"]) == 8 and not capture["errors"]
assert all(v["edgePixels"] == 0 for v in capture["views"])
assert capture["rig"]["forwardReverseAbsoluteReset"]
assert len(clear["clearance"]) == len(capture["rig"]["wheels"]) == 4
for actual in clear["clearance"]:
    wid = actual["wheel"].removeprefix("Wheel_").removesuffix("_Roll")
    claimed = next(w for w in capture["rig"]["wheels"] if w["id"] == wid)
    assert abs(actual["radius"] - claimed["radius"]) < 0.0001
for wheel in capture["rig"]["wheels"]:
    assert all(
        wheel[k]
        for k in [
            "quarterTurn",
            "pivotFixed",
            "independent",
            "reverseQuarterTurn",
            "absoluteReset",
        ]
    )
source = read(D / "packed-source-audit.json")
assert source["status"] == "passed"
for name in ["master.blend", "car.blend"]:
    assert source["results"][name]["sha256"] == sha(A / name)
surfaces = source["results"]["actualGLBSemanticSurfaces"]
assert surfaces["status"] == "passed" and surfaces["glbSha256"] == audit["sha256"]
assert surfaces["rayCount"] == 13 and surfaces["inputBytesUnchanged"]
browser = read(D / "author-qa/browser-qa.json")
assert browser["status"] == "passed" and browser["glbSha256"] == audit["sha256"]
assert browser["offline"]["exactGlbSha256"] == audit["sha256"]
assert not browser["offline"]["networkRequests"]
visual = read(D / "visual-inspection.json")
assert (
    visual["status"] == "no-blocking-issues" and visual["glbSha256"] == audit["sha256"]
)

# Verify actual embedded pixels/material/sampler, independently of author labels.
b = (O / "model.glb").read_bytes()
n = struct.unpack_from("<I", b, 12)[0]
g = json.loads(b[20 : 20 + n])
binary = b[28 + n :]
assert "KHR_materials_unlit" in g["materials"][0]["extensions"]
assert g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
)
v = g["bufferViews"][g["images"][0]["bufferView"]]
png = binary[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]]
atlas = Image.open(O / "atlas.png").convert("RGBA")
embedded = Image.open(io.BytesIO(png)).convert("RGBA")
assert atlas.size == (512, 512) and atlas.getchannel("A").getextrema() == (255, 255)
assert atlas.tobytes() == embedded.tobytes()
assert {p[:3] for p in atlas.getdata()} <= {
    tuple(c) for c in read(S / "family.json")["palette"].values()
}

inputs = [
    "build.py",
    "family.json",
    "coverage-region.json",
    "surface-regions.json",
    "deck-region.json",
    "review.json",
]
for name in inputs:
    assert (S / name).read_bytes() == (A / name).read_bytes()
fresh = read(D / "fresh-replay-verification.json")
assert fresh["status"] == "passed" and fresh["byteIdentical"]
assert not fresh["scratchInputDependencies"]
for name in ["model.glb", "atlas.png", "recipe.json"]:
    assert fresh["outputs"][name] == sha(O / name)
for path, expected in {**fresh["inputHashes"], **fresh["sharedInputHashes"]}.items():
    assert sha(ROOT / path) == expected, path
shared_paths = [
    ROOT / "scripts/vehicle-bake" / name
    for name in [
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
shared_paths.append(ROOT / "scripts/authored-assets/runtime/wheel-rig.mjs")
shared_paths.extend(
    ROOT / "src/rendering" / name
    for name in ["CarMeshAsset.ts", "CarMeshProjection.ts", "CarPixelOutline.ts"]
)
shared_paths.append(ROOT / read(S / "review.json")["styleReference"])
shared_paths.append(ROOT / "package-lock.json")
assert all(p.is_file() for p in shared_paths)
replay = {
    "status": "passed",
    "byteIdentical": True,
    "glbSha256": audit["sha256"],
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "invokedBuilder": rel(A / "build.py"),
    "inputHashes": {rel(A / name): sha(A / name) for name in inputs},
    "sharedInputHashes": {rel(p): sha(p) for p in shared_paths},
    "scratchInputDependencies": [],
    "isolatedReplay": fresh,
    "blender": "5.2.2 LTS d13f752e3b9c; factory startup; background; four threads",
    "meaning": "Only six retained constructor/config inputs plus catalog.py were placed in a fresh miniature repository. Model, atlas and recipe exact. Other pinned helpers qualify QA only; packed scene byte determinism not claimed.",
}
for p in S.iterdir():
    if p.is_file() and p.suffix in [".py", ".mjs", ".json"]:
        shutil.copyfile(p, A / p.name)
for src, dst in [
    ("clearance-final.json", "shared-clearance.json"),
    ("clearance-input.json", "clearance-input.json"),
    ("packed-source-audit.json", "packed-source-audit.json"),
    ("visual-inspection.json", "author-visual-inspection.json"),
    ("author-view/captures/capture.json", "engine-capture.json"),
    ("author-qa/browser-qa.json", "author-browser-qa.json"),
    ("deck-final.json", "flat-platform-geometry.json"),
    ("native-fit.json", "native-and-fallback-fit.json"),
    ("fresh-replay-verification.json", "fresh-isolated-replay.json"),
]:
    shutil.copyfile(D / src, A / "evidence" / dst)
coverage["input"] = rel(O / "model.glb")
write(A / "evidence/upper-wheel-coverage.json", coverage)
write(A / "evidence/replay-verification.json", replay)
(O / "engine").mkdir(exist_ok=True)
for p in (D / "author-view/captures").glob("*.png"):
    shutil.copyfile(p, O / "engine" / p.name)
shutil.copyfile(D / "author-view/captures/capture.json", O / "engine/capture.json")

blender = "& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python "
commands = [
    "python art-source/vehicle-bake/flatbed-truck/v1/replay.py --blender BLENDER --name NEW_FRESH_OUTPUT",
    "node scripts/vehicle-bake/flatbed-truck/capture.mjs",
    "python scripts/vehicle-bake/flatbed-truck/sheets.py",
    blender + "scripts/vehicle-bake/flatbed-truck/audit-source.py",
    blender
    + "scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/flatbed-truck/v1/evidence/clearance-input.json data/vehicle-bake/flatbed-truck/recheck-clearance.json",
    blender
    + "scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/flatbed-truck/v1/model.glb --config art-source/vehicle-bake/flatbed-truck/v1/coverage-region.json --output data/vehicle-bake/flatbed-truck/recheck-coverage.json",
    blender
    + "art-source/vehicle-bake/flatbed-truck/v1/prove-deck.py -- --input public/demos/vehicle-bake/flatbed-truck/v1/model.glb --output data/vehicle-bake/flatbed-truck/recheck-deck.json",
    "python scripts/vehicle-bake/flatbed-truck/measure-fit.py",
    "python scripts/vehicle-bake/flatbed-truck/pack-author.py",
    "node scripts/vehicle-bake/family-capture.mjs data/vehicle-bake/flatbed-truck/author-config.json --qa-only",
]
report.update(
    status="complete",
    artReviewStatus="agent-QA; run153 appearance wait waived; no formal human approval claimed",
    runtime="Parent owns frozen review and integration; this is the stable source handoff",
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
    coverageEvidence=rel(A / "evidence/upper-wheel-coverage.json"),
    engineEvidence="engine/capture.json",
    actualBounds=source["results"]["actualGLBBounds"],
    semanticSurfaceEvidence=surfaces,
    flatPlatformEvidence=rel(A / "evidence/flat-platform-geometry.json"),
    nativeAndFallbackFit=fit,
    replayCommands=commands,
    visualInspection=visual["observations"],
    validation={
        "actualGLBAudit": True,
        "actualKHRMaterialsUnlit": True,
        "oneOpaque512Atlas": True,
        "embeddedAtlasPixelsMatch": True,
        "actualSharedEngine32HeadingViews": True,
        "eightSignedPhasesPerCamera": True,
        "independentWheelsFixedBodyReverseAbsoluteReset": True,
        "actualPerWheelGeometryRadiusMatchesRigMetadata": True,
        "allNeutralRollWholeBodyClearance": True,
        "collidingBodyRejectedAndBaselineRestored": True,
        "crown25of25EachWithControls": True,
        "actualGLBSemanticTriangleUVRays": 13,
        "actualFlatExposedDeckNineTopUndersidePairs": True,
        "raisedObstructionAndZeroThicknessDeckRejectedThenExactReset": True,
        "native224AndStandard192x224FallbackFitAtFixedDensity": True,
        "retainedSourceOnlyReplayByteIdentical": True,
        "packedSourcesVerified": True,
        "authorDesktopMobileOffline": True,
        "scopedFormatting": "Python Black and Biome checked before source pins",
        "globalTests": "Not run by author; parent owns global validation per run153 worker contract",
        "independentFamilyQA": "Parent independently captures/freezes stable source after this handoff",
    },
    limitations=[
        "Exact human art approval is not claimed; run153 authorizes proceeding without per-vehicle appearance waits.",
        "Economical semantic component master uses runtime topology; no high-poly transfer claim.",
        "Finite crown region is support evidence, complemented by all 32 actual native views; not a universal coverage metric.",
        "Full neutral wheel roll only; nonzero steering and suspension are unqualified.",
        "No visible animated driver; existing ordinary driving semantics hide the driver inside vehicles. No new rider gameplay.",
        "Closed work cab and empty flat platform; no recessed-bed interior, cargo, towing or animated equipment claim.",
        "Nominal 6.3 x 2.3 x 2.4 source body proportions; bumpers, mirrors and rounded guard lips are included in actual exported bounds.",
        "Thin deck panel seams, diagonal glass frames, hazard blocks and chrome highlights retain expected angle-dependent native pixel aliasing.",
        "Nearest mipmap nearest in exporter; shared CarMeshAsset enforces nearest min/mag without mipmaps.",
    ],
    sourceHashes={
        rel(p): sha(p)
        for p in sorted(A.rglob("*"))
        if p.is_file()
        and p.name not in ["delivery.json", "retained-files.json", "report.json"]
    },
)
write(O / "report.json", report)
write(A / "report.json", report)
write(
    A / "delivery.json",
    {
        "status": "complete",
        "readyForParentQA": True,
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
print(
    json.dumps(
        {"status": "complete", "readyForParentQA": True, "audit": audit}, indent=2
    )
)
