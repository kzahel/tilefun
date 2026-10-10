"""Compact native/enlarged QA panels, preserving every frame's fixed anchor."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
output = ROOT / "data/wildlife-pets-084/panels"
output.mkdir(parents=True, exist_ok=True)
batch = json.loads((ROOT / "art-source/wildlife-v2/pet-batch.json").read_text())
for pet in batch["pets"]:
    base = ROOT / f"public/demos/wildlife-v2/{pet['id']}/draft-v1"
    sheet = Image.open(base / "sheet.png").convert("RGBA")
    meta = json.loads((base / "sprite.json").read_text())
    size = meta["frameWidth"]
    frames = [sheet.crop((i*size, row*size, (i+1)*size, (row+1)*size)) for row in range(4) for i in range(sheet.width//size)]
    bounds = [im.getbbox() for im in frames]
    crop = (min(b[0] for b in bounds)-2, min(b[1] for b in bounds)-2, max(b[2] for b in bounds)+2, max(b[3] for b in bounds)+2)
    w, h = crop[2]-crop[0], crop[3]-crop[1]
    for clip_name, clip in meta["clips"].items():
        panel = Image.new("RGBA", ((w+3)*clip["count"], (h+8)*4), "#879b82")
        draw = ImageDraw.Draw(panel)
        for row, facing in enumerate(meta["facings"]):
            draw.text((0, row*(h+8)), facing, fill="white")
            for pose in range(clip["count"]):
                frame = sheet.crop(((clip["start"]+pose)*size, row*size, (clip["start"]+pose+1)*size, (row+1)*size))
                panel.alpha_composite(frame.crop(crop), (pose*(w+3), row*(h+8)+8))
        panel.save(output / f"{pet['id']}-{clip_name}-native.png")
        panel.resize((panel.width*3, panel.height*3), Image.Resampling.NEAREST).save(output / f"{pet['id']}-{clip_name}-3x.png")
