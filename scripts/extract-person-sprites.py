#!/usr/bin/env python3
"""Extract walk-cycle sprites from LimeZu premade character sheets.

Source sheets: assets/interiors/2_Characters/Character_Generator/0_Premade_Characters/16x16/
Output: public/assets/sprites/person{1..20}.png (96x128, 6 frames x 4 directions)

Sheet layout (16x16 cells, characters are 16x32 = 2 rows per frame):
  Row pair 0 (y=0-31):   4 idle poses: Down, Up, Left, Right
  Row pair 1 (y=32-63):  24 walk frames: Right(0-5), Up(6-11), Left(12-17), Down(18-23)
  Row pair 2 (y=64-95):  24 run frames (same direction order)
  ... (many more animation rows: sit, sleep, carry, etc.)

Output row order matches Direction enum: Down=0, Up=1, Left=2, Right=3
"""

from PIL import Image
import os

SRC_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "assets/interiors/2_Characters/Character_Generator/0_Premade_Characters/16x16",
)
DST_DIR = os.path.join(os.path.dirname(__file__), "..", "public/assets/sprites")

FRAMES_PER_DIR = 6
FRAME_W = 16
FRAME_H = 32
WALK_ROW_Y = 32  # pixel y where walk cycle starts (row pair 1)

# Source order in sheet: Right(0-5), Up(6-11), Left(12-17), Down(18-23)
# Target rows: Down=0, Up=1, Left=2, Right=3
DIR_MAP = {
    0: 3,  # Down  -> source group 3 (frames 18-23)
    1: 1,  # Up    -> source group 1 (frames 6-11)
    2: 2,  # Left  -> source group 2 (frames 12-17)
    3: 0,  # Right -> source group 0 (frames 0-5)
}

COUNT = 20

for i in range(1, COUNT + 1):
    path = os.path.join(SRC_DIR, f"Premade_Character_{i:02d}.png")
    src = Image.open(path).convert("RGBA")

    out = Image.new("RGBA", (FRAMES_PER_DIR * FRAME_W, 4 * FRAME_H), (0, 0, 0, 0))

    for target_row, src_group in DIR_MAP.items():
        for frame in range(FRAMES_PER_DIR):
            sx = (src_group * FRAMES_PER_DIR + frame) * FRAME_W
            cell = src.crop((sx, WALK_ROW_Y, sx + FRAME_W, WALK_ROW_Y + FRAME_H))
            dx = frame * FRAME_W
            dy = target_row * FRAME_H
            out.paste(cell, (dx, dy))

    out_path = os.path.join(DST_DIR, f"person{i}.png")
    out.save(out_path)
    print(f"Saved {out_path} ({out.width}x{out.height})")

print(f"\nDone! Extracted {COUNT} character walk sprites.")
