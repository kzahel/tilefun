#!/usr/bin/env python3
"""Reproduce bounded RB01 Room Builder path/arch evidence without changing art.

Requires restored original native16 Room Builder files and Pillow. --check
compares the frozen proposal; --capture-dir writes disposable nearest-neighbor
source crops and assembly probes. No browser, repacking or gameplay changes.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
PLAN = REPO / "docs/tactical/053-semantic-tileset-map"
OUTPUT = PLAN / "packets/RB01-room-builder-path-arch.json"
LEDGER_HASH = "c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda"
ROOT = "assets/interiors/1_Interiors/16x16/"
MASTER = ROOT + "Room_Builder_16x16.png"
PATHS = ROOT + "Room_Builder_subfiles/Room_Builder_Floor_Paths_16x16.png"
ARCHES = ROOT + "Room_Builder_subfiles/Room_Builder_Arched_Entryways_16x16.png"
WALLS = ROOT + "Room_Builder_subfiles/Room_Builder_Walls_16x16.png"
# Short role, source x/y, proposed open interior edges. These are bounded visual
# hypotheses, not a universal autotile scheme. L/R means the outside border side.
FLOOR = [
    ("fill", 0, 16, "NESW"),
    ("left-side", 16, 48, "NES"),
    ("right-side", 32, 16, "NSW"),
    ("inset-upper-left", 48, 0, "ES"),
    ("inset-upper-right", 64, 0, "SW"),
    ("inset-upper-edge", 80, 0, "ESW"),
    ("inset-lower-left", 48, 16, "NE"),
    ("inset-lower-right", 64, 16, "NW"),
    ("lower-edge", 80, 16, "NEW"),
    ("horizontal-narrow", 48, 32, "EW"),
    ("junction-down-left", 16, 80, "ESW"),
    ("bend-down-right-outer", 32, 80, "SW"),
    ("junction-down-right", 64, 80, "ESW"),
    ("shaded-upper-left", 48, 48, "ES"),
    ("shaded-upper-right", 64, 48, "SW"),
    ("narrow-lower-left", 48, 64, "NE"),
    ("narrow-lower-right", 32, 64, "NW"),
]
EDGE_NAMES = {"N": "top", "E": "right", "S": "bottom", "W": "left"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sid(path):
    return "src-" + sha(path.encode())[:16]


def field(value, confidence, evidence, alternatives=None, disposition="proposed"):
    return {"value": value, "confidence": confidence, "evidence": evidence,
            "alternatives": alternatives or [], "disposition": disposition}


def crop(im, rect):
    x, y, w, h = rect
    if min(x, y) < 0 or min(w, h) <= 0 or x + w > im.width or y + h > im.height:
        raise ValueError(f"Out-of-bounds source crop: {rect}")
    return im.crop((x, y, x + w, y + h))


def edge(im, name):
    if name in ("left", "right"):
        x = 0 if name == "left" else im.width - 1
        return [list(im.getpixel((x, y))) for y in range(im.height)]
    y = 0 if name == "top" else im.height - 1
    return [list(im.getpixel((x, y))) for x in range(im.width)]


def seams(canvas, placements, images):
    result = []
    for i, a in enumerate(placements):
        ax, ay = a["targetOffset"]
        ai = images[a["memberId"]]
        for b in placements[i + 1:]:
            bx, by = b["targetOffset"]
            bi = images[b["memberId"]]
            direction = None
            if ay == by and ai.height == bi.height and ax + ai.width == bx:
                direction, left, right = "horizontal", edge(ai, "right"), edge(bi, "left")
            elif ax == bx and ai.width == bi.width and ay + ai.height == by:
                direction, left, right = "vertical", edge(ai, "bottom"), edge(bi, "top")
            if direction:
                result.append({"members": [a["memberId"], b["memberId"]], "axis": direction,
                               "differentAdjacentRGBAPositions": [n for n, (p, q) in enumerate(zip(left, right)) if p != q],
                               "note": "Equality is a diagnostic, not topology or render-quality proof; shading can intentionally differ."})
    return result


def build(capture_dir=None):
    raw_ledger = (PLAN / "source-files.json").read_bytes()
    if sha(raw_ledger) != LEDGER_HASH:
        raise ValueError("Source-file ledger changed")
    ledger = {r[0]: r for r in json.loads(raw_ledger)["files"]}
    spec = importlib.util.spec_from_file_location("semantic_match", REPO / "scripts/semantic-map-match.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sources, originals = {}, {}

    def read(path):
        if path in originals:
            return originals[path]
        raw = (REPO / path).read_bytes()
        row = ledger[path]
        if sha(raw) != row[1]:
            raise ValueError(f"Pinned source drift: {path}")
        im = module.normalized(Image.open(REPO / path))
        if list(im.size) != row[2:4]:
            raise ValueError(f"Source size drift: {path}")
        sources[sid(path)] = {"id": sid(path), "path": path, "pngSHA256": sha(raw),
                              "size": list(im.size), "normalizedRgbaSHA256": sha(im.tobytes())}
        originals[path] = im
        return im

    domain = sorted(p for p in ledger if p == MASTER or (p.startswith(ROOT + "Room_Builder_subfiles/") and p.endswith(".png")))
    if len(domain) != 10:
        raise ValueError("Room Builder master/subfile search domain changed")
    matchers = {p: module.Matcher(read(p), grid=16) for p in domain}
    catalog_path = "public/data/modern-interiors-atlas.json"
    catalog_raw = (REPO / catalog_path).read_bytes()
    catalog = json.loads(catalog_raw)
    packed_path = "public/" + catalog["atlas"].lstrip("/")
    packed_raw = (REPO / packed_path).read_bytes()
    packed = module.normalized(Image.open(REPO / packed_path))
    sources[sid(packed_path)] = {"id": sid(packed_path), "path": packed_path,
                               "pngSHA256": sha(packed_raw), "size": list(packed.size),
                               "normalizedRgbaSHA256": sha(packed.tobytes())}
    indexed = [e for e in catalog["entries"] if e["sourceKind"] in ("room_builder_tile", "room_builder_sheet")]
    sheet_entries = {e["sourcePath"]: e for e in indexed if e["sourceKind"] == "room_builder_sheet"}
    for e in indexed:
        if crop(read(e["sourcePath"]), e["sourceRect"]).tobytes() != crop(packed, e["rect"]).tobytes():
            raise ValueError(f"Packed Room Builder lineage mismatch: {e['key']}")

    selected, images, role_ids = [], {}, {}
    for n, (role, x, y, ports) in enumerate(FLOOR, 1):
        cid = f"RB01-P{n:02}"
        role_ids[role] = cid
        selected.append((cid, PATHS, [x, y, 16, 16], role, ports))
    for row in range(4):
        for col in range(2):
            cid = f"RB01-A{row * 2 + col + 1:02}"
            role = ("arch-upper", "arch-pier-middle", "arch-pier-lower", "arch-ground-shadow")[row] + ("-left" if col == 0 else "-right")
            selected.append((cid, ARCHES, [col * 16, row * 16, 16, 8 if row == 3 else 16], role, ""))
    candidates = []
    for cid, path, rect, role, ports in selected:
        im = crop(read(path), rect)
        images[cid] = im
        bbox = im.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"Empty selected member: {cid}")
        x0, y0, x1, y1 = bbox
        occurrences = [{"sourceId": sid(p), "rect": r, "lineage": "direct-exact-normalized-RGBA-grid16"}
                       for p in domain for r in matchers[p].find(im)]
        direct_aliases = [{"sourceId": sid(packed_path), "key": e["key"], "rect": e["rect"],
                           "originalSourceId": sid(e["sourcePath"]), "originalSourceRect": e["sourceRect"], "exactVerified": True}
                          for e in indexed if e["sourceKind"] == "room_builder_tile" and tuple(e["sourceRect"][2:]) == im.size
                          and crop(read(e["sourcePath"]), e["sourceRect"]).tobytes() == im.tobytes()]
        sheet_aliases = []
        for occurrence in occurrences:
            p = next(p for p in domain if sid(p) == occurrence["sourceId"])
            if p not in sheet_entries:
                continue
            e = sheet_entries[p]
            x, y, w, h = occurrence["rect"]
            packed_rect = [e["rect"][0] + x, e["rect"][1] + y, w, h]
            if crop(packed, packed_rect).tobytes() != im.tobytes():
                raise ValueError("Packed sheet-offset alias failed")
            sheet_aliases.append({"sourceId": sid(packed_path), "sheetKey": e["key"], "rect": packed_rect,
                                  "originalSourceId": sid(p), "originalSourceRect": occurrence["rect"], "exactVerified": True})
        if path == PATHS:
            family = "pale-yellow-floor-path-kit"
            evidence = "Observed interior #f0f0c8, surrounding #e8e8a8 and border #e0d898; source-pixel probes below distinguish inset corners, shaded caps and asymmetric narrow junctions."
            edge_names = [EDGE_NAMES[e] for e in ports]
            alternatives = ["Inset-corner extension with long side strips is visually weakened by a four-pixel contour shift"] if role.startswith("inset-") else []
            compatibility = "Selected same-palette neighbors only; named assembly recipes establish bounded compatibility. Matching open-edge names alone does not license a join."
            family_rule = "tile modules form a floor motif or path network, not individual whole-object props"
            variant = "pale yellow; other source material banks excluded"
        else:
            family = "three-row-stone-arch-probe"
            evidence = "Stone rim and transparent opening form two columns across three 16px body rows; lower 8px strip contains translucent ground shadow."
            row = int(cid[-2:]) - 1
            row, col = row // 2, row % 2
            edge_names = ["right" if col == 0 else "left"]
            if row in (0, 1):
                edge_names.append("bottom")
            if row in (1, 2, 3):
                edge_names.append("top")
            if row == 3:
                edge_names = ["top"]
            alternatives = ["Caption may describe another convention; body dimensions independently establish three native tile rows"]
            compatibility = "Fixed complementary same-arch columns/rows at recorded offsets; no height/width repetition proven. Shadow strips attach below matching lower piers; optional body-only probe retained."
            family_rule = "six body members at fixed offsets make one arch; two shadow spills are optional render companions"
            variant = "first pale gray/lilac stone arch; four other frame palettes and all wall-cutout styles excluded"
        candidates.append({"id": cid, "primarySourceId": sid(path), "sourceRect": rect,
                           "alphaVisibleRect": [x0, y0, x1 - x0, y1 - y0], "normalizedRgbaSHA256": sha(im.tobytes()),
                           "occurrences": occurrences, "packedTileAliases": direct_aliases, "packedSheetOffsetAliases": sheet_aliases,
                           "fields": {"identity": field(role.replace("-", " "), "high" if path == ARCHES else "medium", evidence, alternatives),
                                      "bounds": field("exact source crop; alpha bounds separate", "high", "Pinned originals, grid coordinates and exact verified packed aliases."),
                                      "family": field(family, "high", evidence),
                                      "role": field(role, "medium" if path == PATHS else "high", evidence, alternatives),
                                      "facing": field("image-axis orientation; world compass unknown", "medium", "Edges and pier positions use source-image axes only."),
                                      "variant": field(variant, "high", "Only the explicit source palette is semantically mapped; no recolor inheritance.")},
                           "topology": {"standaloneEligibility": "forbidden; partial assembly module, not a complete prop",
                                        "requiredFamily": family, "openJoinEdges": edge_names,
                                        "requiredNeighborEdges": edge_names,
                                        "closedOuterEdges": [n for n in EDGE_NAMES.values() if n not in edge_names],
                                        "rule": family_rule, "compatibility": compatibility,
                                        "repeatability": "fill/straight modules tested only at explicit recipe counts" if path == PATHS else "no repetition licensed",
                                        "enforcement": "proposal metadata only; runtime/editor/catalog unchanged"},
                           "geometry": {"anchor": None, "footprint": None, "collision": None, "walkableSurfaces": None, "status": "unknown"},
                           "independentReview": "pending", "humanApproval": "none; unregistered"})

    captures, experiments = [], []

    def experiment(name, placements, size, disposition, observation, boundary_ports=None, comparison=None):
        canvas = Image.new("RGBA", tuple(size))
        records = []
        for cid, x, y in placements:
            im = images[cid]
            if x < 0 or y < 0 or x + im.width > canvas.width or y + im.height > canvas.height:
                raise ValueError("Assembly placement out of bounds")
            canvas.paste(im, (x, y))
            records.append({"memberId": cid, "sourceRect": [0, 0, im.width, im.height], "targetOffset": [x, y]})
        recipe = {"operation": "normalized RGBA overwrite on transparent canvas; no scaling, flipping or source edits", "placements": records, "size": size}
        e = {"id": name, "renderRecipe": recipe, "renderRecipeSHA256": sha(json.dumps(recipe, sort_keys=True, separators=(",", ":")).encode()),
             "outputNormalizedRgbaSHA256": sha(canvas.tobytes()), "joinDiagnostics": seams(canvas, records, images),
             "topologyDisposition": disposition, "observation": observation, "explicitContinuationBoundaryPorts": boundary_ports or [],
             "renderQuality": "mapper inspected source-only render; independent review pending", "humanApproval": "none"}
        if comparison:
            reference = crop(read(comparison[0]), comparison[1])
            e["sourceComparison"] = {"sourceId": sid(comparison[0]), "rect": comparison[1], "exactNormalizedRGBAEqual": reference.size == canvas.size and reference.tobytes() == canvas.tobytes(), "referenceNormalizedRgbaSHA256": sha(reference.tobytes())}
        experiments.append(e)
        captures.append((name, canvas))

    def grid(name, rows, disposition, observation, boundary_ports=None, comparison=None):
        placements = [(role_ids[role], x * 16, y * 16) for y, row in enumerate(rows) for x, role in enumerate(row) if role]
        experiment(name, placements, [len(rows[0]) * 16, len(rows) * 16], disposition, observation, boundary_ports, comparison)

    grid("inset-square-native", [["inset-upper-left", "inset-upper-right"], ["inset-lower-left", "inset-lower-right"]],
         "proposed-valid-bounded-closed-motif", "Closed inset-square motif; source adjacency verified pixel-exact, but not taken as proof of general extensibility.", comparison=(PATHS, [48, 0, 32, 32]))
    for width, height in [(3, 3), (5, 4)]:
        rows = [["inset-upper-left"] + ["inset-upper-edge"] * (width - 2) + ["inset-upper-right"]]
        rows += [["left-side"] + ["fill"] * (width - 2) + ["right-side"] for _ in range(height - 2)]
        rows += [["inset-lower-left"] + ["lower-edge"] * (width - 2) + ["inset-lower-right"]]
        grid(f"inset-extension-{width}x{height}", rows, "topology-hypothesis-render-weakened",
             "Fill joins, but inset-corner contours enter white at x=6 versus side strip x=10 on the left; a four-pixel width change occurs. Do not claim seamless nine-slice support.")
    for middle_count in (0, 1, 2):
        rows = [["shaded-upper-left", "shaded-upper-right"]] + [["left-side", "right-side"]] * middle_count + [["narrow-lower-left", "narrow-lower-right"]]
        grid(f"shaded-vertical-{middle_count}-middle-rows", rows, "proposed-valid-bounded-capped-strip",
             "Side contours align with this separate cap bank; upper cap has a shaded band, lower cap closes the strip. Only these middle counts tested.")
    grid("L-continuation-window", [["horizontal-narrow", "horizontal-narrow", "junction-down-left", "bend-down-right-outer"], [None, None, "left-side", "right-side"]],
         "proposed-valid-explicit-open-network-window", "Aligned two-piece vertical stem turns from the one-row horizontal run; left and bottom continuations are deliberately uncapped.",
         [{"edge": "left", "range": [0, 16]}, {"edge": "bottom", "range": [32, 64]}])
    grid("T-continuation-window", [["horizontal-narrow", "junction-down-left", "junction-down-right", "horizontal-narrow"], [None, "left-side", "right-side", None]],
         "proposed-valid-explicit-open-network-window", "Two junction halves form a downward stem. Horizontal arms and bottom stem are continuation boundaries, not complete standalone objects.",
         [{"edge": "left", "range": [0, 16]}, {"edge": "right", "range": [0, 16]}, {"edge": "bottom", "range": [16, 48]}])
    grid("L-reversed-junction-halves", [["horizontal-narrow", "horizontal-narrow", "bend-down-right-outer", "junction-down-left"], [None, None, "left-side", "right-side"]],
         "invalid-join-contours", "Swapped halves interrupt horizontal continuity and reverse the stem contours; edge-name compatibility alone is insufficient.")
    grid("side-strip-without-caps", [["left-side", "right-side"], ["left-side", "right-side"]],
         "invalid-as-complete-standalone", "Interior crosses upper and lower crop boundaries. Usable only with declared continuations or caps; not a closed object.")
    grid("wrong-inset-corners", [["inset-lower-right", "inset-upper-edge", "inset-upper-right"], ["left-side", "fill", "right-side"], ["inset-lower-left", "lower-edge", "inset-upper-left"]],
         "invalid-join-contours", "Reversed corners leave border paths turned into the interior; no complete rectangle rule inferred.")
    arch_body = [(f"RB01-A{r * 2 + c + 1:02}", c * 16, r * 16) for r in range(3) for c in range(2)]
    arch_all = arch_body + [("RB01-A07", 0, 48), ("RB01-A08", 16, 48)]
    experiment("stone-arch-body-three-rows", arch_body, [32, 48], "proposed-valid-fixed-body",
               "Six body cells produce the intact first stone arch. Body export has blank top padding; the three-row statement concerns the crop, not tight visible height.", comparison=(ARCHES, [0, 0, 32, 48]))
    experiment("stone-arch-with-shadow", arch_all, [32, 56], "proposed-valid-fixed-body-with-shadow",
               "Two 16x8 strips carry translucent floor shadow below the body; this spill is not a fourth body row.", comparison=(ARCHES, [0, 0, 32, 56]))
    experiment("stone-arch-upper-halves-swapped", [("RB01-A02", 0, 0), ("RB01-A01", 16, 0)] + arch_body[2:], [32, 48], "invalid-arch-rim",
               "Upper halves swap outer rim for the crown seam and disrupt the curve; fixed column identity matters.")
    experiment("stone-arch-middle-row-omitted", arch_body[:2] + [("RB01-A05", 0, 16), ("RB01-A06", 16, 16)], [32, 32], "unresolved-shortened-arch-alternative",
               "A shorter rim can be rendered, but deleting a row changes the depicted opening height. No optional-height or repetition rule assigned.")
    experiment("stone-arch-shadow-only", [("RB01-A07", 0, 0), ("RB01-A08", 16, 0)], [32, 8], "invalid-as-complete-standalone",
               "Ground shadows have no arch body and cannot stand alone.")

    # Experiment-only context; these wall pixels do not create extra candidates.
    coral = crop(read(ARCHES), [64, 64, 32, 32])
    wall = crop(read(WALLS), [368, 0, 16, 32])
    context_experiments = []
    for name, filler, observation in [("coral-wall-cutout-with-matching-wall", wall, "Coral fill and upper trim align; five lower trim rows differ intentionally because the opening removes the bottom band. This 32x32 wall cutout is not the three-row stone-frame body."),
                                      ("coral-wall-cutout-with-wrong-texture", crop(read(WALLS), [192, 0, 16, 32]), "Wood texture disagrees with the plain coral opening at the vertical seams; spatial proximity does not establish compatibility.")]:
        canvas = Image.new("RGBA", (64, 32))
        for im, offset in [(filler, (0, 0)), (coral, (16, 0)), (filler, (48, 0))]:
            canvas.paste(im, offset)
        recipe = {"operation": "normalized RGBA overwrite; no scaling", "size": [64, 32], "placements": [
            {"sourceId": sid(WALLS), "sourceRect": [368 if filler is wall else 192, 0, 16, 32], "targetOffset": [0, 0]},
            {"sourceId": sid(ARCHES), "sourceRect": [64, 64, 32, 32], "targetOffset": [16, 0]},
            {"sourceId": sid(WALLS), "sourceRect": [368 if filler is wall else 192, 0, 16, 32], "targetOffset": [48, 0]}]}
        context_experiments.append({"id": name, "scope": "experiment-only; not a semantic member",
                                   "renderRecipe": recipe, "renderRecipeSHA256": sha(json.dumps(recipe, sort_keys=True, separators=(",", ":")).encode()),
                                   "outputNormalizedRgbaSHA256": sha(canvas.tobytes()),
                                   "leftSeamDifferentRows": [y for y, (p, q) in enumerate(zip(edge(filler, "right"), edge(coral, "left"))) if p != q],
                                   "rightSeamDifferentRows": [y for y, (p, q) in enumerate(zip(edge(coral, "right"), edge(filler, "left"))) if p != q],
                                   "observation": observation, "humanApproval": "none"})
        captures.append((name, canvas))

    sub_arch = crop(read(ARCHES), [0, 0, 32, 56])
    master_arch = crop(read(MASTER), [1056, 160, 32, 56])
    changed = Image.new("L", sub_arch.size)
    pairs = {}
    for y in range(sub_arch.height):
        for x in range(sub_arch.width):
            p, q = sub_arch.getpixel((x, y)), master_arch.getpixel((x, y))
            if p != q:
                changed.putpixel((x, y), 255)
                pairs[(p, q)] = pairs.get((p, q), 0) + 1
    variant_tests = [{"id": "stone-arch-subfile-versus-master-shadow", "subfileSourceId": sid(ARCHES), "subfileRect": [0, 0, 32, 56],
                      "masterSourceId": sid(MASTER), "masterRect": [1056, 160, 32, 56],
                      "subfileNormalizedRgbaSHA256": sha(sub_arch.tobytes()), "masterNormalizedRgbaSHA256": sha(master_arch.tobytes()),
                      "changedPixels": sum(pairs.values()), "changedBoundsXYXY": list(changed.getbbox()) if changed.getbbox() else None,
                      "changedMaskSHA256": sha(changed.tobytes()),
                      "changedRGBAValues": [{"subfile": list(p), "master": list(q), "pixels": n} for (p, q), n in sorted(pairs.items())],
                      "observation": "The whole arch is not an exact master alias: translucent shadow alpha differs. Preserve the five exact body-cell master occurrences, not an invented whole-arch lineage. No blanket shadow normalization or semantic inheritance applied."}]
    captures.extend([("stone-arch-original-master", master_arch), ("stone-arch-original-subfile", sub_arch)])
    result = {"schemaVersion": 2, "packetId": "RB01", "proposalRevision": 1, "state": "agent-proposal-frozen-for-independent-review",
              "coordinates": {"unit": "native pixels", "origin": "top-left", "rect": "[x,y,width,height]; half-open", "packedAliases": "separate packed-atlas pixels"},
              "pins": {"sourceLedger": {"path": str((PLAN / "source-files.json").relative_to(REPO)), "sha256": LEDGER_HASH},
                       "packedIndex": {"path": catalog_path, "sha256": sha(catalog_raw)}},
              "scope": {"surveyRegions": ["S02-R11", "S02-R09"], "floorMaterialWindow": [0, 0, 96, 96],
                        "stoneArchWindow": [0, 0, 32, 56], "floorRecords": 17, "archBodyRecords": 6, "archShadowRecords": 2,
                        "exclusions": ["remaining floor records/materials", "four other frame arches", "wall-cutout semantic mapping", "baseboards and captions as objects", "source repacking/art edits", "runtime and physics"],
                        "countMeaning": "25 crop/component records; not 25 whole objects; contextual wall probes are not candidates"},
              "sources": sorted(sources.values(), key=lambda s: s["path"]), "candidates": candidates,
              "matching": {"implementation": "scripts/semantic-map-match.py Matcher(grid=16)", "comparison": "exact RGBA; hidden RGB zeroed only at alpha=0",
                           "sheetDomains": [sid(p) for p in domain], "origins": "every fitting native16 grid origin anchored at [0,0] of each source; partial shadow crops also use this origin grid",
                           "packedAliasCorpus": {"domain": "every indexed native16 Room Builder tile and whole subfile sheet", "records": len(indexed), "allPixelLineagesVerified": True},
                           "limitation": "No arbitrary-pixel, clipped, occluded, transformed, other-pack or Interiors-master search; no missing-art claim. Whole-rectangle visible-byte equality only."},
              "assemblyExperiments": experiments, "contextExperiments": context_experiments, "variantExperiments": variant_tests,
              "completenessRules": [
                  {"family": "inset-square", "members": [role_ids[r] for r in ["inset-upper-left", "inset-upper-right", "inset-lower-left", "inset-lower-right"]],
                   "rule": "fixed 2x2 source motif; larger width/height compatibility unresolved after contour mismatch"},
                  {"family": "shaded-vertical-strip", "members": [role_ids[r] for r in ["shaded-upper-left", "shaded-upper-right", "left-side", "right-side", "narrow-lower-left", "narrow-lower-right"]],
                   "rule": "paired upper caps, 0..2 tested paired straight rows, paired lower caps; all offsets are native16; other counts and wide extension unapproved"},
                  {"family": "L/T-network-window", "rule": "one-row horizontal arm and two-column vertical stem; every open boundary explicitly declared; never a whole standalone prop"},
                  {"family": "stone-arch", "members": [f"RB01-A{n:02}" for n in range(1, 9)],
                   "rule": "six body cells at fixed [column*16,row*16] offsets; optional two 16x8 shadows at y48; no width/height repetition; caption interpretation qualified"}],
              "contexts": [{"sourceId": sid(MASTER), "rect": [0, 832, 704, 256]}, {"sourceId": sid(MASTER), "rect": [960, 112, 256, 592]},
                           {"sourceId": sid(PATHS), "rect": [0, 0, 96, 96]}, {"sourceId": sid(ARCHES), "rect": [0, 0, 160, 128]}],
              "review": {"independent": "pending separate artifact pinned to exact proposal file hash", "human": "none; not registered/approved/promoted"},
              "coverage": {"sourceRecordCount": len(candidates), "floorComponentRecords": 17, "archBodyRecords": 6, "shadowCompanionRecords": 2,
                           "assemblyProbes": len(experiments), "contextOnlyProbes": len(context_experiments),
                           "semanticExhaustiveness": "bounded selected palette/components only; no survey-window or pack completion claimed"},
              "reproduce": {"check": "python3 scripts/semantic-map-room-builder.py --check", "capture": "python3 scripts/semantic-map-room-builder.py --check --capture-dir /tmp/tilefun-semantic-RB01"}}
    if capture_dir:
        capture_dir.mkdir(parents=True, exist_ok=True)
        for i, context in enumerate(result["contexts"]):
            path = next(p for p in domain if sid(p) == context["sourceId"])
            im = crop(read(path), context["rect"])
            backing = Image.new("RGBA", im.size, "#dedede")
            backing.alpha_composite(im)
            backing.resize((im.width * 3, im.height * 3), Image.Resampling.NEAREST).save(capture_dir / f"context-{i + 1}.png")
        sheet = Image.new("RGB", (1000, 5 * 170), "#dedede")
        draw = ImageDraw.Draw(sheet)
        for i, candidate in enumerate(candidates):
            x, y = i % 5 * 200, i // 5 * 170
            im = images[candidate["id"]]
            scaled = im.resize((im.width * 6, im.height * 6), Image.Resampling.NEAREST)
            sheet.paste(scaled, (x + 20, y + 55), scaled)
            draw.text((x + 5, y + 5), candidate["id"], fill="black")
            draw.text((x + 5, y + 20), candidate["fields"]["role"]["value"], fill="black")
            draw.text((x + 5, y + 35), str(candidate["sourceRect"]), fill="black")
        sheet.save(capture_dir / "contact-sheet.png")
        sheet = Image.new("RGB", (1200, ((len(captures) + 2) // 3) * 300), "#dedede")
        draw = ImageDraw.Draw(sheet)
        for i, (name, im) in enumerate(captures):
            x, y = i % 3 * 400, i // 3 * 300
            draw.text((x + 10, y + 5), name, fill="black")
            scaled = im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST)
            sheet.paste(scaled, (x + 10, y + 35), scaled)
            backing = Image.new("RGBA", im.size, "#dedede")
            backing.alpha_composite(im)
            backing.resize((im.width * 6, im.height * 6), Image.Resampling.NEAREST).save(capture_dir / (name + ".png"))
        sheet.save(capture_dir / "assemblies.png")
        (capture_dir / "evidence.json").write_text(json.dumps({"proposalSHA256": sha((json.dumps(result, indent=2) + "\n").encode()), "coverage": result["coverage"], "captures": [name + ".png" for name, _ in captures]}, indent=2) + "\n")
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
            raise SystemExit("RB01 differs from reproduced evidence")
        print("RB01 verified: " + json.dumps(result["coverage"], sort_keys=True))
    else:
        OUTPUT.write_text(output)
        print("Wrote " + str(OUTPUT.relative_to(REPO)))


if __name__ == "__main__":
    main()
