"""Freeze one rider source prerequisite; fixture geometry remains ignored."""

from pathlib import Path
import hashlib, json, struct, io, shutil, py_compile
from PIL import Image

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = R / "scripts/vehicle-riders/explorer-upright"
A = R / "art-source/vehicle-riders/explorer-upright/v1"
O = R / "public/demos/vehicle-riders/explorer-upright/v1"
D = R / "data/vehicle-riders/explorer-upright"


def read(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def rel(p):
    return p.relative_to(R).as_posix()


def write(p, v):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(v, indent=2) + "\n", encoding="utf8")


report = read(O / "report.json")
assert not report["sourceImmutable"]
C = read(S / "rider.json")
model = sha(O / "rider.glb")
assert (
    sha(S / "profile.json")
    == sha(R / C["contactProfile"]["source"])
    == C["contactProfile"]["sha256"]
)
for p, h in C["identityInputs"].items():
    assert sha(R / p) == h, p
assert (S / "identity.json").read_bytes() == (
    R / "art-source/pixel-characters/person.json"
).read_bytes()
core = ["build.py", "rider.json", "identity.json", "profile.json"]
for n in core:
    assert (
        (S / n).read_bytes()
        == (A / n).read_bytes()
        == (D / "replay-final/source" / n).read_bytes()
    ), n
for n in ["rider.glb", "atlas.png", "recipe.json"]:
    assert (
        (O / n).read_bytes()
        == (A / n).read_bytes()
        == (D / "replay-final/public" / n).read_bytes()
    ), n
raw = (O / "rider.glb").read_bytes()
size = struct.unpack_from("<I", raw, 12)[0]
g = json.loads(raw[20 : 20 + size])
binary = raw[28 + size :]
assert len(g["meshes"]) == len(g["materials"]) == len(g["textures"]) == 1 and not g.get(
    "animations"
)
p = g["meshes"][0]["primitives"]
assert len(p) == 1
tri = g["accessors"][p[0]["indices"]]["count"] // 3
verts = g["accessors"][p[0]["attributes"]["POSITION"]]["count"]
assert tri == 1956 and report["geometry"]["sha256"] == model
assert (
    "KHR_materials_unlit" in g["materials"][0]["extensions"]
    and g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
)
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
)
atlas = Image.open(O / "atlas.png").convert("RGBA")
assert atlas.size == (256, 256) and atlas.getchannel("A").getextrema() == (255, 255)
assert {p[:3] for p in atlas.getdata()} <= {
    tuple(bytes.fromhex(v[1:])) for v in read(S / "identity.json")["palette"].values()
}
v = g["bufferViews"][g["images"][0]["bufferView"]]
embedded = Image.open(
    io.BytesIO(
        binary[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]]
    )
).convert("RGBA")
assert embedded.tobytes() == atlas.tobytes()
proof = read(D / "contact-proof.json")
capture = read(D / "capture.json")
for e in [proof, capture]:
    assert (
        e["status"] == "passed"
        and e["riderSha256"] == model
        and e["profileSha256"] == C["contactProfile"]["sha256"]
    )
    assert (
        e["fixtureSha256"] == sha(D / "synthetic-contact-fixture.glb")
        and not e["actualBikePresent"]
    )
assert (
    not proof["inappropriateSelfIntersectionPairs"]
    and not proof["inappropriateFixtureIntersectionPairs"]
)
assert all(
    proof["negativeControls"][n]
    for n in [
        "allDisplacedSocketsRejected",
        "collapsedLegsRejected",
        "baselineRestored",
    ]
)
assert proof["straddleOpening"]["minimumLegInnerHalfGapWorld"] > 1.18
assert proof["footHandGeometry"]["closedVolumetricHandFootComponents"]
assert len(proof["contactLandmarks"]) == 5 and all(
    r["profileErrorWorld"] < 1e-5 for r in proof["contactLandmarks"]
)
for n in ["master.blend", "low.blend"]:
    assert proof["packedSources"][n]["sha256"] == sha(A / n)
assert len(capture["views"]) == 96 and all(
    v["edgePixels"] == 0 for v in capture["views"]
)
assert (
    capture["desktopMobileControls"]
    and capture["mobileNoOverflow"]
    and capture["offline"]["exactFixtureCombinedPixels"]
    and not capture["offline"]["networkRequests"]
    and not capture["errors"]
)
assert (
    capture["singleDepthTarget"]
    and capture["sharedProjectionAndOutline"]
    and not capture["CarMeshAssetUsed"]
)
assert not any(
    "CarMeshAsset" in line and "import" in line
    for line in (S / "viewer.mjs").read_text().splitlines()
)
previous = {}
for folder in [
    *(R / "art-source/vehicle-bake").glob("*/v1"),
    R / "art-source/vehicle-riders/explorer/v1",
]:
    pin = folder / "retained-files.json"
    if pin.exists():
        rows = read(pin)
        for path, h in rows.items():
            assert sha(R / path) == h, path
        previous[rel(pin)] = {"sha256": sha(pin), "verifiedFiles": len(rows)}
visual = {
    "status": "no-blocking-issues-for-prerequisite-pose",
    "riderSha256": model,
    "humanApproval": False,
    "actualBikePresent": False,
    "examined": "All16 study plus16 game rider-alone and synthetic-fixture combined native224 captures; four actual wireframes; desktop/mobile screenshots. Same-bounds4x nearest sheets aid inspection, original native pixels retained.",
    "observations": [
        "Short rounded brown crown and warm face/eyes read at native scale, with angle-dependent pixel loss. Same teal jacket/canvas pack/dark boots identity palette.",
        "Bent outboard knees, lowered support soles and raised bent arms read coherently; far limbs occlude by actual depth.",
        "Five neutral patches are visibly minimal synthetic contacts, never a bike. Fixture geometry and combined viewer/captures remain ignored.",
    ],
    "limits": [
        "Static coarse anatomy and closed mitten hands; no fingers, animation or actual bike clearance proof.",
        "Face detail varies with heading; likeness and contact profile await independent parent/human review.",
        "Finite surface intersection diagnostics and central opening do not qualify arbitrary frames, mounts or other avatars.",
    ],
}
write(D / "visual-inspection.json", visual)
replay = {
    "status": "passed",
    "byteIdentical": True,
    "outputs": {n: sha(O / n) for n in ["rider.glb", "atlas.png", "recipe.json"]},
    "inputHashes": {n: sha(A / n) for n in core},
    "scratchInputDependencies": [],
    "sharedInputDependencies": [],
    "freshOutput": "data/vehicle-riders/explorer-upright/replay-final/",
    "blender": "5.2.2 LTS d13f752e3b9c, factory startup background four threads",
    "meaning": "Only four retained own inputs construct rider mesh/atlas/recipe. Profile/identity source pins are provenance; constructor uses retained exact copies. Diagnostic fixture and viewer are separate, generated under ignored data. GLB index ordering canonicalized without changing winding or vertex/normal/UV/image buffers.",
}
write(D / "replay-verification.json", replay)
shared = [
    R / "src/rendering" / n for n in ["CarMeshProjection.ts", "CarPixelOutline.ts"]
] + [R / "package.json", R / "src/characters/approved-v1.json"]
shared += [R / n for n in ["pnpm-lock.yaml", "package-lock.json"] if (R / n).exists()]
write(
    D / "diagnostic-inputs.json",
    {
        "sharedInputHashes": {rel(p): sha(p) for p in shared},
        "identityInputHashes": C["identityInputs"],
        "profileInput": C["contactProfile"],
        "fixtureConstructor": rel(S / "fixture.py"),
        "fixtureRecipeSha256": sha(D / "fixture-recipe.json"),
        "fixtureOutputSha256": sha(D / "synthetic-contact-fixture.glb"),
        "fixtureOutputsStayIgnored": True,
        "actualBikePresent": False,
        "CarMeshAssetUsed": False,
    },
)
for p in S.iterdir():
    if p.is_file() and p.suffix in [".py", ".mjs", ".json", ".html"]:
        shutil.copyfile(p, A / p.name)
for n in [
    "contact-proof.json",
    "capture.json",
    "visual-inspection.json",
    "replay-verification.json",
    "diagnostic-inputs.json",
]:
    (A / "evidence").mkdir(exist_ok=True)
    shutil.copyfile(D / n, A / "evidence" / n)
shutil.copyfile(
    R / "public/demos/pixel-characters/person-32.png",
    A / "approved-standing-identity-reference.png",
)
for p in (D / "captures").glob("*.png"):
    if p.name.startswith("rider-") or p.name.startswith("wire-rider-"):
        (O / "captures").mkdir(exist_ok=True)
        shutil.copyfile(p, O / "captures" / p.name)
for p in D.glob("inspection-rider-*.png"):
    shutil.copyfile(p, O / p.name)
assert not list(A.rglob("*fixture*.glb")) and not list(O.rglob("*fixture*.glb"))
report.update(
    sourceStage="complete",
    sourceImmutable=True,
    humanApproval=False,
    readyForIndependentPrerequisiteQA=True,
    actualBikePresent=False,
    CarMeshAssetUsed=False,
    fixtureGeometryStaysIgnored=True,
    profileSha256=C["contactProfile"]["sha256"],
    sourceOnlyReplayExact=True,
)
report["geometry"]["uvVertices"] = verts
for b in [A, O]:
    write(b / "report.json", report)
write(
    A / "source-hashes.json",
    {rel(p): sha(p) for p in sorted(S.iterdir()) if p.is_file()},
)
audit = {
    "status": "source-complete-prototype-not-production",
    "riderSha256": model,
    "geometry": report["geometry"],
    "sourceOnlyReplayExact": True,
    "humanApproval": False,
    "previousImmutableBundles": previous,
    "allPreviousPinnedFilesUnchanged": True,
    "fixtureGeometryRetainedOnlyUnderIgnoredData": True,
}
write(A / "source-audit.json", audit)
pins = {
    rel(p): sha(p)
    for b in [A, O]
    for p in sorted(b.rglob("*"))
    if p.is_file() and p.name != "retained-files.json"
}
write(A / "retained-files.json", pins)
for p, h in pins.items():
    assert sha(R / p) == h
cache = D / "py-cache"
cache.mkdir(exist_ok=True)
for p in S.glob("*.py"):
    py_compile.compile(str(p), cfile=str(cache / (p.name + "c")), doraise=True)
text = f"""# Explorer upright profile prerequisite - immutable source complete

Status: prototype-not-production; humanApproval:false. Final GLB SHA256 `{model}`. {tri} triangles, {verts} UV vertices, one opaque unlit nearest256 atlas mesh. Retained master keeps35 editable semantic components, low is one joined mesh.

All five hip-relative world-pixel anchors match immutable upright-v1 profile within1e-5; actual pelvis/sole surfaces meet fixture top surfaces and hand geometry surrounds the grip centerlines. Actual closed hand/foot solids verified. Displaced anchors and collapsed-leg negatives reject; reset restores baseline. Actual leg triangles leave a1.8world-pixel central empty strip (minimum inner half-gap1.18501675); this excludes pelvis/fixture and is not bike clearance. Zero inappropriate semantic surface-intersection pairs; declared anatomy/garment joints and palm wrapping retained explicitly.

All16 study plus16 game native224/radius112 rider-alone and synthetic-fixture combined headings, wires, desktop/mobile and exact offline pixels passed with shared projection/outline and one depth target. The five-patch synthetic fixture, combined captures and self-contained offline viewer stay ignored under data/vehicle-riders/explorer-upright/. It is not a bike or production depth qualification. No CarMeshAsset use or two-wheel engine claim.

Fresh four-input constructor-only replay exactly matches GLB/atlas/recipe. Packed master/low, semantic UV ownership, constructor/config/profile/identity copies and provenance pins retained. Prior pinned bundles verified unchanged. {len(pins)} retained file hashes in art-source/vehicle-riders/explorer-upright/v1/retained-files.json.

Limitations: static coarse anatomy/mitten hands, angle-dependent face pixel detail; no fingers, animation, actual bike/body/wheel fit, normal activation, other-avatar/AI/fallback qualification. Parent/human approval remains pending. Parent owns independent QA/freeze/registration and next bike/engine instruction.

Next: read-only identity/proportion inventory proposal for the other26 player appearances; no art/code rollout.
"""
(D / "finalresult.md").write_text(text, encoding="utf8")
(D / "progress.md").write_text(text, encoding="utf8")
print(
    json.dumps(
        {
            "sha256": model,
            "triangles": tri,
            "uvVertices": verts,
            "retainedFiles": len(pins),
            "sourceImmutable": True,
            "humanApproval": False,
        }
    )
)
