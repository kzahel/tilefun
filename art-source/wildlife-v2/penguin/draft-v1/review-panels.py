from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/penguin/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';T=B/'penguin-inspection';T.mkdir(exist_ok=True);sheet=Image.open(O/'sheet.png').convert('RGBA');facings=['down','up','left','right']
for row,f in enumerate(facings):
 im=Image.new('RGBA',(5*186,5*139),'#879b82');d=ImageDraw.Draw(im)
 for i in range(25):
  crop=sheet.crop((i*64+2,row*64+10,i*64+62,row*64+50)).resize((180,120),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%5)*186,(i//5)*139));d.text(((i%5)*186,(i//5)*139+121),str(i),fill='white')
 im.save(T/f'{f}-all-poses.png')
if (B/'penguin-browser/capture.json').exists():
 cap=json.loads((B/'penguin-browser/capture.json').read_text())
 for scale in [1,4]:
  for row,f in enumerate(facings):
   im=Image.new('RGBA',(6*186,8*139),'#879b82');d=ImageDraw.Draw(im)
   for i in range(46):
    sample=next(s for s in cap['samples'] if s['scale']==scale and s['sequenceIndex']==i);frame=Image.open(B/'penguin-browser'/sample['filename']);crop=frame.crop((50+row*120,75,110+row*120,115)).resize((180,120),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%6)*186,(i//6)*139));d.text(((i%6)*186,(i//6)*139+121),f'{i}:{sample["clip"]}{sample["pose"]}',fill='white')
   im.save(T/f'{f}-{scale}x-playback.png')
print('PENGUIN_REVIEW_PANELS_OK')
