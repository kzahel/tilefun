"""Every robin pose and chronological panels from actual Chromium canvas frames."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/robin/draft-v2';D=R/'data/wildlife-campaign-v2/background-01-worker/robin-inspection-draft-v2';D.mkdir(exist_ok=True);W=32;sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(['down','up','left','right']):
 im=Image.new('RGBA',(6*192,4*192),'#899780');d=ImageDraw.Draw(im)
 for col in range(23):
  frame=sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)).crop((4,4,28,28)).resize((192,192),Image.Resampling.NEAREST);im.alpha_composite(frame,((col%6)*192,(col//6)*192));d.text(((col%6)*192+3,(col//6)*192+3),f'{f} {col}',fill='white')
 im.save(D/f'all-{f}-8x.png')
cap=R/'data/wildlife-campaign-v2/background-01-worker/robin-browser-draft-v2'
if (cap/'capture.json').exists():
 report=json.loads((cap/'capture.json').read_text())
 for scale in [1,4]:
  ss=[s for s in report['samples'] if s['scale']==scale];chosen=[];last=None
  for s in ss:
   k=(s['clip'],s['pose'],s['sequenceIndex'])
   if k!=last:chosen.append(s);last=k
  first=[]
  for s in chosen:
   if first and s['sequenceIndex']<first[-1]['sequenceIndex']:break
   first.append(s)
  for row,f in enumerate(['down','up','left','right']):
   grid=Image.new('RGB',(8*160,math.ceil(len(first)/8)*160),'#899780');d=ImageDraw.Draw(grid)
   for n,s in enumerate(first):
    x=42+row*65;a=Image.open(cap/s['filename']).convert('RGB').crop((x+4,74,x+28,98)).resize((144,144),Image.Resampling.NEAREST);grid.paste(a,((n%8)*160,(n//8)*160+16));d.text(((n%8)*160+2,(n//8)*160+1),f'{s["sequenceIndex"]} {s["clip"]}{s["pose"]}',fill='white')
   grid.save(D/f'actual-{scale}x-{f}-first-cycle.png')
  for chunk in range((len(chosen)+7)//8):
   group=chosen[chunk*8:chunk*8+8];im=Image.new('RGB',(1280,len(group)*184),'#899780');d=ImageDraw.Draw(im)
   for n,s in enumerate(group):
    a=Image.open(cap/s['filename']).convert('RGB').crop((0,65,320,105)).resize((1280,160),Image.Resampling.NEAREST);im.paste(a,(0,n*184+24));d.text((3,n*184+3),f'CSS{scale}x actual {s["time"]-ss[0]["time"]:.0f}ms {s["clip"]} {s["pose"]} seq{s["sequenceIndex"]}',fill='white')
   im.save(D/f'playback-{scale}x-{chunk:02}.png')
 print('ROBIN_PLAYBACK_PANELS_OK',len(report['samples']))
