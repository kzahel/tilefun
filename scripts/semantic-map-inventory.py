#!/usr/bin/env python3
"""Pin native semantic-map sources without repacking or changing any art.

Default: write the two inventory JSON artifacts. --check: reproduce and compare
without writes (requires original packs and Pillow for indexed pixel checks).
--check --committed-only: verify the saved ledger and committed inputs on a fresh
clone using only stdlib; this does not verify missing original-pack pixels.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "docs/tactical/053-semantic-tileset-map"
EX = "assets/exteriors/Modern_Exteriors_16x16"
IN = "assets/interiors/1_Interiors/16x16"
EX_SINGLE = EX + "/Modern_Exteriors_Complete_Singles_16x16"
EX_MASTER = EX + "/Modern_Exteriors_Complete_Tileset.png"
COMMITTED_EX = "public/assets/tilesets/me-complete.png"
COMMITTED_IN = "public/assets/tilesets/modern-interiors-atlas.png"
INDEX_EX = "public/data/me-atlas-index.json"
INDEX_IN = "public/data/modern-interiors-atlas.json"
PROVENANCE = [INDEX_EX, INDEX_IN, "scripts/index-atlas.py",
              "scripts/index-interiors-atlas.mjs"]
ROOTS = [EX, IN, "assets/interiors/3_Animated_objects/16x16",
         "assets/interiors/6_Home_Designs"]


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True,
                       separators=(",", ":")) + "\n").encode()


def group(path: str) -> str | None:
    """Classify declared sources by paths, never by presumed object identity."""
    if path in (COMMITTED_EX, COMMITTED_IN):
        return "committed-reference"
    if path.startswith(EX + "/"):
        rel = path[len(EX) + 1:]
        if rel.startswith(("Character_Generator_Addons_16x16/", "ME_Theme_Sorter_16x16/Old_Sorting/")):
            return None
        if "/" not in rel:
            return "exteriors-master"
        parent = rel.split("/")[0]
        return {"Animated_16x16": "exteriors-animations",
                "Autotiles_16x16": "exteriors-autotiles",
                "Modern_Exteriors_Complete_Singles_16x16": "exteriors-complete-singles",
                "ME_Theme_Sorter_16x16": "exteriors-theme-singles" if rel.count("/") > 1
                else "exteriors-theme-sheets"}[parent]
    if path.startswith(IN + "/"):
        rel = path[len(IN) + 1:]
        parent = rel.split("/")[0]
        if parent == "Old stuff":
            return None
        return {"Interiors_16x16.png": "interiors-master",
                "Room_Builder_16x16.png": "interiors-room-builder-master",
                "Room_Builder_subfiles": "interiors-room-builder-subfiles",
                "Theme_Sorter": "interiors-theme-normal",
                "Theme_Sorter_Black_Shadow": "interiors-theme-black-shadow",
                "Theme_Sorter_Shadowless": "interiors-theme-shadowless",
                "Theme_Sorter_Singles": "interiors-singles-normal",
                "Theme_Sorter_Black_Shadow_Singles": "interiors-singles-black-shadow",
                "Theme_Sorter_Shadowless_Singles": "interiors-singles-shadowless"}[parent]
    if path.startswith("assets/interiors/3_Animated_objects/16x16/"):
        return "interiors-animations"
    if path.startswith("assets/interiors/6_Home_Designs/") and "/16x16/" in path:
        return "interiors-home-examples"
    return None


def png_record(path: str, tracked: set[str]) -> list:
    data = (REPO / path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"Not a PNG with IHDR: {path}")
    width, height = struct.unpack(">II", data[16:24])
    return [path, digest(data), width, height, len(data), group(path), path in tracked]


def fingerprint(rows: list[list]) -> str:
    return digest(b"".join(encode(row[:4]) for row in rows))


def ledger_bytes(rows: list[list]) -> bytes:
    # One compact row per file makes a large inventory inspectable in diffs.
    header = '{"schemaVersion":1,"columns":["path","sha256","width","height","bytes","scopeGroup","gitTracked"],"files":[\n'
    return (header + ",\n".join(encode(row).decode().rstrip() for row in rows)
            + "\n]}\n").encode()


def file_reference(path: str) -> dict:
    data = (REPO / path).read_bytes()
    return {"path": path, "sha256": digest(data), "bytes": len(data)}


def pixel_audit(rows: list[list]) -> dict:
    # Pillow is used only to compare indexed pixels, not to hash PNGs or repack.
    from PIL import Image

    by_path = {row[0]: row for row in rows}
    exterior = json.loads((REPO / INDEX_EX).read_text())
    interior = json.loads((REPO / INDEX_IN).read_text())
    ex_names = defaultdict(list)
    theme_singles = {}
    for row in rows:
        if row[5] == "exteriors-complete-singles":
            ex_names[Path(row[0]).stem].append(row[0])
        elif row[5] == "exteriors-theme-singles":
            theme_singles[Path(row[0]).stem] = row
    master = Image.open(REPO / COMMITTED_EX).convert("RGBA")
    atlas = Image.open(REPO / COMMITTED_IN).convert("RGBA")
    failures = []
    ex_paths = set()
    ex_rects = set()
    ex_count = 0
    if (exterior["atlasWidth"], exterior["atlasHeight"]) != master.size:
        failures.append({"index": "exteriors", "problem": "declared-atlas-size"})
    if (interior["atlasWidth"], interior["atlasHeight"]) != atlas.size or interior["entryCount"] != len(interior["entries"]):
        failures.append({"index": "interiors", "problem": "declared-atlas-size-or-count"})
    for theme, names in sorted(exterior["themes"].items()):
        for name, rect in sorted(names.items()):
            ex_count += 1
            ex_rects.add(tuple(rect))
            stem = f"{theme}_16x16_{name}" if theme else name
            matches = ex_names[stem]
            if len(matches) != 1:
                failures.append({"index": "exteriors", "key": name,
                                 "problem": "single-path-not-unique", "paths": matches})
                continue
            path = matches[0]
            ex_paths.add(path)
            x, y, w, h = rect
            if x < 0 or y < 0 or x + w > master.width or y + h > master.height:
                failures.append({"index": "exteriors", "key": name, "problem": "bounds"})
                continue
            with Image.open(REPO / path) as image:
                source = image.convert("RGBA")
            crop = master.crop((x, y, x + w, y + h))
            # Existing Exteriors matcher ignores RGB under zero alpha. Composite
            # onto transparent black to enforce that same visual equality.
            normalized = Image.new("RGBA", source.size)
            normalized.alpha_composite(source)
            normalized_crop = Image.new("RGBA", crop.size)
            normalized_crop.alpha_composite(crop)
            if source.size != (w, h) or normalized.tobytes() != normalized_crop.tobytes():
                failures.append({"index": "exteriors", "key": name, "problem": "pixel-mismatch"})
    paths = Counter(entry["sourcePath"] for entry in interior["entries"])
    in_kinds = Counter(entry["sourceKind"] for entry in interior["entries"])
    # Each original file is opened once, even for thousands of Room Builder tiles.
    entries_by_path = defaultdict(list)
    for entry in interior["entries"]:
        entries_by_path[entry["sourcePath"]].append(entry)
    for path, entries in sorted(entries_by_path.items()):
        if path not in by_path:
            failures.append({"index": "interiors", "path": path, "problem": "source-not-in-scope"})
            continue
        with Image.open(REPO / path) as image:
            source = image.convert("RGBA")
        for entry in entries:
            sx, sy, sw, sh = entry["sourceRect"]
            x, y, w, h = entry["rect"]
            if (sw, sh) != (w, h) or min(x, y, sx, sy) < 0 or x + w > atlas.width or y + h > atlas.height or sx + sw > source.width or sy + sh > source.height:
                failures.append({"index": "interiors", "key": entry["key"], "problem": "bounds"})
            elif source.crop((sx, sy, sx + sw, sy + sh)).tobytes() != atlas.crop((x, y, x + w, y + h)).tobytes():
                failures.append({"index": "interiors", "key": entry["key"], "problem": "pixel-mismatch"})
    unindexed_in = [row[0] for row in rows if row[0].startswith("assets/interiors/") and row[0] not in paths]
    unindexed_ex = sorted(path for names in ex_names.values() for path in names if path not in ex_paths)
    return {
        "exteriors": {"indexedNames": ex_count, "distinctMasterRects": len(ex_rects),
            "resolvedSinglePaths": len(ex_paths), "unindexedCompleteSingles": len(unindexed_ex),
            "unindexedSinglePathsDigest": digest(encode(unindexed_ex)),
            "reportedMatched": exterior["matched"], "reportedUnmatched": exterior["unmatched"],
            "indexNameToOriginalPath": "theme + '_16x16_' + key when theme is nonempty; otherwise key; append .png beneath complete-singles root",
            "themeSinglesByteIdenticalToSameNamedCompleteSingle": sum(
                row[1] == by_path[ex_names[name][0]][1] for name, row in theme_singles.items()
                if len(ex_names[name]) == 1),
            "themeSingleCount": len(theme_singles),
            "originalMasterEqualsCommittedBytes": by_path[EX_MASTER][1] == by_path[COMMITTED_EX][1],
            "comparison": "exact RGBA after zero-alpha RGB normalization"},
        "interiors": {"entries": len(interior["entries"]), "distinctSourcePaths": len(paths),
            "entrySourceKinds": dict(sorted(in_kinds.items())),
            "sourcePathsByScopeGroup": dict(sorted(Counter(by_path[p][5] for p in paths if p in by_path).items())),
            "inScopeOriginalPNGsNotReferenced": len(unindexed_in),
            "unreferencedGroups": dict(sorted(Counter(by_path[p][5] for p in unindexed_in).items())),
            "comparison": "exact decoded RGBA including transparent RGB"},
        "failures": failures,
        "limits": ["Existing indexes are a reconciliation baseline, not semantic coverage.",
                   "No new single-to-master search; unmatched is not proof of missing art.",
                   "Theme sheets, animations and example assemblies are inventoried, not semantically verified."]}


def build() -> tuple[dict, list[list]]:
    for root in ROOTS:
        if not (REPO / root).is_dir():
            raise ValueError(f"Restore ignored original pack directory: {root}")
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=REPO).decode().split("\0"))
    paths = {COMMITTED_EX, COMMITTED_IN}
    for root in ROOTS:
        paths.update(path.relative_to(REPO).as_posix() for path in (REPO / root).rglob("*")
                     if path.is_file() and path.suffix.lower() == ".png" and group(path.relative_to(REPO).as_posix()))
    rows = [png_record(path, tracked) for path in sorted(paths)]
    originals = [row for row in rows if row[5] != "committed-reference"]
    group_rows = defaultdict(list)
    for row in rows:
        group_rows[row[5]].append(row)
    audit = pixel_audit(rows)
    if audit["failures"]:
        raise ValueError(f"Indexed source reconciliation failed: {audit['failures'][:5]}")
    manifest = {
        "schemaVersion": 1, "scope": "native16 Modern Exteriors/Interiors semantic investigation",
        "revision": {"vendorRelease": None,
            "vendorReleaseStatus": "unverified; local archive names do not establish release identity",
            "fingerprintAlgorithm": "SHA256 of sorted compact JSON [repoPath,pngSHA256,width,height] lines; UTF-8 with LF",
            "includedOriginalPNGsFingerprint": fingerprint(originals),
            "exteriorsFingerprint": fingerprint([row for row in originals if row[0].startswith("assets/exteriors/")]),
            "interiorsFingerprint": fingerprint([row for row in originals if row[0].startswith("assets/interiors/")])},
        "coordinates": {"unit": "native source pixels", "origin": "top-left",
            "rect": "[x,y,width,height]; right/bottom exclusive", "tileSize": 16,
            "exteriorsIndex": "rectangles refer to original master, byte-identical committed me-complete",
            "interiorsIndex": "rect is packed-atlas coordinates; sourceRect and sourcePath refer to original files; packed origins need not be tile-aligned"},
        "sourceFiles": {"path": "docs/tactical/053-semantic-tileset-map/source-files.json",
            "sha256": digest(ledger_bytes(rows)), "pngCount": len(rows),
            "originalPNGCount": len(originals), "committedReferencePNGCount": len(rows) - len(originals)},
        "groups": {key: {"pngCount": len(items), "bytes": sum(row[4] for row in items),
                          "distinctPngSHA256": len({row[1] for row in items}),
                          "fingerprint": fingerprint(items)} for key, items in sorted(group_rows.items())},
        "anchorFiles": [{"path": row[0], "sha256": row[1], "width": row[2], "height": row[3],
                         "scopeGroup": row[5]} for row in rows if "master" in row[5] or row[5] == "committed-reference"],
        "committedIndexAndBuilderInputs": [file_reference(path) for path in PROVENANCE],
        "freshClone": {"originalsAvailable": False,
            "ignoredRoots": ROOTS, "gitTrackedOriginalPNGCount": sum(row[6] for row in originals),
            "gitTrackedCommittedReferencePNGCount": sum(row[6] for row in rows if row[5] == "committed-reference"),
            "fullVerification": "requires restoring these exact original PNGs and installing Pillow",
            "committedVerification": "python3 scripts/semantic-map-inventory.py --check --committed-only"},
        "exclusions": [
            {"paths": ["assets/exteriors/Modern_Exteriors_32x32", "assets/exteriors/Modern_Exteriors_48x48", "assets/interiors/1_Interiors/32x32", "assets/interiors/1_Interiors/48x48"], "reason": "other resolutions"},
            {"paths": [EX + "/Character_Generator_Addons_16x16", "assets/interiors/2_Characters", "assets/interiors/4_User_Interface_Elements"], "reason": "characters and UI"},
            {"paths": [IN + "/Old stuff", EX + "/ME_Theme_Sorter_16x16/Old_Sorting", EX + "/OLD.zip", "assets/exteriors_rpg", "assets/interiors_rpg"], "reason": "legacy packs/sorting and RPG conversions; excluded 22 Interiors Old stuff PNGs and 5 Exteriors Old_Sorting PNGs"},
            {"paths": ["assets/interiors/3_Animated_objects/32x32", "assets/interiors/3_Animated_objects/48x48", "assets/interiors/6_Home_Designs/**/32x32", "assets/interiors/6_Home_Designs/**/48x48"], "reason": "other-resolution animations and examples"},
            {"patterns": ["*.gif", "*.zip", "*.ase", "*.aseprite", "*.tsx", "*.ini", ".DS_Store"], "reason": "non-PNG exports, archives, editing metadata or OS state; animation PNG sheets/frames are included"},
            {"paths": ["assets/interiors/Palettes", "assets/Palette.png"], "reason": "palette references outside semantic source-art scope"},
            {"paths": ["public/assets/ (except the two named committed references)", "src/interiors/review/assets/", "src/generation/regional/*assets*.json"], "reason": "derived runtime/review/promotion artifacts; never regenerated or counted as original source occurrences"}],
        "indexReconciliation": audit,
        "reproduce": {"write": "python3 scripts/semantic-map-inventory.py",
            "check": "python3 scripts/semantic-map-inventory.py --check",
            "changes": "only source-manifest.json and source-files.json; sources, indexes and promoted banks remain read-only"}}
    return manifest, rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--committed-only", action="store_true")
    args = parser.parse_args()
    if args.committed_only and not args.check:
        parser.error("--committed-only requires --check")
    try:
        if args.committed_only:
            manifest = json.loads((OUT / "source-manifest.json").read_text())
            ledger = (OUT / "source-files.json").read_bytes()
            if digest(ledger) != manifest["sourceFiles"]["sha256"]:
                raise ValueError("Source ledger hash differs from manifest")
            rows = json.loads(ledger)["files"]
            originals = [row for row in rows if row[5] != "committed-reference"]
            if fingerprint(originals) != manifest["revision"]["includedOriginalPNGsFingerprint"]:
                raise ValueError("Source ledger fingerprint differs from manifest")
            for row in rows:
                if row[5] == "committed-reference" and png_record(row[0], {row[0]}) != row:
                    raise ValueError(f"Committed PNG drift: {row[0]}")
            for reference in manifest["committedIndexAndBuilderInputs"]:
                if file_reference(reference["path"]) != reference:
                    raise ValueError(f"Committed input drift: {reference['path']}")
            print("Committed references and saved ledger verified; ignored originals not checked.")
            return 0
        manifest, rows = build()
        outputs = {"source-manifest.json": (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode(),
                   "source-files.json": ledger_bytes(rows)}
        for name, data in outputs.items():
            target = OUT / name
            if args.check:
                if not target.exists() or target.read_bytes() != data:
                    raise ValueError(f"Inventory drift: {target.relative_to(REPO)}")
            else:
                target.write_bytes(data)
        print(f"{'Verified' if args.check else 'Wrote'} {len(rows)} PNG records; indexed pixel checks passed.")
        return 0
    except (ValueError, OSError, ImportError, KeyError) as error:
        print(f"semantic-map-inventory: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
