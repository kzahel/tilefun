"""Retain one source-complete prerequisite art prototype; never production activation."""

from pathlib import Path
import json, hashlib, shutil, struct, io, re
from PIL import Image

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = R / "scripts/vehicle-riders/explorer"
A = R / "art-source/vehicle-riders/explorer/v1"
O = R / "public/demos/vehicle-riders/explorer/v1"
D = R / "data/vehicle-riders/explorer"


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def read(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def rel(p):
    return p.relative_to(R).as_posix()


def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, indent=2) + "\n")


report = read(O / "report.json")
assert not report["sourceImmutable"]
C = read(S / "rider.json")
identity = read(S / "identity.json")
assert (
    sha(O / "rider.glb")
    == "519b5d27183ab71692a1b3247ca59cc408cf7feb8dba0cee702f38a37736d642"
)
assert sha(R / C["carControl"]["glb"]) == C["carControl"]["sha256"]
assert (
    sha(R / C["identityReference"]["approvedPNG"])
    == C["identityReference"]["approvedPNGsha256"]
)
original_identity = read(R / C["identityReference"]["source"])
assert (
    identity["palette"] == original_identity["palette"]
    and identity["32"] == original_identity["32"]
)
gbytes = (O / "rider.glb").read_bytes()
n = struct.unpack_from("<I", gbytes, 12)[0]
g = json.loads(gbytes[20 : 20 + n])
binary = gbytes[28 + n :]
assert len(g["meshes"]) == len(g["materials"]) == len(g["textures"]) == 1 and not g.get(
    "animations"
)
primitive = g["meshes"][0]["primitives"]
assert len(primitive) == 1
vertices = g["accessors"][primitive[0]["attributes"]["POSITION"]]["count"]
tris = g["accessors"][primitive[0]["indices"]]["count"] // 3
assert tris == 1864
assert (
    g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
    and "KHR_materials_unlit" in g["materials"][0]["extensions"]
)
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
)
atlas = Image.open(O / "atlas.png").convert("RGBA")
assert atlas.size == (256, 256) and atlas.getchannel("A").getextrema() == (255, 255)
allowed = {tuple(bytes.fromhex(x[1:])) for x in identity["palette"].values()}
assert {x[:3] for x in atlas.getdata()} <= allowed
v = g["bufferViews"][g["images"][0]["bufferView"]]
embedded = Image.open(
    io.BytesIO(
        binary[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]]
    )
).convert("RGBA")
assert embedded.tobytes() == atlas.tobytes()
proof = read(D / "contact-proof.json")
capture = read(D / "capture.json")
bare = read(D / "bare-car-parity.json")
occlusion = read(D / "occlusion-proof.json")
visual = read(D / "visual-inspection.json")
for value in [proof, capture]:
    assert (
        value["status"] == "passed"
        and value["riderSha256"] == sha(O / "rider.glb")
        and value["carSha256"] == C["carControl"]["sha256"]
    )
assert (
    not proof["inappropriateSurfaceIntersections"]
    and proof["actualMainBodyInteriorVertexCount"] == 0
    and proof["backpackSeatbackVerticalSeparationWorld"] > 0.99
)
assert proof["mainBodyTrianglesFromActualGLB"] == 696 and all(
    proof["controls"][k]
    for k in ["translatedIntoHoodRejected", "baselineRestored", "inputBytesUnchanged"]
)
assert len(proof["actualContactSockets"]) == 5 and all(
    c["socketToDeclaredTargetWorld"] < 0.0001 for c in proof["actualContactSockets"]
)
for name in ["master.blend", "low.blend"]:
    assert proof["packedSources"][name]["sha256"] == sha(A / name)
assert (
    capture["singleDepthTarget"]
    and capture["sharedNormalizedParent"]
    and len(capture["views"]) == 32
    and not capture["errors"]
)
assert (
    capture["desktopMobileControls"]
    and capture["mobileNoOverflow"]
    and capture["offline"]["exactCombinedPixels"]
    and not capture["offline"]["networkRequests"]
)
assert (
    bare["status"] == "passed"
    and len(bare["views"]) == 32
    and all(v["mismatchedRGBAChannels"] == 0 for v in bare["views"])
)
assert (
    occlusion["status"] == "passed"
    and len(occlusion["views"]) == 32
    and all(
        v["visibleMaskOutsideRiderPixels"] == 0
        and v["actualCarDepthOccludedRiderPixels"] > 0
        for v in occlusion["views"]
    )
)
assert visual["status"] == "no-blocking-issues-for-prerequisite-pilot" and visual[
    "riderSha256"
] == sha(O / "rider.glb")
core = ["build.py", "rider.json", "identity.json"]
for name in core:
    assert (
        (S / name).read_bytes()
        == (A / name).read_bytes()
        == (D / "replay-final/source" / name).read_bytes()
    )
for name in ["rider.glb", "atlas.png", "recipe.json"]:
    assert (O / name).read_bytes() == (D / "replay-final/public" / name).read_bytes()
viewer_paths = [
    S / n
    for n in ["viewer.mjs", "build-view.mjs", "capture.mjs", "index.html", "rider.json"]
]
shared_paths = [
    R / "src/rendering" / n
    for n in [
        "CarMeshAsset.ts",
        "CarMeshProjection.ts",
        "CarPixelOutline.ts",
        "VehicleGeometryBatches.ts",
        "VehicleEmergencyLights.ts",
        "CarMeshDefinition.ts",
    ]
]
shared_paths += [
    R / C["carControl"]["glb"],
    R / C["carControl"]["master"],
    R / C["carControl"]["build"],
    R / "art-source/vehicle-bake/classic-roadster/v1/recipe.json",
    R / C["identityReference"]["source"],
    R / C["identityReference"]["approvedPNG"],
    R / "src/characters/approved-v1.json",
    R / "package.json",
]
shared_paths += [
    R / n for n in ["pnpm-lock.yaml", "package-lock.json"] if (R / n).exists()
]
for p in S.iterdir():
    if p.is_file() and p.suffix in [".py", ".mjs", ".json", ".html"]:
        shutil.copyfile(p, A / p.name)
(A / "evidence").mkdir(exist_ok=True)
for name in [
    "contact-proof.json",
    "capture.json",
    "bare-car-parity.json",
    "occlusion-proof.json",
    "visual-inspection.json",
]:
    shutil.copyfile(D / name, A / "evidence" / name)
shutil.copyfile(
    R / C["identityReference"]["approvedPNG"],
    A / "approved-standing-identity-reference.png",
)
shutil.copyfile(D / "offline.html", O / "offline.html")
offline_json = re.search(
    r"window.riderOffline=(.*?);</script>", (O / "offline.html").read_text(), re.S
).group(1)
import base64

offline_assets = json.loads(offline_json)["assets"]
assert (
    hashlib.sha256(base64.b64decode(offline_assets["car"].split(",")[1])).hexdigest()
    == C["carControl"]["sha256"]
)
assert hashlib.sha256(
    base64.b64decode(offline_assets["rider"].split(",")[1])
).hexdigest() == sha(O / "rider.glb")
for p in (D / "captures").glob("*.png"):
    (O / "captures").mkdir(exist_ok=True)
    shutil.copyfile(p, O / "captures" / p.name)
for p in [
    *D.glob("inspection-*.png"),
    *D.glob("identity-detail-*.png"),
    D / "desktop.png",
    D / "mobile.png",
]:
    shutil.copyfile(p, O / p.name)
replay = {
    "status": "passed",
    "byteIdentical": True,
    "glbSha256": sha(O / "rider.glb"),
    "atlasSha256": sha(O / "atlas.png"),
    "recipeSha256": sha(O / "recipe.json"),
    "inputHashes": {rel(A / n): sha(A / n) for n in core},
    "sharedInputHashes": {},
    "scratchInputDependencies": [],
    "blender": "5.2.2 LTS d13f752e3b9c, background factory startup four threads",
    "freshOutput": "data/vehicle-riders/explorer/replay-final/",
    "meaning": "Rider mesh/atlas/recipe need only retained constructor/config/identity JSON plus Blender. Shared car/renderer assets belong to composition diagnostics, not rider construction. Winding-preserving index order canonicalization changes no geometry/vertex/normal/UV/image buffers.",
}
write(A / "evidence/replay-verification.json", replay)
write(
    A / "evidence/composition-inputs.json",
    {
        "ownInputHashes": {rel(p): sha(p) for p in viewer_paths},
        "sharedInputHashes": {rel(p): sha(p) for p in shared_paths},
        "frozenCarCaptureHashes": {
            rel(R / C["carControl"]["frozenCaptures"] / f"{mode}-{i}.png"): sha(
                R / C["carControl"]["frozenCaptures"] / f"{mode}-{i}.png"
            )
            for mode in ["study", "engine"]
            for i in range(16)
        },
        "readonlyCarAndApprovedStandingReference": True,
        "noIgnoredInputDependencies": True,
    },
)
report.update(
    sourceStage="complete",
    sourceImmutable=True,
    status="prototype-not-production",
    humanApproval=False,
    readyForParentPrerequisiteArtReview=True,
    productionActivation=False,
    geometry={**report["geometry"], "vertices": vertices},
    glbSha256=sha(O / "rider.glb"),
    atlasSha256=sha(O / "atlas.png"),
    recipeSha256=sha(O / "recipe.json"),
    contactProof=proof,
    occlusionProof=occlusion,
    bareCarPixelParity=bare,
    visualInspection=visual,
    sourceReplay=replay,
    compositionSource="evidence/composition-inputs.json",
    scope="One static Explorer/one unchanged roadster driver seat. No all27-avatar, AI occupancy, production authority/renderer/pooling/failed-mesh/fallback or motorcycle activation support.",
    limits=visual["limits"],
    sourceHashes={
        rel(p): sha(p)
        for p in sorted(A.rglob("*"))
        if p.is_file() and p.name not in ["report.json", "retained-files.json"]
    },
)
write(O / "report.json", report)
write(A / "report.json", report)
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
        {
            "status": "prototype-not-production",
            "sourceStage": "complete",
            "sourceImmutable": True,
            "humanApproval": False,
            "riderSha256": sha(O / "rider.glb"),
            "triangles": tris,
            "vertices": vertices,
            "readyForParentPrerequisiteArtReview": True,
        },
        indent=2,
    )
)
