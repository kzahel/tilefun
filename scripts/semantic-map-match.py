#!/usr/bin/env python3
"""Find every exact, grid-aligned occurrence of source sprites without repacking.

Requires Pillow. Transparent RGB is ignored; alpha and visible RGBA must match.
An unmatched result only excludes exact matches at the specified grid spacing.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def normalized(image):
    result = image.convert("RGBA")
    invisible = result.getchannel("A").point(lambda alpha: 255 if alpha == 0 else 0)
    result.paste((0, 0, 0, 0), mask=invisible)
    return result


class Matcher:
    def __init__(self, master, grid=16):
        if grid < 1:
            raise ValueError("Grid spacing must be positive")
        self.master = normalized(master)
        self.grid = grid
        self.indexes = {}

    def index(self, width, height):
        key = (width, height)
        if key not in self.indexes:
            index = {}
            mw, mh = self.master.size
            for y in range(0, mh - height + 1, self.grid):
                for x in range(0, mw - width + 1, self.grid):
                    data = self.master.crop((x, y, x + width, y + height)).tobytes()
                    index.setdefault(hashlib.sha256(data).digest(), []).append((x, y))
            self.indexes[key] = index
        return self.indexes[key]

    def find(self, candidate):
        candidate = normalized(candidate)
        width, height = candidate.size
        mw, mh = self.master.size
        if width > mw or height > mh:
            return []
        if candidate.getchannel("A").getbbox() is None:
            raise ValueError("Fully transparent candidates have no asset identity")
        aw, ah = min(self.grid, width), min(self.grid, height)
        index = self.index(aw, ah)
        # Pick the least frequent sampled anchor; always verify the whole sprite.
        xs = sorted({0, ((width - aw) // self.grid) * self.grid})
        ys = sorted({0, ((height - ah) // self.grid) * self.grid})
        anchors = []
        for sy in ys:
            for sx in xs:
                data = candidate.crop((sx, sy, sx + aw, sy + ah)).tobytes()
                positions = index.get(hashlib.sha256(data).digest(), [])
                anchors.append((len(positions), sx, sy, positions))
        _, sx, sy, positions = min(anchors, key=lambda item: item[0])
        expected = candidate.tobytes()
        matches = []
        for ax, ay in positions:
            x, y = ax - sx, ay - sy
            if x < 0 or y < 0 or x + width > mw or y + height > mh:
                continue
            actual = self.master.crop((x, y, x + width, y + height)).tobytes()
            if actual == expected:
                matches.append([x, y, width, height])
        return sorted(matches, key=lambda rect: (rect[1], rect[0]))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--candidate", required=True, action="append", type=Path)
    parser.add_argument("--grid", type=int, default=16)
    parser.add_argument("--output", type=Path, help="Default: print JSON to stdout")
    args = parser.parse_args()
    candidates = []
    for path in args.candidate:
        candidates.extend(sorted(path.rglob("*.png")) if path.is_dir() else [path])
    candidates = sorted(set(candidates))
    if not candidates:
        parser.error("No candidate PNGs found")
    with Image.open(args.master) as source:
        matcher = Matcher(source, args.grid)
    result = {
        "version": 1,
        "master": {"path": args.master.as_posix(), "sha256": digest(args.master),
                   "size": list(matcher.master.size)},
        "comparison": "Exact RGBA with RGB zeroed only where alpha is zero",
        "search": {"grid": args.grid, "origin": [0, 0], "allOccurrences": True},
        "limitation": "Unmatched means no exact grid-aligned match, not missing art or semantics.",
        "candidates": [],
    }
    for path in candidates:
        with Image.open(path) as candidate:
            record = {"path": path.as_posix(), "sha256": digest(path),
                      "size": list(candidate.size)}
            if candidate.convert("RGBA").getchannel("A").getbbox() is None:
                record.update(status="empty", matches=[])
            else:
                matches = matcher.find(candidate)
                record.update(status="matched" if matches else "unmatched", matches=matches)
        result["candidates"].append(record)
    output = json.dumps(result, indent=2) + "\n"
    if args.output:
        if args.output.resolve() in {p.resolve() for p in [args.master, *candidates]}:
            parser.error("Output must not overwrite a source image")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output)
    else:
        print(output, end="")


if __name__ == "__main__":
    main()
