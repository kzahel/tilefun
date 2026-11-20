"""Compose matched sprite/model motion studies from the exported cat captures."""
import hashlib
import json
import random
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "data/experiments/cat")
ROOT = Path(__file__).resolve().parents[3]
SPRITE = ROOT / "public/demos/wildlife-v2/cat/finish-v1"
METADATA = json.loads((SPRITE / "sprite.json").read_text())
assert hashlib.sha256((SPRITE / "sheet.png").read_bytes()).hexdigest() == METADATA["sheetSha256"]
SHEET = Image.open(SPRITE / "sheet.png").convert("RGBA")
FRAMES = json.loads((DIR / "renders/frames.json").read_text())["jobs"]
COUNTS = {(job["view"], job["clip"]): job["frame"] + 1 for job in FRAMES}
FACING = {"front": 0, "back": 1, "left": 2, "right": 3}
DARK, INK, MUTED = "#171f23", "#f5f0e2", "#b4c5bd"
FIELD = (118, 146, 118)
NATIVE_SIZE = (100, 56)
ANCHOR = (50, 40)
FPS = 24


@lru_cache
def font(size, bold=False):
    return ImageFont.truetype("Helvetica.ttc", size=size, index=1 if bold else 0)


def label(draw, xy, value, size=20, fill=INK, bold=False, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


@lru_cache
def source_frame(clip, view, frame):
    w, h = METADATA["frameWidth"], METADATA["frameHeight"]
    index = METADATA["clips"][clip.lower()]["start"] + frame
    row = FACING[view]
    return SHEET.crop((index * w, row * h, (index + 1) * w, (row + 1) * h))


@lru_cache
def model_frame(clip, view, frame):
    return Image.open(DIR / "renders" / f"{view}-{clip}-{frame}.png").convert("RGBA")


def patch():
    image = Image.new("RGB", NATIVE_SIZE, FIELD)
    draw = ImageDraw.Draw(image)
    rng = random.Random(19)
    for _ in range(36):
        x, y = rng.randrange(3, 98), rng.randrange(6, 54)
        if y < 21 or abs(x - 50) > 26:
            color = rng.choice([(113, 141, 113), (124, 151, 120), (127, 153, 122)])
            draw.line((x, y, x + rng.randrange(1, 4), y), fill=color)
    return image


GROUND = patch()


def field(kind, clip, phase, view="right", shift=0, ball=None):
    image = GROUND.copy()
    ox, oy = ANCHOR[0] + shift, ANCHOR[1]
    draw = ImageDraw.Draw(image)
    shadow_size = (6, 2) if view in ("left", "right") else (4, 4)
    if clip == "Pounce" and .34 < phase < .71:
        shadow_size = (shadow_size[0] - 1, shadow_size[1])
    hx, hy = shadow_size
    draw.ellipse((ox - hx, oy - hy + 1, ox + hx, oy + hy + 1), fill=(100, 126, 100))
    if ball is not None:
        draw.ellipse((ball - 2, oy - 3, ball + 2, oy + 1), fill="#9d5c48")
        draw.point((ball - 1, oy - 2), fill="#efac7d")
        draw.point((ball, oy - 2), fill="#c9845d")
    if kind == "sprite":
        count = METADATA["clips"][clip.lower()]["count"]
        sprite = source_frame(clip, view, min(count - 1, int(phase * count)))
        ax, ay = METADATA["anchor"]
        image.paste(sprite, (ox - ax, oy - ay), sprite)
    else:
        count = COUNTS[(view, clip)]
        frame = model_frame(clip, view, min(count - 1, int(phase * count)))
        image.paste(frame, (shift, 0), frame)
    return image


def zoom(image, size):
    return image.resize(size, Image.Resampling.NEAREST)


def portrait_field(clip, phase):
    count = COUNTS[("portrait", clip)]
    portrait = model_frame(clip, "portrait", min(count - 1, int(phase * count)))
    card = Image.new("RGB", portrait.size, FIELD)
    shadow = ImageDraw.Draw(card)
    shadow.ellipse((185, 281, 371, 319), fill=(104, 130, 104))
    card.paste(portrait, (0, 0), portrait)
    return card


def video_frame(clip, phase, shift, ball, subtitle, detail=False):
    image = Image.new("RGB", (1088, 438), DARK)
    draw = ImageDraw.Draw(image)
    label(draw, (32, 24), "Tuxedo cat", 36, bold=True)
    label(draw, (1054, 34), subtitle, 22, MUTED, anchor="ra")
    label(draw, (32, 88), "Current sprite", 20, bold=True)
    label(draw, (556, 88), "3D close-up" if detail else "3D cat draft", 20, bold=True)
    view = "front" if clip == "Idle" else "right"
    image.paste(zoom(field("sprite", clip, phase, view, shift, ball), (500, 280)), (32, 122))
    if detail:
        draw.rectangle((556, 122, 1055, 401), fill=FIELD)
        image.paste(portrait_field(clip, phase).resize((459, 280), Image.Resampling.LANCZOS), (576, 122))
    else:
        image.paste(zoom(field("model", clip, phase, view, shift, ball), (500, 280)), (556, 122))
    caption = "Sprite at native game scale, enlarged 5×" if detail else "Native game scale, enlarged 5×"
    label(draw, (32, 414), caption, 15, MUTED)
    return image


def video():
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", "1088x438",
        "-framerate", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
        "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(DIR / "cat-side-by-side.mp4"),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin
    # Walk and idle at authored tempo; pounce at authored tempo and half speed.
    for frame in range(60):
        seconds = frame / FPS
        phase = (seconds / .64) % 1
        process.stdin.write(video_frame("Walk", phase, round(-16 + seconds * 13.8), None, "Walk").tobytes())
    for speed, subtitle, detail in (
        (1, "Stalk and pounce", False),
        (.5, "Stalk and pounce · half speed", False),
        (.63, "Stalk and pounce · close-up", True),
    ):
        for frame in range(round(2.16 / speed * FPS)):
            seconds = frame / FPS * speed
            if seconds < 1:
                clip, phase, shift, ball = "Stalk", seconds, round(-13 + 8 * seconds), 62
            else:
                clip, phase = "Pounce", min(1, (seconds - 1) / .64)
                travel = max(0, min(1, (phase - .20) / .54))
                shift = round(-5 + 13 * travel)
                ball = 62 + round(max(0, seconds - (1 + .64 * .72)) * 19)
            process.stdin.write(video_frame(clip, phase, shift, ball, subtitle, detail).tobytes())
    for frame in range(48):
        process.stdin.write(video_frame("Idle", frame / 48, 0, None, "Idle · front").tobytes())
    process.stdin.close()
    assert process.wait() == 0


def animation_sheet(clip, steps, headline, file):
    image = Image.new("RGB", (1088, 440), DARK)
    draw = ImageDraw.Draw(image)
    label(draw, (30, 20), headline, 32, bold=True)
    label(draw, (1058, 29), "Native game scale, enlarged 5×", 16, MUTED, anchor="ra")
    for row, (kind, title) in enumerate((("sprite", "Current sprite"), ("model", "3D cat draft"))):
        y = 105 + row * 152
        label(draw, (30, y + 48), title, 19, bold=True)
        for column, (phase, name) in enumerate(steps):
            x = 176 + 223 * column
            ox = 62 if clip == "Pounce" else None
            frame = field(kind, clip, phase, ball=ox)
            frame = frame.crop((29, 23, 71, 47))
            image.paste(zoom(frame, (210, 120)), (x, y))
            if row == 0:
                label(draw, (x, y - 28), name, 16, MUTED)
    image.save(DIR / file)


def appearance():
    image = Image.new("RGB", (1040, 500), DARK)
    draw = ImageDraw.Draw(image)
    label(draw, (28, 18), "Tuxedo cat in two views", 32, bold=True)
    label(draw, (28, 76), "Current sprite", 19, bold=True)
    label(draw, (251, 76), "3D cat draft", 19, bold=True)
    label(draw, (475, 76), "3D close-up", 19, bold=True)
    for row, (clip, view, phase) in enumerate((("Walk", "right", 0), ("Idle", "front", .23))):
        for kind, x in (("sprite", 28), ("model", 251)):
            crop = field(kind, clip, phase, view).crop((32, 17, 68, 47))
            image.paste(zoom(crop, (216, 180)), (x, 108 + row * 190))
    image.paste(portrait_field("Idle", 0), (475, 108))
    label(draw, (475, 460), "Three-quarter view of the Blender model", 16, MUTED)
    image.save(DIR / "cat-appearance.png")


def native_comparison():
    rows = [
        ("Idle", "front", 0), ("Idle", "back", 0),
        ("Walk", "left", 0), ("Walk", "right", .25),
        ("Pounce", "right", .14), ("Pounce", "right", .53),
    ]
    image = Image.new("RGB", (200, 56 * len(rows)))
    for i, (clip, view, phase) in enumerate(rows):
        image.paste(field("sprite", clip, phase, view), (0, i * 56))
        image.paste(field("model", clip, phase, view), (100, i * 56))
    image.save(DIR / "cat-native.png")


def main():
    # Require real silhouettes and motion before writing any review media.
    for view, clip in COUNTS:
        assert model_frame(clip, view, 0).getbbox(), (view, clip)
        if view == "portrait":
            for i in range(COUNTS[(view, clip)]):
                image = model_frame(clip, view, i)
                left, top, right, bottom = image.getbbox()
                assert 0 < left < right < image.width, (clip, i)
                assert 0 < top < bottom < image.height, (clip, i)
    for clip in ("Walk", "Stalk", "Pounce"):
        frames = [model_frame(clip, "right", i).tobytes() for i in range(COUNTS[("right", clip)])]
        assert len(set(frames)) > 5, clip
    animation_sheet("Walk", [(0, "Reach"), (.25, "Plant"), (.5, "Opposite reach"),
                              (.75, "Opposite plant")], "Walk · four poses", "cat-walk.png")
    animation_sheet("Pounce", [(.14, "Coil"), (.37, "Launch"), (.53, "Airborne"),
                                (.78, "Land")], "Pounce · four poses", "cat-pounce.png")
    appearance()
    native_comparison()
    video()


if __name__ == "__main__":
    main()
