"""Retain the exact qualified pickup source checkpoint; no shared-path writes.

Requires actual-export proofs, author visual inspection and source-only replay.
Independent frozen-review QA and owner approval remain separate.
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

S = ROOT / "scripts/vehicle-bake/pickup"
A = ROOT / "art-source/vehicle-bake/pickup/v1"
O = ROOT / "public/demos/vehicle-bake/pickup/v1"
D = ROOT / "data/vehicle-bake/pickup"


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
assert report["status"] == "draft", "Completed checkpoint is immutable"
audit = audit_glb(O / "model.glb")
assert (
    audit["sha256"]
    == "4eb8b56c808c4ca807ef120caa786ecd29f256b3f43b40d04661cb8573b3b9d7"
)
assert audit["triangles"] == 2984
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
capture = read(D / "author-view/captures/capture.json")
assert capture["status"] == "passed" and capture["glbSha256"] == audit["sha256"]
assert len(capture["views"]) == 32 and capture["nativeSize"] == 224
assert len(capture["phases"]) == 8 and not capture["errors"]
assert all(v["edgePixels"] == 0 for v in capture["views"])
assert capture["rig"]["forwardReverseAbsoluteReset"]
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
assert source["results"]["actualGLBOpenBed"]["rayCount"] == 12
assert source["results"]["actualGLBOpenBed"]["glbSha256"] == audit["sha256"]
browser = read(D / "author-qa/browser-qa.json")
assert browser["status"] == "passed" and browser["glbSha256"] == audit["sha256"]
assert browser["offline"]["exactGlbSha256"] == audit["sha256"]
assert not browser["offline"]["networkRequests"]
visual = read(D / "visual-inspection.json")
assert (
    visual["status"] == "no-blocking-issues" and visual["glbSha256"] == audit["sha256"]
)

# Check actual exported material and embedded atlas pixels, independent of labels.
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

inputs = ["build.py", "family.json", "coverage-region.json", "review.json"]
for name in inputs:
    assert (
        (S / name).read_bytes()
        == (A / name).read_bytes()
        == (D / "replay/source" / name).read_bytes()
    )
for name in ["model.glb", "atlas.png", "recipe.json"]:
    assert (O / name).read_bytes() == (D / "replay/public" / name).read_bytes()
shared = [
    "catalog.py",
    "clearance.py",
    "coverage.py",
    "family-viewer.mjs",
    "family-build.mjs",
    "family-capture.mjs",
    "family-package.py",
]
shared_paths = [ROOT / "scripts/vehicle-bake" / name for name in shared]
shared_paths.append(ROOT / "scripts/authored-assets/runtime/wheel-rig.mjs")
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
    "blender": "5.2.2 LTS d13f752e3b9c; factory startup; background; 4 threads; python exit code 1",
    "meaning": "Retained builder/config only plus declared repository helpers; scratch contains outputs only. GLB, atlas and recipe replay exactly. Packed scene bytes are retained, not asserted deterministic across saves.",
}

baseline = read(D / "prior-baseline.json")
changed = [
    p for p, h in baseline.items() if not (ROOT / p).is_file() or sha(ROOT / p) != h
]
assert not changed, changed
preserved = {
    "priorFilesVerified": len(baseline),
    "changedFiles": changed,
    "method": "SHA-256 comparison with pre-authoring ledger of prior finished source and frozen family bundles.",
}
for name in [*inputs, "capture.mjs", "sheets.py", "audit-source.py", "finalize.py"]:
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
write(A / "evidence/prior-retained-preservation.json", preserved)
(O / "engine").mkdir(exist_ok=True)
for p in (D / "author-view/captures").glob("*.png"):
    if p.name.startswith(
        ("study-", "engine-", "roll-", "game-roll-", "wire-", "inspection-")
    ):
        shutil.copyfile(p, O / "engine" / p.name)
shutil.copyfile(D / "author-view/captures/capture.json", O / "engine/capture.json")

blender = "& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --threads 4 --python-exit-code 1 --python "
commands = [
    blender + "art-source/vehicle-bake/pickup/v1/build.py -- --scratch",
    "node scripts/vehicle-bake/pickup/capture.mjs",
    "python scripts/vehicle-bake/pickup/sheets.py",
    blender + "scripts/vehicle-bake/pickup/audit-source.py",
    blender
    + "scripts/vehicle-bake/clearance.py -- art-source/vehicle-bake/pickup/v1/evidence/clearance-input.json data/vehicle-bake/pickup/recheck-clearance.json",
    blender
    + "scripts/vehicle-bake/coverage.py -- --input public/demos/vehicle-bake/pickup/v1/model.glb --config art-source/vehicle-bake/pickup/v1/coverage-region.json --output data/vehicle-bake/pickup/recheck-coverage.json",
]
report.update(
    status="complete",
    artReviewStatus="awaiting-owner-review",
    runtime="not integrated",
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
    cargoBedEvidence=source["results"]["actualGLBOpenBed"],
    replayCommands=commands,
    visualInspection=visual["observations"],
    priorAssetsPreserved=preserved,
    validation={
        "actualGLBAudit": True,
        "actualKHRMaterialsUnlit": True,
        "oneOpaque512Atlas": True,
        "embeddedAtlasPixelsMatch": True,
        "actualSharedEngine32HeadingViews": True,
        "eightSignedPhasesPerCamera": True,
        "independentWheelsFixedBodyReverseAbsoluteReset": True,
        "allNeutralRollWholeBodyClearance": True,
        "collidingBodyRejectedAndBaselineRestored": True,
        "crown25of25EachWithControls": True,
        "actualGLBRecessedBedRays": 12,
        "retainedSourceOnlyReplayByteIdentical": True,
        "packedSourcesVerified": True,
        "priorFrozenAssetsPreserved": True,
        "authorDesktopMobileOffline": True,
        "typecheck": "passed",
        "lint": "passed with existing warnings",
        "globalTests": "Author duplicate stopped at coordinator request after concurrent unrelated timeouts; coordinator owns global suite/build/inventories.",
        "independentFamilyQA": "Separate QA worker owns frozen review; source checkpoint ready.",
    },
    limitations=[
        "Owner appearance approval pending; no pickup runtime or catalog activation.",
        "Original semantic surface paint; economical 51-component master uses runtime topology. No high-poly transfer claim.",
        "Finite declared crown region is geometric support evidence; all 32 actual-GLB views were visually checked separately.",
        "Full neutral roll only; nonzero steering, suspension, opening tailgate and gameplay handling unqualified.",
        "No animated lamps or equipment. Minor native-pixel aliasing on grille/lamp/hub highlights varies with angle.",
        "Exporter min sampler is nearest mipmap nearest; shared CarMeshAsset enforces nearest min/mag and disables mipmaps.",
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
        "artReviewStatus": "awaiting-owner-review",
        "runtime": "not integrated",
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
    json.dumps({"status": "complete", "audit": audit, "preserved": preserved}, indent=2)
)
