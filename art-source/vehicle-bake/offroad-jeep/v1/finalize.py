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

S = ROOT / "scripts/vehicle-bake/offroad-jeep"
A = ROOT / "art-source/vehicle-bake/offroad-jeep/v1"
O = ROOT / "public/demos/vehicle-bake/offroad-jeep/v1"
D = ROOT / "data/vehicle-bake/offroad-jeep"


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
    == "68b188c03f679308082ec5453f80d101c0949af93220562f7f7bce5e7dba378d"
)
assert audit["triangles"] == 3146
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
coverage = read(D / "coverage-final.json")
assert coverage["inputSha256"] == audit["sha256"] and coverage["inputBytesUnchanged"]
assert all(w["coveredCount"] == w["sampleCount"] == 25 for w in coverage["wheels"])
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
assert source["results"]["actualGLBStaticSpare"]["noRollMetadata"]
assert source["results"]["actualGLBBounds"]["glbSha256"] == audit["sha256"]
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
    ]
]
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
    "independent-visual.mjs",
    "finalize.py",
]:
    shutil.copyfile(S / name, A / name)
for src, dst in [
    ("clearance-final.json", "shared-clearance.json"),
    ("clearance-input.json", "clearance-input.json"),
    ("packed-source-audit.json", "packed-source-audit.json"),
    ("visual-inspection.json", "author-visual-inspection.json"),
    ("author-view/captures/capture.json", "engine-capture.json"),
    ("author-qa/browser-qa.json", "author-browser-qa.json"),
]:
    shutil.copyfile(D / src, A / "evidence" / dst)
coverage["input"] = rel(O / "model.glb")
write(A / "evidence/upper-wheel-coverage.json", coverage)
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
        )
    ):
        shutil.copyfile(p, O / "engine" / p.name)
shutil.copyfile(D / "author-view/captures/capture.json", O / "engine/capture.json")
write(O / "engine/independent-visual.json", independent)

blender = "& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python "
commands = [
    blender + "art-source/vehicle-bake/offroad-jeep/v1/build.py -- --scratch",
    "node scripts/vehicle-bake/offroad-jeep/capture.mjs",
    "node scripts/vehicle-bake/offroad-jeep/independent-visual.mjs",
    "python scripts/vehicle-bake/offroad-jeep/sheets.py",
    blender + "scripts/vehicle-bake/offroad-jeep/audit-source.py",
    blender
    + "scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/offroad-jeep/v1/evidence/clearance-input.json data/vehicle-bake/offroad-jeep/recheck-clearance.json",
    blender
    + "scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/offroad-jeep/v1/model.glb --config art-source/vehicle-bake/offroad-jeep/v1/coverage-region.json --output data/vehicle-bake/offroad-jeep/recheck-coverage.json",
]
report.update(
    status="complete",
    artReviewStatus="agent-QA; no formal human approval fabricated",
    runtime="parent-owned integration pending",
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
    coverageEvidence=rel(A / "evidence/upper-wheel-coverage.json"),
    engineEvidence="engine/capture.json",
    independentWheelVisualEvidence="engine/independent-visual.json",
    actualBounds=source["results"]["actualGLBBounds"],
    staticSpareEvidence=source["results"]["actualGLBStaticSpare"],
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
        "staticHardtopAndRearSpare": True,
        "allNeutralRollWholeBodyClearance": True,
        "collidingBodyRejectedAndBaselineRestored": True,
        "crown25of25EachWithControls": True,
        "retainedSourceOnlyReplayByteIdentical": True,
        "packedSourcesVerified": True,
        "authorDesktopMobileOffline": True,
        "scopedBiomeAndPythonCompile": "passed",
        "globalTests": "Not run; explicitly parent-owned",
        "independentFrozenReview": "parent-owned",
    },
    limitations=[
        "Economical editable semantic component master uses runtime topology; no high-to-low transfer claim.",
        "Finite family crown sampling and native visual inspection are separate evidence.",
        "Full neutral roll only; nonzero steering, suspension and equipment motion unqualified.",
        "No off-road physics or new gameplay features; ordinary drive contract.",
        "Minor native-pixel aliasing of round lamps/hub marks varies with heading.",
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
