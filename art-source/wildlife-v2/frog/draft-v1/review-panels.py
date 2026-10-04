from pathlib import Path
import json
from PIL import Image,ImageDraw
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/frog/draft-v1';D=R/'data/wildlife-campaign-v2/background-01-worker/frog-inspection';D.mkdir(exist_ok=True)
sheet=Image.open(O/'sheet.png').convert('RGBA');W=48;F=['down','up','left','right']
for row,f in enumerate(F):
 im=Image.new('RGBA',(700,640),'#879b82');d=ImageDraw.Draw(im)
 for j in range(23):
  p=sheet.crop((j*W+7,row*W+14,j*W+42,row*W+42)).resize((140,112),Image.Resampling.NEAREST)
  x=(j%5)*140;y=(j//5)*128;im.alpha_composite(p,(x,y+16));d.text((x+2,y),f'{f} {j}',fill='white')
 im.save(D/f'all-{f}-4x.png')
C=json.loads((R/'data/wildlife-campaign-v2/background-01-worker/frog-browser/capture.json').read_text());B=R/'data/wildlife-campaign-v2/background-01-worker/frog-browser'
for scale in [1,4]:
 samples=[s for s in C['samples'] if s['scale']==scale]
 for row,f in enumerate(F):
  im=Image.new('RGBA',(1120,768),'#879b82');d=ImageDraw.Draw(im)
  for j in range(44):
   s=next(s for s in samples if s['sequenceIndex']==j);p=Image.open(B/s['filename']).convert('RGBA').crop((49+row*88,92,84+row*88,120)).resize((140,112),Image.Resampling.NEAREST)
   x=(j%8)*140;y=(j//8)*128;im.alpha_composite(p,(x,y+16));d.text((x+2,y),f'{j} {s["clip"]}{s["pose"]}',fill='white')
  im.save(D/f'actual-{f}-{scale}x.png')
print('FROG_REVIEW_PANELS_OK')
