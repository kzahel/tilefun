from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/cat/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';T=B/'cat-inspection';T.mkdir(exist_ok=True);sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(['down','up','left','right']):
 im=Image.new('RGBA',(5*156,5*156),'#879b82');d=ImageDraw.Draw(im)
 for i in range(21):
  crop=sheet.crop((i*48+6,row*48+3,i*48+42,row*48+39)).resize((144,144),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%5)*156,(i//5)*156));d.text(((i%5)*156,(i//5)*156+144),str(i),fill='white')
 im.save(T/f'{f}-all-poses.png')
cap=json.loads((B/'cat-browser/capture.json').read_text())
for scale in [1,4]:
 for row,f in enumerate(['down','up','left','right']):
  im=Image.new('RGBA',(6*156,7*156),'#879b82');d=ImageDraw.Draw(im)
  for i in range(38):
   sample=next(s for s in cap['samples'] if s['scale']==scale and s['sequenceIndex']==i);fr=Image.open(B/'cat-browser'/sample['filename']);crop=fr.crop((74+row*150,91,110+row*150,127)).resize((144,144),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%6)*156,(i//6)*156));d.text(((i%6)*156,(i//6)*156+144),f'{i}:{sample["clip"]}{sample["pose"]}',fill='white')
  im.save(T/f'{f}-{scale}x-playback.png')
for name in ['preview-native.gif','preview.gif','preview-walk-travel-native.gif']:
 fs=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(Image.open(O/name))]
 if 'travel' in name:
  for half in [0,1]:
   im=Image.new('RGBA',(1200,6*78),'#879b82');d=ImageDraw.Draw(im)
   for i in range(12):im.alpha_composite(fs[half*12+i].crop((0,76,600,140)),((i%2)*600,(i//2)*78));d.text(((i%2)*600,(i//2)*78+64),f'cycle{half+1} pose{i}',fill='white')
   im.save(T/(name+f'-cycle{half+1}.png'))
 else:
  im=Image.new('RGBA',(1152,((len(fs)+2)//3)*108),'#879b82');d=ImageDraw.Draw(im)
  for i,fr in enumerate(fs):
   if name=='preview.gif':fr=fr.resize((192,48),Image.Resampling.NEAREST)
   fr=fr.resize((384,96),Image.Resampling.NEAREST);im.alpha_composite(fr,((i%3)*384,(i//3)*108));d.text(((i%3)*384,(i//3)*108+96),f'decoded{i}',fill='white')
  im.save(T/(name+'.png'))
print('CAT_REVIEW_PANELS_OK')
