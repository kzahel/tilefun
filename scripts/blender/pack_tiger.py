"""Apply one shared palette, preserve alpha/pivots, and pack the tiger demo."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[2]
RAW = REPO / "data" / "blender-tiger" / "raw"
OUT = REPO / "public" / "demos" / "blender-tiger"
REPORT = json.loads((RAW.parent/"render.json").read_text())
COLORS = [tuple(bytes.fromhex(c[1:])) for c in REPORT["palette"]]
BG, GRID, TEXT = (24,28,35), (32,38,45), (239,229,202)


def process(raw):
    raw = raw.resize((32,32),Image.Resampling.NEAREST)
    image = Image.new("RGBA",raw.size)
    visible = {(x,y) for y in range(32) for x in range(32) if raw.getpixel((x,y))[3] >= 110}
    edge = {(x+dx,y+dy) for x,y in visible for dx,dy in [(0,1),(0,-1),(1,0),(-1,0)] if 0 <= x+dx < 32 and 0 <= y+dy < 32}
    for xy in edge-visible:
        image.putpixel(xy,COLORS[0]+(255,))
    for xy in visible:
        color = raw.getpixel(xy)[:3]
        closest = min(COLORS,key=lambda c:sum((a-b)**2 for a,b in zip(color,c)))
        image.putpixel(xy,closest+(255,))
    return image


def checker(size):
    image = Image.new("RGB",size,BG)
    draw = ImageDraw.Draw(image)
    for y in range(0,size[1],16):
        for x in range(0,size[0],16):
            if (x//16+y//16)%2:
                draw.rectangle((x,y,x+15,y+15),fill=GRID)
    return image


def display(image,scale=6):
    scaled = image.resize((32*scale,32*scale),Image.Resampling.NEAREST)
    tile = checker(scaled.size)
    tile.paste(scaled,(0,0),scaled)
    return tile


def font(size):
    # Use Pillow's bundled font so the packer is portable across operating systems.
    return ImageFont.load_default(size=size)


def main(preview):
    OUT.mkdir(parents=True,exist_ok=True)
    count = 1 if preview else REPORT["frameCount"]
    clips = {}
    for direction in REPORT["directions"]:
        clips[direction] = [process(Image.open(RAW/f"{direction}-{f:02}.png").convert("RGBA")) for f in range(1,count+1)]
    if preview:
        stage = Image.new("RGB",(800,244),BG)
        for row,direction in enumerate(REPORT["directions"]):
            stage.paste(display(clips[direction][0]),(4+row*200,40))
            ImageDraw.Draw(stage).text((16+row*200,12),direction.upper(),fill=TEXT,font=font(18))
        stage.save(RAW.parent/"model-preview.png")
        return

    sheet = Image.new("RGBA",(32*count,32*4))
    all_colors, bounds = set(), {}
    for row,(direction,frames) in enumerate(clips.items()):
        bounds[direction] = []
        for col,frame in enumerate(frames):
            sheet.paste(frame,(col*32,row*32))
            all_colors.update(pixel[:3] for pixel in frame.get_flattened_data() if pixel[3])
            bounds[direction].append(frame.getbbox())
            assert set(frame.getchannel("A").get_flattened_data()) <= {0,255}
        assert len({f.tobytes() for f in frames}) == count, direction
    assert all(c in COLORS for c in all_colors)
    assert all(b and b[0] > 0 and b[1] > 0 and b[2] < 32 and b[3] < 32 for clip in bounds.values() for b in clip), bounds
    sheet.save(OUT/"tiger-walk.png")
    contact = Image.new("RGB",(880,448),BG)
    draw = ImageDraw.Draw(contact)
    draw.text((16,12),"TIGER / FOUR DIRECTIONS / 8 POSES / 32 PX",fill=TEXT,font=font(21))
    for row,(direction,frames) in enumerate(clips.items()):
        draw.text((12,65+row*96),direction.upper(),fill=TEXT,font=font(15))
        for col,frame in enumerate(frames):
            contact.paste(display(frame,3),(100+col*96,40+row*96))
    for i,color in enumerate(COLORS):
        draw.rectangle((100+i*27,430,123+i*27,442),fill=color)
    contact.save(OUT/"contact-sheet.png")
    previews = []
    for index in range(count):
        canvas = Image.new("RGB",(800,244),BG)
        for row,direction in enumerate(clips):
            canvas.paste(display(clips[direction][index]),(4+row*200,40))
            ImageDraw.Draw(canvas).text((16+row*200,12),direction.upper(),fill=TEXT,font=font(18))
        previews.append(canvas)
    previews[0].save(OUT/"walk-preview.gif",save_all=True,append_images=previews[1:],duration=[120,130]*4,loop=0,disposal=2)
    previews[0].save(OUT/"preview.png")
    metadata = {"image":"tiger-walk.png","frameWidth":32,"frameHeight":32,"columns":count,
                "rows":4,"fps":REPORT["fps"],"pivot":REPORT["pivot"],"loop":True,
                "directions":{name:{"row":row,"frames":count} for row,name in enumerate(clips)},
                "palette":REPORT["palette"],"source":"art-source/blender/tiger.blend",
                "builder":"scripts/blender/build_tiger.py","blenderVersion":REPORT["blenderVersion"]}
    (OUT/"tiger-walk.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")
    # Validate encoded playback as well as the source PNGs.
    gif = Image.open(OUT/"walk-preview.gif")
    duration = 0
    for frame in range(gif.n_frames):
        gif.seek(frame)
        duration += gif.info["duration"]
    assert gif.n_frames == count and duration == 1000
    validation = {"frames":count*4,"uniqueColors":len(all_colors),"alpha":"binary",
                  "allFramesPadded":True,"tailMeshDeformation":REPORT["tailDeformation"],
                  "gifFrames":gif.n_frames,"gifDurationMs":duration,
                  "sheetSha256":hashlib.sha256((OUT/"tiger-walk.png").read_bytes()).hexdigest()}
    (RAW.parent/"validation.json").write_text(json.dumps(validation,indent=2),encoding="utf-8")
    print(json.dumps(validation,indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview",action="store_true")
    main(parser.parse_args().preview)
