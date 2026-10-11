"""Compare every road vehicle's four source views without changing source pixels.

Outputs a reproducible offline report and source contact sheets. Exact alpha,
binary occupancy and reversible palette equivalence are separate tests; none
proves hidden 3D geometry or authorizes a template transfer by itself.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DIRECTIONS = ("east", "west", "north", "south")
PHYSICAL_KEYS = ("anchor", "footprint", "colliders", "depthOffset")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def signature(parts):
    result = hashlib.sha256()
    for dimensions, data in parts:
        result.update(json.dumps(dimensions).encode())
        result.update(data)
    return result.hexdigest()


def palette_pattern(views):
    """Global equality of color regions across ALL views, not per-view remaps."""
    labels, parts = {}, []
    for image in views:
        values = bytearray()
        for pixel in image.get_flattened_data():
            if not pixel[3]:
                label = 0
            else:
                if pixel not in labels:
                    labels[pixel] = len(labels) + 1
                label = labels[pixel]
            values.extend(label.to_bytes(4, "little"))
        parts.append((image.size, values))
    return signature(parts)


def palette_transfer(before, after):
    """Directional map permits color merging, but never one-to-many mapping."""
    correspondences, changed, visible = defaultdict(Counter), 0, 0
    for direction, a, b in zip(DIRECTIONS, before, after):
        if a.size != b.size or a.getchannel("A").tobytes() != b.getchannel("A").tobytes():
            return {"consistent": False, "reason": "alpha-or-size-differs"}
        for source, target in zip(a.get_flattened_data(), b.get_flattened_data()):
            if not source[3]:
                continue
            visible += 1
            changed += source != target
            correspondences[source][target] += 1
    # Most frequent target minimizes exceptions to a single global remap. A
    # first-seen map exaggerates edits when its first pixel is the exception.
    mapping = {source: max(targets, key=lambda target: (targets[target], target))
               for source, targets in correspondences.items()}
    conflicts = {source: sum(targets.values()) - targets[mapping[source]]
                 for source, targets in correspondences.items() if len(targets) > 1}
    exceptions = {}
    for direction, a, b in zip(DIRECTIONS, before, after):
        exceptions[direction] = sum(mapping[x] != y for x, y in
                                    zip(a.get_flattened_data(), b.get_flattened_data()) if x[3])
    return {
        "consistent": not conflicts,
        "sourceColors": len(mapping),
        "changedPixels": changed,
        "conflictingSourceColors": len(conflicts),
        "conflictingPixels": sum(conflicts.values()),
        "visiblePixels": visible,
        "exceptionsByView": exceptions,
        "map": [{"from": list(a), "to": list(b)} for a, b in sorted(mapping.items())]
    }


def group(records, field, prefix):
    grouped = defaultdict(list)
    for record in records:
        grouped[record[field]].append(record["id"])
    return [{"id": f"{prefix}{i:02d}", "members": members}
            for i, members in enumerate(grouped.values(), 1)]


def overlap(a, b):
    """Tight-box top-left alignment; translation only, never scaling/flipping."""
    w, h = max(a.width, b.width), max(a.height, b.height)
    masks = []
    for image in (a, b):
        canvas = Image.new("L", (w, h))
        canvas.paste(image.getchannel("A").point(lambda x: 255 if x else 0), (0, 0))
        masks.append(canvas.tobytes())
    intersection = sum(bool(x and y) for x, y in zip(*masks))
    union = sum(bool(x or y) for x, y in zip(*masks))
    return {"iou": round(intersection / union, 6), "differentPixels": union - intersection,
            "sizeA": list(a.size), "sizeB": list(b.size)}


def best_overlap(a, b):
    """Expose up to two pixels of whole-crop registration uncertainty."""
    points = []
    for image in (a, b):
        points.append({(x, y) for y in range(image.height) for x in range(image.width)
                       if image.getpixel((x, y))[3]})
    candidates = []
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            shifted = {(x + dx, y + dy) for x, y in points[1]}
            different = len(points[0] ^ shifted)
            union = len(points[0] | shifted)
            candidates.append((different, abs(dx) + abs(dy), dx, dy, union))
    different, _, dx, dy, union = min(candidates)
    return {"iou": round(1 - different / union, 6), "differentPixels": different,
            "translationB": [dx, dy], "sizeA": list(a.size), "sizeB": list(b.size)}


def contact_sheet(groups, images, path, title):
    # One member per row, grouped by exact equivalence; all four views visible.
    width, row_height = 980, 166
    canvas = Image.new("RGB", (width, 52 + sum(len(g["members"]) for g in groups) * row_height), "#f5f5f5")
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 10), title, fill="#101820", font_size=19)
    draw.text((205, 34), "EAST                      WEST                      NORTH                     SOUTH", fill="#101820")
    row = 0
    for number, family in enumerate(groups):
        for member in family["members"]:
            top = 52 + row * row_height
            draw.rectangle((0, top, width, top + row_height - 1), fill="#e3eef3" if number % 2 == 0 else "#faf0e0")
            draw.text((12, top + 10), family["id"], fill="#101820", font_size=17)
            draw.text((12, top + 36), member, fill="#101820", font_size=13)
            for index, image in enumerate(images[member]):
                # Native pixels enlarged uniformly per set; long fire views remain native.
                scale = 2 if max(image.width, image.height) <= 76 else 1
                enlarged = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
                left = 205 + index * 190
                canvas.paste(enlarged, (left + (170 - enlarged.width) // 2,
                                        top + (row_height - enlarged.height) // 2), enlarged)
            row += 1
    canvas.save(path)


def near_sheet(pairs, images, path):
    rows = [(pair, direction) for pair in pairs for direction in DIRECTIONS
            if pair["views"][direction]["differentPixels"]]
    canvas = Image.new("RGB", (1000, 80 + len(rows) * 280), "#f5f5f5")
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 10), "Near matches: whole-sprite translation only; silhouette exceptions", fill="black", font_size=19)
    draw.text((12, 40), "A (left) / B aligned (middle) / common gray, A-only magenta, B-only cyan (right)", fill="black", font_size=15)
    for row, (pair, direction) in enumerate(rows):
        top = 80 + row * 280
        draw.text((12, top), f"{pair['a']} vs {pair['b']} / {direction}", fill="black", font_size=16)
        metrics = pair["views"][direction]
        draw.text((12, top + 25), f"B shift {metrics['translationB']}; {metrics['differentPixels']} differing pixels; IoU {metrics['iou']}", fill="black", font_size=14)
        a = images[pair["a"]][DIRECTIONS.index(direction)]
        b = images[pair["b"]][DIRECTIONS.index(direction)]
        dx, dy = metrics["translationB"]
        width, height = max(a.width, b.width + dx) + 8, max(a.height, b.height + dy) + 8
        layers = []
        for image, shift in ((a, (4, 4)), (b, (4 + dx, 4 + dy))):
            layer = Image.new("RGBA", (width, height))
            layer.paste(image, shift)
            layers.append(layer)
        overlay = Image.new("RGB", (width, height), "#f5f5f5")
        overlay.putdata([(120, 130, 140) if x[3] and y[3] else
                         (240, 0, 150) if x[3] else (0, 180, 240) if y[3] else (245, 245, 245)
                         for x, y in zip(layers[0].get_flattened_data(), layers[1].get_flattened_data())])
        scale = 2
        for column, layer in enumerate([*layers, overlay]):
            enlarged = layer.resize((width * scale, height * scale), Image.Resampling.NEAREST)
            canvas.paste(enlarged, (20 + column * 325, top + 55), enlarged if layer.mode == "RGBA" else None)
    canvas.save(path)


def audit(output):
    if output.exists():
        raise FileExistsError("Choose a fresh offline report directory.")
    inventory_path = ROOT / "docs/research/vehicle-source-audit.json"
    bank_path = ROOT / "src/traffic/vehicles-v1.json"
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    bank = json.loads(bank_path.read_text(encoding="utf-8"))
    source_path = ROOT / inventory["source"]["path"]
    if digest(source_path) != inventory["source"]["sha256"]:
        raise ValueError("Source image differs from the frozen inventory.")
    if bank["sourceFingerprint"] != inventory["source"]["sha256"]:
        raise ValueError("Bank and audit pin different source images.")
    source = Image.open(source_path).convert("RGBA")
    bank_views = {(v["vehicleId"], v["direction"]): v for v in bank["views"]}
    if {v["id"] for v in inventory["variants"]} != {key[0] for key in bank_views}:
        raise ValueError("Audit and runtime source inventories differ.")
    images, raw_images, records, physical = {}, {}, [], {}
    for vehicle in inventory["variants"]:
        identifier = vehicle["id"]
        raw, tight, views, meta = [], [], {}, {}
        for direction in DIRECTIONS:
            runtime = bank_views[identifier, direction]
            audited_rect = vehicle["directions"][direction]["rect"]
            # The approved bank tightens three documented neighboring fragments.
            # Compare the actual gameplay source selections and expose that delta.
            rect = runtime["rect"]
            x, y, w, h = rect
            if min(x, y) < 0 or min(w, h) <= 0 or x + w > source.width or y + h > source.height:
                raise ValueError(f"Invalid source rectangle: {identifier} {direction}")
            image = source.crop((x, y, x + w, y + h))
            bounds = image.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"Empty source: {identifier} {direction}")
            cropped = image.crop(bounds)
            raw.append(image)
            tight.append(cropped)
            meta[direction] = {key: runtime["metadata"].get(key) for key in PHYSICAL_KEYS}
            views[direction] = {"rect": rect, "occupiedBounds": list(bounds),
                                "alphaLevels": sorted(set(cropped.getchannel("A").tobytes()))}
            if rect != audited_rect:
                views[direction]["originalAuditRect"] = audited_rect
        raw_images[identifier], images[identifier], physical[identifier] = raw, tight, meta
        masks = [(im.size, im.getchannel("A").tobytes()) for im in tight]
        binary = [(size, bytes(bool(alpha) for alpha in data)) for size, data in masks]
        solid = []
        for image in tight:
            opaque = image.getchannel("A").point(lambda alpha: 255 if alpha == 255 else 0)
            opaque = opaque.crop(opaque.getbbox())
            solid.append((opaque.size, opaque.tobytes()))
        # Pattern alone doesn't encode alpha values, so include exact alpha signature.
        records.append({"id": identifier, "views": views,
                        "alphaSignature": signature(masks), "occupancySignature": signature(binary),
                        "opaqueSignature": signature(solid),
                        "paletteSignature": signature(masks) + ":" + palette_pattern(tight)})
    pairs, near = [], []
    for i, a in enumerate(records):
        for b in records[i + 1:]:
            ida, idb = a["id"], b["id"]
            metrics = {d: overlap(x, y) for d, x, y in zip(DIRECTIONS, images[ida], images[idb])}
            exact = a["alphaSignature"] == b["alphaSignature"]
            if exact:
                ab, ba = palette_transfer(images[ida], images[idb]), palette_transfer(images[idb], images[ida])
                raw_equal = all(x.size == y.size and x.getchannel("A").tobytes() == y.getchannel("A").tobytes()
                                for x, y in zip(raw_images[ida], raw_images[idb]))
                meta_equal = physical[ida] == physical[idb]
                pairs.append({"a": ida, "b": idb, "identicalTightAlpha": True,
                              "identicalRawAlpha": raw_equal, "identicalPhysicalMetadata": meta_equal,
                              "reversiblePaletteOnly": ab["consistent"] and ba["consistent"],
                              "aToB": ab, "bToA": ba,
                              "strictTransferAToB": raw_equal and meta_equal and ab["consistent"],
                              "strictTransferBToA": raw_equal and meta_equal and ba["consistent"]})
            elif (min(view["iou"] for view in metrics.values()) >= .90 and
                  all(max(abs(x - y) for x, y in zip(view["sizeA"], view["sizeB"])) <= 2
                      for view in metrics.values())):
                aligned = {d: best_overlap(x, y) for d, x, y in zip(DIRECTIONS, images[ida], images[idb])}
                if min(view["iou"] for view in aligned.values()) >= .97:
                    near.append({"a": ida, "b": idb, "views": aligned, "tightBoxViews": metrics,
                                 "identicalOccupancy": a["occupancySignature"] == b["occupancySignature"]})
    alpha_groups = group(records, "alphaSignature", "A")
    palette_groups = group(records, "paletteSignature", "P")
    occupancy_groups = group(records, "occupancySignature", "S")
    opaque_groups = group(records, "opaqueSignature", "O")
    paint_seeds = []
    for family in alpha_groups:
        if len(family["members"]) < 2:
            continue
        choices = []
        for seed in family["members"]:
            transfers = []
            for target in family["members"]:
                if seed == target:
                    continue
                check = palette_transfer(images[seed], images[target])
                raw_equal = all(x.size == y.size and x.getchannel("A").tobytes() == y.getchannel("A").tobytes()
                                for x, y in zip(raw_images[seed], raw_images[target]))
                transfers.append({"target": target, "paintExceptions": check["conflictingPixels"],
                                  "visiblePixels": check["visiblePixels"], "exceptionsByView": check["exceptionsByView"],
                                  "identicalRawAlpha": raw_equal,
                                  "identicalPhysicalMetadata": physical[seed] == physical[target]})
            choices.append({"alphaGroup": family["id"], "seed": seed,
                            "totalPaintExceptions": sum(t["paintExceptions"] for t in transfers),
                            "transfers": transfers})
        paint_seeds.append(min(choices, key=lambda choice: choice["totalPaintExceptions"]))
    report = {"version": 1, "source": inventory["source"],
              "inputs": {"inventorySha256": digest(inventory_path), "bankSha256": digest(bank_path)},
              "method": {"directions": DIRECTIONS, "alignment": "trim transparent borders only; no scale, mirror or rotation",
                         "alpha": "all nonzero alpha, including painted shadows; current approved bank crops, with original audit deltas recorded",
                         "palette": "one global RGBA correspondence across all four views; reversible groups preserve color regions",
                         "physicalMetadata": PHYSICAL_KEYS, "nearThresholdMinFourViewIoU": .97,
                         "nearAlignment": "search +/-2 pixels per axis after tight-box IoU >= .90 and size deltas <=2; report translation explicitly"},
              "counts": {"vehicles": len(records), "views": len(records) * 4,
                         "pairsCompared": len(records) * (len(records) - 1) // 2,
                         "exactAlphaGroups": len(alpha_groups), "exactOccupancyGroups": len(occupancy_groups),
                         "exactOpaqueGroups": len(opaque_groups),
                         "reversiblePaletteGroups": len(palette_groups)},
              "alphaGroups": alpha_groups, "occupancyGroups": occupancy_groups,
              "opaqueGroups": opaque_groups,
              "paletteGroups": palette_groups, "vehicles": records,
              "exactAlphaPairs": pairs, "nearPairs": near,
              "suggestedPaintSeeds": paint_seeds,
              "status": "source classification only; hidden geometry, template fit and authored palette roles remain unqualified"}
    output.mkdir(parents=True)
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    contact_sheet(palette_groups, images, output / "palette-families.png", "Exact four-view reversible palette families (source sprites)")
    contact_sheet(alpha_groups, images, output / "silhouette-families.png", "Exact four-view silhouette families (source sprites)")
    # Smaller summary of one representative per shape family.
    contact_sheet([{**g, "members": [g["members"][0]]} for g in alpha_groups], images,
                  output / "shape-representatives.png", "Exact four-view alpha families: one representative each")
    near_sheet([pair for pair in near if (pair["a"], pair["b"]) in
                (("bus-1", "bus-5"), ("garbage-truck-green", "garbage-truck-orange"))],
               images, output / "near-shape-differences.png")
    for key in ("counts", "alphaGroups", "paletteGroups", "nearPairs"):
        print(key + ": " + json.dumps(report[key]))
    print("Report: " + str(output / "report.json"))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    audit(parser.parse_args().out.resolve())
