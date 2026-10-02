"""Compose authored pixel drawings over four Blender pose guides, at 32px and 16px.

uv run --with pillow python scripts/blender/finish_tiger.py
No Blender or ignored raw renders are required for this finishing step.
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO/"art-source"/"pixel-tiger"
OUT = REPO/"public"/"demos"/"blender-tiger"
ART = json.loads((SOURCE/"masters.json").read_text())
GUIDES = json.loads((SOURCE/"pose-guides.json").read_text())
PALETTE = {symbol: tuple(bytes.fromhex(color[1:]))+(255,) for symbol,color in ART["palette"].items()}
DIRECTIONS = ("down", "up", "left", "right")
BG, TEXT = (24,28,35), (239,229,202)


def tile(rows):
    rows = [row.replace(" ", "") for row in rows]
    assert len({len(row) for row in rows}) == 1, rows
    image = Image.new("RGBA", (len(rows[0]),len(rows)))
    for y,row in enumerate(rows):
        for x,symbol in enumerate(row):
            if symbol != ".":
                image.putpixel((x,y),PALETTE[symbol])
    return image


def line_pixels(a,b):
    """Integer Bresenham path: no filtering, half pixels or shaded edge samples."""
    x,y = a
    x2,y2 = b
    dx,dy = abs(x2-x),-abs(y2-y)
    sx,sy = (1 if x < x2 else -1),(1 if y < y2 else -1)
    error = dx+dy
    pixels = []
    while True:
        pixels.append((x,y))
        if (x,y) == (x2,y2):
            return pixels
        twice = 2*error
        if twice >= dy:
            error += dy
            x += sx
        if twice <= dx:
            error += dx
            y += sy


def compose(size,direction,pose):
    pieces = {name: tile(rows) for name,rows in ART[str(size)].items()}
    image = Image.new("RGBA",(size,size))
    scale = size/32

    def position(point):
        # Half-up rounding preserves the one-pixel contact/lift difference at
        # 16px; Python's ties-to-even would collapse 24px and 25px to 12px.
        return tuple(math.floor(value*scale+.5) for value in point)

    def paste(name,center,offset=(0,0),mirror=False):
        piece = pieces[name]
        if mirror:
            piece = ImageOps.mirror(piece)
        cx,cy = position(center)
        xy = (cx-piece.width//2+offset[0], cy-piece.height//2+offset[1])
        image.alpha_composite(piece,xy)
        return piece,xy

    # Tail joints come from the rig. Rebuild a clean, flat-color pixel ribbon;
    # broad alternating bands replace the rendered tube's tiny shaded fragments.
    joints = [position(point) for point in pose["tail"]]
    # The wider drawn head would conceal the rendered tail. Open the curl
    # outward in front/back views to keep that character feature readable.
    if direction in ("down", "up"):
        spread = (4 if size == 32 else 2)*(1 if direction == "down" else -1)
        joints = [joints[0]]+[(x+spread,y) for x,y in joints[1:]]
    path = []
    for a,b in zip(joints,joints[1:]):
        path.extend(line_pixels(a,b)[:-1])
    path.append(joints[-1])
    draw = ImageDraw.Draw(image)
    if size == 32:
        draw.line(joints,fill=PALETTE["b"],width=3)
        for index,point in enumerate(path):
            image.putpixel(point,PALETTE["k" if index%5 >= 3 else "o"])
    else:
        draw.line(joints,fill=PALETTE["o"],width=1)
        image.putpixel(joints[-1],PALETTE["k"])

    # Four rig samples set contacts, lifts, arm swing and the head bob. The
    # actual parts, marks and shadows are the same authored drawings each time.
    for foot in sorted(pose["feet"],key=lambda point: point[1]):
        fx,fy = position(foot)
        _,hip_y = position(pose["body"])
        draw.line([(fx,hip_y+1),(fx,fy-1)],fill=PALETTE["b"],width=3 if size == 32 else 1)
        if size == 32:
            draw.line([(fx,hip_y+1),(fx,fy-1)],fill=PALETTE["o"],width=1)
        paste("foot",foot,(0,-1 if size == 32 else 0))
    for hand in sorted(pose["hands"],key=lambda point: point[1]):
        paste("arm",hand,(0,-2 if size == 32 else -1),direction == "right")
    body = "body" if direction == "down" else "backBody" if direction == "up" else "sideBody"
    paste(body,pose["body"],mirror=direction == "right")
    head = "front" if direction == "down" else "back" if direction == "up" else "profile"
    bob = -1 if size == 16 and pose["blenderFrame"] in (3,7) else 0
    head_piece,head_xy = paste(head,pose["head"],offset=(0,bob),mirror=direction == "right")
    # Validate the full head drawing in the composed sprite, not just its eyes.
    for y in range(head_piece.height):
        for x in range(head_piece.width):
            pixel = head_piece.getpixel((x,y))
            if pixel[3]:
                assert image.getpixel((head_xy[0]+x,head_xy[1]+y)) == pixel
    return image


def enlarged(frame,scale):
    tile_image = Image.new("RGB",(frame.width*scale,frame.height*scale),BG)
    sprite = frame.resize(tile_image.size,Image.Resampling.NEAREST)
    tile_image.paste(sprite,(0,0),sprite)
    return tile_image


def font(size):
    return ImageFont.load_default(size=size)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    versions = {}
    contracts = {}
    for size in (32,16):
        clips = {direction:[compose(size,direction,pose) for pose in GUIDES["directions"][direction]] for direction in DIRECTIONS}
        sheet = Image.new("RGBA",(size*4,size*4))
        for row,(direction,frames) in enumerate(clips.items()):
            assert len({frame.tobytes() for frame in frames}) == 4, f"Repeated {size}px poses: {direction}"
            for col,frame in enumerate(frames):
                bounds = frame.getbbox()
                assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < size and bounds[3] < size, (size,direction,col,bounds)
                assert set(frame.getchannel("A").get_flattened_data()) <= {0,255}
                assert all(pixel in PALETTE.values() for pixel in frame.get_flattened_data() if pixel[3])
                sheet.paste(frame,(col*size,row*size))
        filename = f"tiger-finished-{size}.png"
        sheet.save(OUT/filename)
        versions[size] = clips
        contracts[str(size)] = {"image":filename,"frameWidth":size,"frameHeight":size,"columns":4,"rows":4,"fps":4,
                                "pivot":[size//2,27 if size == 32 else 14],"loop":True,
                                "directions":{direction:{"row":row,"frames":4} for row,direction in enumerate(DIRECTIONS)},
                                "sheetSha256":hashlib.sha256((OUT/filename).read_bytes()).hexdigest()}
    metadata = {"versions":contracts,"palette":ART["palette"],"sourceFrames":GUIDES["frames"],
                "source":"art-source/pixel-tiger/masters.json","poseGuides":"art-source/pixel-tiger/pose-guides.json",
                "builder":"scripts/blender/finish_tiger.py","method":"authored pixel parts composed using four Blender pose guides; separate 16px drawings"}
    (OUT/"tiger-finished.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")

    contact = Image.new("RGB",(736,340),BG)
    draw = ImageDraw.Draw(contact)
    draw.text((16,12),"AUTHORED PIXELS / FOUR BLENDER POSES / 32 PX + 16 PX",fill=TEXT,font=font(18))
    for row,direction in enumerate(DIRECTIONS):
        draw.text((8,61+row*72),direction.upper(),fill=TEXT,font=font(13))
        for col,frame in enumerate(versions[32][direction]):
            contact.paste(enlarged(frame,2),(72+col*72,40+row*72))
            contact.paste(enlarged(versions[16][direction][col],4),(400+col*72,40+row*72))
    contact.save(OUT/"finished-contact-sheet.png")

    old = Image.open(OUT/"tiger-walk.png").convert("RGBA")
    previews = []
    for pose in range(4):
        canvas = Image.new("RGB",(840,480),BG)
        draw = ImageDraw.Draw(canvas)
        for col,direction in enumerate(DIRECTIONS):
            draw.text((48+col*200,12),direction.upper(),fill=TEXT,font=font(18))
            before = old.crop((pose*64,col*32,pose*64+32,col*32+32))
            canvas.paste(enlarged(before,5),(44+col*200,42))
            canvas.paste(enlarged(versions[32][direction][pose],5),(44+col*200,250))
            canvas.paste(enlarged(versions[16][direction][pose],2),(172+col*200,420))
        draw.text((12,211),"BLENDER + EYE FIX",fill=TEXT,font=font(16))
        draw.text((12,453),"AUTHORED FINISH    /    small figures: separate native 16px art at 2x",fill=TEXT,font=font(16))
        previews.append(canvas)
    previews[0].save(OUT/"finish-comparison.gif",save_all=True,append_images=previews[1:],duration=250,loop=0,disposal=2)
    previews[0].save(OUT/"finish-comparison.png")
    print(json.dumps({"nativeSizes":[32,16],"framesPerDirection":4,"directions":4,"colors":len(PALETTE),"wholeHeadsStable":True,"contracts":contracts},indent=2))


if __name__ == "__main__":
    main()
