from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/manta-ray/draft-v1';G=json.loads((S/'projected-guides.json').read_text());W=144
palette={'o':'#18343a','d':'#2b4d53','g':'#42626a','l':'#78928c','w':'#d9dfcb','c':'#abbcac','e':'#0c222a'};P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()};P['.']=(0,0,0,0);inv={v:k for k,v in P.items()}
heads={
 'down':{'offset':[-5,-2],'pixels':['..ooooooo..','.odddddddo.','edgggggggde','.odwwwwwdo.','..ooooooo..']},
 'up':{'offset':[-5,-3],'pixels':['..ooooooo..','.odddddddo.','odgggggggdo','odddddddddo','.odddddddo.','..ooooooo..']},
 'left':{'offset':[-3,-3],'pixels':['..oooo..','.oddgdo.','odggggdo','oddddddo','oddedddo','wddddddo','.odddddo','..oooo..']},
 'right':{'offset':[-4,-3],'pixels':[]}}
heads['right']['pixels']=[r[::-1] for r in heads['left']['pixels']]
def xy(p):return math.floor(p[0]+.5),math.floor(p[1]+.5)
tiles={}
for f,h in heads.items():
 assert len({len(r) for r in h['pixels']})==1;im=Image.new('RGBA',(len(h['pixels'][0]),len(h['pixels'])));im.putdata([P[c] for r in h['pixels'] for c in r]);tiles[f]=im
frames=[]
for r in G['records']:
 f=r['facing'];im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im);vol=r['volumes']
 # Small whip tail follows actual chain contacts; one integer line bridges rounded joint samples.
 d.line([xy(p) for p in r['tail']],fill=P['d'],width=1)
 for s in ['-1','1']:
  wingmask=Image.new('L',(W,W));wingdraw=ImageDraw.Draw(wingmask)
  for j in [1,0]:
   n=f'pectoral-{s}-{j}';v=vol[n];h=[xy(p) for p in v['hull']];wingdraw.polygon(h,fill=255);top=v['dorsalFacesCamera'];d.polygon(h,fill=P['d'] if top else P['w'])
   # Broad fixed-surface palette bands, clipped to actual panel; no ellipsoid color quantization.
   if top:
    mask=Image.new('L',(W,W));md=ImageDraw.Draw(mask);md.polygon(h,fill=255);paint=Image.new('RGBA',(W,W));pd=ImageDraw.Draw(paint);b=v['bbox'];x0,y0,x1,y1=map(lambda a:math.floor(a+.5),b);pd.polygon(h,fill=P['d']);pd.rectangle((x0,y0,x1,y0+1),fill=P['g']);paint.putalpha(mask);im.alpha_composite(paint);d=ImageDraw.Draw(im)
  d.line([xy(p) for p in r['wings'][s]],fill=P['d'],width=1)
  for y in range(1,W-1):
   for x in range(1,W-1):
    if wingmask.getpixel((x,y)) and any(not wingmask.getpixel((x+dx,y+dy)) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):d.point((x,y),fill=P['o'])
 # Independent fixed central volume and two characteristic white triangular shoulder markings.
 for n in ['central-disc','broad-terminal-head']:
  h=[xy(p) for p in vol[n]['hull']];d.polygon(h,fill=P['d']);d.line(h+[h[0]],fill=P['o'])
 bx,by=xy(r['body']);d.line([(bx,by-6),(bx,by+4)],fill=P['g'],width=2)
 for s in [-1,1]:
  h=[xy(p) for p in vol['shoulder-white-'+str(s)]['hull']];d.polygon(h,fill=P['w'])
 d.polygon([xy(p) for p in vol['small-dorsal-fin']['hull']],fill=P['g'])
 # Front lobes are actual articulated chains, never scaled horns. Rear still hides facial eyes/mouth.
 for s in ['-1','1']:
  for j in range(3):d.polygon([xy(p) for p in vol[f'cephalic-{s}-{j}']['hull']],fill=P['g'])
  d.line([xy(p) for p in r['cephalic'][s]],fill=P['g'],width=1)
 hp=heads[f];hx,hy=xy(r['head']);im.alpha_composite(tiles[f],(hx+hp['offset'][0],hy+hp['offset'][1]))
 assert min(im.getbbox()[:2])>=3 and max(im.getbbox()[2:])<=141
 frames.append({'facing':f,'clip':r['clip'],'index':r['index'],'pixels':[''.join(inv[im.getpixel((x,y))] for x in range(W)) for y in range(W)]})
M={'identity':'manta-ray-draft-v1-drawing-02','canvas':[W,W],'palette':palette,'heads':heads,'frames':frames,'stylization':['Broad authored blue-black dorsal masses, two white giant-manta shoulder triangles, restrained slate highlights and pale ventral rim.','Stable full broad terminal-head/eye/mouth templates; rear hides face. Continuous painted wing surfaces follow independently articulated panel guides, with actual fixed-length cephalic/tail chains.','Integer edge simplification and one-pixel tail/lobe joints; no geometry scaling or sprite resampling.']}
for path in [S,O]:(path/'masters.json').write_text(json.dumps(M,indent=1)+'\n',encoding='utf-8')
print('MANTA_RAY_MASTERS_OK',len(frames))
