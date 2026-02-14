#!/usr/bin/env python3
"""Crop player spritesheet from 48x48 cells to 16x16 cells.

The original Sprout Lands player sprite has 48x48 cells but the actual
character is only ~14x16 pixels centered in each cell (16px blank top,
16px blank bottom, ~17px blank left/right).

This extracts the 16x16 content region from each cell and repacks into
a new 64x64 (4x4 grid of 16x16) spritesheet.

Usage: python3 scripts/crop-player-sprite.py [--verify]
"""
import os
import sys
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "..", "public/assets/sprites/player.png")
DST = SRC  # overwrite in place

OLD_CELL = 48
NEW_CELL = 16
# Crop region within each 48x48 cell: top-left corner of the 16x16 content
# Content is at x=17..30, y=16..31 → centered in a 16x16 box starting at (16, 16)
CROP_X = 16
CROP_Y = 16


def main():
    verify_only = "--verify" in sys.argv

    src = Image.open(SRC).convert("RGBA")
    cols = src.width // OLD_CELL
    rows = src.height // OLD_CELL
    print(f"Source: {src.width}x{src.height}, {cols}x{rows} grid of {OLD_CELL}x{OLD_CELL}")
    print(f"Crop region per cell: ({CROP_X}, {CROP_Y}) size {NEW_CELL}x{NEW_CELL}")

    if verify_only:
        # Just verify the crop region contains all content
        pixels = src.load()
        ok = True
        for row in range(rows):
            for col in range(cols):
                for ly in range(OLD_CELL):
                    for lx in range(OLD_CELL):
                        a = pixels[col * OLD_CELL + lx, row * OLD_CELL + ly][3]
                        if a > 0:
                            in_crop = (CROP_X <= lx < CROP_X + NEW_CELL and
                                       CROP_Y <= ly < CROP_Y + NEW_CELL)
                            if not in_crop:
                                print(f"  WARNING: [{row},{col}] pixel at ({lx},{ly}) "
                                      f"is outside crop region!")
                                ok = False
        if ok:
            print("All non-transparent pixels are inside the crop region.")
        return

    out = Image.new("RGBA", (cols * NEW_CELL, rows * NEW_CELL), (0, 0, 0, 0))

    for row in range(rows):
        for col in range(cols):
            sx = col * OLD_CELL + CROP_X
            sy = row * OLD_CELL + CROP_Y
            cell = src.crop((sx, sy, sx + NEW_CELL, sy + NEW_CELL))
            out.paste(cell, (col * NEW_CELL, row * NEW_CELL))

    out.save(DST)
    print(f"Saved {DST} ({out.width}x{out.height})")

    # Verify result
    print("\nVerifying cropped sprite:")
    os.system(f'python3 {os.path.join(os.path.dirname(__file__), "sprite-bounds.py")} '
              f'{DST} {NEW_CELL} {NEW_CELL}')


if __name__ == "__main__":
    main()
