from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/harbor-seal/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';T=B/'harbor-seal-inspection';T.mkdir(exist_ok=True);sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(['down','up','left','right']):
 im=Image.new('RGBA',(5*160,5*136),'#879b82');d=ImageDraw.Draw(im)
 for i in range(23):
  crop=sheet.crop((i*96+10,row*96+13,i*96+86,row*96+73)).resize((152,120),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%5)*160,(i//5)*136));d.text(((i%5)*160,(i//5)*136+120),str(i),fill='white')
 im.save(T/f'{f}-all-poses.png')
if (B/'harbor-seal-browser/capture.json').exists():
 cap=json.loads((B/'harbor-seal-browser/capture.json').read_text())
 for scale in [1,4]:
  for row,f in enumerate(['down','up','left','right']):
   im=Image.new('RGBA',(6*160,8*136),'#879b82');d=ImageDraw.Draw(im)
   for i in range(44):
    sample=next(s for s in cap['samples'] if s['scale']==scale and s['sequenceIndex']==i);frame=Image.open(B/'harbor-seal-browser'/sample['filename']);crop=frame.crop((60+row*140,71,136+row*140,131)).resize((152,120),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%6)*160,(i//6)*136));d.text(((i%6)*160,(i//6)*136+120),f'{i}:{sample["clip"]}{sample["pose"]}',fill='white')
   im.save(T/f'{f}-{scale}x-playback.png')
print('HARBOR_SEAL_REVIEW_PANELS_OK')
