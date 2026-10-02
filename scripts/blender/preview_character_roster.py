"""Review completed characters in request order, without regenerating their art.

uv run --with pillow python scripts/blender/preview_character_roster.py
"""
from PIL import Image, ImageDraw, ImageFont

from finish_characters import BG, DIRECTIONS, OUT, TEXT, enlarged, read_json

ROSTER = ("cat", "dog", "person", "squirrel", "bear")


def main():
    records = {record["id"]: record for record in read_json(OUT / "characters.json")["characters"]}
    sheets = {}
    for character in ROSTER:
        metadata = read_json(OUT / records[character]["metadata"])
        for size in (32, 16):
            contract = metadata["versions"][str(size)]
            assert contract["fps"] == 4 and contract["durationMs"] == 1000
            sheets[character, size] = Image.open(OUT / contract["image"]).convert("RGBA")
            assert sheets[character, size].size == (size * 4, size * 4)
    frames = []
    font = ImageFont.load_default(size=18)
    for pose in range(4):
        canvas = Image.new("RGB", (1144, 688), BG)
        draw = ImageDraw.Draw(canvas)
        draw.fontmode = "1"
        draw.text((16, 12), "PIXEL ROSTER / 4 POSES / 4 FPS / 1 SECOND", font=font, fill=TEXT)
        for col, character in enumerate(ROSTER):
            x = 84 + col * 212
            draw.text((x, 42), records[character]["name"], font=font, fill=TEXT)
            draw.text((x + 12, 67), "32px (3x)", fill=TEXT)
            draw.text((x + 124, 67), "Native16 (5x)", fill=TEXT)
            for row, direction in enumerate(DIRECTIONS):
                y = 90 + row * 148
                if col == 0:
                    draw.text((12, y + 38), direction.upper(), fill=TEXT)
                for size, scale, offset in ((32, 3, 12), (16, 5, 124)):
                    sheet = sheets[character, size]
                    sprite = sheet.crop((pose * size, row * size, (pose + 1) * size, (row + 1) * size))
                    canvas.paste(enlarged(sprite, scale), (x + offset, y))
                    canvas.paste(enlarged(sprite, 1), (x + offset, y + 104))
        frames.append(canvas)
    frames[0].save(OUT / "roster-overview.png")
    path = OUT / "roster-preview.gif"
    # One shared exact palette, including the label/background colors. Retain
    # unchanged areas between differential frames so labels cannot be disposed.
    colors = sorted({pixel for frame in frames for pixel in frame.get_flattened_data()})
    assert len(colors) <= 256
    palette = Image.new("P", (1, 1))
    palette.putpalette([channel for color in colors for channel in color] + [0] * (768 - len(colors) * 3))
    encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    encoded[0].save(path, save_all=True, append_images=encoded[1:], duration=250, loop=0, disposal=1, optimize=False)
    with Image.open(path) as gif:
        assert gif.n_frames == 4 and gif.info["loop"] == 0
        durations = []
        for pose in range(4):
            gif.seek(pose)
            durations.append(gif.info["duration"])
            assert gif.convert("RGB").tobytes() == frames[pose].tobytes(), "Encoded overview pixels changed"
        assert durations == [250] * 4
    print("Validated roster overview: cat, dog, person, squirrel, bear; both sizes; four directions; 1s loop")


if __name__ == "__main__":
    main()
