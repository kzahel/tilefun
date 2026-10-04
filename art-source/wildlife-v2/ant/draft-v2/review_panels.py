from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/ant/draft-v2';D=R/'data/wildlife-campaign-v2/background-01-worker/ant-inspection-draft-v2';D.mkdir(exist_ok=True);W=32;F=['down','up','left','right'];sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(F):
 out=Image.new('RGB',(5*192,3*208),(135,157,135));d=ImageDraw.Draw(out)
 for col in range(15):
  im=Image.new('RGBA',(W,W),(135,157,135,255));im.alpha_composite(sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)));out.paste(im.resize((192,192),Image.Resampling.NEAREST),(col%5*192,col//5*208+16));d.text((col%5*192,col//5*208),f'{f}{col}',fill='white')
 out.save(D/f'all-{f}-6x.png')
cap=R/'data/wildlife-campaign-v2/background-01-worker/ant-browser-draft-v2'
if(cap/'capture.json').exists():
 C=json.loads((cap/'capture.json').read_text())
 for scale in [1,4]:
  first={}
  for s in C['samples']:
   if s['scale']==scale and s['sequenceIndex'] not in first:first[s['sequenceIndex']]=s
  assert set(range(28))<=set(first)
  for row,f in enumerate(F):
   out=Image.new('RGB',(8*192,4*208),(135,157,135));d=ImageDraw.Draw(out)
   for i in range(28):
    s=first[i];im=Image.open(cap/s['filename']);out.paste(im.crop((42+row*65,83,74+row*65,115)).resize((192,192),Image.Resampling.NEAREST),(i%8*192,i//8*208+16));d.text((i%8*192,i//8*208),f'{i} {s["clip"]}{s["pose"]}',fill='white')
   out.save(D/f'actual-{scale}x-{f}-first-cycle.png')
 print('ANT_PLAYBACK_PANELS_OK',len(C['samples']))
