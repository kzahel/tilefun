"""All drawn poses plus real chronological full Chromium samples, every facing."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/fish/draft-v2';D=R/'data/wildlife-campaign-v2/background-01-worker/fish-inspection-draft-v2';D.mkdir(exist_ok=True);W=48;F=['down','up','left','right'];sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(F):
 im=Image.new('RGBA',(5*192,3*192),'#879b82');d=ImageDraw.Draw(im)
 for col in range(15):
  a=sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)).crop((8,14,40,46)).resize((192,192),Image.Resampling.NEAREST);im.alpha_composite(a,((col%5)*192,(col//5)*192));d.text(((col%5)*192+3,(col//5)*192+3),f'{f} {col}',fill='white')
 im.save(D/f'all-{f}-6x.png')
cap=R/'data/wildlife-campaign-v2/background-01-worker/fish-browser-draft-v2'
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
  for row,f in enumerate(F):
   im=Image.new('RGB',(8*192,math.ceil(len(first)/8)*208),'#879b82');d=ImageDraw.Draw(im)
   for n,s in enumerate(first):
    x=34+row*65;a=Image.open(cap/s['filename']).convert('RGB').crop((x+8,88,x+40,120)).resize((192,192),Image.Resampling.NEAREST);im.paste(a,((n%8)*192,(n//8)*208+16));d.text(((n%8)*192+3,(n//8)*208+1),f'{s["sequenceIndex"]} {s["clip"]}{s["pose"]}',fill='white')
   im.save(D/f'actual-{scale}x-{f}-first-cycle.png')
 print('FISH_PLAYBACK_PANELS_OK',len(report['samples']))
