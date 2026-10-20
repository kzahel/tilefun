"""Freeze one static Person7 player-avatar prerequisite, never production activation."""

from pathlib import Path
import hashlib, json, struct, io, shutil, py_compile
from PIL import Image

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
S = R / "scripts/vehicle-riders/person7-upright"
A = R / "art-source/vehicle-riders/person7-upright/v1"
O = R / "public/demos/vehicle-riders/person7-upright/v1"
D = R / "data/vehicle-riders/person7-upright"


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
core = [
    "build.py",
    "rider.json",
    "identity.json",
    "explorer-upright-v1.json",
    "person7-upright-v1.json",
]
assert read(O / "recipe.json")["sourceDependencies"] == core
for n in core:
    assert (
        (S / n).read_bytes()
        == (A / n).read_bytes()
        == (D / "declared-inputs-only" / n).read_bytes()
        == (D / "replay-final/source" / n).read_bytes()
    ), n
for n in ["rider.glb", "atlas.png", "recipe.json"]:
    assert (
        (A / n).read_bytes()
        == (O / n).read_bytes()
        == (D / "replay-final/public" / n).read_bytes()
    ), n
for p, h in C["identityInputs"].items():
    assert sha(R / p) == h, p
I = read(S / "identity.json")
assert I["sourceSha256"] == sha(R / "public/assets/sprites/person7.png")
source = Image.open(R / "public/assets/sprites/person7.png").convert("RGBA")
reverse = {tuple(bytes.fromhex(v[1:])): k for k, v in I["palette"].items()}
assert len(reverse) == 24
for chart, row in [("front", 0), ("back", 1), ("profile", 2), ("rightProfile", 3)]:
    expected = [
        "".join(
            (
                reverse[source.getpixel((x, row * 32 + y))[:3]]
                if source.getpixel((x, row * 32 + y))[3]
                else "."
            )
            for x in range(16)
        )
        for y in range(19, 23)
    ]
    assert I["headSkinCharts"][chart] == expected
assert (
    sha(S / "explorer-upright-v1.json")
    == sha(R / C["explorerProfile"]["source"])
    == C["explorerProfile"]["sha256"]
)
assert sha(S / C["contactProfile"]["ownCopy"]) == C["contactProfile"]["sha256"]
raw = (O / "rider.glb").read_bytes()
n = struct.unpack_from("<I", raw, 12)[0]
g = json.loads(raw[20 : 20 + n])
binary = raw[28 + n :]
assert (
    len(g["meshes"]) == len(g["materials"]) == len(g["textures"]) == 1
    and not g.get("animations")
    and not g.get("skins")
)
primitives = g["meshes"][0]["primitives"]
assert len(primitives) == 1
p = primitives[0]
tri = g["accessors"][p["indices"]]["count"] // 3
vertices = g["accessors"][p["attributes"]["POSITION"]]["count"]
assert 1400 <= tri <= 2400
assert tri == report["geometry"]["triangles"] and model == report["geometry"]["sha256"]
assert (
    g["materials"][0].get("alphaMode", "OPAQUE") == "OPAQUE"
    and "KHR_materials_unlit" in g["materials"][0]["extensions"]
)
assert all(
    s["magFilter"] == 9728 and s["minFilter"] in [9728, 9984] for s in g["samplers"]
)
atlas = Image.open(O / "atlas.png").convert("RGBA")
assert atlas.size == (256, 256) and atlas.getchannel("A").getextrema() == (255, 255)
assert {p[:3] for p in atlas.get_flattened_data()} <= {
    tuple(bytes.fromhex(v[1:])) for v in I["palette"].values()
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
replay = read(D / "replay-verification.json")
identity = read(D / "identity-inspection.json")
for e in [proof, capture]:
    assert (
        e["status"] == "passed"
        and e["riderSha256"] == model
        and e["profileSha256"] == C["contactProfile"]["sha256"]
        and e["fixtureSha256"] == sha(D / "synthetic-contact-fixture.glb")
        and not e["actualBikePresent"]
    )
assert read(D / "fixture-recipe.json")["profileSha256"] == C["contactProfile"]["sha256"]
assert (
    not proof["inappropriateSelfIntersectionPairs"]
    and not proof["inappropriateFixtureIntersectionPairs"]
)
assert len(proof["contactLandmarks"]) == 5 and all(
    r["profileErrorWorld"] < 1e-5 for r in proof["contactLandmarks"]
)
assert len(proof["actualFixedBoneLengthChecks"]) == 8 and all(
    r["errorWorld"] < 0.0001 for r in proof["actualFixedBoneLengthChecks"]
)
assert (
    proof["handFootGeometry"]["closedVolumetricPalmsBoots"]
    and len(proof["handFootGeometry"]["actualClosedSolidChecks"]) == 4
)
assert proof["straddleOpening"]["minimumLegInnerHalfGapWorld"] > 1.95
assert all(
    proof["negativeControls"][n]
    for n in [
        "allDisplacedSocketsRejected",
        "collapsedLegsRejected",
        "baselineRestored",
    ]
)
for n in ["master.blend", "low.blend"]:
    assert proof["packedSources"][n]["sha256"] == sha(A / n)
assert (
    len(capture["views"]) == 96
    and len(capture["wireViews"]) == 64
    and all(v["edgePixels"] == 0 for v in capture["views"] + capture["wireViews"])
)
assert (
    capture["singleDepthTarget"]
    and capture["sharedProjectionAndOutline"]
    and not capture["CarMeshAssetUsed"]
    and not capture["errors"]
)
assert (
    capture["desktopMobileControls"]
    and capture["mobileNoOverflow"]
    and capture["offline"]["exactFixtureCombinedPixels"]
    and not capture["offline"]["networkRequests"]
)
assert (
    replay["status"] == "passed"
    and replay["onlyFiveDeclaredFilesPresent"]
    and not replay["scratchInputDependencies"]
    and not replay["sharedInputDependencies"]
)
assert replay["outputs"] == {
    n: sha(O / n) for n in ["rider.glb", "atlas.png", "recipe.json"]
}
assert identity["riderSha256"] == model
assert len(capture["rulerViews"]) == 32 and all(
    v["edgePixels"] == 0 for v in capture["rulerViews"]
)
assert (
    capture["scaleControlInputs"] == C["scaleControls"]
    and capture["offline"]["exactRulerPixels"]
)
for entry in C["scaleControls"]:
    assert sha(R / entry["path"]) == entry["sha256"]
bundle = read(D / "diagnostic-build-pins.json")
assert (
    bundle["status"] == "passed"
    and bundle["noInputChangesDuringBuild"]
    and bundle["before"] == bundle["after"]
)
for path, h in bundle["after"].items():
    assert sha(R / path) == h, path
assert sha(D / "author-view/viewer.js") == bundle["viewBundleSha256"]
failed = read(D / "final-explorer-attempt/failed-fit.json")
initial = read(D / "explorer-profile-attempt/failed-fit.json")
assert (
    failed["status"] == "FAILED-Explorer-upright-v1-fit-no-stretch"
    and failed["sameAnatomyAsFinalProposedPerson7Profile"]
    and failed["fixedPerson7Anatomy"] == C["anatomy"]
)
assert (
    failed["boneLengthsPreserved"]
    and failed["rootTranslationCannotMeetAllFive"]
    and all(r["failsContactTolerance"] for r in failed["actualGLBContacts"])
)
assert (
    failed["riderSha256"] == sha(D / "final-explorer-attempt/public/rider.glb")
    and failed["immutableGlobalProfileSha256"] == C["explorerProfile"]["sha256"]
)
# Narrow read-only preservation checks for the two prior rider sources used as helper references.
previous = {}
for name in ["explorer", "explorer-upright", "bear-upright"]:
    p = R / f"art-source/vehicle-riders/{name}/v1/retained-files.json"
    pins = read(p)
    for path, h in pins.items():
        assert sha(R / path) == h, path
    previous[rel(p)] = {"sha256": sha(p), "verifiedFiles": len(pins)}
profile = read(S / "person7-upright-v1.json")
original = read(S / "explorer-upright-v1.json")
feasibility = {
    "status": "failed-Explorer-profile/proposed-Person7-profile",
    "humanApproval": False,
    "actualBikePresent": False,
    "currentProfileId": profile["id"],
    "currentProfileSha256": C["contactProfile"]["sha256"],
    "immutableExplorerProfileSha256": C["explorerProfile"]["sha256"],
    "sameFinalTemplateExplorerAttempt": failed,
    "initialAttemptSha256": initial["riderSha256"],
    "proposedContactsWorld": profile["contacts"],
    "immutableExplorerContactsWorld": original["contacts"],
    "inferredAnatomy": C["anatomy"],
    "inference": C["inference"],
    "interpretation": "Failure is conditional on fixed inferred upright joint roots and lengths, not universal infeasibility for every possible Person7 leaning pose/anatomy. Own profile is a proposal, not a globally approved or actual bike-qualified mount.",
}
write(D / "contact-profile-feasibility.json", feasibility)
lines = [
    "# Person7 contact-profile feasibility",
    "",
    "Immutable Explorer upright-v1 was attempted first with fixed short inferred Person7 chains and its compact legacy body/large cap identity. The initial actual GLB and32native attempt views are retained under ignored explorer-profile-attempt/. After head-depth/brim and cap-join refinements, the final template was tested again with the same original profile, without limb scaling. All five contacts still fail. Root translation cannot meet all five simultaneously.",
    "",
    "| Landmark | Original Explorer world target | Final-template actual failed anchor | Miss (world pixels) | Proposed Person7 world target |",
    "|---|---|---|---|---|",
]
for row in failed["actualGLBContacts"]:
    n = row["name"]
    fmt = lambda p: ", ".join(f"{v:.4f}" for v in p)
    lines.append(
        f"| {n} | {fmt(original['contacts'][n])} | {fmt(row['actualGLBAnchorWorld'])} | {row['missWorld']:.6f} | {fmt(profile['contacts'][n])} |"
    )
lines += [
    "",
    f"Separate own profile: `{profile['id']}`, file `person7-upright-v1.json`, SHA256 `{C['contactProfile']['sha256']}`. It has shorter grip reach, slightly wider palm centers, compact higher foot supports and the inferred legacy pelvis-bottom anchor. These are separately named proposed targets; global profile bytes never changed.",
    "",
    "Actual final rider contacts meet this proposed fixture: hip bottom and boot sole surfaces on patch tops; grip centerlines inside closed palms, with deliberate palm wrapping. Forearm skin ends at the wrist instead of continuing through grip geometry. Eight actual GLB tube end-ring checks preserve the fixed limb center lengths (forearm chain includes wrist-to-palm offset). Displaced anchors and mirrored/collapsed legs reject; reset restores baseline.",
    "",
    "Source2D art does not specify unique depth or hidden joint centers. Part ratios and compact limb roots/lengths were inferred before contact solving; head forward depth and bill were refined for pale-face readability. Failure applies to this fixed upright template, not every conceivable anatomy or leaning pose. Head/cap/torso/palm/boot comparisons are in identity-inspection.json and identity-comparison.png; common-world-ruler.png compares untouched Explorer/Person7/Bear without resizing. Parent likeness/profile review remains required.",
    "",
    "The five-patch fixture is ignored synthetic diagnostic geometry, not a bike. No actual frame/wheel/mount/engine or production depth fit has been qualified. No standing assets, normal source/runtime, catalog or review registrations were changed. No remaining-avatar/AI/fallback rollout is claimed.",
    "",
]
(D / "contact-profile-feasibility.md").write_text("\n".join(lines), encoding="utf8")
visual = {
    "status": "no-blocking-issues-for-source-prerequisite-pilot",
    "humanApproval": False,
    "riderSha256": model,
    "actualBikePresent": False,
    "examined": "All16study+16game native224 rider-alone and synthetic-fixture combined headings, all32rider wire headings and fixture wire controls; comparative standing/front/back/profile identity sheet and desktop/mobile screenshots. Integer4x nearest diagnostics preserve native pixels.",
    "observations": [
        "Distinct Person7 legacy human: tall stacked teal cap/brim with orange skin-UV accent, pale face/gray-brown hair, blue/teal jacket and compact olive pants/boots. Own head/hat geometry, no Explorer head/recolor.",
        "Bent arms and short straddled legs remain coherent through headings; contact fixture stays minimal and synthetic.",
        "Own source24-color skin charts retain pale face and clothing clusters. Orange accent and stacked cap band remain semantic UV owners on actual geometry. Small face detail varies with heading.",
    ],
    "limits": identity["uncertainty"]
    + [
        "Static closed palms have no fingers/articulated grasp; no pose animation.",
        "Surface intersection diagnostics are finite and except only explicitly bounded local anatomical joins and matching palm/sole/seat contacts.",
    ],
}
write(D / "visual-inspection.json", visual)
shared = (
    [R / "src/rendering" / n for n in ["CarMeshProjection.ts", "CarPixelOutline.ts"]]
    + [R / "package.json", R / "src/characters/approved-v1.json"]
    + [R / n for n in ["pnpm-lock.yaml", "package-lock.json"] if (R / n).exists()]
)
write(
    D / "diagnostic-inputs.json",
    {
        "sharedInputHashes": {rel(p): sha(p) for p in shared},
        "identityInputHashes": C["identityInputs"],
        "immutableGlobalProfile": C["explorerProfile"],
        "ownProposedProfile": C["contactProfile"],
        "fixtureOutputSha256": sha(D / "synthetic-contact-fixture.glb"),
        "fixtureRecipeSha256": sha(D / "fixture-recipe.json"),
        "fixtureOutputsStayIgnored": True,
        "CarMeshAssetUsed": False,
        "actualBikePresent": False,
        "helperCodeProvenanceOnly": {
            rel(R / "scripts/vehicle-riders/explorer-upright" / n): sha(
                R / "scripts/vehicle-riders/explorer-upright" / n
            )
            for n in ["build.py", "viewer.mjs", "capture.mjs", "fixture.py"]
        },
        "noPriorHelperRuntimeDependencyForRiderConstructor": True,
        "readOnlyRulerControls": C["scaleControls"],
        "rulerControlsAreNotRiderConstructionInputs": True,
    },
)
for p in S.iterdir():
    if p.is_file() and p.suffix in [".py", ".mjs", ".json", ".html"]:
        shutil.copyfile(p, A / p.name)
for n in [
    "contact-proof.json",
    "capture.json",
    "replay-verification.json",
    "identity-inspection.json",
    "visual-inspection.json",
    "diagnostic-inputs.json",
    "contact-profile-feasibility.json",
    "contact-profile-feasibility.md",
    "diagnostic-build-pins.json",
]:
    (A / "evidence").mkdir(exist_ok=True)
    shutil.copyfile(D / n, A / "evidence" / n)
observation = read(D / "inventory-row.json")
write(
    A / "evidence/identity-inventory-observation.json",
    {
        "observationAtTaskStart": observation,
        "constructionDependency": False,
        "meaning": "Retained appearance inventory and coverage document are observational context, not immutable engine or rider construction pins. Source PNG/own identity JSON supply this family's retained paint evidence.",
    },
)
for stage, folder in [
    ("initial", "explorer-profile-attempt"),
    ("final", "final-explorer-attempt"),
]:
    out = A / "evidence" / f"{stage}-explorer-profile-attempt"
    out.mkdir(exist_ok=True)
    for n in ["rider.glb", "atlas.png", "recipe.json"]:
        shutil.copyfile(D / folder / "public" / n, out / n)
    shutil.copyfile(D / folder / "failed-fit.json", out / "failed-fit.json")
    if stage == "initial":
        for n in [
            "build.py",
            "rider.json",
            "identity.json",
            "explorer-upright-v1.json",
        ]:
            shutil.copyfile(D / folder / "inputs" / n, out / n)
shutil.copyfile(
    R / "public/assets/sprites/person7.png",
    A / "source-standing-reference.png",
)
for p in (D / "captures").glob("*.png"):
    if p.name.startswith("rider-") or p.name.startswith("wire-rider-"):
        (O / "captures").mkdir(exist_ok=True)
        shutil.copyfile(p, O / "captures" / p.name)
for pattern in [
    "inspection-rider-*.png",
    "inspection-wire-rider-*.png",
    "identity-comparison.png",
]:
    for p in D.glob(pattern):
        shutil.copyfile(p, O / p.name)
assert not any(
    "fixture" in p.name.lower() and p.suffix == ".glb"
    for base in [A, O]
    for p in base.rglob("*")
)
report.update(
    sourceStage="complete",
    sourceImmutable=True,
    humanApproval=False,
    readyForIndependentPrerequisiteQA=True,
    actualBikePresent=False,
    CarMeshAssetUsed=False,
    fixtureGeometryStaysIgnored=True,
    sourceOnlyReplayExact=True,
    contactProfileId=profile["id"],
    contactProfileSha256=C["contactProfile"]["sha256"],
    contactProfileStatus="proposed-not-globally-approved",
    originalExplorerProfileFit="FAILED-final-template-no-stretch",
    normalActivationQualified=False,
)
report["geometry"]["uvVertices"] = vertices
for base in [A, O]:
    write(base / "report.json", report)
write(
    A / "source-hashes.json",
    {rel(p): sha(p) for p in sorted(S.iterdir()) if p.is_file()},
)
audit = {
    "status": "source-complete-prototype-not-production",
    "humanApproval": False,
    "riderSha256": model,
    "geometry": report["geometry"],
    "packedSources": proof["packedSources"],
    "sourceOnlyReplayExact": True,
    "declaredInputCount": 5,
    "originalExplorerProfileFailed": True,
    "ownProfileProposalOnly": True,
    "fixtureGeometryIgnoredOnly": True,
    "priorRiderPinsUnchanged": previous,
    "observationalPerson7InputsUnchanged": C["identityInputs"],
    "globalProfileUnchanged": C["explorerProfile"]["sha256"],
    "noStandingNormalSourceCatalogReviewEdits": True,
}
write(A / "source-audit.json", audit)
pins = {
    rel(p): sha(p)
    for base in [A, O]
    for p in sorted(base.rglob("*"))
    if p.is_file() and p.name != "retained-files.json"
}
write(A / "retained-files.json", pins)
for p, h in pins.items():
    assert sha(R / p) == h, p
cache = D / "py-cache"
cache.mkdir(exist_ok=True)
for p in S.glob("*.py"):
    py_compile.compile(str(p), cfile=str(cache / (p.name + "c")), doraise=True)
text = f"""# Person7 upright rider - immutable source complete

Status: prototype-not-production; humanApproval:false. Final GLB SHA256 `{model}`. {tri} triangles, {vertices} UV vertices, one opaque unlit nearest256 atlas mesh;26 editable semantic components in packed master, one joined low. Source-stage complete and immutable; prior rider/standing/normal sources unchanged.

Own legacy human/cap template preserves the large stacked teal crown/band/brim and orange accent, pale face with gray-brown hair, blue/teal jacket and short olive pants/boots. Own24-color palette/skin charts come from actual Person7 source PNG; body/hat geometry is new, no Explorer head/body recolor or standing billboard. Visible source allocation is cap12rows, face3, jacket4, lower pants/boots5; inferred3D depth and hidden joints are uncertain. No normalization to physicalHeight24 or stretching to Explorer reach.

Original upright-v1 profile failed actual fixed-chain fit: hip0.339130, each hand5.297737 and sole2.975377world pixels. Initial failure with32views retained; final refined template rerun also fails all5 without changing its short limb lengths. Other possible leaning/anatomical interpretations are not ruled out. Global profile SHA remains `{C['explorerProfile']['sha256']}`.

Separately named proposed `{profile['id']}` profile SHA `{C['contactProfile']['sha256']}`. Actual5anchors and pelvis/sole surfaces meet synthetic patch tops; grip centers lie inside closed palms.8actual GLB tube end-ring checks retain fixed short chains (forearm includes wrist-to-palm offset). Closed palms/boots, bounded local body/head/hat/clothing joins, displaced-anchor and collapsed-leg negative/reset controls pass. Minimum inner leg half-gap~2world; certified central empty strip2world wide excludes pelvis/fixture and is not bike clearance. Zero inappropriate self/fixture surface pairs.

All16study+16game native224/radius112 rider-alone and synthetic-fixture combined views plus32rider wires inspected. Additional32 read-only ruler compositions show Explorer/Person7/Bear at unchanged scale with shared hip origins, yaw, camera, pixel clock and depth target. Source standing reference uses shared native ground ruler; no individual or per-angle fitting. Fixed80/4.6 density and shared CarPixelOutline/projection. Desktop/mobile and exact offline combined/ruler pixels pass. Fixture and ruler-control assets/composites/viewer stay ignored under data/vehicle-riders/person7-upright/. Public colored/wire captures contain Person7 alone. No CarMeshAsset/two-wheel claim.

Fresh directory containing exactly5 declared inputs reproduced GLB/atlas/recipe byte-for-byte. Recipe SHA `{sha(O/'recipe.json')}`, atlas SHA `{sha(O/'atlas.png')}`. Packed master/low, semantic UV owners, retained constructors/config/identity/profile copies, failure evidence and {len(pins)} hashes in art-source/vehicle-riders/person7-upright/v1/. contact-profile-feasibility.md/json and identity-inspection.json retain explicit limits; common-world-ruler.png is ignored diagnostic evidence.

Commands: Blender5.2.2 factory background4threads --python build.py for draft construction only; build.py -- --explorer-attempt recreates ignored failed final-template fit; attempt-proof.py -- --final measures it. fixture.py and prove.py check actual geometry. node build-view.mjs and capture.mjs create ignored native/mobile/offline/ruler evidence; inspect.py and identity-inspect.py create nearest-only comparisons. replay.py --blender BLENDER requires fresh empty ignored replay dirs and only5 retained constructor inputs. Scoped Biome checks for own build-view.mjs/capture.mjs/viewer.mjs and own config/profile pass before final pinning; Python helpers formatted and compiled.

Limitations: small face/eyes/brim/orange clusters lose pixels by heading, static closed palms lack fingers/articulated grasp, and hidden depths/joints are inferred. No actual bike/frame/wheel/mount/production depth, normal activation, broader legacy-human batch, all-avatar, AI/fallback or animation qualification. Standing source is observational identity, not seated approval. Parent owns independent QA/registration and actual bike variants. Await next task; immutable source will not be overwritten.
"""
for n in ["finalresult.md", "progress.md"]:
    (D / n).write_text(text, encoding="utf8")
print(
    json.dumps(
        {
            "sha256": model,
            "triangles": tri,
            "uvVertices": vertices,
            "sourceImmutable": True,
            "retainedFiles": len(pins),
            "ownProfileId": profile["id"],
            "humanApproval": False,
        }
    )
)
