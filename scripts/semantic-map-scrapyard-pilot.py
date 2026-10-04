#!/usr/bin/env python3
"""Reproduce P02 exact source evidence and temporary visual probes; never repack.

Requires Pillow and restored originals. --check compares JSON without mutation.
--capture-dir emits source crops/contact sheets/assembly probes only there.
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
PLAN = REPO / "docs/tactical/053-semantic-tileset-map"
MASTER_PATH = "public/assets/tilesets/me-complete.png"
MASTER_HASH = "1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737"
SINGLES = "assets/exteriors/Modern_Exteriors_16x16/Modern_Exteriors_Complete_Singles_16x16"
PREFIX = "ME_Singles_City_Props_16x16_"
SPEC = [
    ("Car_Wreck_1", "Damaged teal car shell", "wrecked-cars", "standalone-shell", "high", "Bent cabin/body and side windows; deformation distinguishes it from intact neighboring vehicles."),
    ("Car_Wreck_2", "Damaged pale-gray car shell", "wrecked-cars", "standalone-shell", "high", "Same broad bent-car silhouette as 1; pale body panels and dark windows."),
    ("Car_Wreck_4", "Two-car stack: gray over orange", "wrecked-cars", "baked-two-object-composition", "high", "Two distinct cabins and body silhouettes overlap vertically; gray is above orange."),
    ("Car_Wreck_7", "Three-car stack: orange, gray, teal", "wrecked-cars", "baked-three-object-composition", "high", "Three separate cabins/bodies form one exported PNG with bottom teal shell."),
    ("Car_Wreck_8", "Overturned teal car, lower sheet row", "overturned-car-wrecks", "standalone-underbody-view", "high", "Four circular wheels and exposed dark underside; no visible upright passenger cabin."),
    ("Car_Wreck_13", "Overturned teal car, upper sheet row", "overturned-car-wrecks", "standalone-underbody-view", "high", "Four wheels and underbody; front/rear end silhouette differs from 8, not merely row placement."),
    ("Junk_2", "Rust-colored hollow ring", "loose-industrial-debris", "loose-item", "medium", "Open dark center and mottled beige/rust rim; precise tire/pipe identity remains uncertain."),
    ("Junk_6", "Stacked curved metal strips", "loose-industrial-debris", "small-stack-composition", "medium", "Three silvery bent horizontal bands with orange/rust marks; bumper interpretation is plausible."),
    ("Junk_7", "Brown slatted frame or pallet", "loose-industrial-debris", "loose-frame", "medium", "Brown horizontal slats held by two darker side rails; material/usage cannot be fixed from this view."),
    ("Scrap_Metal_1", "Gray-and-orange compact scrap block", "compact-scrap-blocks", "loose-block", "medium", "Short dense cuboidal mass with irregular metallic-looking facets; no identifiable intact object."),
    ("Scrap_Metal_2", "Tall green-and-orange scrap block", "compact-scrap-blocks", "loose-block", "medium", "Vertical rectangular mass with green/orange bands and dark outline."),
    ("Scrap_Metal_3", "Small green-and-orange scrap block", "compact-scrap-blocks", "loose-block", "medium", "Short narrow rectangular mass; shares colored fragments with 2 but is not assumed scaled."),
    ("Scrap_Metal_4", "Small pale metallic scrap block", "compact-scrap-blocks", "loose-block", "medium", "Pale slanted highlight over a dark compact base; precise material stays proposed."),
    ("Scrap_Metal_7", "Tall mixed-color scrap block", "compact-scrap-blocks", "loose-block", "medium", "Tall rectangular compacted-looking bundle; green and orange fragments differ from 2."),
    ("Scrap_Metal_Pile_1", "Stacked compact scrap blocks", "compact-scrap-blocks", "baked-block-pile-composition", "high", "Several rectangular bundles form a stepped mound; individual components remain visually separable."),
    ("Trash_Pile_1", "Mixed refuse mound, plain", "mixed-refuse-mounds", "baked-mixed-pile", "high", "Broad tapering mound with gray fragments and orange/green litter; irregular outline."),
    ("Trash_Pile_2", "Mixed refuse mound with blue sign", "mixed-refuse-mounds", "baked-mixed-pile", "high", "Same broad mound family, with a conspicuous blue/white sign and brown circular debris."),
    ("Trash_Pile_3", "Mixed refuse mound with warning triangle", "mixed-refuse-mounds", "baked-mixed-pile", "high", "Orange/red warning triangle and framed debris rise from an irregular mound."),
    ("Trash_Pile_4", "Mixed refuse mound with round dark item", "mixed-refuse-mounds", "baked-mixed-pile", "high", "Dense mound has a dark round object at its rear and orange debris; original export has blank top padding."),
    ("Trash_Pile_5", "Mixed refuse mound with tall white item", "mixed-refuse-mounds", "baked-mixed-pile", "high", "Tall white rectangular item and orange debris project above the mound; precise appliance/container identity is unknown."),
    ("Trash_Pile_Modular_1", "Refuse strip left taper", "modular-refuse-strip", "left-cap", "high", "Triangular rising left edge with a vertically cut right side; assembly probe closes left end."),
    ("Trash_Pile_Modular_2", "Refuse strip body", "modular-refuse-strip", "repeatable-middle-proposal", "medium", "Wide rectangular band has upright edges on both sides; repeated placement was rendered, not inferred from name alone."),
    ("Trash_Pile_Modular_3", "Refuse strip right taper", "modular-refuse-strip", "right-cap", "high", "Vertically cut left side tapers down toward right; assembly probe closes right end."),
    ("Trash_Pile_Props_7", "Blue directional sign among debris", "refuse-loose-components", "potential-pile-overlay", "high", "Blue rectangle carries a white right-pointing arrow on a gray support; counterpart appears in pile 2."),
    ("Trash_Pile_Props_15", "Warning triangle on support", "refuse-loose-components", "potential-pile-overlay", "high", "Orange/red triangular warning face on gray pole; counterpart appears in pile 3."),
    ("Trash_Pile_Props_16", "Tall white rectangular discarded item", "refuse-loose-components", "potential-pile-overlay", "medium", "White vertical box with two pale horizontal divisions; refrigerator, appliance, bin or cabinet remain alternatives."),
    ("Water_Tower_1", "Cylindrical water-tank candidate", "neighboring-utilities", "complete-utility-prop", "medium", "Elevated pale cylinder, domed brown roof and central narrow support; no waste fragments."),
    ("Container_House_1", "Container-like utility cabin", "neighboring-utility-buildings", "complete-building-composition", "high", "Rectangular corrugated body has door/windows and rooftop fan or cooling units; proximity does not make it scrap."),
    ("Junk_Shack_1", "Corrugated shed or shack", "neighboring-utility-buildings", "complete-building-composition", "high", "Rust-striped corrugated roof/wall above a shutter/window; intact shelter silhouette rather than loose junk."),
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def all_pixel_matches(master, candidate, colors):
    """Rare visible color anchors scan C-backed bytes, then verify full RGBA."""
    data = master.tobytes()
    expected = candidate.tobytes()
    anchors = []
    for y in range(candidate.height):
        for x in range(candidate.width):
            pixel = expected[(y * candidate.width + x) * 4:(y * candidate.width + x + 1) * 4]
            if pixel[3]:
                anchors.append((colors.get(tuple(pixel), 0), x, y, pixel))
    _, sx, sy, pixel = min(anchors)
    matches = []
    pos = data.find(pixel)
    while pos >= 0:
        if pos % 4 == 0:
            index = pos // 4
            x, y = index % master.width - sx, index // master.width - sy
            if 0 <= x <= master.width - candidate.width and 0 <= y <= master.height - candidate.height:
                if master.crop((x, y, x + candidate.width, y + candidate.height)).tobytes() == expected:
                    matches.append([x, y, candidate.width, candidate.height])
        pos = data.find(pixel, pos + 1)
    return sorted(matches, key=lambda r: (r[1], r[0]))


def masked_overlay_probe(source, target):
    """Compare only component-visible pixels at every fitting offset in a pile."""
    pixels = source.tobytes()
    visible = [(i // 4 % source.width, i // 4 // source.width, pixels[i:i + 4])
               for i in range(0, len(pixels), 4) if pixels[i + 3]]
    scores = []
    for y in range(target.height - source.height + 1):
        for x in range(target.width - source.width + 1):
            patch = target.crop((x, y, x + source.width, y + source.height)).tobytes()
            equal = sum(patch[(py * source.width + px) * 4:(py * source.width + px + 1) * 4] == pixel
                        for px, py, pixel in visible)
            scores.append((equal, x, y))
    best = max(scores) if scores else None
    return {"visibleComponentPixels": len(visible),
            "bestEqualVisiblePixels": best[0] if best else 0,
            "bestOffset": list(best[1:]) if best else None,
            "exactVisibleSubset": bool(best and best[0] == len(visible)),
            "limitation": "Offsets must fit full source export; occlusion/clipping can defeat this comparison; subset equality alone does not prove assembly order."}


def build(capture_dir):
    raw = (REPO / MASTER_PATH).read_bytes()
    if sha(raw) != MASTER_HASH:
        raise ValueError("Pinned Exteriors master changed")
    module_spec = importlib.util.spec_from_file_location("semantic_match", REPO / "scripts/semantic-map-match.py")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    master = module.normalized(Image.open(REPO / MASTER_PATH))
    matcher = module.Matcher(master)
    pixel_matcher = module.Matcher(master, grid=1)
    ledger = json.loads((PLAN / "source-files.json").read_text())["files"]
    rows = {row[0]: row for row in ledger}
    index = json.loads((REPO / "public/data/me-atlas-index.json").read_text())["themes"]["ME_Singles_City_Props"]
    colors = None
    candidates = []
    images = {}
    for number, (key, label, family, role, confidence, evidence) in enumerate(SPEC, 1):
        path = f"{SINGLES}/{PREFIX}{key}.png"
        png = (REPO / path).read_bytes()
        if sha(png) != rows[path][1]:
            raise ValueError(f"Original differs from pinned ledger: {path}")
        image = module.normalized(Image.open(REPO / path))
        images[key] = image
        grid_matches = matcher.find(image)
        matches = pixel_matcher.find(image)
        if key in ("Trash_Pile_4", "Trash_Pile_5"):
            if colors is None:
                colors = {color: count for count, color in master.getcolors(1_000_000)}
            independent_matches = all_pixel_matches(master, image, colors)
            if matches != independent_matches:
                raise ValueError(f"Independent color-anchor and shared row-anchor scans disagree: {key}")
        aliases = [{"path": row[0], "sha256": row[1], "rect": [0, 0, image.width, image.height]}
                   for row in ledger if Path(row[0]).name == PREFIX + key + ".png" and row[1] == sha(png)]
        bbox = image.getchannel("A").getbbox()
        facing = "unknown compass heading"
        if key.startswith("Car_Wreck_"):
            facing = "overturned underbody; compass heading unknown" if key in ("Car_Wreck_8", "Car_Wreck_13") else "side/cabin view; compass heading unknown"
        alternatives = []
        if family == "compact-scrap-blocks":
            alternatives = ["compressed metal recycling bale", "bundled mixed trash with metallic highlights"]
        if key == "Junk_2":
            alternatives = ["worn tire", "open pipe coupling or loop"]
        if key == "Junk_6":
            alternatives = ["car bumpers", "bent general metal panels"]
        if key == "Junk_7":
            alternatives = ["wood pallet", "rusted metal grating/frame"]
        if key == "Trash_Pile_Props_16":
            alternatives = ["refrigerator/appliance", "cabinet/bin"]
        if key == "Water_Tower_1":
            alternatives = ["water storage tank", "generic elevated industrial tank"]
        if key in ("Car_Wreck_8", "Car_Wreck_13"):
            alternatives = ["front/rear heading difference", "different crushed underside variant"]
        if key == "Trash_Pile_Modular_2":
            alternatives = ["repeatable fill", "single fixed-width central strip"]
        candidates.append({
            "id": f"P02-{number:02d}", "sourceKey": key, "label": label,
            "sources": aliases, "sourceSize": list(image.size), "sourceAlphaBounds": list(bbox),
            "normalizedRgbaSHA256": sha(image.tobytes()),
            "masterOccurrences": [{"rect": rect,
                "visibleBounds": [rect[0] + bbox[0], rect[1] + bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]]}
                for rect in matches],
            "existingIndexRect": index.get(key),
            "matching": {"comparison": "exact normalized RGBA; transparent RGB ignored",
                "grid16Occurrences": grid_matches, "allOccurrencesWithinSearch": True,
                "searchGrid": 1,
                "independentlyVerifiedSearch": "rare visible color anchor" if key in ("Trash_Pile_4", "Trash_Pile_5") else None,
                "limitation": "Excludes only exact whole-export matches; occluded fragments and near-matches remain uncounted."},
            "fields": {
                "identity": {"value": label, "confidence": confidence, "evidence": evidence},
                "bounds": {"value": "whole exported single; alpha-visible bounds retained separately", "confidence": "high", "evidence": "Pinned single file and verified master occurrence(s)."},
                "family": {"value": family, "confidence": "medium", "evidence": "Shared silhouettes and materials in raw neighboring context and named singles; names are supporting evidence."},
                "role": {"value": role, "confidence": "medium" if "proposal" in role or "potential" in role else "high", "evidence": evidence},
                "facing": {"value": facing, "confidence": "low", "evidence": "No world-axis/compass convention proven by source image."}},
            "variantHypothesis": {"value": label, "confidence": confidence,
                "evidence": "Visible body color, stack count, outline or prominent added objects; no generic inheritance of near-matches."},
            "alternatives": alternatives,
            "discriminatingCheck": "Compare detailed source facets and related compositions; do not inherit specific material/object names from the legacy key." if alternatives else "Exact source/rect comparison supports this coarse identity; precise gameplay behavior is outside this packet.",
            "geometry": {"anchor": None, "footprint": None, "collision": None, "walkableSurfaces": None, "status": "unknown; no physics proposal"},
            "independentReview": "pending", "humanApproval": "not registered or approved"})
    assembly = []
    for repeats in (1, 2):
        sequence = ["Trash_Pile_Modular_1"] + ["Trash_Pile_Modular_2"] * repeats + ["Trash_Pile_Modular_3"]
        composed = Image.new("RGBA", (16 + 64 * repeats + 16, 32))
        x = 0
        joins = []
        for key in sequence:
            composed.alpha_composite(images[key], (x, 0))
            if x:
                joins.append(x)
            x += images[key].width
        alpha = composed.getchannel("A")
        seams = [{"x": join, "rowsOccupiedOnBothSides": [y for y in range(32) if alpha.getpixel((join - 1, y)) and alpha.getpixel((join, y))]} for join in joins]
        assembly.append({"bodyRepeats": repeats, "size": list(composed.size), "sequence": sequence,
                         "normalizedRgbaSHA256": sha(composed.tobytes()), "seams": seams})
        if capture_dir:
            backdrop = Image.new("RGBA", composed.size, "#25252c")
            backdrop.alpha_composite(composed)
            backdrop.resize((composed.width * 6, 192), Image.Resampling.NEAREST).save(capture_dir / f"modular-strip-{repeats}.png")
    wrong = Image.new("RGBA", (96, 32))
    wrong.alpha_composite(images["Trash_Pile_Modular_3"], (0, 0))
    wrong.alpha_composite(images["Trash_Pile_Modular_2"], (16, 0))
    wrong.alpha_composite(images["Trash_Pile_Modular_1"], (80, 0))
    if capture_dir:
        backdrop = Image.new("RGBA", wrong.size, "#25252c")
        backdrop.alpha_composite(wrong)
        backdrop.resize((576, 192), Image.Resampling.NEAREST).save(capture_dir / "modular-strip-reversed-caps.png")
    reversed_caps = {"sequence": ["Trash_Pile_Modular_3", "Trash_Pile_Modular_2", "Trash_Pile_Modular_1"],
        "size": [96, 32], "normalizedRgbaSHA256": sha(wrong.tobytes()),
        "expectedObservation": "Outer edges become vertical cuts; tapered faces point inward, weakening the reversed cap assignment."}
    overlays = [{"component": component, "pile": pile,
                 **masked_overlay_probe(images[component], images[pile])}
                for component, pile in [("Trash_Pile_Props_7", "Trash_Pile_2"),
                    ("Trash_Pile_Props_15", "Trash_Pile_3"), ("Trash_Pile_Props_16", "Trash_Pile_5")]]
    if capture_dir:
        for name, rect, scale in [("context", [1280, 2944, 1216, 400], 2), ("detail", [1728, 3024, 512, 304], 3)]:
            x, y, w, h = rect
            master.crop((x, y, x + w, y + h)).resize((w * scale, h * scale), Image.Resampling.NEAREST).save(capture_dir / (name + ".png"))
        cellw, cellh = 192, 192
        sheet = Image.new("RGB", (cellw * 6, cellh * 5), "#25252c")
        draw = ImageDraw.Draw(sheet)
        for i, candidate in enumerate(candidates):
            x, y = i % 6 * cellw, i // 6 * cellh
            image = images[candidate["sourceKey"]]
            scale = min(3, 180 // image.width, 148 // image.height)
            scaled = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
            sheet.paste(scaled, (x + (cellw - scaled.width) // 2, y + 40), scaled)
            draw.text((x + 4, y + 4), candidate["id"], fill="white")
            draw.text((x + 4, y + 20), candidate["sourceKey"], fill="white")
        sheet.save(capture_dir / "candidates.png")
    return {"schemaVersion": 1, "packetId": "P02", "proposalRevision": 1, "state": "proposed",
        "source": {"path": MASTER_PATH, "sha256": MASTER_HASH, "size": list(master.size),
            "coordinates": "original pixel [x,y,width,height], top-left, right/bottom exclusive"},
        "surveyRegions": [{"id": "context", "rect": [1280, 2944, 1216, 400]}, {"id": "scrapyard-detail", "rect": [1728, 3024, 512, 304]}],
        "scope": "29 representative candidates; not exhaustive scrapyard segmentation or full family coverage",
        "candidates": candidates,
        "experiments": {"modularStrip": assembly, "reversedCaps": reversed_caps, "visibleComponentSubset": overlays},
        "relations": [
            {"members": ["P02-01", "P02-02"], "relation": "color/form variants", "confidence": "medium", "limit": "not verified as pure recolors"},
            {"members": ["P02-03", "P02-04"], "relation": "car-shell stack compositions", "confidence": "high", "limit": "no claim that legacy standalone singles compose pixel-exactly into these exports"},
            {"members": ["P02-05", "P02-06"], "relation": "same teal overturned-car family; upper/lower variants", "confidence": "high", "limit": "compass heading and semantic order unknown"},
            {"members": ["P02-10", "P02-11", "P02-12", "P02-13", "P02-14", "P02-15"], "relation": "compact-block objects and composed block mound", "confidence": "medium", "limit": "pressed metal remains a hypothesis; no exact constituent reconstruction"},
            {"members": ["P02-21", "P02-22", "P02-23"], "relation": "left cap -> body -> right cap; repeat-body tested", "confidence": "medium", "limit": "rendered visual seam evidence only"},
            {"members": ["P02-17", "P02-24"], "relation": "blue-sign component and full mound", "confidence": "medium", "experiment": "visibleComponentSubset"},
            {"members": ["P02-18", "P02-25"], "relation": "warning-triangle component and full mound", "confidence": "medium", "experiment": "visibleComponentSubset"},
            {"members": ["P02-20", "P02-26"], "relation": "white-item component and full mound", "confidence": "medium", "experiment": "visibleComponentSubset"}],
        "review": {"independent": "pending separate review artifact", "human": "no registration, approval or promotion"},
        "coverage": {"candidateCount": len(candidates), "masterOccurrenceCount": sum(len(c["masterOccurrences"]) for c in candidates),
            "namedSourceOccurrences": sum(len(c["sources"]) for c in candidates),
            "sourceRegionsFullyAudited": False, "leftovers": ["Other seven car wreck exports", "Remaining junk/scrap loose items", "Most sixteen trash props", "Containers, tower variants, fence fragments, barrel pile and neighboring structures", "Small trash piles around y3984-4112 outside this pilot"]},
        "reproduce": {"generate": "python3 scripts/semantic-map-scrapyard-pilot.py", "check": "python3 scripts/semantic-map-scrapyard-pilot.py --check",
            "capture": "python3 scripts/semantic-map-scrapyard-pilot.py --check --capture-dir /tmp/tilefun-semantic-P02",
            "dependencies": "Pillow, pinned original singles restored, committed source ledger and exact matcher"}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--capture-dir", type=Path)
    args = parser.parse_args()
    if args.capture_dir:
        args.capture_dir.mkdir(parents=True, exist_ok=True)
    result = build(args.capture_dir)
    data = (json.dumps(result, indent=2, ensure_ascii=False) + "\n").encode()
    path = PLAN / "packets/P02-scrapyard.json"
    if args.check:
        if path.read_bytes() != data:
            raise ValueError("P02 JSON differs from pinned source evidence/proposal")
    else:
        path.write_bytes(data)
    print(f"{'Verified' if args.check else 'Wrote'} P02: {len(result['candidates'])} candidates; {result['coverage']['masterOccurrenceCount']} master occurrences.")


if __name__ == "__main__":
    main()
