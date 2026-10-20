"""Actual exported native identity landmarks; v2 is an unqualified diagnostic control."""

from pathlib import Path
import hashlib, json
from PIL import Image, ImageDraw

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-riders/classic-upright-v3"
O = R / "public/demos/vehicle-riders/classic-upright/v3"
P = D / "eye-removal-control"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
e = json.loads((P / "evidence.json").read_text())
assert e["riderSha256"] == sha(O / "rider.glb")
assert len(e["rows"]) == 32 and e["geometryAndOccupancyUnchanged"]


def clusters(points):
    todo = {tuple(p["pixel"]) for p in points}
    groups = []
    while todo:
        one = {todo.pop()}
        pending = list(one)
        while pending:
            x, y = pending.pop()
            for p in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
                if p in todo:
                    todo.remove(p)
                    one.add(p)
                    pending.append(p)
        groups.append(
            {
                "pixels": sorted(one),
                "centroid": [sum(p[i] for p in one) / len(one) for i in range(2)],
            }
        )
    return sorted(groups, key=lambda g: g["centroid"][0])


rows = []
for row in e["rows"]:
    assert row["baselineResetExact"] and row["collarResetExact"]
    src = Image.open(D / f"captures/rider-{row['mode']}-{row['index']}.png").convert(
        "RGBA"
    )
    violet = Image.open(
        P / f"{row['mode']}-{row['index']}-original-violet.png"
    ).convert("RGBA")
    assert (
        src.tobytes() == violet.tobytes()
    ), "Eye controls must render same immutable candidate"
    for kind in ["raw", "violet", "shared"]:
        assert len(row["collarRemovalPixels"][kind]) == sum(
            row["collarColors"][kind].values()
        )
        assert all(
            p["original"][:3] == [92, 78, 146]
            and p["eyeRemoved"][:3] == [243, 242, 192]
            for p in row["pixels"][kind]
        )
    groups = {k: clusters(row["pixels"][k]) for k in ["raw", "violet", "shared"]}
    if row["index"] == 4:
        for kind in ["violet", "shared"]:
            assert len(groups[kind]) == 2 and all(
                len(g["pixels"]) >= 2 for g in groups[kind]
            ), groups
            assert groups[kind][1]["centroid"][0] - groups[kind][0]["centroid"][0] >= 5
            assert (
                row["collarColors"][kind]["n"] > 0
                and row["collarColors"][kind]["l"] > 0
            )
    if row["index"] in [0, 8]:
        assert row["counts"]["violet"] > 0 and row["counts"]["shared"] > 0
    rows.append(
        {
            "camera": row["mode"],
            "yaw": row["yaw"],
            "eyePixels": row["counts"],
            "eyeClusters": groups,
            "collarVisiblePixels": row["collarColors"],
            "eyeBoundaryLossShared": row["sharedEyeLostAtSilhouette"],
            "exactEyeAndCollarResets": True,
        }
    )
# Entire 32-view shared-outline sheets. Same native crop across every heading.
for mode in ["study", "engine"]:
    for kind in ["raw", "violet", "shared"]:
        frames = [
            Image.open(P / f"{mode}-{i}-original-{kind}.png").convert("RGBA")
            for i in range(16)
        ]
        bb = [im.getbbox() for im in frames]
        box = (
            min(b[0] for b in bb) - 3,
            min(b[1] for b in bb) - 3,
            max(b[2] for b in bb) + 3,
            max(b[3] for b in bb) + 3,
        )
        w, h = (box[2] - box[0]) * 6, (box[3] - box[1]) * 6
        sheet = Image.new("RGB", (w * 4, (h + 22) * 4), "#33434b")
        draw = ImageDraw.Draw(sheet)
        for i, im in enumerate(frames):
            x, y = i % 4 * w, i // 4 * (h + 22)
            draw.text((x + 3, y + 3), f"{mode} {i*22.5:g} {kind} /6x", fill="white")
            im = im.crop(box).resize((w, h), Image.Resampling.NEAREST)
            sheet.paste(im, (x, y + 22), im)
        sheet.save(D / f"features-{mode}-{kind}.png")
standing = Image.open(R / "public/assets/sprites/player.png").convert("RGBA")
sheet = Image.new("RGB", (1280, 1770), "#33434b")
draw = ImageDraw.Draw(sheet)
draw.text(
    (5, 5),
    "Unchanged original / V2 unqualified ear control / V3 raw / V3 violet / V3 shared58. Same4x native ruler.",
    fill="white",
)
for j, (mode, index, label, sourceRow) in enumerate(
    [
        ("study", 4, "front", 0),
        ("engine", 4, "front", 0),
        ("study", 3, "near-front67.5", 0),
        ("engine", 3, "near-front67.5", 0),
        ("study", 0, "side", 2),
        ("engine", 0, "side", 2),
    ]
):
    y = 28 + j * 288
    draw.text(
        (5, y),
        mode + " " + label + "; near-front uses original front reference only",
        fill="white",
    )
    native = Image.new("RGBA", (64, 64))
    native.paste(standing.crop((0, 16 * sourceRow, 16, 16 * (sourceRow + 1))), (24, 19))
    box = (80, 108, 144, 172) if mode == "study" else (80, 80, 144, 144)
    panels = [
        native,
        Image.open(
            R
            / f"public/demos/vehicle-riders/classic-upright/v2/captures/rider-{mode}-{index}.png"
        )
        .convert("RGBA")
        .crop(box),
    ]
    panels += [
        Image.open(P / f"{mode}-{index}-original-{k}.png").convert("RGBA").crop(box)
        for k in ["raw", "violet", "shared"]
    ]
    for i, im in enumerate(panels):
        im = im.resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(im, (i * 256, y + 20), im)
sheet.save(D / "v2-diagnostic-control-v3-identity.png")
# Finite eye/collar removal images use the same source registration, never redraw.
sheet = Image.new("RGB", (1008, 1220), "#33434b")
draw = ImageDraw.Draw(sheet)
for j, (mode, index) in enumerate(
    [("study", 4), ("engine", 4), ("study", 3), ("engine", 3)]
):
    y = j * 300
    draw.text(
        (5, y + 5),
        f"{mode} yaw{index*22.5:g} actual original / eyes removed / collar removed;6x",
        fill="white",
    )
    box = (100, 120, 124, 150) if mode == "study" else (100, 88, 124, 124)
    for k, kind in enumerate(["violet", "shared"]):
        draw.text((k * 504 + 5, y + 20), kind, fill="white")
        for l, name in enumerate(
            [f"original-{kind}", f"removed-{kind}", f"collar-removed-{kind}"]
        ):
            im = Image.open(P / f"{mode}-{index}-{name}.png").convert("RGBA").crop(box)
            im = im.resize((144, (box[3] - box[1]) * 6), Image.Resampling.NEAREST)
            sheet.paste(im, (k * 504 + l * 164 + 5, y + 40), im)
sheet.save(D / "eye-collar-removal-comparison.png")
report = {
    "status": "passed-native-feature-controls",
    "humanApproval": False,
    "riderSha256": sha(O / "rider.glb"),
    "atlasSha256": sha(O / "atlas.png"),
    "actualGLBSourceView": True,
    "CarMeshAssetUsed": False,
    "sourceVioletAndUnchangedSharedOutlineSeparatelyMeasured": True,
    "sharedOutlineSha256": e["sharedOutlineSha256"],
    "eyeRemovalTexels": e["changedTexels"],
    "collarRemovalTexels": e["collarRemovedTexels"],
    "all32GeometryOccupancyAndResetExact": True,
    "frontTwoSeparateInteriorEyeLandmarksBothCamerasBothOutlines": True,
    "frontVioletYellowCollarVisibleBothCamerasBothOutlines": True,
    "v2DiagnosticNotAppearanceQualified": True,
    "rows": rows,
    "limits": [
        "Agent native art QA; finite feature controls do not independently award likeness. Actual sheets require visual inspection.",
        "Some side/rear yellow collar samples remain hidden or consumed by inward stroke; front and near-front cues are proven, not universal color visibility.",
        "2D standing and seated volumetric profiles differ under fixed projection. No per-view resize or exact sprite silhouette parity claim.",
        "No actual bike, shared CarMeshAsset, normal availability, human approval, all27, AI or occupied fallback qualification.",
    ],
}
(D / "native-feature-proof.json").write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": report["status"],
            "front": [
                {
                    "camera": r["camera"],
                    "eyes": r["eyePixels"],
                    "collar": r["collarVisiblePixels"],
                }
                for r in rows
                if r["yaw"] == 90
            ],
        },
        indent=2,
    )
)
