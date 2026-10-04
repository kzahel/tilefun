"""Integer enlarged crops for visual inspection; no production output edits."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/giraffe/draft-v1';D=R/'data/wildlife-campaign-v2/background-01-worker/giraffe-inspection';D.mkdir(exist_ok=True)
sheet=Image.open(O/'sheet.png').convert('RGBA');W=144
for row,f in enumerate(['down','up','left','right']):
 grid=Image.new('RGBA',(5*240,5*330),'#879b82');d=ImageDraw.Draw(grid)
 for col in range(25):
  im=sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)).crop((32,30,112,140))
  grid.alpha_composite(im.resize((240,330),Image.Resampling.NEAREST),((col%5)*240,(col//5)*330))
  d.text(((col%5)*240+4,(col//5)*330+4),f'{f} '+('idle' if col==0 else f'walk {col-1}' if col<17 else f'action {col-17}'),fill='white')
 grid.save(D/f'all-{f}-3x.png')
cap=R/'data/wildlife-campaign-v2/background-01-worker/giraffe-browser'
if (cap/'capture.json').exists():
 report=json.loads((cap/'capture.json').read_text())
 # Actual chronological samples: first occurrence of every sequence position in
 # each of two complete sequences at each displayed scale.
 for scale in [1,4]:
  ss=[s for s in report['samples'] if s['scale']==scale];start=ss[0]['time'];chosen=[];last=None
  for s in ss:
   key=(s['clip'],s['pose'],s['sequenceIndex'])
   if key!=last:chosen.append(s);last=key
  for chunk in range((len(chosen)+11)//12):
   group=chosen[chunk*12:chunk*12+12];grid=Image.new('RGB',(1280,3*320),'#879b82');d=ImageDraw.Draw(grid)
   for n,s in enumerate(group):
    im=Image.open(cap/s['filename']).convert('RGB')
    # All four facings plus nearby Explorer, same fixed native scene crop.
    # Canvas readback is native in both CSS scales; never crop it as 4x pixels.
    im=im.crop((0,65,640,179)).resize((1280,228),Image.Resampling.NEAREST)
    # Native captured data preserved separately; these panels only arrange it.
    y=(n%3)*320;grid.paste(im,(0,y+24));d.text((4,y+4),f'{scale}x actual {s["time"]-start:.0f}ms {s["clip"]} {s["pose"]} sequence {s["sequenceIndex"]}',fill='white')
    if n%3==2:
     grid.save(D/f'playback-{scale}x-{chunk:02}-{n//3}.png');grid=Image.new('RGB',(1280,3*320),'#879b82');d=ImageDraw.Draw(grid)
   if len(group)%3:grid.save(D/f'playback-{scale}x-{chunk:02}-last.png')
 print('BROWSER_REVIEW_PANELS_OK',len(report['samples']))
