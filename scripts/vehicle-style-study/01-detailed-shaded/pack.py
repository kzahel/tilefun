"""Adapt character packer's fixed palette/binary alpha/cardinal ink to car contract.

No pixel-art redraw or authored feature clusters. Requires Python and Pillow.
python scripts/vehicle-style-study/01-detailed-shaded/pack.py
"""
import hashlib
import json
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
ROUTE="01-detailed-shaded"
DATA=ROOT/"data/vehicle-style-study"/ROUTE
OUT=ROOT/"public/demos/vehicle-style-study"/ROUTE
REFS=ROOT/"art-source/vehicle-models/compact-4/v1/refs"
BG=(28,32,41); GRID=(37,42,53); TEXT=(235,235,239); MUTED=(164,181,201)


def hexcolor(c): return '#'+''.join(f'{x:02x}' for x in c)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def font(size): return ImageFont.load_default(size=size)


def checker(size,step=16):
    im=Image.new("RGB",size,BG); d=ImageDraw.Draw(im)
    for y in range(0,size[1],step):
        for x in range(0,size[0],step):
            if (x//step+y//step)%2: d.rectangle((x,y,x+step-1,y+step-1),fill=GRID)
    return im


def show(im,size=None):
    if size: im=im.resize(size,Image.Resampling.NEAREST)
    bg=checker(im.size)
    bg.paste(im,(0,0),im)
    return bg


counts=Counter()
refs=[]
for path in sorted(REFS.glob("*.png")):
    im=Image.open(path).convert("RGBA")
    counts.update(p[:3] for p in im.get_flattened_data() if p[3]>=128)
    refs.append({"path":path.relative_to(ROOT).as_posix(),"sha256":sha(path),"size":list(im.size)})
# Every opaque source colour is retained. Supplements are explicit material roles,
# fixed before processing any direction; there is no adaptive per-frame palette.
sampled=[c for c,n in counts.most_common()]
roles={"redDeepShadow":(65,12,26),"redShadow":(116,18,29),
       "redMid":(171,22,30),"redAutomotive":(221,32,37),
       "redLit":(250,67,57),"redClearcoat":(255,124,100),
       "trimOutline":(28,25,39)}
palette=list(dict.fromkeys(sampled+list(roles.values())))
ink=roles["trimOutline"]
cache={}


def nearest(rgb):
    if rgb not in cache:
        cache[rgb]=min(palette,key=lambda c:sum((a-b)**2 for a,b in zip(rgb,c)))
    return cache[rgb]


def process(raw,index):
    # Premultiplied filtering prevents invisible RGB leaking across the silhouette.
    small=raw.convert("RGBa").resize((128,128),Image.Resampling.LANCZOS).convert("RGBA")
    # Whole canvas translation is identical for all directions. Never crop/refit.
    shifted=Image.new("RGBA",(128,128))
    shifted.paste(small,(0,28))
    shifted.save(DATA/f"reduced-{index}.png")
    visible={(x,y) for y in range(128) for x in range(128) if shifted.getpixel((x,y))[3]>=110}
    edge={(x+dx,y+dy) for x,y in visible for dx,dy in [(0,1),(0,-1),(1,0),(-1,0)]
          if 0<=x+dx<128 and 0<=y+dy<128}-visible
    final=Image.new("RGBA",(128,128))
    for xy in edge: final.putpixel(xy,(*ink,255))
    for xy in visible: final.putpixel(xy,(*nearest(shifted.getpixel(xy)[:3]),255))
    return final,shifted,{"bodyPixels":len(visible),"outlinePixels":len(edge),"bounds":list(final.getbbox())}


frames=[]; reduced=[]; metrics=[]; used=set(); raws=[]
for i in range(8):
    raw=Image.open(OUT/f"raw-{i}.png").convert("RGBA")
    assert raw.size==(512,512)
    raws.append(raw)
    im,small,m=process(raw,i)
    im.save(OUT/f"view-{i}.png")
    frames.append(im); reduced.append(small); metrics.append(m)
    alpha=set(im.getchannel('A').get_flattened_data())
    assert alpha=={0,255}
    colours={p[:3] for p in im.get_flattened_data() if p[3]}
    assert colours<=set(palette)
    used.update(colours)
    b=im.getbbox()
    assert b and b[0]>0 and b[1]>0 and b[2]<128 and b[3]<128, b
assert len({im.tobytes() for im in frames})==8
sheet=Image.new("RGBA",(1024,128))
for i,im in enumerate(frames): sheet.paste(im,(i*128,0))
sheet.save(OUT/"sheet.png")

# Contact sheet exposes every raw beauty image and all eight native sprites.
contact=checker((1024,570)); d=ImageDraw.Draw(contact)
for i in range(8):
    x=(i%4)*256; y=(i//4)*282
    contact.paste(show(raws[i],(256,256)),(x,y+23))
    d.text((x+8,y+3),f"RAW {i} / {i*45} degrees",font=font(16),fill=TEXT)
contact.save(OUT/"raw-contact.png")
native=checker((512,302)); d=ImageDraw.Draw(native)
for i,im in enumerate(frames):
    x=(i%4)*128; y=(i//4)*150
    native.paste(show(im),(x,y+21))
    d.text((x+8,y+2),f"{i} / {i*45} deg",font=font(13),fill=TEXT)
native.save(OUT/"native-contact.png")

# Labelled 4x2 cells retain raw beauty, true 1x filtered/palette sprites and 4x
# nearest final. No view is independently framed, even in this process sheet.
CW=528; CH=890; HEADER=100; FOOTER=300
comparison=Image.new("RGB",(CW*4,HEADER+CH*2+FOOTER),BG)
d=ImageDraw.Draw(comparison)
d.text((20,14),"01 / DETAILED SHADED SPORTS COUPE",font=font(29),fill=TEXT)
d.text((20,54),"Direct 16-sample CPU beauty > 128px Lanczos > shared palette / binary alpha / 1px ink. No feature redraw.",font=font(19),fill=MUTED)
for i in range(8):
    x=(i%4)*CW; y=HEADER+(i//4)*CH
    d.text((x+8,y+3),f"VIEW {i} / YAW {i*45} degrees",font=font(20),fill=TEXT)
    d.text((x+8,y+32),"RAW BEAUTY / 0.5x",font=font(15),fill=MUTED)
    comparison.paste(show(raws[i],(256,256)),(x+8,y+56))
    d.text((x+280,y+32),"REDUCED / 1x",font=font(15),fill=MUTED)
    comparison.paste(show(reduced[i]),(x+280,y+56))
    d.text((x+280,y+186),"FINAL / 1x",font=font(15),fill=MUTED)
    comparison.paste(show(frames[i]),(x+280,y+208))
    d.text((x+8,y+342),"FINAL / 4x NEAREST",font=font(15),fill=MUTED)
    comparison.paste(show(frames[i],(512,512)),(x+8,y+364))
fy=HEADER+CH*2
d.text((16,fy+8),"EXISTING COMPACT-4 REFERENCES / PALETTE PROVENANCE / ORIGINAL PIXELS UNCHANGED",font=font(21),fill=TEXT)
for i,ref in enumerate(refs):
    im=Image.open(ROOT/ref['path']).convert('RGBA')
    x=i*CW+12
    d.text((x,fy+42),Path(ref['path']).name+" / 1x and 2x",font=font(17),fill=MUTED)
    comparison.paste(show(im),(x,fy+72))
    comparison.paste(show(im,(im.width*2,im.height*2)),(x+im.width+16,fy+72))
for i,c in enumerate(palette):
    x=16+i*30; yy=comparison.height-35
    d.rectangle((x,yy,x+25,yy+20),fill=c)
d.text((16,comparison.height-62),f"{len(palette)} fixed palette entries; {len(used)} actually used. Six named automotive reds + one dark trim supplement.",font=font(17),fill=MUTED)
comparison.save(OUT/"comparison.png")

# Same-size checker and fixed anchor throughout; GIF is a display derivative.
gifframes=[show(im,(512,512)) for im in frames]
gifframes[0].save(OUT/"turntable.gif",save_all=True,append_images=gifframes[1:],duration=350,loop=0,disposal=2,optimize=False)
gif=Image.open(OUT/"turntable.gif")
assert gif.n_frames==8
gif_durations=[]
for i in range(8):
    gif.seek(i); gif_durations.append(gif.info['duration'])

render=json.loads((DATA/"render.json").read_text(encoding='utf-8'))
command1='& "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --threads 4 --python-exit-code 1 --python scripts/vehicle-style-study/01-detailed-shaded/build.py'
command2='python scripts/vehicle-style-study/01-detailed-shaded/pack.py'
report={"route":ROUTE,"title":"Detailed smooth red sports coupe / direct shaded render",
        "status":"awaiting-visual-inspection",
        "method":"Original parametric curved panels and mechanical details; glossy red Principled clearcoat; fixed soft studio; CPU Cycles 16 samples; direct render quantization adapting pack_tiger.py. No authored pixel clusters or redraw.",
        "evaluatedTriangles":render['complexity']['evaluatedTriangles'],
        "evaluatedMeshCount":render['complexity']['evaluatedMeshCount'],
        "sourceMeshCount":render['complexity']['sourceMeshCount'],
        "sourceCurveCount":render['complexity']['sourceCurveCount'],
        "nativeSize":[128,128],"rawSize":[512,512],
        "palette":[hexcolor(c) for c in palette],"paletteCount":len(palette),"colourCount":len(used),
        "paletteProvenance":{"sourceReferences":refs,"sampledColours":[hexcolor(c) for c in sampled],
                             "namedSupplementRoles":{k:hexcolor(v) for k,v in roles.items()}},
        "blendPath":render['blend'],"sourcePath":"scripts/vehicle-style-study/01-detailed-shaded/build.py",
        "packerPath":"scripts/vehicle-style-study/01-detailed-shaded/pack.py",
        "commands":[command1,command2],"renderer":{"engine":"Cycles CPU","threads":4,"samples":16},
        "projection":render['camera'],"model":render['model'],
        "packing":{"filter":"premultiplied-alpha Lanczos 512 to 128","translation":[0,28],
                   "groundAnchor":[64,92],"alphaThreshold":110,"alpha":"binary 0 or 255",
                   "outline":"one native pixel, exterior cardinal neighbours only","dither":False,
                   "independentFrameFit":False,"authoredPixelClusters":[]},
        "views":metrics,"gif":{"frames":gif.n_frames,"durationMs":gif_durations,"size":[512,512],"loop":True},
        "limitations":["Unreviewed offline experiment; no production approval or integration.",
                       "Bright softbox highlights can turn red panels pale pink and collapse to broad flat palette bands.",
                       "Fine split spokes, rotor drillings, lens rings, tire grooves and grille ribs approach or fall below a native pixel.",
                       "Reflective highlights change across directions under fixed lighting; palette mapping cannot impose authored cluster stability.",
                       "Glass is opaque reflective smoked material, not a refractive cabin with interior.",
                       "Editable wheels have separate pivots, but animated steering, tire/body clearance and runtime optimization are unqualified.",
                       "Dense evaluated geometry is an offline shading experiment, not a runtime mesh budget."],
        "visualInspection":[],"validation":{"distinctViews":8,"binaryAlpha":True,"sharedPalette":True,"allFramesPadded":True,
                                             "sheetSize":[1024,128],"expectedFilesExist":True},
        "outputHashes":{p.name:sha(p) for p in sorted(OUT.iterdir()) if p.suffix.lower() in ('.png','.gif')}}
expected=[f'{kind}-{i}.png' for kind in ('raw','view') for i in range(8)]+['sheet.png','comparison.png','turntable.gif']
assert all((OUT/p).is_file() for p in expected)
assert (ROOT/report['blendPath']).is_file()
(OUT/"report.json").write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
(DATA/"palette.json").write_text(json.dumps(report['paletteProvenance'],indent=2)+'\n',encoding='utf-8')
print(json.dumps({"status":report['status'],"triangles":report['evaluatedTriangles'],"palette":len(palette),"used":len(used),"bounds":[m['bounds'] for m in metrics],"gifDuration":sum(gif_durations)},indent=2))
