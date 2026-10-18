"""Deterministic native palette masters from this species' evaluated Blender volumes.

No sprite rescaling, frame-wide bounce, source-color quantization or random marks.
"""
import json
import math
import shutil
import sys
from pathlib import Path
from PIL import Image, ImageDraw

SPECIES = "t-rex"
ROOT = next(p for p in Path(__file__).resolve().parents if (p/"package.json").exists())
SCRIPT = Path(__file__).resolve().parent
SCRATCH = "--workspace" in sys.argv
WORK = ROOT / sys.argv[sys.argv.index("--workspace")+1] if SCRATCH else ROOT/f"data/fierce-137/{SPECIES}"
SOURCE = WORK/"source" if SCRATCH else SCRIPT
OUT = WORK/"public" if SCRATCH else ROOT/f"public/demos/wildlife-v2/{SPECIES}/fierce-v1"
assert not (SOURCE/"receipt.json").exists(), "Registered pixels are immutable; use --workspace."
OUT.mkdir(parents=True,exist_ok=True)
G = json.loads((WORK/"projected-guides.json").read_text())
W = G["canvas"][0]
palette = G["palette"]
letters = list(palette)
colors = {k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
colors["."]=(0,0,0,0)
idx = {k:i+1 for i,k in enumerate(letters)}
facings = ["down","up","left","right"]
clips = {}
column = 0
for name,(_,count) in G["clips"].items():
    duration = 100 if name in ["walk","flight"] else 160 if name in ["feed","display"] else 280 if name=="sleep" else G["chargeStride"]*10/G["chaseSpeed"]*1000/count if name=="charge" else 180
    clips[name]={"start":column,"count":count,"frameDuration":duration,"rootTravelPixelsPerCycle":(G["chargeStride"] if name=="charge" else G["stride"])*10 if name in ["walk","charge"] else 0}
    column+=count

def pixels(record):
    image=Image.new("L",(W,W))
    draw=ImageDraw.Draw(image)
    for name,volume in sorted(record["volumes"].items(),key=lambda item:-sum(item[1]["depthRange"])/2):
        points=[(math.floor(x+.5),math.floor(y+.5)) for x,y in volume["hull"]]
        color=volume["color"]
        if not points: continue
        if len(points)<3:
            draw.line(points,fill=idx[color],width=1)
            continue
        mask=Image.new("1",(W,W))
        ImageDraw.Draw(mask).polygon(points,fill=1)
        bounds=mask.getbbox()
        if not bounds: continue
        draw.polygon(points,fill=idx[color])
        if color in ["c","w","r"]:
            # Broad authored upper light and lower shade, clipped to each fixed
            # projected volume. Adjacent body pieces do not get bead outlines.
            for x in range(bounds[0],bounds[2]):
                ys=[y for y in range(bounds[1],bounds[3]) if mask.getpixel((x,y))]
                for y in ys:
                    if color=="c" and y<=ys[0]+1: image.putpixel((x,y),idx["h"])
                    elif color=="c" and y>=ys[-1]-1: image.putpixel((x,y),idx["s"])
                    elif color=="w" and y>=ys[-1]-1: image.putpixel((x,y),idx["g"])
        if name.startswith("wing-finger"):
            draw.line(points+[points[0]],fill=idx["g"],width=1)
    before=image.copy()
    for y in range(1,W-1):
        for x in range(1,W-1):
            value=before.getpixel((x,y))
            if value and letters[value-1] not in ["e","f","g"] and any(not before.getpixel((x+dx,y+dy)) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):
                image.putpixel((x,y),idx["k"])
    return image

frames,masters={},[]
for record in G["records"]:
    image=pixels(record)
    data=list(image.get_flattened_data())
    rows=["".join("." if p==0 else letters[p-1] for p in data[y*W:(y+1)*W]) for y in range(W)]
    masters.append({"facing":record["facing"],"clip":record["clip"],"index":record["index"],"pixels":rows})
    rgba=Image.new("RGBA",(W,W))
    rgba.putdata([colors[c] for row in rows for c in row])
    frames[record["facing"],record["clip"],record["index"]]=rgba
M={"identity":f"{SPECIES}-fierce-v1-pixels-01","palette":palette,"canvas":[W,W],"anchor":G["anchor"],
   "stylization":["Fixed 40-degree wildlife camera at 10 native pixels per unit.","Species-owned fixed meshes, moving hips, planted-foot compensation and independently posed head/jaw/tail/wings.","Integer projected silhouettes with broad palette bands; every final pixel is retained in letter masters."],"frames":masters}
(SOURCE/"masters.json").write_text(json.dumps(M,indent=1)+"\n",encoding="utf-8",newline="\n")
sheet=Image.new("RGBA",(column*W,4*W))
meta={"identity":M["identity"],"reviewStatus":"pending","image":"sheet.png","frameWidth":W,"frameHeight":W,"anchor":G["anchor"],"rootMotion":False,
      "cameraContract":G["cameraContract"],"orthoScale":G["orthoScale"],"shiftY":G["shiftY"],"rootTravelPixelsPerCycle":G["stride"]*10,"clips":clips,"facings":{}}
for row,facing in enumerate(facings):
    meta["facings"][facing]={"frames":[]}
    for name,clip in clips.items():
        for i in range(clip["count"]):
            image=frames[facing,name,i]
            x,y=(clip["start"]+i)*W,row*W
            sheet.alpha_composite(image,(x,y))
            record=next(r for r in G["records"] if (r["facing"],r["clip"],r["index"])==(facing,name,i))
            meta["facings"][facing]["frames"].append({"clip":name,"index":i,"rect":[x,y,W,W],"visibleBounds":image.getbbox(),"contacts":record["contacts"],"projectedContacts":record["projectedContacts"]})
sheet.save(OUT/"sheet.png")
(OUT/"sprite.json").write_text(json.dumps(meta,indent=1)+"\n",encoding="utf-8",newline="\n")
contact=Image.new("RGBA",sheet.size,"#879b82")
contact.alpha_composite(sheet)
contact.save(OUT/"contact-sheet-native.png")
allbounds=[im.getbbox() for im in frames.values()]
crop=(min(b[0] for b in allbounds)-2,min(b[1] for b in allbounds)-2,max(b[2] for b in allbounds)+2,max(b[3] for b in allbounds)+2)
cw,ch=crop[2]-crop[0],crop[3]-crop[1]
for name,clip in clips.items():
    panel=Image.new("RGBA",((cw+3)*clip["count"],(ch+12)*4),"#879b82")
    draw=ImageDraw.Draw(panel)
    for row,facing in enumerate(facings):
        draw.text((0,row*(ch+12)),facing,fill="white")
        for i in range(clip["count"]): panel.alpha_composite(frames[facing,name,i].crop(crop),(i*(cw+3),row*(ch+12)+12))
    panel.save(WORK/f"{name}-native.png")
    panel.resize((panel.width*3,panel.height*3),Image.Resampling.NEAREST).save(WORK/f"{name}-3x.png")
background=Image.new("RGBA",(960,320),"#789258")
atlas=Image.open(ROOT/"public/assets/tilesets/me-complete.png").convert("RGBA")
for rect,pos in [((1920,7312,2080,7472),(780,-40)),((256,96,304,160),(6,14)),((0,1152,208,1216),(360,245))]: background.alpha_composite(atlas.crop(rect),pos)
explorer=Image.open(ROOT/"public/demos/pixel-characters/person-32.png").convert("RGBA")
def scenery(name,index,travel=0):
    image=background.copy()
    for row,facing in enumerate(facings):
        yaw=math.radians(G["cameraContract"]["modelYawDegrees"][facing])
        dx,dy=round(-math.sin(yaw)*travel),round(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        image.alpha_composite(frames[facing,name,index],(110+row*230-G["anchor"][0]+dx,220-G["anchor"][1]+dy))
        image.alpha_composite(explorer.crop((0,row*32,32,(row+1)*32)),(45+row*230,192))
    return image
background.save(OUT/"scene-background.png")
scenery("idle",0).save(OUT/"scene-native.png")
scenery("idle",0).resize((2880,960),Image.Resampling.NEAREST).save(WORK/"scene-3x.png")
reference=Image.new("RGBA",(340,200),"#879b82")
reference.alpha_composite(explorer.crop((0,96,32,128)),(8,142))
reference.alpha_composite(frames["right","idle",0],(70-G["anchor"][0],170-G["anchor"][1]))
elephant=ROOT/"public/demos/wildlife-v2/elephant/pilot-v2"
em=json.loads((elephant/"sprite.json").read_text())
x,y,w,h=em["facings"]["right"]["frames"][0]["rect"]
reference.alpha_composite(Image.open(elephant/"sheet.png").convert("RGBA").crop((x,y,x+w,y+h)),(190,170-em["anchor"][1]))
reference.save(OUT/"scale-reference-native.png")
sequence=[("idle",0)]*3+[("walk",i%12) for i in range(24)]+[(name,i) for name,c in clips.items() if name not in ["idle","walk"] for i in range(c["count"])]+[("idle",0)]*3
native,scenes=[],[]
for name,i in sequence:
    im=Image.new("RGBA",(W*4,W),"#879b82")
    for row,facing in enumerate(facings): im.alpha_composite(frames[facing,name,i],(row*W,0))
    native.append(im)
    scenes.append(scenery(name,i))
durations=[max(20,round(clips[name]["frameDuration"])) for name,_ in sequence]
for images,path in [(native,OUT/"preview-native.gif"),([im.resize((W*12,W*3),Image.Resampling.NEAREST) for im in native],OUT/"preview.gif"),(scenes,OUT/"scene-native.gif")]:
    images[0].save(path,save_all=True,append_images=images[1:],duration=durations,loop=0,disposal=2,optimize=False)
assert set(sheet.getchannel("A").get_flattened_data())=={0,255}
assert all(b[0]>2 and b[1]>2 and b[2]<W-2 and b[3]<W-2 for b in allbounds), crop
report={"identity":f"{SPECIES}-fierce-v1","poses":len(frames),"binaryAlpha":True,"paletteColors":len(palette),"canvas":[W,W],"anchor":G["anchor"],
        "idleVisibleHeights":{f:frames[f,"idle",0].getbbox()[3]-frames[f,"idle",0].getbbox()[1] for f in facings},"sequenceDurationMs":sum(durations),"status":"Integrity only; independent visual observation and human review remain separate."}
(OUT/"validation.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8",newline="\n")
for filename in ["playback.js","index.html"]: shutil.copyfile(SCRIPT/filename,OUT/filename)
print(json.dumps(report))
