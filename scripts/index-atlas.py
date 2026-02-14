#!/usr/bin/env python3
"""
Index the Modern Exteriors master tileset by matching singles PNGs.

For each singles PNG, finds its (x, y, w, h) location in the master tileset
using 16x16 cell hashing for fast candidate lookup, then pixel-perfect
verification to eliminate false positives.

Outputs: public/data/me-atlas-index.json (compact grouped-by-theme format)
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from PIL import Image

TILE = 16
REPO = Path(__file__).resolve().parent.parent
ME_DIR = REPO / "assets" / "exteriors" / "Modern_Exteriors_16x16"
MASTER = ME_DIR / "Modern_Exteriors_Complete_Tileset.png"
SINGLES_DIR = ME_DIR / "Modern_Exteriors_Complete_Singles_16x16"
OUT = REPO / "public" / "data" / "me-atlas-index.json"


def normalize_tile(img: Image.Image, x: int, y: int) -> bytes:
    """Extract a 16x16 tile with RGB zeroed where alpha=0 for consistent comparison."""
    tile = img.crop((x, y, x + TILE, y + TILE))
    pixels = list(tile.getdata())
    normalized = []
    for r, g, b, a in pixels:
        if a == 0:
            normalized.extend((0, 0, 0, 0))
        else:
            normalized.extend((r, g, b, a))
    return bytes(normalized)


def hash_tile(img: Image.Image, x: int, y: int) -> str:
    """Hash a 16x16 tile region (RGB normalized where alpha=0)."""
    return hashlib.md5(normalize_tile(img, x, y)).hexdigest()


def is_empty_tile(img: Image.Image, x: int, y: int) -> bool:
    """Check if a 16x16 tile region is fully transparent."""
    region = img.crop((x, y, x + TILE, y + TILE))
    alpha = region.split()[3]
    return alpha.getextrema() == (0, 0)


def pixels_match(single: Image.Image, master: Image.Image, mx: int, my: int) -> bool:
    """Pixel-perfect verification: compare entire single against master region.

    Ignores RGB differences where alpha=0 (visually identical transparent pixels
    may have different RGB values between singles and atlas).
    """
    sw, sh = single.size
    mw, mh = master.size
    if mx + sw > mw or my + sh > mh:
        return False
    s_data = single.getdata()
    m_data = master.crop((mx, my, mx + sw, my + sh)).getdata()
    for (sr, sg, sb, sa), (mr, mg, mb, ma) in zip(s_data, m_data):
        if sa != ma:
            return False
        if sa > 0 and (sr != mr or sg != mg or sb != mb):
            return False
    return True


def build_master_index(master: Image.Image) -> dict[str, list[tuple[int, int]]]:
    """Hash every non-empty 16x16 cell. Returns hash -> [(x,y), ...]"""
    w, h = master.size
    cols, rows = w // TILE, h // TILE
    index: dict[str, list[tuple[int, int]]] = {}
    empty = 0
    for row in range(rows):
        for col in range(cols):
            px, py = col * TILE, row * TILE
            if is_empty_tile(master, px, py):
                empty += 1
                continue
            h_val = hash_tile(master, px, py)
            index.setdefault(h_val, []).append((px, py))
    total = cols * rows
    print(f"Master: {cols}x{rows} = {total} cells, {total - empty} non-empty, {empty} empty")
    print(f"Unique tile hashes: {len(index)}")
    return index


def find_single_in_master(
    single: Image.Image,
    master_index: dict[str, list[tuple[int, int]]],
    master: Image.Image,
) -> tuple[int, int, int, int] | None:
    """Find a singles PNG in the master tileset.

    Uses any non-empty 16x16 cell as anchor for hash lookup,
    then does pixel-perfect verification of the full sprite.
    """
    sw, sh = single.size
    tile_cols = (sw + TILE - 1) // TILE
    tile_rows = (sh + TILE - 1) // TILE

    # Try each non-empty 16x16 cell in the single as an anchor
    for tr in range(tile_rows):
        for tc in range(tile_cols):
            sx, sy = tc * TILE, tr * TILE
            if sx + TILE > sw or sy + TILE > sh:
                continue
            if is_empty_tile(single, sx, sy):
                continue

            cell_hash = hash_tile(single, sx, sy)
            candidates = master_index.get(cell_hash, [])

            for cx, cy in candidates:
                # Infer top-left of the full sprite in master
                mx = cx - sx
                my = cy - sy
                if mx < 0 or my < 0:
                    continue
                # Pixel-perfect verification of entire sprite
                if pixels_match(single, master, mx, my):
                    return (mx, my, sw, sh)

            # If we found candidates but none verified, try next anchor
            # If no candidates at all, also try next anchor

    return None


def main():
    print(f"Loading master tileset: {MASTER}")
    master = Image.open(MASTER).convert("RGBA")
    print(f"Master size: {master.size[0]}x{master.size[1]}")

    print("\nBuilding master cell hash index...")
    master_index = build_master_index(master)

    # Collect singles
    singles = sorted(SINGLES_DIR.rglob("*.png"))
    print(f"\nFound {len(singles)} singles PNGs")

    # themes dict: theme -> { name: [x, y, w, h], ... }
    themes: dict[str, dict[str, list[int]]] = {}
    matched = 0
    unmatched = 0
    unmatched_names = []

    for i, path in enumerate(singles):
        if (i + 1) % 500 == 0:
            print(f"  Progress: {i + 1}/{len(singles)} ({matched} matched, {unmatched} unmatched)")

        name = path.stem
        single = Image.open(path).convert("RGBA")

        loc = find_single_in_master(single, master_index, master)
        if loc:
            x, y, w, h = loc
            # Derive theme and prop name from filename
            if "_16x16_" in name:
                theme, prop_name = name.split("_16x16_", 1)
            else:
                theme, prop_name = "", name
            themes.setdefault(theme, {})[prop_name] = [x, y, w, h]
            matched += 1
        else:
            unmatched += 1
            if len(unmatched_names) < 20:
                unmatched_names.append(f"  {name} ({single.size[0]}x{single.size[1]})")

    print(f"\nResults: {matched} matched, {unmatched} unmatched")
    if unmatched_names:
        print(f"\nSample unmatched:")
        for n in unmatched_names:
            print(n)

    # Sort themes and sprite names for deterministic output
    sorted_themes = {}
    for theme in sorted(themes.keys()):
        sorted_themes[theme] = dict(sorted(themes[theme].items()))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(
            {
                "atlas": "Modern_Exteriors_Complete_Tileset.png",
                "tileSize": TILE,
                "atlasWidth": master.size[0],
                "atlasHeight": master.size[1],
                "matched": matched,
                "unmatched": unmatched,
                "themes": sorted_themes,
            },
            f,
            separators=(",", ":"),
        )
    print(f"\nWrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
