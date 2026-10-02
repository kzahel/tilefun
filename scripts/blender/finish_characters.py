"""Export original pixel-pattern characters using committed Blender pose guides.

uv run --with pillow python scripts/blender/finish_characters.py
uv run --with pillow python scripts/blender/finish_characters.py --character cat
No Blender execution, tiger regeneration, or downsampling of native16 art.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "art-source/pixel-characters"
OUT = REPO / "public/demos/pixel-characters"
DIRECTIONS = ("down", "up", "left", "right")
BG, TEXT = (216, 227, 223), (36, 49, 60)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def tile(rows, palette):
    rows = [row.replace(" ", "") for row in rows]
    assert rows and len({len(row) for row in rows}) == 1, rows
    image = Image.new("RGBA", (len(rows[0]), len(rows)))
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            if symbol != ".":
                image.putpixel((x, y), palette[symbol])
    return image


def compose(art, palette, size, direction, pose):
    pieces = {name: tile(rows, palette) for name, rows in art[str(size)].items()}
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)

    def position(point):
        return tuple(math.floor(value * size / 32 + .5) for value in point)

    def paste(name, center, offset=(0, 0)):
        piece = pieces[name]
        if direction == "right":
            piece = ImageOps.mirror(piece)
        cx, cy = position(center)
        xy = (cx - piece.width // 2 + offset[0], cy - piece.height // 2 + offset[1])
        image.alpha_composite(piece, xy)
        return piece, xy

    tail = art.get("tail")
    if tail and "patterns" in tail:
        # Broad furry appendages need authored clusters, not a joint ribbon.
        # Draw behind the character; the complete head remains the top layer.
        name = tail["patterns"][direction][(pose["blenderFrame"] - 1) // 2]
        paste(name, pose["tailCenter"])
    elif tail:
        joints = [position(point) for point in pose["tail"]]
        draw.line(joints, fill=palette[tail["outline"]], width=3 if size == 32 else 1)
        draw.line(joints, fill=palette[tail["fill"]], width=1)
        image.putpixel(joints[-1], palette[tail["tip"]])

    bx, by = position(pose["body"])
    limb = art["limbs"]
    for foot in sorted(pose["feet"], key=lambda point: point[1]):
        fx, fy = position(foot)
        draw.line([(bx, by + 1), (fx, fy - 1)], fill=palette[limb["outline"]], width=3 if size == 32 else 1)
        if size == 32:
            draw.line([(bx, by + 1), (fx, fy - 1)], fill=palette[limb["fill"]], width=1)
        paste("foot", foot, (0, -1 if size == 32 else 0))
    def draw_arm(hand):
        hx, hy = position(hand)
        shoulder = (bx + (2 if hx > bx else -2) if size == 32 else bx, by - 1)
        draw.line([shoulder, (hx, hy - 1)], fill=palette[limb["outline"]], width=3 if size == 32 else 1)
        if size == 32:
            # Clothed characters can use jacket sleeves over different trouser legs.
            draw.line([shoulder, (hx, hy - 1)], fill=palette[limb.get("armFill", limb["fill"])], width=1)
        paste("arm", hand, (0, -2 if size == 32 else -1))

    # A human's near sleeve must swing in front of the jacket/backpack in profile.
    near_arm = limb.get("profileForegroundArm") if direction in ("left", "right") else None
    for index, hand in sorted(enumerate(pose["hands"]), key=lambda item: item[1][1]):
        if index != near_arm:
            draw_arm(hand)
    body = "body" if direction == "down" else "backBody" if direction == "up" else "sideBody"
    paste(body, pose["body"])
    if near_arm is not None:
        draw_arm(pose["hands"][near_arm])
    head = "front" if direction == "down" else "back" if direction == "up" else "profile"
    bob = -1 if size == 16 and pose["blenderFrame"] in (3, 7) else 0
    head_piece, head_xy = paste(head, pose["head"], (0, bob))
    return image, head_piece, head_xy


def verify_frame(frame, head, xy, palette):
    size = frame.width
    bounds = frame.getbbox()
    assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < size and bounds[3] < size, bounds
    assert set(frame.getchannel("A").get_flattened_data()) <= {0, 255}
    assert all(pixel in palette.values() for pixel in frame.get_flattened_data() if pixel[3])
    for y in range(head.height):
        for x in range(head.width):
            pixel = head.getpixel((x, y))
            if pixel[3]:
                assert frame.getpixel((xy[0] + x, xy[1] + y)) == pixel, "Whole head changed"
    # Every visible pixel belongs to one connected silhouette (8-neighbor).
    occupied = {(x, y) for y in range(size) for x in range(size) if frame.getpixel((x, y))[3]}
    pending = [next(iter(occupied))]
    seen = set(pending)
    while pending:
        x, y = pending.pop()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                point = x + dx, y + dy
                if point in occupied and point not in seen:
                    seen.add(point)
                    pending.append(point)
    assert seen == occupied, f"Disconnected pixels: {occupied - seen}"


def enlarged(frame, scale):
    canvas = Image.new("RGB", (frame.width * scale, frame.height * scale), BG)
    sprite = frame.resize(canvas.size, Image.Resampling.NEAREST)
    canvas.paste(sprite, (0, 0), sprite)
    return canvas


def export_character(path):
    art = read_json(path)
    character_id = art["id"]
    assert re.fullmatch(r"[a-z][a-z0-9-]*", character_id) and path.stem == character_id
    guides = read_json(REPO / art["poseGuides"])
    assert guides["grid"] == 32 and guides["frames"] == [1, 3, 5, 7]
    palette = {symbol: tuple(bytes.fromhex(color[1:])) + (255,) for symbol, color in art["palette"].items()}
    assert len(palette) <= 12
    versions, contracts = {}, {}
    for size in (32, 16):
        sheet = Image.new("RGBA", (size * 4, size * 4))
        clips, head_anchors = {}, {}
        for row, direction in enumerate(DIRECTIONS):
            clips[direction], head_anchors[direction] = [], []
            assert len(guides["directions"][direction]) == 4
            overrides = art.get("poseOverrides", {}).get(direction, [{}] * 4)
            assert len(overrides) == 4
            for col, (guide, override) in enumerate(zip(guides["directions"][direction], overrides)):
                frame, head, xy = compose(art, palette, size, direction, {**guide, **override})
                verify_frame(frame, head, xy, palette)
                clips[direction].append(frame)
                head_anchors[direction].append(list(xy))
                sheet.paste(frame, (col * size, row * size))
            assert len({frame.tobytes() for frame in clips[direction]}) == 4, (character_id, size, direction, "Repeated poses")
        filename = f"{character_id}-{size}.png"
        sheet.save(OUT / filename)
        # Check the encoded PNG as well as the composition, including head patches.
        with Image.open(OUT / filename) as encoded:
            assert encoded.size == (size * 4, size * 4)
            assert encoded.convert("RGBA").tobytes() == sheet.tobytes()
        versions[size] = clips
        contracts[str(size)] = {"image": filename, "frameWidth": size, "frameHeight": size,
            "columns": 4, "rows": 4, "fps": 4, "durationMs": 1000, "pivot": [size // 2, 27 if size == 32 else 14],
            "loop": True, "directions": {direction: {"row": row, "frames": 4} for row, direction in enumerate(DIRECTIONS)},
            "headAnchors": head_anchors, "sheetSha256": hashlib.sha256((OUT / filename).read_bytes()).hexdigest()}
    assert any(versions[16][direction][pose].tobytes() != versions[32][direction][pose].resize((16, 16), Image.Resampling.NEAREST).tobytes()
        for direction in DIRECTIONS for pose in range(4)), "Native16 must differ from a downsample"
    metadata = {"id": character_id, "name": art["name"], "versions": contracts, "palette": art["palette"],
        "source": path.relative_to(REPO).as_posix(), "poseGuides": art["poseGuides"], "rig": guides["source"],
        "sourceFrames": guides["frames"], "provenance": art["provenance"],
        "builder": "scripts/blender/finish_characters.py",
        "method": "programmatically composed authored pixel patterns using Blender pose guides; separate native16 patterns",
        "validation": {"binaryAlpha": True, "paletteMembership": True, "padding": True,
            "distinctPosesPerDirection": 4, "wholeHeadsStable": True, "connectedSilhouettes": True}}
    (OUT / f"{character_id}.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    contact = Image.new("RGB", (960, 610), BG)
    draw = ImageDraw.Draw(contact)
    draw.text((16, 12), f"{art['name']} / FOUR POSES / 32px (3x) + NATIVE 16px (6x)", fill=TEXT, font=ImageFont.load_default(size=20))
    for row, direction in enumerate(DIRECTIONS):
        draw.text((12, 75 + row * 138), direction.upper(), fill=TEXT)
        for col in range(4):
            contact.paste(enlarged(versions[32][direction][col], 3), (76 + col * 104, 46 + row * 138))
            contact.paste(enlarged(versions[16][direction][col], 6), (528 + col * 104, 46 + row * 138))
            # Actual-size sprites next to their enlarged equivalents.
            contact.paste(enlarged(versions[32][direction][col], 1), (76 + col * 104, 146 + row * 138))
            contact.paste(enlarged(versions[16][direction][col], 1), (528 + col * 104, 146 + row * 138))
    contact.save(OUT / f"{character_id}-contact-sheet.png")
    previews = []
    for pose in range(4):
        canvas = Image.new("RGB", (768, 320), BG)
        draw = ImageDraw.Draw(canvas)
        for col, direction in enumerate(DIRECTIONS):
            draw.text((col * 192 + 28, 12), direction.upper(), fill=TEXT, font=ImageFont.load_default(size=18))
            canvas.paste(enlarged(versions[32][direction][pose], 4), (col * 192 + 28, 38))
            canvas.paste(enlarged(versions[16][direction][pose], 6), (col * 192 + 44, 190))
            canvas.paste(enlarged(versions[32][direction][pose], 1), (col * 192 + 4, 282))
            canvas.paste(enlarged(versions[16][direction][pose], 1), (col * 192 + 48, 298))
        previews.append(canvas)
    gif_path = OUT / f"{character_id}-preview.gif"
    previews[0].save(gif_path, save_all=True, append_images=previews[1:], duration=250, loop=0, disposal=2)
    with Image.open(gif_path) as gif:
        assert gif.n_frames == 4 and gif.info["loop"] == 0
        duration = 0
        for index in range(4):
            gif.seek(index)
            duration += gif.info["duration"]
        assert duration == 1000
    print(f"Validated {character_id}: 32px + native16, 4 unique poses/direction, stable heads, connected limbs, 1s loop")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", help="Export just this source; registry still includes all completed exports")
    args = parser.parse_args()
    records = sorted(SOURCE.glob("*.json"))
    selected = [path for path in records if not args.character or path.stem == args.character]
    if not selected:
        parser.error("No matching character source")
    OUT.mkdir(parents=True, exist_ok=True)
    for path in selected:
        export_character(path)
    registry = []
    for path in records:
        art = read_json(path)
        if not (OUT / f"{art['id']}.json").is_file():
            continue
        registry.append({"id": art["id"], "name": art["name"], "description": art["description"],
            "metadata": f"{art['id']}.json", "contactSheet": f"{art['id']}-contact-sheet.png",
            "preview": f"{art['id']}-preview.gif"})
    (OUT / "characters.json").write_text(json.dumps({"characters": registry}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
