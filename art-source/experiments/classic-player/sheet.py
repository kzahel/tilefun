"""Lay out the exported model views and the original three directional sprite cells."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[3]
renders = root / "data/experiments/classic-player"
output = root / "public/demos/classic-player-3d/v1"
paper, ink, muted = "#f7f6f0", "#243936", "#526460"
stage = Image.open(renders/"hero.png").convert("RGB").getpixel((0,0))
board = Image.new("RGB", (1260,800), paper)
draw = ImageDraw.Draw(board)


def font(name, fallback, size):
    for path in [name, Path("/System/Library/Fonts/Supplemental")/name, fallback]:
        try:
            return ImageFont.truetype(str(path),size)
        except OSError:
            pass
    return ImageFont.load_default(size)


title = font("Georgia.ttf","DejaVuSerif.ttf",55)
label = font("Arial Bold.ttf","DejaVuSans-Bold.ttf",17)
small = font("Arial.ttf","DejaVuSans.ttf",16)
draw.text((42,28),"Classic Player",font=title,fill=ink)
draw.text((45,101),"Tilefun  /  Standing character study",font=small,fill=muted)
source = Image.open(root/"public/assets/sprites/player.png").convert("RGBA")
for i,row in enumerate((0,3,1)):
    sprite = source.crop((0,16*row,16,16*row+16)).resize((64,64),Image.Resampling.NEAREST)
    board.paste(sprite,(990+80*i,23),sprite)
draw.text((1100,99),"Original 16 × 16 sprite",font=small,fill=muted,anchor="mt")
draw.line((40,136,1220,136),fill="#b9c6bd",width=1)


def panel(view, caption, x, y, w, h):
    label_height = 37
    rh = h-label_height
    image = Image.open(renders/(view+".png")).convert("RGB")
    # The source still includes a wide studio margin. Keep the camera scale
    # consistent between the four smaller views while fitting the main portrait.
    crop_w = min(image.width,round(image.height*w/rh))
    left = (image.width-crop_w)//2
    image = image.crop((left,0,left+crop_w,image.height))
    image.thumbnail((w,rh), Image.Resampling.LANCZOS)
    draw.rounded_rectangle((x,y,x+w-1,y+rh-1),radius=12,fill=stage)
    board.paste(image,(x+(w-image.width)//2,y+(rh-image.height)//2))
    draw.text((x+3,y+rh+8),caption,font=label,fill=ink)


panel("hero","Three-quarter",40,158,550,604)
panel("front","Front",612,158,293,297)
panel("side","Profile",927,158,293,297)
panel("back","Back",612,465,293,297)
panel("above","From above",927,465,293,297)
draw.text((42,773),"Original sprite by Cup Nooble · Sprout Lands",font=small,fill=muted)
board.save(output/"angle-sheet.jpg",quality=95,subsampling=0)
