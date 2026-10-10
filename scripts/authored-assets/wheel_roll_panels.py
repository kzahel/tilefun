"""Compose the wheel-only Blender frames with native-pixel outline treatment."""
import argparse
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from pipeline import read, write
from pixel_style import ink

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--frames", type=Path, required=True)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
if args.out.exists():
    raise FileExistsError("Choose a new wheel animation output.")
record = read(args.frames/"animation.json")
frames, hashes = [], []
for path in sorted(args.frames.glob("frame-*.png")):
    image = Image.open(path).convert("RGBA").resize((80, 80), Image.Resampling.NEAREST)
    hashes.append(hashlib.sha256(image.tobytes()).hexdigest())
    enlarged = ink(image).resize((320, 320), Image.Resampling.NEAREST)
    panel = Image.new("RGB", (360, 370), "#53636b")
    panel.paste(enlarged, (20, 35), enlarged)
    draw = ImageDraw.Draw(panel)
    font = ImageFont.load_default(size=15)
    draw.text((12, 10), "Wheel rotation test · fixed body", fill="white", font=font)
    draw.text((12, 346), "Actual mesh frames · source-palette hubs", fill="#d8e0e6", font=font)
    frames.append(panel)
if len(frames) != record["frames"] or len(set(hashes)) <= 4:
    raise ValueError("Missing or stationary wheel frames.")
frames[0].save(args.out, save_all=True, append_images=frames[1:], duration=90, loop=0, disposal=2)
write(args.out.with_suffix(".json"), {**record, "nativeFrameHashes": hashes, "uniqueNativeFrames": len(set(hashes)),
      "gifSha256": hashlib.sha256(args.out.read_bytes()).hexdigest()})
