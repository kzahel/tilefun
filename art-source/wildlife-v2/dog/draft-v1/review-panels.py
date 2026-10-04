from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/dog/draft-v1';B=R/'data/wildlife-campaign-v2/background-01-worker';T=B/'dog-inspection';T.mkdir(exist_ok=True);sheet=Image.open(O/'sheet.png').convert('RGBA')
for row,f in enumerate(['down','up','left','right']):
 im=Image.new('RGBA',(5*164,5*164),'#879b82');d=ImageDraw.Draw(im)
 for i in range(25):
  crop=sheet.crop((i*64+9,row*64+6,i*64+59,row*64+56)).resize((150,150),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%5)*164,(i//5)*164));d.text(((i%5)*164,(i//5)*164+150),str(i),fill='white')
 im.save(T/f'{f}-all-poses.png')
cap=json.loads((B/'dog-browser/capture.json').read_text())
for scale in [1,4]:
 for row,f in enumerate(['down','up','left','right']):
  im=Image.new('RGBA',(6*164,8*164),'#879b82');d=ImageDraw.Draw(im)
  for i in range(46):
   sample=next(s for s in cap['samples'] if s['scale']==scale and s['sequenceIndex']==i);fr=Image.open(B/'dog-browser'/sample['filename']);crop=fr.crop((83+row*170,94,133+row*170,144)).resize((150,150),Image.Resampling.NEAREST);im.alpha_composite(crop,((i%6)*164,(i//6)*164));d.text(((i%6)*164,(i//6)*164+150),f'{i}:{sample["clip"]}{sample["pose"]}',fill='white')
  im.save(T/f'{f}-{scale}x-playback.png')
for name in ['preview-native.gif','preview.gif','preview-walk-travel-native.gif']:
 fs=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(Image.open(O/name))]
 if 'travel' in name:
  for half in [0,1]:
   im=Image.new('RGBA',(1360,8*92),'#879b82');d=ImageDraw.Draw(im)
   for i in range(16):im.alpha_composite(fs[half*16+i].crop((0,78,680,156)),((i%2)*680,(i//2)*92));d.text(((i%2)*680,(i//2)*92+78),f'cycle{half+1} pose{i}',fill='white')
   im.save(T/(name+f'-cycle{half+1}.png'))
 else:
  im=Image.new('RGBA',(1536,((len(fs)+2)//3)*140),'#879b82');d=ImageDraw.Draw(im)
  for i,fr in enumerate(fs):
   if name=='preview.gif':fr=fr.resize((256,64),Image.Resampling.NEAREST)
   fr=fr.resize((512,128),Image.Resampling.NEAREST);im.alpha_composite(fr,((i%3)*512,(i//3)*140));d.text(((i%3)*512,(i//3)*140+128),f'decoded{i}',fill='white')
  im.save(T/(name+'.png'))
print('DOG_REVIEW_PANELS_OK')
