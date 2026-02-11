#!/usr/bin/env python3
"""
Determine the actual bitmask layout of ME autotile sheets by comparing each cell
against the known mask-255 cell (solid primary fill at position (1,0)).

For each cell, we compute pixel differences from the solid fill tile, then
determine which quadrants have differences to reconstruct the bitmask.

A blob autotile 16x16 tile is implicitly composed of four 8x8 quadrants:
  NW(0,0)  NE(8,0)
  SW(0,8)  SE(8,8)

For mask 255 (all neighbors), all quadrants show pure primary.
When a cardinal/diagonal neighbor is missing, specific quadrants change.
The key insight: each quadrant is affected by its two adjacent cardinals
and one diagonal. By measuring how much each quadrant differs from the
solid fill, we can determine which neighbors are absent.

Quadrant relationships:
  NW quadrant → affected by N, W, NW neighbors
  NE quadrant → affected by N, E, NE neighbors
  SW quadrant → affected by S, W, SW neighbors
  SE quadrant → affected by S, E, SE neighbors
"""

from PIL import Image
import sys

TILE = 16
HALF = 8
COLS = 12
ROWS = 4


def analyze_sheet(path):
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    # Extract all pixels for a cell as a flat list of (r,g,b,a)
    def get_cell(col, row):
        x0, y0 = col * TILE, row * TILE
        result = []
        for dy in range(TILE):
            for dx in range(TILE):
                result.append(pixels[x0 + dx, y0 + dy])
        return result

    # Find transparent cell
    unused = None
    for row in range(ROWS):
        for col in range(COLS):
            cell = get_cell(col, row)
            if all(p[3] < 128 for p in cell):
                unused = (col, row)
    print(f"Unused cell: {unused}")

    # Reference: mask 255 = solid fill at (1, 0)
    ref_cell = get_cell(1, 0)
    ref_rgb = [(p[0], p[1], p[2]) for p in ref_cell]

    def pixel_diff(p1, p2):
        """Squared color distance between two RGB tuples."""
        return sum((p1[i] - p2[i]) ** 2 for i in range(3))

    def quadrant_diff(cell_pixels, qx, qy):
        """
        Compute average pixel difference from reference in a quadrant.
        qx, qy: quadrant offsets (0 or 8) within the 16x16 tile.
        """
        total = 0.0
        count = 0
        for dy in range(HALF):
            for dx in range(HALF):
                idx = (qy + dy) * TILE + (qx + dx)
                r, g, b, a = cell_pixels[idx]
                if a < 128:
                    # Transparent pixel = definitely different from primary
                    total += 10000
                    count += 1
                    continue
                total += pixel_diff((r, g, b), ref_rgb[idx])
                count += 1
        return total / count if count > 0 else 0

    # For each cell, compute the 4 quadrant differences
    results = []
    all_qdiffs = []  # for threshold analysis

    for row in range(ROWS):
        for col in range(COLS):
            cell = get_cell(col, row)
            if all(p[3] < 128 for p in cell):
                results.append({"col": col, "row": row, "mask": -1, "qdiffs": (0, 0, 0, 0)})
                continue

            nw_diff = quadrant_diff(cell, 0, 0)
            ne_diff = quadrant_diff(cell, HALF, 0)
            sw_diff = quadrant_diff(cell, 0, HALF)
            se_diff = quadrant_diff(cell, HALF, HALF)

            results.append({
                "col": col, "row": row,
                "qdiffs": (nw_diff, ne_diff, sw_diff, se_diff),
                "mask": None
            })
            all_qdiffs.extend([nw_diff, ne_diff, sw_diff, se_diff])

    # Find threshold: quadrants that are "same as primary" vs "different"
    # The distribution should be bimodal: near-zero for matching quadrants,
    # large for non-matching.
    sorted_diffs = sorted(d for d in all_qdiffs if d > 0)
    if sorted_diffs:
        # Find the gap in the distribution
        max_gap = 0
        gap_idx = 0
        for i in range(1, len(sorted_diffs)):
            gap = sorted_diffs[i] - sorted_diffs[i-1]
            if gap > max_gap:
                max_gap = gap
                gap_idx = i
        threshold = (sorted_diffs[gap_idx-1] + sorted_diffs[gap_idx]) / 2 if gap_idx > 0 else sorted_diffs[0] / 2
    else:
        threshold = 100

    print(f"Auto threshold: {threshold:.1f}")
    print(f"  Diffs range: {min(sorted_diffs):.1f} to {max(sorted_diffs):.1f}")
    print(f"  Gap at: below={sorted_diffs[gap_idx-1]:.1f}, above={sorted_diffs[gap_idx]:.1f}")

    # Now classify using quadrant logic.
    # A blob autotile's quadrant structure:
    #
    # In a blob tile, when we remove a CARDINAL neighbor, it affects 2 quadrants
    # (the two on that side). When we remove a DIAGONAL, it affects 1 quadrant.
    # But we can only detect "quadrant differs from solid fill" — we can't directly
    # separate cardinal from diagonal effects.
    #
    # However, we can use the DEGREE of difference:
    # - Cardinal absent: the half-edge on that side changes (large diff, ~half the quadrant)
    # - Only diagonal absent: just the corner notch changes (smaller diff)
    #
    # Let's use two thresholds:
    # - "definitely different" (cardinal missing on this side)
    # - "slightly different" (only corner notch = diagonal missing)
    #
    # Actually, let's try a different approach: use sub-quadrant sampling.
    # Split each 8x8 quadrant into its edge region (outer 3px) vs inner region.

    def sub_region_diff(cell_pixels, x_start, y_start, x_size, y_size):
        """Diff from reference for a sub-region."""
        total = 0.0
        count = 0
        for dy in range(y_size):
            for dx in range(x_size):
                px = x_start + dx
                py = y_start + dy
                idx = py * TILE + px
                r, g, b, a = cell_pixels[idx]
                if a < 128:
                    total += 10000
                    count += 1
                    continue
                total += pixel_diff((r, g, b), ref_rgb[idx])
                count += 1
        return total / count if count > 0 else 0

    # Re-analyze with finer-grained regions
    # For each cell, check 8 regions:
    # - N edge: top 3 rows, middle 10 columns (avoid corners)
    # - S edge: bottom 3 rows, middle 10 columns
    # - W edge: left 3 cols, middle 10 rows
    # - E edge: right 3 cols, middle 10 rows
    # - NW corner: top-left 4x4
    # - NE corner: top-right 4x4
    # - SW corner: bottom-left 4x4
    # - SE corner: bottom-right 4x4

    for entry in results:
        if entry["mask"] == -1:
            continue
        col, row = entry["col"], entry["row"]
        cell = get_cell(col, row)

        # Cardinal edges (middle section, avoiding corners)
        n_diff = sub_region_diff(cell, 3, 0, 10, 3)
        s_diff = sub_region_diff(cell, 3, 13, 10, 3)
        w_diff = sub_region_diff(cell, 0, 3, 3, 10)
        e_diff = sub_region_diff(cell, 13, 3, 3, 10)

        # Corner 4x4 regions
        nw_diff = sub_region_diff(cell, 0, 0, 4, 4)
        ne_diff = sub_region_diff(cell, 12, 0, 4, 4)
        sw_diff = sub_region_diff(cell, 0, 12, 4, 4)
        se_diff = sub_region_diff(cell, 12, 12, 4, 4)

        entry["edges"] = (n_diff, w_diff, e_diff, s_diff)
        entry["corners"] = (nw_diff, ne_diff, sw_diff, se_diff)

    # Gather all edge diffs and corner diffs separately to find thresholds
    all_edge_diffs = []
    all_corner_diffs = []
    for entry in results:
        if entry["mask"] == -1 or "edges" not in entry:
            continue
        all_edge_diffs.extend(entry["edges"])
        all_corner_diffs.extend(entry["corners"])

    def find_threshold(diffs, label):
        sorted_d = sorted(diffs)
        max_gap = 0
        gap_idx = 0
        for i in range(1, len(sorted_d)):
            gap = sorted_d[i] - sorted_d[i-1]
            if gap > max_gap:
                max_gap = gap
                gap_idx = i
        if gap_idx > 0:
            thresh = (sorted_d[gap_idx-1] + sorted_d[gap_idx]) / 2
        else:
            thresh = sorted_d[-1] / 2 if sorted_d else 100
        print(f"  {label} threshold: {thresh:.1f} (gap: {sorted_d[gap_idx-1]:.1f} | {sorted_d[gap_idx]:.1f})")
        return thresh

    edge_thresh = find_threshold(all_edge_diffs, "Edge")
    corner_thresh = find_threshold(all_corner_diffs, "Corner")

    # Classify each cell
    for entry in results:
        if entry["mask"] == -1 or "edges" not in entry:
            continue
        n_diff, w_diff, e_diff, s_diff = entry["edges"]
        nw_diff, ne_diff, sw_diff, se_diff = entry["corners"]

        # Cardinal: edge is primary (neighbor present) if diff is small
        n = n_diff < edge_thresh
        w = w_diff < edge_thresh
        e = e_diff < edge_thresh
        s = s_diff < edge_thresh

        mask = 0
        if n: mask |= 1
        if w: mask |= 2
        if e: mask |= 4
        if s: mask |= 8
        # Diagonal: corner is primary only if both adjacent cardinals are present
        if n and w and nw_diff < corner_thresh: mask |= 16
        if n and e and ne_diff < corner_thresh: mask |= 32
        if s and w and sw_diff < corner_thresh: mask |= 64
        if s and e and se_diff < corner_thresh: mask |= 128

        entry["mask"] = mask

    # Print grid
    print(f"\nReconstructed bitmask grid:")
    print(f"{'':>7}", end="")
    for c in range(COLS):
        print(f" col{c:2d}", end="")
    print()
    for r in range(ROWS):
        print(f"row {r}: ", end="")
        for c in range(COLS):
            entry = results[r * COLS + c]
            m = entry["mask"]
            if m < 0:
                print(f"   -- ", end="")
            else:
                print(f"  {m:3d} ", end="")
        print()

    # Validate
    from collections import Counter
    masks = [r["mask"] for r in results if r["mask"] >= 0]
    mask_counts = Counter(masks)
    expected_47 = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                   19, 23, 27, 31, 37, 39, 45, 47, 55, 63, 74, 75, 78, 79, 91,
                   95, 111, 127, 140, 141, 142, 143, 159, 173, 175, 191, 206,
                   207, 223, 239, 255}

    present = set(masks)
    missing = expected_47 - present
    extra = present - expected_47
    duplicated = {m: c for m, c in mask_counts.items() if c > 1 and m >= 0}

    print(f"\nValidation:")
    print(f"  Unique masks: {len(set(masks))} (expected 47)")
    if missing:
        print(f"  Missing: {sorted(missing)}")
    if extra:
        print(f"  Unexpected: {sorted(extra)}")
    if duplicated:
        print(f"  Duplicated: {duplicated}")
    if not missing and not extra and not duplicated:
        print(f"  PERFECT: all 47 canonical masks!")

    # Output mapping
    if not missing and not extra and not duplicated:
        print(f"\nCorrect mapping [mask, col, row]:")
        for entry in sorted(results, key=lambda e: e["mask"]):
            if entry["mask"] >= 0:
                print(f"  [{entry['mask']:3d}, {entry['col']:2d}, {entry['row']}],")

    return results


if __name__ == "__main__":
    sheets = sys.argv[1:] or ["public/assets/tilesets/me-autotile-01.png"]
    for s in sheets:
        print(f"\n{'=' * 60}")
        analyze_sheet(s)
