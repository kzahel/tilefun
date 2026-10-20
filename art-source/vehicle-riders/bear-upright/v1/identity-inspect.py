"""Compare native approved Bear pixels with same-density actual GLB cardinals; no auto-fit."""

from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

R = next(p for p in Path(__file__).resolve().parents if (p / "AGENTS.md").is_file())
D = R / "data/vehicle-riders/bear-upright"
O = R / "public/demos/vehicle-riders/bear-upright/v1"
ref = R / "public/demos/pixel-characters/bear-32.png"
standing = Image.open(ref).convert("RGBA")
boxes = {"study": (80, 108, 144, 172), "engine": (80, 80, 144, 144)}
# Identical64px hip-centered crop for each camera, all headings fixed; no individual fitting.
sheet = Image.new("RGB", (840, 1240), "#263d37")
draw = ImageDraw.Draw(sheet)
draw.text(
    (4, 4),
    "Approved standing / actual GLB study / actual GLB game; common4x nearest pixels",
    fill="white",
)
rows = []
for j, (name, row, index) in enumerate(
    [("front", 0, 4), ("back", 1, 12), ("profile-left", 2, 0), ("profile-right", 3, 8)]
):
    y = j * 300 + 30
    draw.text((4, y), name, fill="white")
    s = standing.crop((0, row * 32, 32, (row + 1) * 32))
    cell = Image.new("RGBA", (64, 64))
    cell.paste(s, (16, 16))
    cell = cell.resize((256, 256), Image.Resampling.NEAREST)
    sheet.paste(cell, (8, y + 20), cell)
    bounds = {}
    for k, mode in enumerate(["study", "engine"]):
        p = D / "captures" / f"rider-{mode}-{index}.png"
        im = Image.open(p).convert("RGBA")
        bounds[mode] = im.getbbox()
        crop = im.crop(boxes[mode])
        crop = crop.resize((256, 256), Image.Resampling.NEAREST)
        sheet.paste(crop, (280 + k * 280, y + 20), crop)
    rows.append(
        {
            "label": name,
            "approvedRow": row,
            "actualYaw": index * 22.5,
            "standingBounds": s.getbbox(),
            "actualNativeBounds": bounds,
        }
    )
sheet.save(D / "identity-comparison.png")
receipt = {
    "status": "author-comparative-inspection-pending-human-review",
    "humanApproval": False,
    "riderSha256": hashlib.sha256((O / "rider.glb").read_bytes()).hexdigest(),
    "approvedStandingSha256": hashlib.sha256(ref.read_bytes()).hexdigest(),
    "pixelComparison": "One fixed64px hip-centered crop per camera across all headings; integer4x display only, no individual pose normalization/auto-fit. Standing frames retain32px in a64px padded cell. Different standing/seated poses and fixed3D camera mean no pixel-equivalence claim.",
    "views": rows,
    "observations": [
        "Stocky brown torso, broad head, two round ear solids, tan muzzle/belly, wide closed paws and tiny fixed tail are retained as distinct animal components.",
        "Head is a rounded ellipsoid with approved Bear front/back/profile paint; projected muzzle and nose are solids, not a face billboard.",
        "Short upper/lower limb center lengths and head/torso dimensions are inferred once, independent of target reach. No Explorer clothes/head/body used.",
    ],
    "uncertainty": [
        "Approved sprite art has no unique depth/skeleton. Template depths, pelvis center, joint centers and seated flexion are inferred.",
        "Game-camera apparent height varies with yaw because source lateral depth contributes to fixed world projection. No per-angle model/camera scaling applied.",
        "Ear/eye/tail details lose pixels at some headings; seated likeness awaits independent parent/human judgment.",
        "Failed upright Explorer reach is conditional on this fixed inferred upright template, not proof that every possible Bear anatomy or leaning pose is infeasible.",
    ],
}
(D / "identity-inspection.json").write_text(json.dumps(receipt, indent=2) + "\n")
print("Native identity comparison and uncertainty receipt retained")
