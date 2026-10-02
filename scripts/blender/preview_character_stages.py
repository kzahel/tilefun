"""Compare the real shared Blender model with authored 32px/native16 art.

uv run --with pillow python scripts/blender/preview_character_stages.py
Add --pack-reference after running render_tiger_reference.py inside Blender.
Only the tiger has a 3D model. Other rows explicitly reuse its pose reference.
"""
import argparse
import json

from PIL import Image, ImageDraw, ImageFont

from finish_characters import BG, DIRECTIONS, OUT, REPO, TEXT, read_json
from preview_character_roster import ROSTER

TIGER = REPO / "public" / "demos" / "blender-tiger"
REFERENCE = TIGER / "tiger-reference-3d.png"
FRAMES = (1, 3, 5, 7)
WIDTH, HEADER, ROW_HEIGHT = 1840, 152, 192
STAGE_X = (180, 732, 1284)


def pack_reference():
    sheet = Image.new("RGBA", (512, 512))
    for row, direction in enumerate(DIRECTIONS):
        for col, frame in enumerate(FRAMES):
            with Image.open(REPO / "data" / "blender-tiger" / "comparison-reference" / f"{direction}-{frame:02}.png") as raw:
                assert raw.size == (128, 128)
                sheet.paste(raw.convert("RGBA"), (col * 128, row * 128))
    sheet.save(REFERENCE)
    (TIGER / "tiger-reference-3d.json").write_text(json.dumps({
        "image": REFERENCE.name, "frameWidth": 128, "frameHeight": 128,
        "frames": list(FRAMES), "directions": list(DIRECTIONS),
        "source": "art-source/blender/tiger.blend",
        "renderer": "scripts/blender/render_tiger_reference.py",
        "description": "Original tiger geometry, camera, lighting and 3D eyes. No palette mapping, pixel eye patch or authored finish. Other characters reuse its projected pose guides; they have no separate 3D models."
    }, indent=2) + "\n", encoding="utf-8")


def compose(pose, names, sheets, reference):
    canvas = Image.new("RGB", (WIDTH, HEADER + len(names) * ROW_HEIGHT + 56), BG)
    draw = ImageDraw.Draw(canvas)
    title = ImageFont.load_default(size=25)
    heading = ImageFont.load_default(size=19)
    body = ImageFont.load_default(size=15)
    draw.text((20, 14), "BLENDER REFERENCE / AUTHORED 32px / NATIVE 16px", font=title, fill=TEXT)
    draw.text((20, 49), "Only Tiger has a 3D model. The other characters reuse its pose guides; their first column is the shared Tiger reference.", font=body, fill=TEXT)
    for x, label, subtitle in zip(STAGE_X,
                                 ("Original Blender render", "Authored 32px", "Separately authored 16px"),
                                 ("128px render, original 3D eyes", "32px pixels enlarged 4x", "16px pixels enlarged 8x")):
        draw.text((x, 82), label, font=heading, fill=TEXT)
        draw.text((x, 106), subtitle, font=body, fill=TEXT)
        for row, direction in enumerate(DIRECTIONS):
            draw.text((x + row * 136 + 40, 131), direction.upper(), fill=TEXT)
    for index, (character, name) in enumerate(names):
        y = HEADER + index * ROW_HEIGHT
        draw.rectangle((12, y, WIDTH - 12, y + ROW_HEIGHT - 6), fill=(239, 243, 240))
        draw.text((24, y + 18), name, font=body, fill=TEXT)
        draw.text((24, y + 44), "Own 3D model" if character == "tiger" else "Shared Tiger guide", fill=TEXT)
        for row, direction in enumerate(DIRECTIONS):
            for stage, size in enumerate((128, 32, 16)):
                x = STAGE_X[stage] + row * 136
                sheet = reference if stage == 0 else sheets[character, size]
                sprite = sheet.crop((pose * size, row * size, (pose + 1) * size, (row + 1) * size))
                enlarged = sprite.resize((128, 128), Image.Resampling.NEAREST)
                canvas.paste(enlarged, (x, y + 8), enlarged)
                if stage != 0:
                    canvas.paste(sprite, (x + (128 - size) // 2, y + 142), sprite)
    draw.text((24, canvas.height - 38), f"Blender pose {FRAMES[pose]} / matched direction and guide timing / actual-size pixel samples beneath / original assets preserved", font=body, fill=TEXT)
    return canvas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack-reference", action="store_true")
    args = parser.parse_args()
    if args.pack_reference:
        pack_reference()
    reference = Image.open(REFERENCE).convert("RGBA")
    assert reference.size == (512, 512)
    records = {record["id"]: record for record in read_json(OUT / "characters.json")["characters"]}
    names = [("tiger", "Original Tiger")] + [(character, records[character]["name"]) for character in ROSTER]
    sheets = {}
    for character, _ in names:
        for size in (32, 16):
            if character == "tiger":
                path = TIGER / f"tiger-finished-{size}.png"
            else:
                contract = read_json(OUT / records[character]["metadata"])["versions"][str(size)]
                path = OUT / contract["image"]
            sheet = Image.open(path).convert("RGBA")
            assert sheet.size == (size * 4, size * 4)
            sheets[character, size] = sheet
    # PNG retains the continuous 3D colors exactly; GIF quantization would alter them.
    for pose in range(4):
        frame = compose(pose, names, sheets, reference)
        path = OUT / ("three-way-comparison.png" if pose == 0 else f"three-way-comparison-pose-{FRAMES[pose]}.png")
        frame.save(path)
        with Image.open(path) as encoded:
            assert encoded.convert("RGB").tobytes() == frame.tobytes()
    print("Exported four lossless comparison sheets: real Tiger 3D reference, authored32, native16; all six characters/four directions")


if __name__ == "__main__":
    main()
