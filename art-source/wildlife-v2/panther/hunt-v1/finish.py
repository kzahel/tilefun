"""Authored integer panther finish over evaluated pose guides; deterministic Pillow.

No render-color quantization, sprite scaling, new random markings or frame bounce.
The editable palette-letter masters preserve all final pixels.
"""
import json
import math
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SCRIPT_SOURCE = Path(__file__).resolve().parent
ROOT = SCRIPT_SOURCE.parents[3]
scratch = "--workspace" in sys.argv
WORK = ROOT / sys.argv[sys.argv.index("--workspace")+1] if scratch else ROOT / "data/predators-132/panther"
SOURCE = WORK / "source" if scratch else SCRIPT_SOURCE
OUT = WORK / "public" if scratch else ROOT / "public/demos/wildlife-v2/panther/hunt-v1"
assert not (SOURCE / "receipt.json").exists(), "Registered pixels are immutable; use --workspace for replay."
OUT.mkdir(parents=True, exist_ok=True)
G = json.loads((WORK / "projected-guides.json").read_text())
W = G["canvas"][0]
P = {'k': '#171e23', 's': '#29333b', 'c': '#414d56', 'h': '#606c75', 'w': '#7f898e', 'g': '#4e5960', 'e': '#d8bc64', 'p': '#77746f'}
KEYS = list(P)
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in P.items()}
COLORS["."] = (0, 0, 0, 0)
HEADS = {'down': ['...kkkkkkk...', '..kcshhhsck..', '.kccccccccck.', '.kcecckcceck.', 'kccccccccccck', 'kcsssspssssck', '.kssskkksssk.', '..ksssssssk..', '...kkssskk...', '.....kkk.....'], 'up': ['...kkkkkkk...', '..kshhhhhsk..', '.kccccccccck.', '.kscccccccsk.', '.kcccsssccck.', '..kscccccsk..', '...ksscssk...', '....kkkkk....'], 'left': ['.....kkkkkk...', '...kkhhhhhck..', '..kcccccccckk.', '.kcecccccsssck', 'kssscccccsssck', 'psssskcccsssk.', 'ksssscccsssk..', '.ksssccsssk...', '..kksssskk....', '....kkkk.....']}
HEADS["right"] = [line[::-1] for line in HEADS["left"]]


def integer(points):
    return [(math.floor(x+.5), math.floor(y+.5)) for x, y in points]


def index(letter):
    return KEYS.index(letter)+1


def pixels(record):
    image = Image.new("L", (W, W))
    draw = ImageDraw.Draw(image)
    for name, volume in sorted(record["volumes"].items(), key=lambda pair: -sum(pair[1]["depthRange"])/2):
        if name.startswith(("skull", "cheek", "muzzle", "nose", "eye", "lower-jaw")):
            continue
        points = integer(volume["hull"])
        mask = Image.new("1", (W, W))
        md = ImageDraw.Draw(mask)
        md.polygon(points, fill=1)
        bbox = mask.getbbox()
        if not bbox:
            continue
        material = volume["material"]
        color = "w" if "ivory" in material else "k" if "charcoal" in material else "c"
        if name.startswith(("HR-", "FR-")) and record["facing"] == "left":
            color = "s"
        if name.startswith(("HL-", "FL-")) and record["facing"] == "right":
            color = "s"
        draw.polygon(points, fill=index(color))
        if color in ["c", "s"]:
            # Deliberate broad light band and underside, united without bead outlines.
            for x in range(bbox[0], bbox[2]):
                column = [y for y in range(bbox[1], bbox[3]) if mask.getpixel((x, y))]
                for y in column:
                    if y >= column[-1]-1:
                        image.putpixel((x, y), index("s"))
                    elif color == "c" and y <= column[0]+1:
                        image.putpixel((x, y), index("h"))
        # Body stripes are projected surface curves, clipped to their own volume.
        for stripe in record["stripes"]:
            if stripe["mesh"] != name:
                continue
            marks = Image.new("1", (W, W))
            sm = ImageDraw.Draw(marks)
            for j in range(len(stripe["points"])-1):
                if stripe["visible"][j] and stripe["visible"][j+1]:
                    sm.line(integer([stripe["points"][j][:2], stripe["points"][j+1][:2]]), fill=1, width=1)
            for y in range(bbox[1], bbox[3]):
                for x in range(bbox[0], bbox[2]):
                    if mask.getpixel((x, y)) and marks.getpixel((x, y)):
                        image.putpixel((x, y), index("k"))
    # Single exterior ink contour; individual torso volumes have no separate rims.
    before = image.copy()
    for y in range(1, W-1):
        for x in range(1, W-1):
            if before.getpixel((x, y)) and any(not before.getpixel((x+dx, y+dy))
                                              for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]):
                image.putpixel((x, y), index("k"))
    hx, hy = integer([record["head"][:2]])[0]
    template = HEADS[record["facing"]]
    left, top = hx-max(map(len, template))//2, hy-4
    # A rigid skull master follows the real head anchor. Sniff uses the same fixed
    # volume drawing (a restrained nine-degree pose); jaw display has a separate
    # lower-mouth drawing, rather than stretching or shrinking the skull.
    for y, line in enumerate(template):
        for x, letter in enumerate(line):
            if letter != ".":
                image.putpixel((left+x, top+y), index(letter))
    if record["clip"] == "display" and record["actionAmount"] >= .6 and record["facing"] != "up":
        if record["facing"] in ["left", "right"]:
            x = left+2 if record["facing"] == "left" else left+len(template[0])-4
        else:
            x = hx-2
        y = top+7
        draw.rectangle((x, y, x+3, y+2), fill=index("k"))
        draw.point((x, y), fill=index("w"))
        draw.point((x+3, y), fill=index("w"))
        draw.line((x+1, y+2, x+2, y+2), fill=index("p"))
        draw.line((x, y+3, x+3, y+3), fill=index("w"))
    return image


FRAMES, masters = {}, []
for record in G["records"]:
    im = pixels(record)
    rows = ["".join("." if value == 0 else KEYS[value-1]
                    for value in list(im.get_flattened_data())[y*W:(y+1)*W]) for y in range(W)]
    masters.append({"facing": record["facing"], "clip": record["clip"], "index": record["index"], "pixels": rows})
    rgba = Image.new("RGBA", (W, W))
    rgba.putdata([COLORS[c] for line in rows for c in line])
    FRAMES[record["facing"], record["clip"], record["index"]] = rgba
M = {"identity": "panther-hunt-v1-pixels-01", "palette": P, "canvas": [W, W],
     "anchor": G["anchor"], "headTemplates": HEADS,
     "stylization": ["Fixed wildlife camera and 10px/unit; species-specific panther anatomy.",
                     "Integer contours and broad palette bands; projected, species-owned unstriped coat.",
                     "Rigid skull master follows evaluated translation; restrained sniff pitch is simplified in final face.",
                     "Separate jaw-open mouth master; no rescaling, random marks or whole-sprite bounce."],
     "frames": masters}
(SOURCE / "masters.json").write_text(json.dumps(M, indent=1)+"\n", encoding="utf-8", newline="\n")
clips = {"idle": {"start": 0, "count": 1, "frameDuration": 180},
         "walk": {"start": 1, "count": 12, "frameDuration": 100},
         "sniff": {"start": 13, "count": 8, "frameDuration": 160},
         "display": {"start": 21, "count": 8, "frameDuration": 160}}
facings = ["down", "up", "left", "right"]
sheet = Image.new("RGBA", (29*W, 4*W))
meta = {"identity": M["identity"], "reviewStatus": "pending", "image": "sheet.png",
        "frameWidth": W, "frameHeight": W, "anchor": G["anchor"], "rootMotion": False,
        "cameraContract": G["cameraContract"], "orthoScale": G["orthoScale"],
        "shiftY": G["shiftY"], "rootTravelPixelsPerCycle": G["rootTravelUnitsPerCycle"]*10,
        "clips": clips, "facings": {}}
for row, facing in enumerate(facings):
    meta["facings"][facing] = {"frames": []}
    for name, clip in clips.items():
        for i in range(clip["count"]):
            im = FRAMES[facing, name, i]
            x, y = (clip["start"]+i)*W, row*W
            sheet.alpha_composite(im, (x, y))
            record = next(r for r in G["records"] if (r["facing"], r["clip"], r["index"]) == (facing, name, i))
            meta["facings"][facing]["frames"].append({"clip": name, "index": i,
                "rect": [x, y, W, W], "visibleBounds": im.getbbox(),
                "contacts": record["contacts"], "projectedContacts": record["projectedContacts"],
                "headAnchor": integer([record["head"][:2]])[0]})
sheet.save(OUT / "sheet.png")
(OUT / "sprite.json").write_text(json.dumps(meta, indent=1)+"\n", encoding="utf-8", newline="\n")
panel = Image.new("RGBA", sheet.size, "#879b82")
panel.alpha_composite(sheet)
panel.save(OUT / "contact-sheet-native.png")

# Tight, fixed-anchor chronological sheets for visual inspection (all 116 poses).
allbounds = [im.getbbox() for im in FRAMES.values()]
crop = (min(b[0] for b in allbounds)-2, min(b[1] for b in allbounds)-2,
        max(b[2] for b in allbounds)+2, max(b[3] for b in allbounds)+2)
cw, ch = crop[2]-crop[0], crop[3]-crop[1]
for name, clip in clips.items():
    panel = Image.new("RGBA", ((cw+3)*clip["count"], (ch+12)*4), "#879b82")
    d = ImageDraw.Draw(panel)
    for row, facing in enumerate(facings):
        d.text((0, row*(ch+12)), facing, fill="white")
        for i in range(clip["count"]):
            panel.alpha_composite(FRAMES[facing, name, i].crop(crop), (i*(cw+3), row*(ch+12)+12))
    panel.save(WORK / f"{name}-native.png")
    panel.resize((panel.width*3, panel.height*3), Image.Resampling.NEAREST).save(WORK / f"{name}-3x.png")

atlas = Image.open(ROOT / "public/assets/tilesets/me-complete.png").convert("RGBA")
background = Image.new("RGBA", (800, 260), "#789258")
for rect, pos in [((1920, 7312, 2080, 7472), (630, -65)), ((256, 96, 304, 160), (3, 1)),
                  ((0, 1152, 208, 1216), (260, 186))]:
    background.alpha_composite(atlas.crop(rect), pos)
explorer = Image.open(ROOT / "public/demos/pixel-characters/person-32.png").convert("RGBA")


def scenery(name, pose, travel=0):
    image = background.copy()
    for row, facing in enumerate(facings):
        yaw = math.radians(G["cameraContract"]["modelYawDegrees"][facing])
        dx, dy = round(-math.sin(yaw)*travel), round(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        image.alpha_composite(FRAMES[facing, name, pose], (70+row*195+dx, 58+dy))
        image.alpha_composite(explorer.crop((0, row*32, 32, (row+1)*32)), (30+row*195, 106))
    return image


background.save(OUT / "scene-background.png")
scenery("idle", 0).save(OUT / "scene-native.png")
scenery("idle", 0).resize((2400, 780), Image.Resampling.NEAREST).save(WORK / "scene-3x.png")
reference = Image.new("RGBA", (260, 112), "#879b82")
reference.alpha_composite(explorer.crop((0, 96, 32, 128)), (12, 64))
reference.alpha_composite(FRAMES["right", "idle", 0], (42, 20))
elephant_dir = ROOT / "public/demos/wildlife-v2/elephant/pilot-v2"
elephant = json.loads((elephant_dir / "sprite.json").read_text())
x, y, w, h = elephant["facings"]["right"]["frames"][0]["rect"]
reference.alpha_composite(Image.open(elephant_dir / "sheet.png").convert("RGBA").crop((x, y, x+w, y+h)), (140, 12))
reference.save(OUT / "scale-reference-native.png")
reference.resize((1040, 448), Image.Resampling.NEAREST).save(WORK / "scale-reference-4x.png")
sequence = [("idle", 0)]*3 + [("walk", i % 12) for i in range(24)]
sequence += [(name, i) for name in ["sniff", "display"] for i in range(8)] + [("idle", 0)]*3
native, scenes = [], []
for name, pose in sequence:
    image = Image.new("RGBA", (W*4, W), "#879b82")
    for row, facing in enumerate(facings):
        image.alpha_composite(FRAMES[facing, name, pose], (row*W, 0))
    native.append(image)
    scenes.append(scenery(name, pose))
durations = [clips[name]["frameDuration"] for name, _ in sequence]
for frames, path in [(native, OUT / "preview-native.gif"),
                     ([im.resize((W*12, W*3), Image.Resampling.NEAREST) for im in native], OUT / "preview.gif"),
                     (scenes, OUT / "scene-native.gif")]:
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, disposal=2, optimize=False)

assert set(sheet.getchannel("A").get_flattened_data()) == {0, 255}
assert all(im.getbbox()[0] > 2 and im.getbbox()[1] > 2 and im.getbbox()[2] < W-2 and im.getbbox()[3] < W-2
           for im in FRAMES.values())
report = {"identity": "panther-hunt-v1", "poses": len(FRAMES), "binaryAlpha": True,
          "canvas": [W, W], "anchor": G["anchor"],
          "idleVisibleHeights": {f: FRAMES[f, "idle", 0].getbbox()[3]-FRAMES[f, "idle", 0].getbbox()[1] for f in facings},
          "sequenceDurationMs": sum(durations), "status": "Integrity only; visual review separate."}
(OUT / "validation.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8", newline="\n")
for filename in ["playback.js", "index.html"]:
    shutil.copyfile(SCRIPT_SOURCE / filename, OUT / filename)
print(json.dumps(report))
