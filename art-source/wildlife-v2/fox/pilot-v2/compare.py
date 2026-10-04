"""Direct fresh pilot-v1/v2 review comparison; reads those exact sheets only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[4]
O=ROOT/'public/demos/wildlife-v2/fox/pilot-v2'
V1=O.parent/'pilot-v1'
sheet1=Image.open(V1/'sheet.png').convert('RGBA')
sheet2=Image.open(O/'sheet.png').convert('RGBA')
facings=['down','up','left','right']
im=Image.new('RGBA',(320,144),'#879b82')
d=ImageDraw.Draw(im)
for col,f in enumerate(facings):d.text((48+col*64,0),f,fill='white')
for row,(label,sheet) in enumerate([('v1',sheet1),('v2',sheet2)]):
    d.text((4,32+row*64),label,fill='white')
    for direction in range(4):
        im.alpha_composite(sheet.crop((0,direction*48,48,direction*48+48)),(40+direction*64,16+row*64))
im.save(O/'v1-v2-native.png')
im.resize((1920,864),Image.Resampling.NEAREST).save(O/'v1-v2-6x.png')
for direction,f in enumerate(facings):
    strip=Image.new('RGBA',(8*48+32,120),'#879b82')
    d=ImageDraw.Draw(strip)
    for row,(label,sheet) in enumerate([('v1',sheet1),('v2',sheet2)]):
        d.text((0,10+row*60),label,fill='white')
        for i in range(8):strip.alpha_composite(sheet.crop(((i+1)*48,direction*48,(i+2)*48,direction*48+48)),(32+i*48,row*60))
    strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(O/f'v1-v2-walk-{f}.png')
sequence=[('idle',0)]*4+[('walk',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(8)]+[('idle',0)]*4
frames=[]
for clip,index in sequence:
    col=0 if clip=='idle' else (1 if clip=='walk' else 9)+index
    frame=Image.new('RGB',im.size,'#879b82');dr=ImageDraw.Draw(frame)
    for row,(label,sheet) in enumerate([('v1',sheet1),('v2',sheet2)]):
        dr.text((4,32+row*64),label,fill='white')
        for n,f in enumerate(facings):
            if row==0:dr.text((48+n*64,0),f,fill='white')
            patch=sheet.crop((col*48,n*48,(col+1)*48,(n+1)*48))
            frame.paste(patch,(40+n*64,16+row*64),patch)
    frames.append(frame)
durations=[120 if i%2==0 else 130 for i in range(32)]
for scale,name in [(1,'v1-v2-native.gif'),(6,'v1-v2-6x.gif')]:
    imgs=[f.resize((f.width*scale,f.height*scale),Image.Resampling.NEAREST) for f in frames]
    imgs[0].save(O/name,save_all=True,append_images=imgs[1:],duration=durations,loop=0,disposal=2,optimize=False)
print('FRESH_V1_V2_COMPARISONS_OK')
