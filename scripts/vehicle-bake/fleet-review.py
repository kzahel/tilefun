"""Create an offline contact sheet/index from exact existing vehicle captures.

This reads assets only. It does not render, scale models, freeze candidates,
change review status or affect game availability. Outputs belong under data/.
"""

import argparse
import base64
import html
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/vehicle-bake/fleet"))
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to(ROOT / "data"), "Review outputs must stay ignored under data"
    output.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / "src/traffic/original-vehicles.json").read_text())
    cards = []
    tiles = []
    records = []
    for vehicle in catalog["vehicles"]:
        name = vehicle["id"]
        if name == "rosso-coupe":
            captures = ROOT / "public/demos/vehicle-bake/captures/a-reduced-projection--mid-fenders-v3"
        else:
            captures = ROOT / f"public/demos/original-vehicles/{name}-v1/captures"
        images = [Image.open(captures / f"{camera}-2.png").convert("RGBA") for camera in ["study", "engine"]]
        crops = [image.crop(image.getbbox()) for image in images]
        records.append((vehicle, crops))
    column_width = max(210, max(crop.width * 2 + 20 for _, crops in records for crop in crops))
    picture_height = max(204, max(crop.height * 2 + 20 for _, crops in records for crop in crops))
    tile_width, tile_height = column_width * 2, picture_height + 56
    for vehicle, crops in records:
        name = vehicle["id"]
        tile = Image.new("RGB", (tile_width, tile_height), "#e0e2e4")
        draw = ImageDraw.Draw(tile)
        draw.text((12, 12), vehicle["name"], fill="#182133")
        for index, crop in enumerate(crops):
            crop = crop.resize((crop.width * 2, crop.height * 2), Image.Resampling.NEAREST)
            tile.paste(crop, (index * column_width + (column_width - crop.width) // 2, 34 + (picture_height - crop.height) // 2), crop)
        draw.text((12, tile_height - 18), "Study / game camera - exact native pixels at 2x", fill="#384253")
        tiles.append(tile)
        buffer = io.BytesIO()
        tile.save(buffer, format="PNG")
        uri = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
        offline = ROOT / f"data/vehicle-bake/{name}-review.html"
        review = f'<a href="{html.escape(offline.as_uri())}">Open interactive exact-model review</a>' if offline.exists() else "Historical coupe pilot"
        cards.append(f'<article><img alt="{html.escape(vehicle["name"])}" src="{uri}"><p>{review}</p><small>Available in Edit → Vehicles and eligible road traffic. Agent QA; formal human review unchanged.</small></article>')
    cols = 3
    sheet = Image.new("RGB", (tile_width * cols, tile_height * math.ceil(len(tiles) / cols)), "#e0e2e4")
    for index, tile in enumerate(tiles):
        sheet.paste(tile, (index % cols * tile_width, index // cols * tile_height))
    sheet.save(output / "fleet.png")
    document = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Original vehicle fleet</title><style>body{font:16px system-ui;background:#202637;color:#eef0f7;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}article{padding:12px;background:#30394d;border-radius:12px}img{width:100%;max-width:420px;image-rendering:pixelated}a{color:#b6deff}small{display:block;margin:12px 0}p{margin:8px 0}</style>'
    document += f'<h1>Original vehicle fleet · {len(tiles)} playable vehicles</h1><p>Cards are thumbnails of existing exported captures. Open a card for native-pixel controls and the exact retained GLB. No network requests. Frozen review pages retain their capture-time integration labels; availability here comes from the current game catalog.</p><main>' + ''.join(cards) + '</main></html>'
    (output / "index.html").write_bytes(document.encode())
    print(json.dumps({"vehicles": len(tiles), "output": str(output)}))


if __name__ == "__main__":
    main()
