from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/manta-ray/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';T=B/'manta-ray-inspection';T.mkdir(exist_ok=True);sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(['down','up','left','right']):
 im=Image.new('RGBA',(5*184,5*174),'#879b82');d=ImageDraw.Draw(im)
 for i in range(21):
  crop=sheet.crop((i*144+28,row*144+24,i*144+116,row*144+104)).resize((176,160),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%5)*184,(i//5)*174));d.text(((i%5)*184,(i//5)*174+160),str(i),fill='white')
 im.save(T/f'{f}-all-poses.png')
if (B/'manta-ray-browser/capture.json').exists():
 cap=json.loads((B/'manta-ray-browser/capture.json').read_text())
 for scale in [1,4]:
  for row,f in enumerate(['down','up','left','right']):
   im=Image.new('RGBA',(6*184,7*174),'#879b82');d=ImageDraw.Draw(im)
   for i in range(38):
    sample=next(s for s in cap['samples'] if s['scale']==scale and s['sequenceIndex']==i);frame=Image.open(B/'manta-ray-browser'/sample['filename']);crop=frame.crop((86+row*180,86,174+row*180,166)).resize((176,160),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%6)*184,(i//6)*174));d.text(((i%6)*184,(i//6)*174+160),f'{i}:{sample["clip"]}{sample["pose"]}',fill='white')
   im.save(T/f'{f}-{scale}x-playback.png')
print('MANTA_RAY_REVIEW_PANELS_OK')
