#!/usr/bin/env python3
"""Reproduce E01 seating proposal, exact lineage, aliases and source-only captures.

Requires restored original PNGs and Pillow. Does not repack or alter art.
--check verifies deterministic proposal JSON; --capture-dir is disposable evidence.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / "docs/tactical/053-semantic-tileset-map"
OUTPUT = PLAN / "packets/E01-outdoor-seating.json"
LEDGER_HASH = "c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda"
MASTER = "public/assets/tilesets/me-complete.png"
MASTER_HASH = "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737"
BASE = "assets/exteriors/Modern_Exteriors_16x16"
SINGLES = BASE + "/Modern_Exteriors_Complete_Singles_16x16"
CONTEXTS = [[32, 128, 176, 464], [1808, 32, 320, 384], [2672, 5280, 144, 160]]
SPECS = [("City_Props", f"Bench_{n}") for n in range(1, 8)] + [
    ("Camping", f"Chair_{n}") for n in range(1, 17)] + [
    ("Camping", f"Benched_Table_{n}") for n in range(1, 5)]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_id(path):
    return "src-" + sha(path.encode())[:16]


def rect_bbox(image):
    x0, y0, x1, y1 = image.getchannel("A").getbbox()
    return [x0, y0, x1 - x0, y1 - y0]


def field(value, confidence, evidence, alternatives=None, disposition="proposed"):
    return {"value": value, "confidence": confidence, "evidence": evidence,
            "alternatives": alternatives or [], "disposition": disposition}


def describe(theme, key):
    n = int(key.rsplit("_", 1)[1])
    if key.startswith("Bench_"):
        labels = ["Short golden slatted bench", "Wide golden slatted bench",
                  "Short side-view bench, tall rail at image right",
                  "Short side-view bench, tall rail at image left",
                  "Long side-view bench, tall rail at image right",
                  "Long side-view bench, tall rail at image left",
                  "Brown slatted bench"]
        evidence = "Parallel wood-colored slats, separate raised back and lower seat, and dark end supports/legs form a closed bench silhouette."
        facing = "Broad horizontal seat/back view" if n in (1, 2, 7) else "Side view; tall back rail at image " + ("right" if n in (3, 5) else "left")
        variants = {1: "short, golden wood", 2: "wide, golden wood", 3: "short, back rail right",
                    4: "short, back rail left", 5: "long, back rail right", 6: "long, back rail left",
                    7: "brown wood; different shading and supports"}
        return labels[n - 1], "civic-slatted-benches", facing, variants[n], evidence
    if key.startswith("Chair_"):
        colors = ["green", "blue", "ochre", "gray"] * 2 + ["blue", "gray", "green", "ochre"] * 2
        facing = "Broad seat/back view" if n <= 8 else "Side view; tall back rail at image " + ("left" if n <= 12 else "right")
        frame = "brown frame" if n <= 4 or n >= 9 else "gray frame"
        evidence = "Two patterned colored fabric-like panels occupy raised back and seat areas inside a narrow frame with visible support feet; side views retain the raised back and lower seat."
        return f"{colors[n - 1].capitalize()} camping chair, {frame}", "framed-camping-chairs", facing, f"{colors[n - 1]} panels; {frame}", evidence
    evidence = "Broad planked tabletop, narrow lower parallel sitting plank, and dark supports form one complete exported table-and-bench image; decorated versions retain this structure."
    label = ["Small picnic table and bench", "Small picnic table with food and drinks",
             "Wide picnic table and bench", "Wide picnic table with cooking and dining items"][n - 1]
    variant = ["small; plain", "small; decorated", "wide; plain", "wide; decorated; taller export"][n - 1]
    return label, "picnic-table-compositions", "Broad tabletop/front-bench view", variant, evidence


def delta(a, b):
    if a.size != b.size:
        raise ValueError("Explicit alignment is required for unequal frames")
    adata, bdata = a.tobytes(), b.tobytes()
    ap = [adata[i:i + 4] for i in range(0, len(adata), 4)]
    bp = [bdata[i:i + 4] for i in range(0, len(bdata), 4)]
    mask = Image.new("L", a.size)
    mask.putdata([255 if x != y else 0 for x, y in zip(ap, bp)])
    alpha_diff = sum(x[3] != y[3] for x, y in zip(ap, bp))
    return {"size": list(a.size), "leftNormalizedRgbaSHA256": sha(adata), "rightNormalizedRgbaSHA256": sha(bdata),
            "rgbaChangedPixels": sum(x != y for x, y in zip(ap, bp)),
            "alphaChangedPixels": alpha_diff, "alphaMaskEqual": alpha_diff == 0,
            "changedBoundsXYXY": list(mask.getbbox()) if mask.getbbox() else None,
            "changedMaskSHA256": sha(mask.tobytes()), "exactEqual": a.tobytes() == b.tobytes()}


def build(capture_dir):
    ledger_bytes = (PLAN / "source-files.json").read_bytes()
    if sha(ledger_bytes) != LEDGER_HASH:
        raise ValueError("Pinned source ledger changed")
    rows = json.loads(ledger_bytes)["files"]
    by_path = {r[0]: r for r in rows}
    spec = importlib.util.spec_from_file_location("semantic_match", REPO / "scripts/semantic-map-match.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sources = {}
    images = {}

    def read(path):
        raw = (REPO / path).read_bytes()
        row = by_path[path]
        if sha(raw) != row[1]:
            raise ValueError(f"Pinned PNG changed: {path}")
        im = module.normalized(Image.open(REPO / path))
        if list(im.size) != row[2:4]:
            raise ValueError(f"Pinned PNG dimensions changed: {path}")
        sid = source_id(path)
        sources[sid] = {"id": sid, "path": path, "pngSHA256": row[1],
                        "size": list(im.size), "normalizedRgbaSHA256": sha(im.tobytes())}
        return im

    master = read(MASTER)
    if sources[source_id(MASTER)]["pngSHA256"] != MASTER_HASH:
        raise ValueError("Master pin changed")
    original_master = BASE + "/Modern_Exteriors_Complete_Tileset.png"
    if read(original_master).tobytes() != master.tobytes():
        raise ValueError("Original/public master alias differs")
    theme_paths = [row[0] for row in rows if row[5] == "exteriors-theme-sheets"]
    if len(theme_paths) != 24:
        raise ValueError("Pinned theme-sheet domain changed")
    sheets = {p: read(p) for p in theme_paths}
    sheet_matchers = {p: module.Matcher(im, grid=1) for p, im in sheets.items()}
    matcher = module.Matcher(master, grid=1)
    index_path = "public/data/me-atlas-index.json"
    index_raw = (REPO / index_path).read_bytes()
    index = json.loads(index_raw)["themes"]
    candidates = []
    selected_pixels = {}
    for theme, key in SPECS:
        path = f"{SINGLES}/ME_Singles_{theme}_16x16_{key}.png"
        im = read(path)
        selected_pixels[(im.size, sha(im.tobytes()))] = True
        images[(theme, key)] = im

    # Scan all native16 named singles by pixel identity, including differently named
    # duplicates and files whose PNG encoding differs. Raw hashes are checked too.
    aliases = {identity: [] for identity in selected_pixels}
    corpus = [r for r in rows if r[5] in ("exteriors-complete-singles", "exteriors-theme-singles")]
    possible_sizes = {identity[0] for identity in selected_pixels}
    checked_count = 0
    for row in corpus:
        if tuple(row[2:4]) not in possible_sizes:
            continue
        raw = (REPO / row[0]).read_bytes()
        if sha(raw) != row[1]:
            raise ValueError(f"Named-single corpus drift: {row[0]}")
        im = module.normalized(Image.open(REPO / row[0]))
        identity = (im.size, sha(im.tobytes()))
        checked_count += 1
        if identity in aliases:
            read(row[0])
            aliases[identity].append(source_id(row[0]))

    for number, (theme, key) in enumerate(SPECS, 1):
        im = images[(theme, key)]
        path = f"{SINGLES}/ME_Singles_{theme}_16x16_{key}.png"
        label, family, facing, variant, evidence = describe(theme, key)
        matches = matcher.find(im)
        bbox = rect_bbox(im)
        occurrences = []
        for sheet_path, searcher in [(MASTER, matcher), *sheet_matchers.items()]:
            rects = matches if sheet_path == MASTER else searcher.find(im)
            for rect in rects:
                occurrences.append({"sourceId": source_id(sheet_path), "rect": rect,
                                    "alphaVisibleRect": [rect[0] + bbox[0], rect[1] + bbox[1], bbox[2], bbox[3]],
                                    "lineage": "direct-exact-normalized-RGBA"})
        material_alternatives = ["wood slats with metal-looking supports", "painted materials; exact material unknown"] if theme == "City_Props" else ["fabric folding/camping chair", "other framed chair; folding mechanics unproven"]
        if key.startswith("Benched_Table"):
            material_alternatives = ["picnic table with attached seating", "table plus separate bench baked into one export; attachment unknown"]
        bounds_evidence = "Full original export and separately measured alpha bounds; exact matching lineage retained per source sheet."
        if not matches:
            bounds_evidence += " No exact full-frame occurrence in master; original exports remain authoritative, not missing-art claims."
        candidates.append({"id": f"E01-{number:02d}", "sourceKey": {"theme": theme, "key": key},
            "label": label, "primarySourceId": source_id(path),
            "exportRect": [0, 0, im.width, im.height], "alphaVisibleRect": bbox,
            "normalizedRgbaSHA256": sha(im.tobytes()),
            "namedExportAliases": aliases[(im.size, sha(im.tobytes()))],
            "occurrences": occurrences,
            "masterOccurrences": [{"rect": r} for r in matches],
            "committedRendering": {"status": "exact committed master crop available" if matches else "requires exact original single; no committed whole crop",
                                   "sourceId": source_id(MASTER) if matches else source_id(path),
                                   "rect": matches[0] if matches else [0, 0, im.width, im.height],
                                   "limit": "No forced reconstruction. Original-only records require exact source copies for ordinary committed-only browsing."},
            "legacyIndexAlias": {"path": index_path, "theme": f"ME_Singles_{theme}", "key": key,
                                 "rect": index[f"ME_Singles_{theme}"].get(key),
                                 "coordinateSpace": "original-master-pixels; not repacked"},
            "fields": {
                "identity": field(label, "high", evidence, material_alternatives),
                "bounds": field("whole original export; alpha bounds separate", "high", bounds_evidence),
                "family": field(family, "high", "Shared visible slatted seat/back, framed fabric panels, or planked table structure respectively; theme names supplement pixel evidence."),
                "role": field("whole object" if not key.startswith("Benched_Table") else "baked table-and-bench composition", "high", "Closed support/leg and seat outlines; no exposed connector cuts or separately required cap pieces are evident."),
                "facing": field(facing + "; compass heading unknown", "medium", "Relative raised-back/seat placement is visible; no source-to-world compass convention established.", ["world compass heading unknown"]),
                "variant": field(variant, "high", "Observed panel/slat color, support color, length, side orientation or added objects; exact deltas are recorded below.")},
            "topology": {"standaloneEligibility": "allowed as visual proposal only", "requiredNeighbors": [],
                         "openJoinEdges": [], "repeatable": "not proposed", "enforcement": "metadata only; no catalog/generator change",
                         "limit": "Complete visual export is not evidence for physics, chair folding or attachment between bench and table."},
            "geometry": {"anchor": None, "footprint": None, "collision": None, "walkableSurfaces": None, "status": "unknown"},
            "independentReview": "pending", "humanApproval": "unregistered; not approved"})

    comparisons = []
    for theme, a, b, transform, statement in [
        ("City_Props", "Bench_3", "Bench_4", "horizontal-reflection", "Opposite-side back rails; exact mirror shortcut tested."),
        ("City_Props", "Bench_5", "Bench_6", "horizontal-reflection", "Opposite-side long benches; exact mirror shortcut tested."),
        *[("Camping", f"Chair_{n}", f"Chair_{n + 4}", "identity", "Brown versus gray frame on same panel color.") for n in range(1, 5)],
        *[("Camping", f"Chair_{a}", f"Chair_{b}", "identity", "Panel-color correspondence, not automatic pixel recolor rule.") for a, b in [(1, 2), (1, 3), (1, 4), (9, 10), (9, 11), (9, 12)]],
        *[("Camping", f"Chair_{n}", f"Chair_{n + 4}", "horizontal-reflection", "Matching panel colors with raised back on opposite side.") for n in range(9, 13)],
        ("Camping", "Benched_Table_1", "Benched_Table_2", "identity", "Added table-top food/drinks tested against plain small table."),
    ]:
        first, second = images[(theme, a)], images[(theme, b)]
        if transform == "horizontal-reflection":
            first = first.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        comparisons.append({"members": [next(c["id"] for c in candidates if c["sourceKey"] == {"theme": theme, "key": key}) for key in (a, b)],
                            "operation": transform, "observation": statement, **delta(first, second)})
    # The larger decorated export has 16 extra top rows; align its lower 32 rows
    # explicitly with the plain wide table rather than silently resizing artwork.
    comparisons.append({"members": ["E01-26", "E01-27"], "operation": "target crop [0,16,48,32]",
                        "observation": "Compare aligned wide table body; extra top rows remain independent art, not discarded bounds.",
                        **delta(images[("Camping", "Benched_Table_3")], images[("Camping", "Benched_Table_4")].crop((0, 16, 48, 48)))})
    extension = []
    for a, b in [(3, 5), (4, 6)]:
        first, second = images[("City_Props", f"Bench_{a}")], images[("City_Props", f"Bench_{b}")]
        top = delta(first.crop((0, 11, 16, 27)), second.crop((0, 0, 16, 16)))
        bottom = delta(first.crop((0, 28, 16, 48)), second.crop((0, 28, 16, 48)))
        short_rows = {first.crop((0, y, 16, y + 1)).tobytes() for y in range(first.height)}
        unmatched_rows = [y for y in range(second.height)
                          if second.crop((0, y, 16, y + 1)).tobytes() not in short_rows]
        extension.append({"members": [f"E01-{a:02d}", f"E01-{b:02d}"],
            "topCorrespondence": {"shortRect": [0, 11, 16, 16], "longRect": [0, 0, 16, 16], **top},
            "bottomCorrespondence": {"shortRect": [0, 28, 16, 20], "longRect": [0, 28, 16, 20], **bottom},
            "longRowsWithoutAnyEqualShortRow": unmatched_rows,
            "middleConclusion": "Long export contains extra body artwork. Whole-row duplication of the short export alone cannot reconstruct it; copied top/bottom is only partial lineage, not a full recipe."})

    result = {"schemaVersion": 2, "packetId": "E01", "proposalRevision": 1, "state": "agent-proposal",
        "coordinates": {"unit": "native pixels", "origin": "top-left", "rect": "[x,y,width,height]; half-open", "deltaBounds": "[left,top,right,bottom]; half-open"},
        "pins": {"sourceLedger": {"path": str((PLAN / "source-files.json").relative_to(REPO)), "sha256": LEDGER_HASH},
                 "legacyIndex": {"path": index_path, "sha256": sha(index_raw)}},
        "scope": {"selectedExportGroups": ["City Props Bench 1-7", "Camping Chair 1-16", "Camping Benched_Table 1-4"],
                  "excluded": ["School/Garden/rail/pool seating", "other themes", "animation/autotile files", "near-matching or occluded master fragments"],
                  "countMeaning": "27 source records / variant proposal units; not unique object count or pack semantic completion"},
        "sources": sorted(sources.values(), key=lambda s: s["path"]), "candidates": candidates,
        "matching": {"implementation": "scripts/semantic-map-match.py Matcher(grid=1)", "comparison": "exact RGBA; RGB zeroed only where alpha is zero",
                     "sheetDomains": [source_id(p) for p in [MASTER, *theme_paths]], "origins": "every fitting integer pixel origin; no grid-only absence inference",
                     "namedAliasDomain": {"groups": ["exteriors-complete-singles", "exteriors-theme-singles"], "files": len(corpus), "sameSizeFilesRead": checked_count,
                                          "method": "dimension prefilter, pinned raw-file hash check, normalized full-RGBA hash equality"},
                     "limitation": "Counts exact full export rectangles only; clipping, occlusion, alternate palettes, partials and other source domains are not searched as equivalence."},
        "experiments": {"variantDeltas": comparisons, "longBenchPartialCorrespondence": extension},
        "relations": [{"members": [f"E01-{i:02d}" for i in range(1, 8)], "relation": "slatted benches with length/facing/palette differences", "limit": "7 is not proven pure recolor; 5/6 have no whole master/theme match"},
                      {"members": [f"E01-{i:02d}" for i in range(8, 24)], "relation": "four panel colors, brown/gray broad-view frames and brown opposite-side views", "limit": "side variants use different color order; no compass heading or pure recolor inherited"},
                      {"members": [f"E01-{i:02d}" for i in range(24, 28)], "relation": "small/wide plain and decorated table-and-bench compositions", "limit": "No attached-bench physics or constituent reconstruction claimed"}],
        "contexts": [{"sourceId": source_id(MASTER), "rect": r} for r in CONTEXTS],
        "review": {"independent": "pending separate per-member artifact pinned to JSON hash", "human": "unregistered; no approval/promotion"},
        "coverage": {"sourceRecordCount": len(candidates), "proposalUnitCount": len(candidates),
                     "exactMasterOccurrenceCount": sum(len(c["masterOccurrences"]) for c in candidates),
                     "noExactMasterMembers": [c["id"] for c in candidates if not c["masterOccurrences"]],
                     "namedExportAliasCount": sum(len(c["namedExportAliases"]) for c in candidates),
                     "semanticExhaustiveness": "selected named groups only; survey regions and all seating themes not exhaustively segmented"},
        "reproduce": {"check": "python3 scripts/semantic-map-outdoor-seating.py --check", "capture": "python3 scripts/semantic-map-outdoor-seating.py --check --capture-dir /tmp/tilefun-semantic-E01"}}
    if capture_dir:
        capture_dir.mkdir(parents=True, exist_ok=True)
        sheet = Image.new("RGB", (6 * 200, 5 * 200), "#30333a")
        draw = ImageDraw.Draw(sheet)
        for i, c in enumerate(candidates):
            x, y = i % 6 * 200, i // 6 * 200
            key = c["sourceKey"]
            im = images[(key["theme"], key["key"])]
            im = im.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST)
            sheet.paste(im, (x + (200 - im.width) // 2, y + 44), im)
            draw.text((x + 8, y + 4), c["id"] + " " + key["theme"], fill="white")
            draw.text((x + 8, y + 20), key["key"], fill="white")
        sheet.save(capture_dir / "contact-sheet.png")
        for i, r in enumerate(CONTEXTS, 1):
            x, y, w, h = r
            im = master.crop((x, y, x + w, y + h))
            backing = Image.new("RGBA", im.size, "#30333a")
            backing.alpha_composite(im)
            backing.resize((w * 3, h * 3), Image.Resampling.NEAREST).save(capture_dir / f"context-{i}.png")
        (capture_dir / "proof-summary.json").write_text(json.dumps(result["coverage"], indent=2) + "\n")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--capture-dir", type=Path)
    args = parser.parse_args()
    result = build(args.capture_dir)
    output = json.dumps(result, indent=2) + "\n"
    if args.check:
        if OUTPUT.read_text() != output:
            raise SystemExit("E01 differs from pinned/reproduced evidence")
        print("E01 verified: " + json.dumps(result["coverage"], sort_keys=True))
    else:
        OUTPUT.write_text(output)
        print("Wrote " + str(OUTPUT.relative_to(REPO)))


if __name__ == "__main__":
    main()
