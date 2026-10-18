"""Assemble unretouched Blender renders; backgrounds/labels are review UI."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
if (Path(__file__).resolve().parent/'receipt.json').exists():
    raise RuntimeError('Registered study is immutable; use an isolated reproduction checkout or a new revision.')
OUT = ROOT/'public/demos/wildlife-v2/horse/motion-study-v1'
TMP = ROOT/'data/horse-motion-139/renders'
BG = '#e7e4db'
FONT = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
SMALL = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',14)
facings = ['down','up','left','right']
sheet = Image.new('RGBA',(2560,320))
for row,f in enumerate(facings):
    for i in range(32):
        sheet.paste(Image.open(TMP/f'{f}-{i:02}.png'),(i*80,row*80))
sheet.save(OUT/'sheet.png')

def gif(frames, path):
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=2,optimize=False)

preview = []
travel_native = []
for i in range(64):
    im = Image.new('RGB',(320,80),BG)
    travelling = Image.new('RGB',(512,160),BG)
    draw = ImageDraw.Draw(travelling)
    for row, f in enumerate(facings):
        tile = sheet.crop(((i%32)*80,row*80,(i%32+1)*80,(row+1)*80))
        im.paste(tile,(row*80,0),tile)
        x = row*128
        for xx in range(x+8,x+128,16):
            draw.line((xx,30,xx,150), fill='#ccc9be')
        for yy in range(30,151,16):
            draw.line((x+4,yy,x+124,yy), fill='#ccc9be')
        yaw = math.radians({'down':180,'up':0,'left':100,'right':260}[f])
        travel = 14.4*i/32
        dx = round(-math.sin(yaw)*travel)
        dy = round(-math.sin(math.radians(40))*math.cos(yaw)*travel)
        travelling.paste(tile,(x+24+dx,45+dy),tile)
        draw.text((x+8,8),f,fill='#353b3b',font=SMALL)
    if i<32:
        preview.append(im)
    travel_native.append(travelling)
gif(preview,OUT/'preview-native.gif')
gif([p.resize((960,240),Image.Resampling.NEAREST) for p in preview],OUT/'preview.gif')
gif(travel_native,OUT/'travel-native.gif')
travel_native[0].save(OUT/'scene-native.png')
contact = Image.new('RGBA',(640,320))
for row in range(4):
    for col,i in enumerate(range(0,32,4)):
        contact.paste(sheet.crop((i*80,row*80,(i+1)*80,(row+1)*80)),(col*80,row*80))
contact.save(OUT/'contact-sheet-native.png')

for name,count,width,height,scale,z in [('side',32,640,520,5.8,2.15),('travel',64,960,520,8,2.05)]:
    frames = []
    grid = Image.new('RGB',(width*8,(height+60)*math.ceil(count/8)),BG)
    ground = round(height/2+z*width/scale)
    for i in range(count):
        im = Image.new('RGB',(width,height+60),BG)
        d = ImageDraw.Draw(im)
        d.text((16,8),'HORSE MOTION STUDY  /  50% SPEED  /  '+('IN PLACE' if name=='side' else 'WORLD TRAVEL — TWO STRIDES, THEN RESET'),fill='#353b3b',font=FONT)
        # Camera is fixed. These stationary marks expose stance sliding.
        d.line((0,ground+44,width,ground+44),fill='#8a8f86',width=2)
        for x in range(0,width,round(.48*width/scale)):
            d.line((x,ground+44,x,ground+53),fill='#8a8f86',width=2)
        render = Image.open(TMP/f'{name}-{i:02}.png').convert('RGBA')
        im.paste(render,(0,44),render)
        supports = [n for n,o in [('LH',0),('LF',.25),('RH',.5),('RF',.75)] if (i/32-o)%1<.66]
        d.text((16,height+40),'Grounded: '+'  '.join(supports)+'     Blue = forelegs   ·   Terracotta = hindlegs',fill='#353b3b',font=SMALL)
        frames.append(im)
        grid.paste(im,((i%8)*width,(i//8)*(height+60)))
    gif(frames,OUT/f'{name}-slow.gif')
    grid.save(OUT/f'{name}-frames.webp',lossless=True,method=6)
    frames[0].save(OUT/f'{name}-poster.png')

metadata = dict(identity='horse-motion-study-v1',reviewStatus='pending',purpose='clay anatomy and motion study; not game art',image='sheet.png',frameWidth=80,frameHeight=80,anchor=[40,61],rootMotion=False,cameraContract=json.loads((ROOT/'art-source/wildlife-v2/camera.json').read_text()),facings={f:{'row':r} for r,f in enumerate(facings)},clips={'walk':{'start':0,'count':32,'frameDuration':50,'rootTravelPixelsPerCycle':14.4}})
(OUT/'sprite.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf8')
print('HORSE_MOTION_ASSEMBLY_OK')
