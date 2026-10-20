"""Assemble exact captured paint-study pixels; freeze only after agent inspection.

python scripts/vehicle-bake/paint-review.py assemble
python scripts/vehicle-bake/paint-review.py freeze
python scripts/vehicle-bake/paint-review.py verify
Gallery's offline copy contains captures, not a separate image repaint.
"""
import argparse
import base64
import copy
import hashlib
import html
import io
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from catalog import audit_glb

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/demos/original-vehicles/paint-study-v1"
SOURCE = ROOT / "art-source/vehicle-bake/paint-study/v1"
QA = ROOT / "data/vehicle-bake/paint-study-v1"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_bytes((json.dumps(value, indent=2) + "\n").encode())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assemble():
    assert not (OUT / "review-manifest.json").exists(), "Frozen study"
    study = read(OUT / "study.json")
    config = read(ROOT / "scripts/vehicle-bake/paint-variants-v1.json")
    for row in study["candidates"]:
        row["scheme"]["swatches"] = [config["ramps"][row["scheme"]["primary"]][3]]
        if row["scheme"].get("secondary"):
            row["scheme"]["swatches"].append(config["ramps"][row["scheme"]["secondary"]][3])
        directory = OUT / row["id"]
        proof = read(directory / "capture-proof.json")
        assert proof["status"] == "passed" and proof["glbSha256"] == row["glbSha256"]
        candidate = read(directory / "candidate.json")["candidates"][0]
        candidate["audit"] = audit_glb(directory / "model.glb")
        write(directory / "candidate.json", {"version": 1, "candidates": [candidate]})
        # Keep the established viewer controls but offer only existing links.
        text = (ROOT / "scripts/vehicle-bake/family-review.html").read_text(encoding="utf-8")
        text = text.replace("A NEW SHAPE, IN THE SAME PIXEL WORLD", "CURATED COLORS, IN THE SAME PIXEL WORLD")
        start = text.index('      <section class="details">')
        end = text.index("</section>", start) + len("</section>")
        text = text[:start] + '<section class="details"><h2>Paint scheme</h2><p id="method"></p><div class="links"><a id="model" href="model.glb" hidden>Exact model</a><a id="atlas" href="atlas.png" hidden>Paint atlas</a><a id="report" href="report.json" hidden>Recipe and preservation proof</a><a href="captures/contact-sheet.png">All headings</a><a href="../index.html">Compare all paint schemes</a></div></section>' + text[end:]
        (directory / "index.html").write_text(text, encoding="utf-8")
        size = row["nativeSize"]
        sheet = Image.new("RGBA", (size * 8, size * 4), (224, 226, 228, 255))
        for mode_index, mode in enumerate(["study", "engine"]):
            for index in range(16):
                frame = Image.open(directory / f"captures/{mode}-{index}.png").convert("RGBA")
                sheet.alpha_composite(frame, ((mode_index * 4 + index % 4) * size, index // 4 * size))
        sheet.convert("RGB").save(directory / "captures/contact-sheet.png")
    write(OUT / "study.json", study)
    # Fixed per-family/camera crops remove transparent padding at this one heading.
    boxes = {}
    for family in config["families"]:
        for mode in ["study", "engine"]:
            b = Image.open(OUT / f"base-{family}/captures/{mode}-2.png").getbbox()
            boxes[(family, mode)] = (b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3)
    font = ImageFont.load_default(size=17)
    small = ImageFont.load_default(size=13)
    cell_w, cell_h = 224, 360
    sheet = Image.new("RGB", (cell_w * 6 + 32, cell_h * 3 + 158), "#e0e2e4")
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 14), "Tilefun / curated vehicle paints / 14 schemes", font=font, fill="#202637")
    draw.text((16, 40), "Actual model captures: game camera above, elevated view below / 2x nearest pixels", font=small, fill="#454d60")
    cards = []
    frame_map = {}
    for family_index, (family, family_config) in enumerate(config["families"].items()):
        row_y = 78 + family_index * (cell_h + 18)
        draw.text((16, row_y - 16), family_config["name"], font=small, fill="#454d60")
        for column, row in enumerate(r for r in study["candidates"] if r["family"] == family):
            directory = OUT / row["id"]
            x, y = 16 + column * cell_w, row_y
            draw.text((x + 6, y + 4), row["scheme"]["name"], font=small, fill="#202637")
            for mode_index, mode in enumerate(["engine", "study"]):
                frame = Image.open(directory / f"captures/{mode}-2.png").convert("RGBA").crop(boxes[(family, mode)])
                frame = frame.resize((frame.width * 2, frame.height * 2), Image.Resampling.NEAREST)
                # Preserve pixels; generous row spacing handles the taller pickup study.
                sheet.paste(frame, (x + (cell_w - frame.width) // 2, y + 26 + mode_index * 168), frame)
            thumb = Image.open(directory / "captures/engine-2.png").convert("RGBA").crop(boxes[(family, "engine")])
            thumb.save(directory / "thumbnail.png")
            cards.append(f'<button type="button" class="paint-card" data-id="{row["id"]}"><img width="{thumb.width * 2}" height="{thumb.height * 2}" src="{row["id"]}/thumbnail.png" alt="{html.escape(row["name"])}"><span>{html.escape(row["name"])}</span></button>')
            for mode in ["study", "engine"]:
                for index in range(16):
                    path = f'{row["id"]}/captures/{mode}-{index}.png'
                    frame_map[path] = "data:image/png;base64," + base64.b64encode((OUT / path).read_bytes()).decode()
            frame_map[f'{row["id"]}/thumbnail.png'] = "data:image/png;base64," + base64.b64encode((directory / "thumbnail.png").read_bytes()).decode()
    sheet.save(OUT / "paint-comparison.png")
    options = ''.join(f'<option value="{r["id"]}">{html.escape(r["name"])}</option>' for r in study["candidates"])
    document = (ROOT / "scripts/vehicle-bake/paint-gallery.html").read_text(encoding="utf-8")
    document = document.replace("<!--OPTIONS-->", options).replace("<!--CARDS-->", "".join(cards))
    (OUT / "index.html").write_text(document, encoding="utf-8")
    for source, target in [("paint-gallery.js", "gallery.js"), ("paint-gallery.css", "gallery.css")]:
        (OUT / target).write_bytes((ROOT / "scripts/vehicle-bake" / source).read_bytes())
    # Self-contained capture gallery remains ignored; the exact GLB pages are committed separately.
    offline = document.replace('<link rel="stylesheet" href="gallery.css">', '<style>' + (OUT / "gallery.css").read_text() + '</style>')
    payload = json.dumps({"study": study, "frames": frame_map}).replace("</", "<\\/")
    offline = offline.replace('<script src="gallery.js" defer></script>', '<script>window.paintStudyOffline=' + payload + ';</script><script>' + (OUT / "gallery.js").read_text().replace("</script", "<\\/script") + '</script>')
    for path, data in frame_map.items():
        offline = offline.replace('src="' + path + '"', 'src="' + data + '"')
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "index.html").write_text(offline, encoding="utf-8")
    print("Assembled 14 exact-model paint comparisons and offline gallery")


def freeze():
    assert not (OUT / "review-manifest.json").exists(), "Frozen study"
    inspection = read(QA / "visual-inspection.json")
    assert inspection["status"] == "no-blocking-issues" and inspection["humanApproval"] is False
    browser = read(QA / "gallery-qa.json")
    assert browser["status"] == "passed" and browser["offlineNetworkRequests"] == []
    packed = read(QA / "packed-source-qa.json")
    assert packed["status"] == "passed" and len(packed["results"]) == 14
    study = read(OUT / "study.json")
    manifest = read(OUT.parent / "manifest.json")
    prior = copy.deepcopy(manifest["candidates"])
    write(OUT / "review-manifest.json", {"version": 1, "status": "frozen-awaiting-owner-review",
          "candidateIds": [r["id"] for r in study["candidates"]], "humanApproval": False, "normalGameplay": False})
    shared = [p for p in OUT.iterdir() if p.is_file() and p.name != "viewer.js"]
    shared += [p for p in OUT.glob("base-*/captures/*.png")]
    for row in study["candidates"]:
        directory = OUT / row["id"]
        candidate = read(directory / "candidate.json")["candidates"][0]
        assert candidate["audit"]["sha256"] == row["glbSha256"]
        candidate.update(url=f'demos/original-vehicles/paint-study-v1/{row["id"]}/index.html',
                         qualification={"art": "awaiting owner review", "runtime": "not integrated",
                                        "paintIsolation": read(directory / "capture-proof.json")})
        candidate["files"] = [{"url": p.relative_to(ROOT / "public").as_posix(), "sha256": digest(p)}
                              for p in sorted(set(shared + [p for p in directory.rglob("*") if p.is_file()]))]
        assert not any(c["id"] == candidate["id"] for c in manifest["candidates"])
        write(directory / "review-manifest.json", {"version": 1, "candidates": [candidate]})
        candidate["files"].append({"url": (directory / "review-manifest.json").relative_to(ROOT / "public").as_posix(), "sha256": digest(directory / "review-manifest.json")})
        manifest["candidates"].append(candidate)
    assert manifest["candidates"][:len(prior)] == prior
    write(OUT.parent / "manifest.json", manifest)
    # Pin every source, configuration and helper required for a new scratch replay.
    inputs = [ROOT / "scripts/vehicle-bake" / name for name in [
        "paint-variants.py", "paint-variants-v1.json", "paint-source-blender.py", "paint-source-verify.py",
        "paint-capture.mjs", "paint-review.py", "paint-gallery.html", "paint-gallery.css", "paint-gallery.js",
        "paint-gallery-qa.mjs", "family-review.html", "family-review.css", "family-viewer.mjs", "family-build.mjs", "catalog.py"]]
    inputs += [ROOT / p for p in ["package.json", "package-lock.json",
        "src/rendering/CarMeshAsset.ts", "src/rendering/CarMeshDefinition.ts",
        "src/rendering/VehicleGeometryBatches.ts", "src/rendering/VehicleEmergencyLights.ts",
        "src/rendering/CarMeshProjection.ts", "src/rendering/CarPixelOutline.ts",
        "scripts/authored-assets/runtime/wheel-rig.mjs"]]
    config = read(ROOT / "scripts/vehicle-bake/paint-variants-v1.json")
    for family in config["families"].values():
        inputs += [ROOT / family["glb"], ROOT / family["blend"]]
    source_files = [p for p in SOURCE.rglob("*") if p.is_file()]
    write(SOURCE / "retained.json", {
        "schema": "tilefun-vehicle-paint-retained-v1", "humanApproval": False, "normalGameplay": False,
        "inputs": [{"path": p.relative_to(ROOT).as_posix(), "sha256": digest(p)} for p in inputs],
        "sourceFiles": [{"path": p.relative_to(ROOT).as_posix(), "sha256": digest(p)} for p in source_files],
        "visualInspection": inspection, "galleryQA": browser, "packedSourceQA": packed})
    print(f"Registered {len(study['candidates'])} new paint reviews; prior {len(prior)} unchanged")


def verify():
    receipt = read(SOURCE / "retained.json")
    for item in receipt["inputs"] + receipt["sourceFiles"]:
        assert digest(ROOT / item["path"]) == item["sha256"], item["path"]
    ids = {r["id"] for r in read(OUT / "study.json")["candidates"]}
    manifest = read(OUT.parent / "manifest.json")
    found = [c for c in manifest["candidates"] if c["id"] in ids]
    assert len(found) == len(ids) == 14
    for candidate in found:
        for item in candidate["files"]:
            assert digest(ROOT / "public" / item["url"]) == item["sha256"], item["url"]
    print("Frozen paint review/source hashes verified")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["assemble", "freeze", "verify"])
    args = parser.parse_args()
    {"assemble": assemble, "freeze": freeze, "verify": verify}[args.action]()
