"""Offline seven-cycle SOURCE PROTOTYPES / NORMAL DEFERRED comparison.

Read complete immutable source reports, actual GLBs and existing raw PNGs only.
No rendering, registration, source mutations or normal/shared qualification.
Run: python scripts/vehicle-bake/cycle-fleet-review.py --self-test
"""

import argparse
import base64
import copy
import hashlib
import html
from html.parser import HTMLParser
import io
import json
import math
from pathlib import Path
import re
import struct
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data/vehicle-bake/cycle-fleet"
ROSTER = "art-source/vehicle-bake/roster.json"
PARENT_SNAPSHOT = {
    "classic-motorcycle",
    "sidecar-motorcycle",
    "sport-motorcycle",
    "cruiser-motorcycle",
}
VIEWS = [(v, c) for v in ["combined", "bike-alone"] for c in ["study", "engine"]]
sha = lambda b: hashlib.sha256(b).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Inputs:
    """Read-only input snapshot; overrides exist solely for in-memory negatives."""

    def __init__(self, root, overrides=None):
        self.root = root.resolve()
        self.overrides = overrides or {}
        self.hashes = {}

    def read(self, relative):
        p = (self.root / relative).resolve()
        require(p.is_relative_to(self.root), f"Input escapes repository: {relative}")
        name = p.relative_to(self.root).as_posix()
        if name in self.overrides:
            data = self.overrides[name]
            if data is None:
                raise ValueError(f"Missing input: {name}")
        else:
            require(p.is_file(), f"Missing input: {name}")
            data = p.read_bytes()
        self.hashes[name] = sha(data)
        return data

    def json(self, name):
        try:
            value = json.loads(self.read(name).decode("utf-8-sig"))
        except (UnicodeError, json.JSONDecodeError) as e:
            raise ValueError(f"Malformed JSON: {name}") from e
        require(isinstance(value, dict), f"Expected object: {name}")
        return value

    def unchanged(self):
        require(not self.overrides, "Negative fixture cannot qualify real inputs")
        for name, digest in self.hashes.items():
            require(
                sha((self.root / name).read_bytes()) == digest, f"Input changed: {name}"
            )


def glb_inventory(data, label):
    require(len(data) >= 20, f"Truncated GLB: {label}")
    magic, version, length = struct.unpack_from("<4sII", data)
    require(
        magic == b"glTF" and version == 2 and length == len(data), f"Bad GLB: {label}"
    )
    chunks = []
    cursor = 12
    while cursor < len(data):
        require(cursor + 8 <= len(data), f"Truncated chunk: {label}")
        size, kind = struct.unpack_from("<II", data, cursor)
        cursor += 8
        require(size % 4 == 0 and cursor + size <= len(data), f"Bad chunk: {label}")
        chunks.append((kind, data[cursor : cursor + size]))
        cursor += size
    require(
        len(chunks) == 2 and [c[0] for c in chunks] == [0x4E4F534A, 0x004E4942],
        f"Expected embedded GLB: {label}",
    )
    try:
        g = json.loads(chunks[0][1])
    except (UnicodeError, json.JSONDecodeError) as e:
        raise ValueError(f"Malformed GLB JSON: {label}") from e
    require(g["asset"]["version"] == "2.0", f"GLTF version: {label}")
    require(all("uri" not in b for b in g["buffers"]), f"External GLB buffer: {label}")
    for view in g["bufferViews"]:
        require(
            view["buffer"] == 0
            and view.get("byteOffset", 0) >= 0
            and view.get("byteOffset", 0) + view["byteLength"] <= len(chunks[1][1]),
            f"Buffer bounds: {label}",
        )
    triangles = draws = 0
    visited = set()

    def visit(index):
        nonlocal triangles, draws
        require(index not in visited, f"Repeated/cyclic source node: {label}")
        visited.add(index)
        node = g["nodes"][index]
        if "mesh" in node:
            for primitive in g["meshes"][node["mesh"]]["primitives"]:
                require(primitive.get("mode", 4) == 4, f"Non-triangle source: {label}")
                count = (
                    g["accessors"][primitive["indices"]]["count"]
                    if "indices" in primitive
                    else g["accessors"][primitive["attributes"]["POSITION"]]["count"]
                )
                require(
                    type(count) is int and count > 0 and count % 3 == 0,
                    f"Triangle count: {label}",
                )
                triangles += count // 3
                draws += 1
        for child in node.get("children", []):
            visit(child)

    for index in g["scenes"][g.get("scene", 0)]["nodes"]:
        visit(index)
    require(triangles > 0 and draws > 0, f"Empty source GLB: {label}")
    images = set()
    for image in g["images"]:
        require(
            "uri" not in image and image.get("mimeType") == "image/png",
            f"External/non-PNG atlas: {label}",
        )
        view = g["bufferViews"][image["bufferView"]]
        off = view.get("byteOffset", 0)
        pixels = chunks[1][1][off : off + view["byteLength"]]
        Image.open(io.BytesIO(pixels)).verify()
        images.add(sha(pixels))
    require(
        len(images) == 1 and len(g["textures"]) == 1,
        f"Expected one source atlas: {label}",
    )
    return {
        "triangles": triangles,
        "draws": draws,
        "atlases": len(images),
        "sha256": sha(data),
    }, images


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.resources = []
        self.links = []
        self.cards = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for name in ["src", "srcset", "poster"]:
            if name in attrs:
                self.resources.append(attrs[name])
        if tag == "link" and "href" in attrs:
            self.resources.append(attrs["href"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))
        if tag == "article":
            self.cards.append(attrs.get("id"))


def verify_viewer(data, bike_hash, rider_hash, label):
    document = data.decode("utf-8")
    parser = Resources()
    parser.feed(document)
    require(
        all(r.startswith("data:") for r in parser.resources),
        f"External offline resource: {label}",
    )
    match = re.search(r"window\.cycleOffline=(\{.*?\})</script>", document, re.DOTALL)
    require(match is not None, f"Missing embedded offline payload: {label}")
    payload = json.loads(match[1])
    for name, digest in [("bike", bike_hash), ("rider", rider_hash)]:
        uri = payload["assets"][name]
        require(
            uri.startswith("data:model/gltf-binary;base64,"),
            f"Offline asset format: {label}",
        )
        require(
            sha(base64.b64decode(uri.split(",", 1)[1], validate=True)) == digest,
            f"Wrong embedded {name}: {label}",
        )
    return {"embeddedBikeAndRiderExact": True, "externalResourceTags": 0}


def complete(report, label):
    require(
        report.get("status") in ["complete", "prototype-source-complete"]
        and report.get("sourceStage") == "complete"
        and report.get("sourceImmutable") is True
        and report.get("sourcePilot") is True,
        f"Incomplete source: {label}",
    )
    require(
        report.get("normalActivation") is False,
        f"Normal activation is not deferred: {label}",
    )


def collect(inputs):
    roster = inputs.json(ROSTER)
    vehicles = [v for v in roster["vehicles"] if 34 <= v["priority"] <= 40]
    vehicles.sort(key=lambda v: v["priority"])
    require(
        len(vehicles) == 7 and [v["priority"] for v in vehicles] == list(range(34, 41)),
        "Expected all seven priorities34..40",
    )
    require(len({v["id"] for v in vehicles}) == 7, "Duplicate cycle IDs")
    records = []
    for vehicle in vehicles:
        name = vehicle["id"]
        require(
            re.fullmatch(r"[a-z0-9-]+", name) and vehicle["status"] == "deferred",
            f"Invalid/deferred roster row: {name}",
        )
        source = f"art-source/vehicle-bake/{name}/v1"
        public = f"public/demos/vehicle-bake/{name}/v1"
        report = inputs.json(f"{source}/report.json")
        public_report = inputs.json(f"{public}/report.json")
        complete(report, name)
        complete(public_report, name)
        require(
            report["family"] == public_report["family"] == name,
            f"Wrong family report: {name}",
        )
        require(
            report["render"]["nativeSize"] == 224
            and report["render"]["meshRadius"] == 112
            and abs(report["exportWorldScale"] - 80 / 4.6) < 1e-9,
            f"Different density: {name}",
        )
        model = inputs.read(f"{public}/model.glb")
        require(
            sha(model) == sha(inputs.read(f"{source}/model.glb")),
            f"Source/public model differs: {name}",
        )
        bare, bare_images = glb_inventory(model, name)
        for r in [report, public_report]:
            require(
                r["geometry"]["sha256"] == bare["sha256"]
                and r["geometry"]["triangles"] == bare["triangles"]
                and r["geometry"]["primitives"] == bare["draws"]
                and r["geometry"]["textures"] == bare["atlases"],
                f"Reported geometry mismatch: {name}",
            )
        atlas = inputs.read(f"{public}/atlas.png")
        require(
            sha(atlas) == sha(inputs.read(f"{source}/atlas.png")),
            f"Atlas differs: {name}",
        )
        require(
            Image.open(io.BytesIO(atlas)).size == (512, 512),
            f"Atlas dimensions: {name}",
        )
        assembly = inputs.json(f"{source}/assembly.json")
        require(
            assembly["bike"]["sha256"] == bare["sha256"], f"Assembly bike pin: {name}"
        )
        rider_data = inputs.read(assembly["rider"]["path"])
        rider, rider_images = glb_inventory(rider_data, name + " rider")
        require(
            rider["sha256"] == assembly["rider"]["sha256"]
            and sha(inputs.read(f"{public}/rider-reference.glb")) == rider["sha256"],
            f"Rider pin: {name}",
        )
        combined = {
            "triangles": bare["triangles"] + rider["triangles"],
            "draws": bare["draws"] + rider["draws"],
            "atlases": len(bare_images | rider_images),
        }
        for key in ["triangles", "draws", "atlases"]:
            require(
                assembly["bike"][key] == bare[key]
                and assembly["rider"][key] == rider[key]
                and assembly["combined"][key] == combined[key],
                f"Assembly counts: {name}/{key}",
            )
            composition = report["riderComposition"]
            count = (
                composition["combined"][key]
                if "combined" in composition
                else composition["combined" + key.title()]
            )
            require(count == combined[key], f"Report combined counts: {name}/{key}")
        capture = inputs.json(f"{source}/evidence/raw-capture.json")
        require(
            capture["status"] == "passed-raw-source-diagnostic"
            and capture["glbSha256"] == bare["sha256"]
            and capture["riderSha256"] == rider["sha256"]
            and capture["nativeSize"] == 224
            and capture["source80ReferenceUnchanged"]
            and capture["singleDepthTarget"],
            f"Wrong capture provenance: {name}",
        )
        frames = {}
        for f in capture["frames"]:
            key = (f["view"], f["mode"], f["yaw"])
            require(key not in frames, f"Duplicate capture: {name}/{key}")
            frames[key] = f
        pictures = {}
        for view, camera in VIEWS:
            for i in range(16):
                f = frames[(view, camera, i * 22.5)]
                filename = f"{view}-{camera}-{i}.png"
                require(
                    f["image"] == filename
                    and f["drawCalls"]
                    == (combined if view == "combined" else bare)["draws"],
                    f"Capture frame identity/count: {name}",
                )
                data = inputs.read(f"{public}/raw-captures/{filename}")
                require(
                    sha(data) == f["sha256"],
                    f"Wrong captured pixels: {name}/{filename}",
                )
                im = Image.open(io.BytesIO(data)).convert("RGBA")
                require(
                    im.size == (224, 224) and im.getbbox() is not None,
                    f"Empty/non-native capture: {name}/{filename}",
                )
                pictures[f"{view}-{camera}-{i}"] = im
        viewer = f"{public}/offline-raw.html"
        offline = verify_viewer(
            inputs.read(viewer), bare["sha256"], rider["sha256"], viewer
        )
        records.append(
            {
                "id": name,
                "name": vehicle["name"],
                "priority": vehicle["priority"],
                "bare": bare,
                "combined": combined,
                "sourceReportSharedReview": report.get(
                    "actualSharedLoaderBrowserReview", "not recorded"
                ),
                "parentTaskSnapshot": (
                    "separate compound passed"
                    if name in PARENT_SNAPSHOT
                    else "pending parent QA"
                ),
                "parentTaskSnapshotIsNotLiveQualification": True,
                "normalActivation": False,
                "viewer": viewer,
                "viewerURI": (inputs.root / viewer).as_uri(),
                "offline": offline,
                "pictures": pictures,
            }
        )
    return records


def controls(root, records):
    report = f"art-source/vehicle-bake/{records[0]['id']}/v1/report.json"
    original = json.loads((root / report).read_text(encoding="utf-8"))
    incomplete = copy.deepcopy(original)
    incomplete["status"] = "draft"
    image = f"public/demos/vehicle-bake/{records[0]['id']}/v1/raw-captures/combined-study-2.png"
    cases = {
        "missingReportRejected": {report: None},
        "malformedReportRejected": {report: b"{broken"},
        "incompleteReportRejected": {report: json.dumps(incomplete).encode()},
        "missingCaptureRejected": {image: None},
        "modelHashMismatchRejected": {
            f"public/demos/vehicle-bake/{records[0]['id']}/v1/model.glb": b"not a GLB"
        },
        "malformedGLBRejected": {
            f"{base}/vehicle-bake/{records[0]['id']}/v1/model.glb": b"not a GLB"
            for base in ["public/demos", "art-source"]
        },
    }
    results = {}
    for label, overrides in cases.items():
        try:
            collect(Inputs(root, overrides))
        except (ValueError, KeyError, TypeError, IndexError, OSError) as e:
            results[label] = {"rejected": True, "reason": str(e)}
        else:
            raise ValueError(f"Negative control accepted: {label}")
    return results


def png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def generate(records, output, heading):
    boxes = [im.getbbox() for r in records for im in r["pictures"].values()]
    crop = (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )
    width, height = (crop[2] - crop[0]) * 2, (crop[3] - crop[1]) * 2
    tiles = []
    cards = []
    payload = {}
    tile_w, tile_h = max(400, width * 2 + 36), height * 2 + 204
    font = ImageFont.load_default(size=13)
    small = ImageFont.load_default(size=12)
    for r in records:
        images = {}
        for key, im in r["pictures"].items():
            cropped = im.crop(crop)
            doubled = cropped.resize((width, height), Image.Resampling.NEAREST)
            require(
                doubled.resize(cropped.size, Image.Resampling.NEAREST).tobytes()
                == cropped.tobytes(),
                "Nearest pixel parity",
            )
            images[key] = (
                "data:image/png;base64," + base64.b64encode(png_bytes(doubled)).decode()
            )
        payload[r["id"]] = images
        tile = Image.new("RGB", (tile_w, tile_h), "#233c38")
        draw = ImageDraw.Draw(tile)
        draw.text((12, 10), f"{r['priority']}  {r['name']}", font=font, fill="white")
        draw.text(
            (12, 30), "SOURCE PROTOTYPE / NORMAL DEFERRED", font=small, fill="#f4ce85"
        )
        gallery = []
        for j, (view, camera) in enumerate(VIEWS):
            key = f"{view}-{camera}-{heading}"
            image = (
                r["pictures"][key]
                .crop(crop)
                .resize((width, height), Image.Resampling.NEAREST)
            )
            x = 12 + (j % 2) * (width + 12)
            y = 75 + (j // 2) * (height + 26)
            draw.text(
                (x, y - 18),
                f"{view} / {camera} {heading*22.5:g}deg",
                font=small,
                fill="#e0e8e5",
            )
            tile.paste(image, (x, y), image)
            gallery.append(
                f'<figure><figcaption>{view} / {camera}</figcaption><img width="{width}" height="{height}" data-view="{view}-{camera}" src="{images[key]}" alt="{html.escape(r["name"])} {view} {camera}"></figure>'
            )
        bottom = 75 + height * 2 + 26
        draw.text(
            (12, bottom),
            f"Triangles bare/combined {r['bare']['triangles']}/{r['combined']['triangles']} | draws {r['bare']['draws']}/{r['combined']['draws']} | atlases {r['bare']['atlases']}/{r['combined']['atlases']}",
            font=small,
            fill="white",
        )
        draw.text(
            (12, bottom + 19),
            "RAW captures; shared qualification separate",
            font=small,
            fill="#f4ce85",
        )
        digest = r["bare"]["sha256"]
        draw.text(
            (12, bottom + 38), "SHA256 " + digest[:32], font=small, fill="#c4d1cc"
        )
        draw.text((12, bottom + 53), digest[32:], font=small, fill="#c4d1cc")
        tiles.append(tile)
        cards.append(
            f'<article id="{r["id"]}"><h2>{r["priority"]} · {html.escape(r["name"])}</h2><p class="badge">SOURCE PROTOTYPE · NORMAL DEFERRED</p><div class="gallery">'
            + "".join(gallery)
            + f'</div><p><a href="{html.escape(r["viewerURI"],quote=True)}">Open actual source offline viewer</a></p><p class="hash">GLB SHA256 {digest}</p><small>Immutable source report shared stage: {html.escape(str(r["sourceReportSharedReview"]))}. These thumbnails are raw source captures.</small></article>'
        )
    columns = 4
    rows = math.ceil(len(tiles) / columns)
    sheet = Image.new("RGB", (tile_w * columns, tile_h * rows + 76), "#172b29")
    pen = ImageDraw.Draw(sheet)
    pen.text(
        (14, 12),
        "SEVEN CYCLE SOURCE PROTOTYPES / NORMAL DEFERRED",
        font=font,
        fill="white",
    )
    pen.text(
        (14, 34),
        f"Existing native224 PNGs; common crop {crop}; exact nearest2x. No model rescaling or rendering.",
        font=small,
        fill="#d6e0d9",
    )
    pen.text(
        (14, 52),
        "Raw source only. Parent shared qualification and normal identity/AI/fallback gates are separate.",
        font=small,
        fill="#f4ce85",
    )
    for i, tile in enumerate(tiles):
        sheet.paste(tile, (i % columns * tile_w, 76 + i // columns * tile_h))
    table = "".join(
        f'<tr><th scope="row">{r["priority"]} {html.escape(r["name"])}</th><td>{r["bare"]["triangles"]} / {r["combined"]["triangles"]}</td><td>{r["bare"]["draws"]} / {r["combined"]["draws"]}</td><td>{r["bare"]["atlases"]} / {r["combined"]["atlases"]}</td><td>{html.escape(r["parentTaskSnapshot"]) }*</td><td>DEFERRED</td><td><code>{r["bare"]["sha256"]}</code></td></tr>'
        for r in records
    )
    options = "".join(
        f'<option value="{i}"'
        + (" selected" if i == heading else "")
        + f">{i*22.5:g}°</option>"
        for i in range(16)
    )
    document = (
        """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Seven cycle source prototypes · normal deferred</title><style>
body{margin:24px;background:#172b29;color:#e9efeb;font:15px/1.5 system-ui,sans-serif}h1{font-size:25px}h2{font-size:18px;margin:0}.badge{color:#f4ce85;font-weight:bold}.controls{position:sticky;top:0;background:#172b29;padding:12px 0;z-index:1}select{padding:6px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px}article{padding:14px;background:#233c38;border-radius:10px;min-width:0}.gallery{display:grid;grid-template-columns:repeat(2,max-content);gap:10px;overflow:auto}figure{margin:0}figcaption{font-size:12px}img{display:block;image-rendering:pixelated}a{color:#b9e2d9}.hash,code{overflow-wrap:anywhere;font-size:11px}small{display:block}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:8px;border:1px solid #506661}td:last-child{max-width:210px}.table{overflow:auto}p{max-width:110ch}@media(max-width:450px){body{margin:12px}main{display:block}article{margin-bottom:16px}}
</style></head><body><h1>Seven cycle SOURCE PROTOTYPES · NORMAL DEFERRED</h1>
<p>Exact existing native224 source captures, common transparent-padding crop and nearest2x pixels. No model rescaling, re-rendering, source changes or new shared qualification. Combined images retain the unchanged Explorer in one actual depth target.</p>
<p>*Parent task checkpoint: separate classic/sidecar/sport/cruiser compounds have independently passed shared review; dirt/scooter/touring await parent QA. This is an explicitly dated task snapshot (2026-10-20), not live review data. Immutable source reports retain historical pending labels. This sheet and linked raw viewers do not qualify the shared loader. Normal identity, AI and occupied fallback gates remain deferred for all seven.</p>
"""
        + f'<div class="controls"><label>Common heading <select id="heading">{options}</select></label> <span id="heading-status">{heading*22.5:g}° · existing source pixels · nearest2x</span></div><div class="table"><table><thead><tr><th>Source</th><th>Triangles bare / combined</th><th>Draws bare / combined</th><th>Atlases bare / combined</th><th>Parent shared checkpoint*</th><th>Normal</th><th>Actual source SHA256</th></tr></thead><tbody>{table}</tbody></table></div><main>'
        + "".join(cards)
        + "</main><script>const images="
        + json.dumps(payload, separators=(",", ":"))
        + """;document.querySelector('#heading').addEventListener('change',e=>{const i=Number(e.target.value);for(const card of document.querySelectorAll('article'))for(const im of card.querySelectorAll('img'))im.src=images[card.id][im.dataset.view+'-'+i];document.querySelector('#heading-status').textContent=(i*22.5)+'deg | existing source pixels | nearest2x';});</script></body></html>"""
    )
    parser = Resources()
    parser.feed(document)
    require(
        len(parser.cards) == len(set(parser.cards)) == len(parser.links) == 7,
        "Seven unique cards/links required",
    )
    require(set(parser.cards) == {r["id"] for r in records}, "Wrong card IDs")
    require(
        all(s.startswith("data:image/png;base64,") for s in parser.resources),
        "Network resource in fleet HTML",
    )
    require(
        set(parser.links) == {r["viewerURI"] for r in records}, "Wrong viewer links"
    )
    output.mkdir(parents=True, exist_ok=True)
    sheet.save(output / "fleet.png")
    (output / "index.html").write_text(document, encoding="utf-8", newline="\n")
    return {
        "commonCropNative224": list(crop),
        "previewScale": 2,
        "resampling": "nearest",
        "modelScaleUnchanged": True,
        "commonCropForAllModelsCamerasAndHeadings": True,
        "embeddedPNGCount": sum(len(v) for v in payload.values()),
        "sevenUniqueCardsAndViewerLinks": True,
        "allViewerFilesExist": True,
        "noExternalResourceTags": True,
        "networkPolicy": "CSP default-src none, connect-src none; embedded images/inline UI only. Source viewers are explicit local file links.",
        "htmlSha256": sha((output / "index.html").read_bytes()),
        "pngSha256": sha((output / "fleet.png").read_bytes()),
        "contactSheetHeadingDegrees": heading * 22.5,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument(
        "--heading",
        type=int,
        choices=range(16),
        default=2,
        help="Existing heading index0..15; PNG default45deg",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Run in-memory missing/malformed/incomplete/hash rejection controls",
    )
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    require(
        OUTPUT.resolve().is_relative_to((ROOT / "data").resolve())
        and output.is_relative_to(OUTPUT.resolve()),
        "Output must stay under ignored data/vehicle-bake/cycle-fleet",
    )
    inputs = Inputs(ROOT)
    records = collect(inputs)
    negative = (
        controls(ROOT, records)
        if args.self_test
        else {"status": "not requested; use --self-test"}
    )
    inputs.unchanged()
    presentation = generate(records, output, args.heading)
    inputs.unchanged()
    receipt = {
        "status": "complete",
        "sourcePrototypes": 7,
        "normalActivation": False,
        "sharedQualificationAwarded": False,
        "sourceRerendered": False,
        "sourceFilesMutated": False,
        "inputHashes": inputs.hashes,
        "inputHashesUnchanged": True,
        "scriptSha256": sha(Path(__file__).read_bytes()),
        "cards": [{k: v for k, v in r.items() if k != "pictures"} for r in records],
        "presentation": presentation,
        "negativeControls": negative,
        "output": output.relative_to(ROOT).as_posix(),
    }
    (output / "report.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "status": "complete",
                "sourcePrototypes": 7,
                "inputsUnchanged": len(inputs.hashes),
                "output": receipt["output"],
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except (
        ValueError,
        KeyError,
        TypeError,
        IndexError,
        OSError,
        struct.error,
    ) as error:
        print(f"Cycle source review rejected: {error}", file=sys.stderr)
        sys.exit(2)
