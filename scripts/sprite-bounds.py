#!/usr/bin/env python3
"""
Analyze a spritesheet PNG to find the tight bounding box of non-transparent
pixels in each cell. Outputs per-cell bounds and a global summary.

Usage: python3 scripts/sprite-bounds.py <png> <cellW> <cellH>
Example: python3 scripts/sprite-bounds.py public/assets/sprites/player.png 48 48
"""
import sys
from PIL import Image

def main():
    if len(sys.argv) < 4:
        print("Usage: python3 scripts/sprite-bounds.py <png> <cellW> <cellH>")
        sys.exit(1)

    png_path = sys.argv[1]
    cell_w = int(sys.argv[2])
    cell_h = int(sys.argv[3])

    img = Image.open(png_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    cols = width // cell_w
    rows = height // cell_h

    print(f"Image: {width}x{height}, cell: {cell_w}x{cell_h}, grid: {cols}x{rows}\n")

    g_min_x, g_min_y = cell_w, cell_h
    g_max_x, g_max_y = -1, -1

    for row in range(rows):
        for col in range(cols):
            min_x, min_y = cell_w, cell_h
            max_x, max_y = -1, -1

            for ly in range(cell_h):
                for lx in range(cell_w):
                    px = col * cell_w + lx
                    py = row * cell_h + ly
                    a = pixels[px, py][3]
                    if a > 0:
                        min_x = min(min_x, lx)
                        max_x = max(max_x, lx)
                        min_y = min(min_y, ly)
                        max_y = max(max_y, ly)

            if max_x >= 0:
                w = max_x - min_x + 1
                h = max_y - min_y + 1
                blank_top = min_y
                blank_bottom = cell_h - 1 - max_y
                print(f"  [{row},{col}] bounds: x={min_x}..{max_x} y={min_y}..{max_y}  "
                      f"size={w}x{h}  blankTop={blank_top} blankBottom={blank_bottom}")
                g_min_x = min(g_min_x, min_x)
                g_min_y = min(g_min_y, min_y)
                g_max_x = max(g_max_x, max_x)
                g_max_y = max(g_max_y, max_y)
            else:
                print(f"  [{row},{col}] (empty)")

    if g_max_x < 0:
        print("\nNo non-transparent pixels found!")
        return

    gw = g_max_x - g_min_x + 1
    gh = g_max_y - g_min_y + 1
    blank_top = g_min_y
    blank_bottom = cell_h - 1 - g_max_y

    print(f"\nGlobal tight box: x={g_min_x}..{g_max_x} y={g_min_y}..{g_max_y}  size={gw}x{gh}")
    print(f"Blank: top={blank_top}px  bottom={blank_bottom}px  left={g_min_x}px  right={cell_w - 1 - g_max_x}px")
    print(f"\nSuggested: spriteWidth={gw}, spriteHeight={gh}, srcOffsetX={g_min_x}, srcOffsetY={g_min_y}")

if __name__ == "__main__":
    main()
