"""Arrange native sprite crops and matched views from the exported GLBs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parents[3]
frames=root/"data/experiments/town-people"
out=root/"public/demos/town-people-3d/v1"
paper="#f6f5ef"
ink="#283d35"
img=Image.new("RGB",(1200,950),paper)
d=ImageDraw.Draw(img)


def font(size, heading=False):
    for face in (("Georgia.ttf","DejaVuSerif.ttf") if heading else ("Arial.ttf","DejaVuSans.ttf")):
        for file in (face,Path("/System/Library/Fonts/Supplemental")/face):
            try: return ImageFont.truetype(str(file),size)
            except OSError: pass
    return ImageFont.load_default(size)


d.text((36,22),"Town pedestrians",font=font(49,True),fill=ink)
d.text((39,88),"Tilefun   /   Standing character studies",font=font(18),fill="#52665d")
d.line((36,125,1164,125),fill="#b3c4ba")
for x,label in [(123,"Original sprite"),(341,"Front"),(575,"Three-quarter"),(810,"Profile"),(1044,"Back")]:
    d.text((x,144),label,font=font(20),fill=ink,anchor="mt")

for row,id in enumerate((4,10,20)):
    y=186+row*250
    s=Image.open(root/f"public/assets/sprites/person{id}.png").convert("RGBA").crop((0,0,16,32))
    s=s.crop(s.getbbox())
    s.thumbnail((16,32))
    s=s.resize((s.width*6,s.height*6),Image.Resampling.NEAREST)
    img.paste(s,(122-s.width//2,y+96-s.height//2),s)
    d.text((122,y+187),f"Person {id}",font=font(21),fill=ink,anchor="mt")
    for col,(angle,cx) in enumerate(zip(("front","three-quarter","profile","back"),(341,575,810,1044))):
        render=Image.open(frames/(angle+".png")).convert("RGB")
        pixel_x=(160,470,780)[row]
        render=render.crop((pixel_x-153,0,pixel_x+153,456)).resize((154,228),Image.Resampling.LANCZOS)
        panel=(cx-110,y,cx+110,y+228)
        d.rounded_rectangle(panel,radius=9,fill=render.getpixel((0,0)))
        img.paste(render,(cx-77,y))
    if row<2: d.line((36,y+239,1164,y+239),fill="#d2dbd3")

img.save(out/"angle-sheet.jpg",quality=94,subsampling=0)
