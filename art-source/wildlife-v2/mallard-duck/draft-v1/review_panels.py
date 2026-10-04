"""Chronological inspection panels from exact sheet and actual Chromium samples."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/mallard-duck/draft-v1';D=R/'data/wildlife-campaign-v2/background-01-worker/mallard-inspection';D.mkdir(exist_ok=True)
sheet=Image.open(O/'sheet.png').convert('RGBA');W=48
for row,f in enumerate(['down','up','left','right']):
 grid=Image.new('RGBA',(8*160,4*160),'#879b82');d=ImageDraw.Draw(grid)
 for col in range(31):
  im=sheet.crop((col*W,row*W,(col+1)*W,(row+1)*W)).crop((4,4,44,44));grid.alpha_composite(im.resize((160,160),Image.Resampling.NEAREST),((col%8)*160,(col//8)*160));d.text(((col%8)*160+4,(col//8)*160+4),f'{f} {col}',fill='white')
 grid.save(D/f'all-{f}-4x.png')
cap=R/'data/wildlife-campaign-v2/background-01-worker/mallard-browser'
if (cap/'capture.json').exists():
 report=json.loads((cap/'capture.json').read_text())
 for scale in [1,4]:
  ss=[s for s in report['samples'] if s['scale']==scale];chosen=[];last=None
  for s in ss:
   k=(s['clip'],s['pose'],s['sequenceIndex'])
   if k!=last:chosen.append(s);last=k
  for chunk in range((len(chosen)+7)//8):
   group=chosen[chunk*8:chunk*8+8];grid=Image.new('RGB',(1280,8*228),'#879b82');d=ImageDraw.Draw(grid)
   for n,s in enumerate(group):
    im=Image.open(cap/s['filename']).convert('RGB').crop((0,20,320,115)).resize((1280,380),Image.Resampling.NEAREST)
    # Keep enough framing for both Explorer and all four native duck facings.
    im=Image.open(cap/s['filename']).convert('RGB').crop((0,65,320,115)).resize((1280,200),Image.Resampling.NEAREST)
    grid.paste(im,(0,n*228+24));d.text((4,n*228+3),f'CSS{scale}x actual {s["time"]-ss[0]["time"]:.0f}ms {s["clip"]} {s["pose"]} seq{s["sequenceIndex"]}',fill='white')
   grid.crop((0,0,1280,len(group)*228)).save(D/f'playback-{scale}x-{chunk:02}.png')
 print('MALLARD_PLAYBACK_PANELS_OK',len(report['samples']))
