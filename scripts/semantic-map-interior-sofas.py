#!/usr/bin/env python3
"""Reproduce I01 Basement sofa/seat lineage, variants and assembly evidence.

Requires Pillow and restored originals. Never writes source art or packed atlases.
--check compares proposal JSON; --capture-dir writes disposable source-only probes.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
PLAN = REPO / "docs/tactical/053-semantic-tileset-map"
OUTPUT = PLAN / "packets/I01-interior-sofas.json"
LEDGER_HASH = "c98c9174f84c7cc8f38011a7b02f87b00f6891a416d0627b31ba7f2a223d2bda"
MASTER = "assets/interiors/1_Interiors/16x16/Interiors_16x16.png"
MASTER_HASH = "a35b8ed8ef392657a9339e1ce0831a3efe7b4631bfff69835bb5ef3bc738550b"
SELECTED = [("normal", n) for n in [*range(4, 16), *range(27, 33)]] + [("black-shadow", 4), ("shadowless", 4)]
SHADOW_PIXELS = {"normal": (167, 151, 150, 255), "black-shadow": (58, 58, 80, 100)}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def sid(path):
    return "src-" + sha(path.encode())[:16]


def vendor_index(entry):
    return int(Path(entry["sourcePath"]).stem.rsplit("_", 1)[1])


def field(value, confidence, evidence, alternatives=None, disposition="proposed"):
    return {"value": value, "confidence": confidence, "evidence": evidence,
            "alternatives": alternatives or [], "disposition": disposition}


def canonical_body(im, variant):
    # A bounded three-record hypothesis, not an Interiors-wide normalization rule.
    raw = bytearray(im.tobytes())
    shadow = SHADOW_PIXELS.get(variant)
    if shadow:
        for i in range(0, len(raw), 4):
            if tuple(raw[i:i + 4]) == shadow:
                raw[i:i + 4] = bytes(4)
    return sha(raw)


def delta(a, b):
    if a.size != b.size:
        raise ValueError("Variant alignment must be explicit")
    ar, br = a.tobytes(), b.tobytes()
    changed, outside, inside, color_pairs = [], 0, 0, set()
    mask = Image.new("L", a.size)
    for i in range(0, len(ar), 4):
        p, q = tuple(ar[i:i + 4]), tuple(br[i:i + 4])
        if p != q:
            x, y = (i // 4) % a.width, (i // 4) // a.width
            changed.append((x, y))
            mask.putpixel((x, y), 255)
            color_pairs.add((p, q))
            if q[3]:
                inside += 1
            else:
                outside += 1
    return {"size": list(a.size), "inputNormalizedRgbaSHA256": sha(ar), "referenceNormalizedRgbaSHA256": sha(br),
            "changedPixels": len(changed), "onReferenceBodyPixels": inside, "outsideReferenceBodyPixels": outside,
            "changedBoundsXYXY": list(mask.getbbox()) if changed else None,
            "changedMaskSHA256": sha(mask.tobytes()),
            "changedColorPairs": [[list(p), list(q)] for p, q in sorted(color_pairs)], "exactEqual": not changed}


def role(n):
    if n in (4, 10):
        return "front-left-cap"
    if n in (5, 11):
        return "front-repeat-middle"
    if n in (6, 12):
        return "front-right-cap"
    if n in (9, 15):
        return "complete-small-upholstered-seat"
    if n in (7, 8, 13, 14):
        return "unresolved-long-seat-or-extension"
    if n in (27, 30):
        return "side-top-cap"
    if n in (28, 31):
        return "side-repeat-middle"
    return "side-bottom-cap"


def build(capture_dir):
    ledger_raw = (PLAN / "source-files.json").read_bytes()
    if sha(ledger_raw) != LEDGER_HASH:
        raise ValueError("Pinned source ledger changed")
    rows = json.loads(ledger_raw)["files"]
    ledger = {r[0]: r for r in rows}
    spec = importlib.util.spec_from_file_location("semantic_match", REPO / "scripts/semantic-map-match.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sources = {}

    def read(path):
        raw = (REPO / path).read_bytes()
        row = ledger[path]
        if sha(raw) != row[1]:
            raise ValueError(f"Pinned PNG changed: {path}")
        im = module.normalized(Image.open(REPO / path))
        if list(im.size) != row[2:4]:
            raise ValueError(f"Pinned source dimensions changed: {path}")
        sources[sid(path)] = {"id": sid(path), "path": path, "pngSHA256": row[1], "size": list(im.size),
                              "normalizedRgbaSHA256": sha(im.tobytes())}
        return im

    master = read(MASTER)
    if sources[sid(MASTER)]["pngSHA256"] != MASTER_HASH:
        raise ValueError("Master pin changed")
    master_matcher = module.Matcher(master, grid=1)
    catalog_path = "public/data/modern-interiors-atlas.json"
    catalog_raw = (REPO / catalog_path).read_bytes()
    catalog = json.loads(catalog_raw)
    packed_path = "public/" + catalog["atlas"]
    packed = read(packed_path)
    basement = [e for e in catalog["entries"] if e.get("sourceKind") == "single" and e.get("theme") == "basement"]
    selected = {(e["variant"], vendor_index(e)): e for e in basement if (e["variant"], vendor_index(e)) in SELECTED}
    if set(selected) != set(SELECTED):
        raise ValueError("Selected source/variant identities changed")
    images = {key: read(e["sourcePath"]) for key, e in selected.items()}
    id_by_key = {key: f"I01-{i:02d}" for i, key in enumerate(SELECTED, 1)}
    theme_paths = [r[0] for r in rows if r[5].startswith("interiors-theme-") and "Basement" in r[0]]
    if len(theme_paths) != 3:
        raise ValueError("Basement theme-sheet domain changed")
    theme_matchers = {p: module.Matcher(read(p), grid=1) for p in theme_paths}

    # Exact aliases across all indexed native16 single variants, not same-name only.
    corpus = [e for e in catalog["entries"] if e.get("sourceKind") == "single"]
    target_identities = {(im.size, sha(im.tobytes())) for im in images.values()}
    aliases = {identity: [] for identity in target_identities}
    possible_sizes = {identity[0] for identity in target_identities}
    fitting_count = 0
    for entry in corpus:
        if tuple(entry["sourceRect"][2:4]) not in possible_sizes:
            continue
        path = entry["sourcePath"]
        raw = (REPO / path).read_bytes()
        if sha(raw) != ledger[path][1]:
            raise ValueError(f"Alias corpus source drift: {path}")
        im = module.normalized(Image.open(REPO / path))
        identity = (im.size, sha(im.tobytes()))
        fitting_count += 1
        if identity in aliases:
            read(path)
            x, y, w, h = entry["rect"]
            if (w, h) != im.size or min(x, y) < 0 or x + w > packed.width or y + h > packed.height:
                raise ValueError(f"Packed alias bounds invalid: {entry['key']}")
            if packed.crop((x, y, x + w, y + h)).tobytes() != im.tobytes():
                raise ValueError(f"Packed pixel alias differs: {entry['key']}")
            aliases[identity].append({"sourceId": sid(path), "packedKey": entry["key"], "packedRect": entry["rect"], "variant": entry["variant"]})

    counterpart_pool = [e for e in basement if e["variant"] == "shadowless"]
    counterpart_images = {vendor_index(e): read(e["sourcePath"]) for e in counterpart_pool}
    counterpart_corpus = [{"sourceId": sid(e["sourcePath"]), "vendorIndex": vendor_index(e)} for e in counterpart_pool]
    counterpart_tests = []
    reference = images[("shadowless", 4)]
    for variant in ("normal", "black-shadow", "shadowless"):
        im = images[(variant, 4)]
        signature = canonical_body(im, variant)
        pool_matches = [n for n, other in counterpart_images.items()
                        if im.size == other.size and signature == canonical_body(other, "shadowless")]
        counterpart_tests.append({"member": id_by_key[(variant, 4)], "shadowlessReference": id_by_key[("shadowless", 4)],
                                  "normalization": "zero only observed shadow token; otherwise exact normalized RGBA",
                                  "shadowToken": list(SHADOW_PIXELS[variant]) if variant in SHADOW_PIXELS else None,
                                  "canonicalBodySHA256": signature, "shadowlessPoolMatches": sorted(pool_matches),
                                  "deltaFromShadowless": delta(im, reference),
                                  "limit": "Only these three records validated; no color/reflection rule applied to other furniture."})

    candidates = []
    for variant, n in SELECTED:
        im, entry = images[(variant, n)], selected[(variant, n)]
        x0, y0, x1, y1 = im.getchannel("A").getbbox()
        member_role = role(n)
        color = "blue-gray striped" if n <= 9 else "pale gray checked"
        if n in (9, 15):
            identity = "Small " + color + " upholstered seat"
            alternative = ["ottoman/footstool", "low chair; raised back not clearly established"]
            evidence = "Rounded closed upper contour, closed side supports, short front band and two dark feet survive in the complete 16x16 export."
            standalone = "allowed as visual proposal only"
            ports = []
            neighbors = []
        elif n in (7, 8, 13, 14):
            identity = color.capitalize() + " long seat or chaise extension"
            alternative = ["complete long backless upholstered seat", "chaise-end/seat-extension module for another sofa"]
            evidence = "Long padded panel has visible bottom feet and a straight top edge. The frame alone does not establish whether the top edge closes the object or is an assembly connection."
            standalone = "unknown; role unresolved"
            ports = ["top-edge connection is a hypothesis, not an established port"]
            neighbors = []
        else:
            identity = color.capitalize() + " sofa " + member_role.replace("-", " ")
            alternative = ["individual whole chair"]
            evidence = "At least one export edge cuts continuously occupied upholstery. Closed outer contour appears only with the complementary cap; source and reversed-cap probes test this explicitly."
            standalone = "forbidden; partial component"
            ports = {"front-left-cap": ["right"], "front-repeat-middle": ["left", "right"], "front-right-cap": ["left"],
                     "side-top-cap": ["bottom"], "side-repeat-middle": ["top", "bottom"], "side-bottom-cap": ["top"]}[member_role]
            neighbors = ports
        if n in (4, 5, 6):
            group = [4, 5, 6]
        elif n in (10, 11, 12):
            group = [10, 11, 12]
        elif n in (27, 28, 29):
            group = [27, 28, 29]
        elif n in (30, 31, 32):
            group = [30, 31, 32]
        else:
            group = []
        repeat_middle = member_role in ("front-repeat-middle", "side-repeat-middle")
        compatible = [id_by_key[(variant, other)] for other in group if (variant, other) in id_by_key and (other != n or repeat_middle)]
        facing = "broad back-and-seat/front-band view" if n <= 15 else "side view; tall rail at image " + ("right" if n <= 29 else "left")
        if n in (7, 8, 13, 14):
            facing = "long padded top-panel/front-foot view; raised back not established"
        if n in (9, 15):
            facing = "small padded top/front-band view; raised back not established"
        port_roles = {"front-left-cap": {"right": ["front-repeat-middle", "front-right-cap"]},
                      "front-repeat-middle": {"left": ["front-left-cap", "front-repeat-middle"], "right": ["front-repeat-middle", "front-right-cap"]},
                      "front-right-cap": {"left": ["front-left-cap", "front-repeat-middle"]},
                      "side-top-cap": {"bottom": ["side-repeat-middle", "side-bottom-cap"]},
                      "side-repeat-middle": {"top": ["side-top-cap", "side-repeat-middle"], "bottom": ["side-repeat-middle", "side-bottom-cap"]},
                      "side-bottom-cap": {"top": ["side-top-cap", "side-repeat-middle"]}}.get(member_role, {})
        occurrences = []
        for path, matcher in [(MASTER, master_matcher), *theme_matchers.items()]:
            for r in matcher.find(im):
                occurrences.append({"sourceId": sid(path), "rect": r, "lineage": "direct-exact-normalized-RGBA"})
        candidates.append({"id": id_by_key[(variant, n)], "vendorIndex": n, "variant": variant,
            "primarySourceId": sid(entry["sourcePath"]), "exportRect": entry["sourceRect"],
            "alphaVisibleRect": [x0, y0, x1 - x0, y1 - y0], "normalizedRgbaSHA256": sha(im.tobytes()),
            "occurrences": occurrences,
            "packedAlias": {"sourceId": sid(packed_path), "key": entry["key"], "rect": entry["rect"], "coordinateSpace": "packed-atlas pixels; sourceRect remains separate", "exactVerified": True},
            "namedExportAliases": aliases[(im.size, sha(im.tobytes()))],
            "fields": {
                "identity": field(identity, "medium" if n in (7, 8, 13, 14) else "high", evidence, alternative),
                "bounds": field("whole original export; alpha bounds separate", "high", "Pinned named single and exact committed packed-alias pixels; all fitting full-sheet occurrences retained."),
                "family": field("upholstered-basement-sofa-kit", "high", "Shared padded/checked or striped body surfaces and aligned cap/middle contours; exact singles belong to Basement, correcting proximity-based Living Room inference."),
                "role": field(member_role, "low" if n in (7, 8, 13, 14) else "high", evidence, alternative,
                              "unresolved" if n in (7, 8, 13, 14) else "proposed"),
                "facing": field(facing + "; compass heading unknown", "medium", "Raised back/support or front band position is visible; source does not establish world compass coordinates.", ["world heading unknown"]),
                "variant": field(color + "; " + variant, "high", "Source pixels and raw render-variant differences retained; counterpart tests limited to vendor index4.")},
            "topology": {"standaloneEligibility": standalone, "openJoinEdges": ports, "requiredNeighborEdges": neighbors,
                         "compatibleSelectedMembers": compatible, "variantCompatibility": "same body palette, facing family and render variant; cross-variant mixing not tested",
                         "requiredPortNeighborRoles": port_roles, "repeatableMiddle": repeat_middle,
                         "limits": "Only explicit examples below rendered; 7/8/13/14 retain unresolved join and standalone roles; black-shadow/shadowless cap4 needs neighbors outside this selected packet.",
                         "enforcement": "metadata only; no runtime/catalog change"},
            "geometry": {"anchor": None, "footprint": None, "collision": None, "walkableSurfaces": None, "status": "unknown"},
            "independentReview": "pending", "humanApproval": "unregistered; not approved"})

    def compose(ns, axis):
        members = [images[("normal", n)] for n in ns]
        w = sum(im.width for im in members) if axis == "x" else max(im.width for im in members)
        h = max(im.height for im in members) if axis == "x" else sum(im.height for im in members)
        canvas = Image.new("RGBA", (w, h))
        offset = 0
        placements = []
        seams = []
        for n, im in zip(ns, members):
            x, y = (offset, 0) if axis == "x" else (0, offset)
            if offset:
                seams.append(offset)
            canvas.paste(im, (x, y))
            placements.append({"memberId": id_by_key[("normal", n)], "sourceRect": [0, 0, im.width, im.height], "targetOffset": [x, y]})
            offset += im.width if axis == "x" else im.height
        alpha = canvas.getchannel("A")
        continuity = []
        for seam in seams:
            span = h if axis == "x" else w
            occupied = [k for k in range(span) if (alpha.getpixel((seam - 1, k)) and alpha.getpixel((seam, k)) if axis == "x"
                                                   else alpha.getpixel((k, seam - 1)) and alpha.getpixel((k, seam)))]
            continuity.append({"axis": axis, "offset": seam, "positionsOccupiedOnBothSides": occupied})
        return canvas, placements, continuity

    recipes = [
        ("blue-front-closed", [4, 5, 6], "x", True), ("gray-front-closed", [10, 11, 12], "x", True),
        ("blue-front-short", [4, 6], "x", True), ("blue-front-repeated-middle", [4, 5, 5, 6], "x", True),
        ("blue-front-reversed-caps", [6, 5, 4], "x", False), ("blue-front-uncapped", [5, 5], "x", False),
        ("gray-side-right-short", [27, 29], "y", True), ("gray-side-right-extended", [27, 28, 29], "y", True),
        ("gray-side-right-repeated", [27, 28, 28, 29], "y", True),
        ("gray-side-left-short", [30, 32], "y", True), ("gray-side-left-extended", [30, 31, 32], "y", True),
        ("gray-side-reversed-caps", [29, 28, 27], "y", False),
        ("gray-side-source-sampler", [27, 29, 28], "y", False),
        ("blue-lower-seats-paired", [7, 8], "x", None), ("gray-lower-seats-paired", [14, 13], "x", None)]
    experiments = []
    captures = []
    for name, ns, axis, valid in recipes:
        canvas, placements, continuity = compose(ns, axis)
        experiments.append({"id": name, "operation": "RGBA overwrite onto transparent canvas; no source resizing",
                            "placements": placements, "size": list(canvas.size), "outputNormalizedRgbaSHA256": sha(canvas.tobytes()),
                            "exactMasterOccurrences": master_matcher.find(canvas), "joinAlphaContinuity": continuity,
                            "topologyDisposition": "proposed-valid" if valid is True else "invalid-open-ends" if valid is False else "unresolved-role-probe",
                            "observation": "Complementary outer caps close the upholstered chain." if valid is True else "Outer cut edge or unclosed lower end remains; continuity alone is insufficient." if valid is False else "Pairing is rendered for comparison; no standalone/join rule assigned from this alone.",
                            "renderQuality": "mapper source-pixel visual inspection; independent review pending",
                            "humanApproval": "none"})
        captures.append((name, canvas))

    result = {"schemaVersion": 2, "packetId": "I01", "proposalRevision": 1, "state": "agent-proposal",
        "coordinates": {"unit": "native pixels", "origin": "top-left", "rect": "[x,y,width,height]; half-open", "deltaBounds": "[left,top,right,bottom]; half-open", "packedAliases": "separate packed-atlas coordinates"},
        "pins": {"sourceLedger": {"path": str((PLAN / "source-files.json").relative_to(REPO)), "sha256": LEDGER_HASH},
                 "packedIndex": {"path": catalog_path, "sha256": sha(catalog_raw)}},
        "scope": {"normalVendorIndices": [*range(4, 16), *range(27, 33)], "additionalVariantRecords": [["black-shadow", 4], ["shadowless", 4]],
                  "surveyRegion": "S02-I16", "normalRecords": 18, "additionalRenderCounterparts": 2,
                  "exclusions": ["remaining Basement sofa colors/facings", "other shadow-set members", "other themes", "runtime placement or physics"],
                  "countMeaning": "20 records / 18 normal variant proposal units; render counterparts are not additional concepts or unique objects"},
        "sources": sorted(sources.values(), key=lambda s: s["path"]), "candidates": candidates,
        "matching": {"implementation": "scripts/semantic-map-match.py Matcher(grid=1)", "comparison": "exact RGBA; transparent RGB zeroed only where alpha is zero",
                     "sheetDomains": [sid(p) for p in [MASTER, *theme_paths]], "origins": "every fitting integer pixel origin",
                     "aliasCorpus": {"domain": "all indexed native16 Interiors singles in all three variants", "records": len(corpus), "sameSizeRecordsRead": fitting_count},
                     "limitation": "Exact whole-export equality only; no absence claim for clipped, occluded, alternate-body or other theme-sheet appearances."},
        "counterpartCorpus": counterpart_corpus, "counterpartExperiments": counterpart_tests,
        "assemblyExperiments": experiments,
        "completenessRules": [{"family": "front-sofa", "normalMemberGroups": [[id_by_key[("normal", n)] for n in ns] for ns in [[4, 5, 6], [10, 11, 12]]],
                               "rule": "left cap -> zero or more middles -> right cap; constant 32-pixel height; 16-pixel horizontal advance; same palette/variant",
                               "testedMiddleCounts": [0, 1, 2], "limit": "Only blue bank tested at 0 and2; gray bank at1. Arbitrarily long chains and mixed colors unapproved."},
                              {"family": "side-sofa", "normalMemberGroups": [[id_by_key[("normal", n)] for n in ns] for ns in [[27, 28, 29], [30, 31, 32]]],
                               "rule": "top cap -> zero or more middles -> bottom cap; 32-pixel width; top is32 pixels high, middle/end16; same facing/palette/variant",
                               "testedMiddleCounts": [0, 1, 2], "limit": "Two middles tested only for right-rail family. Source sampler top/end/middle is not a complete extended chain."}],
        "contexts": [{"sourceId": sid(MASTER), "rect": [32, 5456, 208, 208]}],
        "review": {"independent": "pending separate per-member artifact pinned to proposal hash", "human": "unregistered; no approval or promotion"},
        "coverage": {"sourceRecordCount": len(candidates), "normalSourceRecords": 18, "additionalRenderCounterparts": 2,
                     "exactMasterOccurrenceCount": sum(o["sourceId"] == sid(MASTER) for c in candidates for o in c["occurrences"]),
                     "standaloneVisualProposals": [c["id"] for c in candidates if c["topology"]["standaloneEligibility"].startswith("allowed")],
                     "unresolvedRoleMembers": [c["id"] for c in candidates if "unknown" in c["topology"]["standaloneEligibility"]],
                     "semanticExhaustiveness": "bounded selected source groups; no whole-region or pack completion claimed"},
        "reproduce": {"check": "python3 scripts/semantic-map-interior-sofas.py --check", "capture": "python3 scripts/semantic-map-interior-sofas.py --check --capture-dir /tmp/tilefun-semantic-I01"}}
    if capture_dir:
        capture_dir.mkdir(parents=True, exist_ok=True)
        sheet = Image.new("RGB", (1000, 800), "#dedede")
        draw = ImageDraw.Draw(sheet)
        for i, key in enumerate(SELECTED):
            x, y = i % 5 * 200, i // 5 * 200
            im = images[key]
            scaled = im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST)
            sheet.paste(scaled, (x + 20, y + 40), scaled)
            draw.text((x + 5, y + 5), id_by_key[key] + " Basement " + str(key[1]), fill="black")
            draw.text((x + 5, y + 20), key[0], fill="black")
        sheet.save(capture_dir / "contact-sheet.png")
        assembly_sheet = Image.new("RGB", (1200, 5 * 380), "#dedede")
        draw = ImageDraw.Draw(assembly_sheet)
        for i, (name, im) in enumerate(captures):
            x, y = i % 3 * 400, i // 3 * 380
            scaled = im.resize((im.width * 4, im.height * 4), Image.Resampling.NEAREST)
            assembly_sheet.paste(scaled, (x + 20, y + 35), scaled)
            draw.text((x + 5, y + 5), name, fill="black")
            draw.text((x + 5, y + 20), experiments[i]["topologyDisposition"], fill="black")
        assembly_sheet.save(capture_dir / "assemblies.png")
        context = master.crop((32, 5456, 240, 5664))
        backing = Image.new("RGBA", context.size, "#dedede")
        backing.alpha_composite(context)
        backing.resize((context.width * 4, context.height * 4), Image.Resampling.NEAREST).save(capture_dir / "context.png")
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
            raise SystemExit("I01 differs from reproduced evidence")
        print("I01 verified: " + json.dumps(result["coverage"], sort_keys=True))
    else:
        OUTPUT.write_text(output)
        print("Wrote " + str(OUTPUT.relative_to(REPO)))


if __name__ == "__main__":
    main()
