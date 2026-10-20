"""Native semantic ear silhouette controls, independently of roof/body alpha."""

from pathlib import Path
from collections import Counter
import hashlib, json
from PIL import Image, ImageDraw

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-riders/classic-upright-v3"
P = D / "ear-removal-control"
O = R / "public/demos/vehicle-riders/classic-upright/v3"
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
e = json.loads((P / "evidence.json").read_text())
assert e["modelSha256"] == sha(O / "rider.glb")
assert (
    e["attributeBuffersUnchanged"]
    and e["onlyEarIndicesRemoved"]
    and e["all32ExactResets"]
)
assert len(e["rows"]) == 32
front = []
for row in e["rows"]:
    actual = Image.open(D / f"captures/rider-{row['mode']}-{row['index']}.png").convert(
        "RGBA"
    )
    original = Image.open(
        P / f"{row['mode']}-{row['index']}-original-violet.png"
    ).convert("RGBA")
    assert actual.tobytes() == original.tobytes()
    for name, detail in row["removed"].items():
        assert detail["exactReset"] and detail["onlyDeclaredEarIndicesRemoved"]
        assert (
            {tuple(p) for p in detail["alphaLoss"]["raw"]}
            == {tuple(p) for p in detail["alphaLoss"]["violet"]}
            == {tuple(p) for p in detail["alphaLoss"]["shared"]}
        )
    if row["index"] in [3, 4, 5]:
        left = row["removed"]["left"]["alphaLoss"]["raw"]
        right = row["removed"]["right"]["alphaLoss"]["raw"]
        assert len(left) >= 2 and len(right) >= 2
        assert not {tuple(p) for p in left} & {tuple(p) for p in right}
        assert (
            abs(
                sum(p[0] for p in left) / len(left)
                - sum(p[0] for p in right) / len(right)
            )
            >= 3
        )
        peaks = []
        if row["index"] == 4:
            for points in [left, right]:
                widths = Counter(p[1] for p in points)
                assert (
                    widths[min(widths)] == 1
                    and max(widths.values()) >= 2
                    and len(widths) >= 2
                ), widths
                peaks.append(
                    {
                        "onePixelApex": True,
                        "visibleHeightPixels": len(widths),
                        "maximumWidthPixels": max(widths.values()),
                        "alphaPixels": len(points),
                    }
                )
        front.append(
            {
                "camera": row["mode"],
                "yaw": row["yaw"],
                "leftOnlySilhouettePixels": len(left),
                "rightOnlySilhouettePixels": len(right),
                "bothRemovedPixels": len(row["removed"]["both"]["alphaLoss"]["raw"]),
                "disjointEarLandmarks": True,
                "nativePointedFrontProfiles": peaks,
            }
        )
sheet = Image.new("RGB", (1280, 1770), "#33434b")
draw = ImageDraw.Draw(sheet)
draw.text(
    (4, 4),
    "V3 actual original / LEFT removed / RIGHT removed / BOTH removed / alpha loss only. Same6x native pixels.",
    fill="white",
)
for j, (mode, index) in enumerate(
    [
        ("study", 3),
        ("study", 4),
        ("study", 5),
        ("engine", 3),
        ("engine", 4),
        ("engine", 5),
    ]
):
    y = 28 + j * 288
    draw.text(
        (5, y),
        f"{mode} yaw{index*22.5:g}: actual decoded ear triangles only; unchanged shared58 stroke",
        fill="white",
    )
    box = (96, 118, 128, 154) if mode == "study" else (96, 85, 128, 125)
    images = [
        Image.open(P / f"{mode}-{index}-{name}-shared.png").convert("RGBA")
        for name in ["original", "left-removed", "right-removed", "both-removed"]
    ]
    mask = Image.new("RGBA", (224, 224))
    row = next(r for r in e["rows"] if r["mode"] == mode and r["index"] == index)
    for name, color in [("left", (255, 200, 90, 255)), ("right", (100, 230, 255, 255))]:
        for point in row["removed"][name]["alphaLoss"]["raw"]:
            mask.putpixel(tuple(point), color)
    images.append(mask)
    for k, im in enumerate(images):
        im = im.crop(box).resize((192, (box[3] - box[1]) * 6), Image.Resampling.NEAREST)
        sheet.paste(im, (k * 256 + 20, y + 24), im)
sheet.save(D / "ear-removal-front-nearfront.png")
result = {
    "status": "passed-native-ear-silhouette-controls",
    "riderSha256": e["modelSha256"],
    "semanticMapSha256": sha(D / "ear-triangle-map.json"),
    "all32AttributeBuffersAndExactResets": True,
    "all32RawSourceSharedAlphaLossIdentical": True,
    "bothEarsDistinctFrontAndNearFrontBothCameras": True,
    "nativeFrontPointedNotRoof": True,
    "frontAndNearFront": front,
    "meaning": "Only actual mapped32triangles per ear are removed from the actual GLB index buffer; all other triangles, positions, normals, UVs, atlas, materials, transforms and cameras stay exact. Front alpha loss has two separated one-pixel apices widening below; restoring indices restores every pixel. No fake ear tags or silhouette paint.",
    "humanApproval": False,
    "CarMeshAssetUsed": False,
    "limits": [
        "Finite semantic silhouette evidence supplements required actual image inspection; not human or independent peer appearance approval.",
        "No normal availability, bike fit, all27, AI or occupied fallback qualification.",
    ],
}
(D / "ear-silhouette-proof.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"status": result["status"], "views": front}, indent=2))
