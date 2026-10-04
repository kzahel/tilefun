"""Deliberate palette-letter masters, broad spotted coat and stable earless head; guided integer limbs."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/harbor-seal/draft-v1';G=json.loads((S/'projected-guides.json').read_text());W=96
palette={'o':'#293d3d','d':'#50635e','g':'#87958a','l':'#afb8a6','c':'#d7d2b9','w':'#efe3c8','e':'#142c2d','s':'#667972'}
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()};inverse={v:k for k,v in P.items()};inverse[0,0,0,0]='.'
heads={
 'down':{'offset':[-4,-3],'pixels':['..ooooo..','.oglllgo.','oglllllgo','oglelelgo','ogcceccgo','.cwwewwc.','..coooc..','...odd...']},
 'up':{'offset':[-4,-3],'pixels':['..oooo..','.ogllgo.','ogllllgo','oglgdggo','ogggdggo','.ogddgo.','..oddo..']},
 'left':{'offset':[-4,-3],'pixels':['..oooo...','.ogllgo..','ogelllgo.','ccllllgg.','ecclllgg.','.cocdggo.','..oddgo..','...ooo...']},
 'right':{'offset':[-4,-3],'pixels':[]}}
# Explicit mirrored profile lettering, no sprite resampling. Light convention is deliberate.
heads['right']['pixels']=[row[::-1] for row in heads['left']['pixels']]
for f,p in heads.items():assert len({len(row) for row in p['pixels']})==1,(f,p['pixels'])
def snap(v):return math.floor(v+.5)
def xy(p):return snap(p[0]),snap(p[1])
def tile(p):
 im=Image.new('RGBA',(len(p['pixels'][0]),len(p['pixels'])));im.putdata([P[c] if c!='.' else (0,0,0,0) for row in p['pixels'] for c in row]);return im
T={f:tile(p) for f,p in heads.items()};frames=[]
for r in G['records']:
 f=r['facing'];im=Image.new('RGBA',(W,W));d=ImageDraw.Draw(im);vol=r['volumes'];body=vol['continuous-tapered-body'];bb=body['bbox'];bodymask=Image.new('L',(W,W));md=ImageDraw.Draw(bodymask);md.polygon([xy(p) for p in body['hull']],fill=255)
 def paddle(n):
  h=[xy(p) for p in vol[n]['hull']];d.polygon(h,fill=P['d']);d.line(h+[h[0]],fill=P['o'],width=1)
  b=vol[n]['bbox'];cx,cy=xy([(b[0]+b[2])/2,(b[1]+b[3])/2]);d.line([(cx-1,cy),(cx+1,cy)],fill=P['s'])
 # Rear webs under body; actual depth selects far/near foreflipper.
 for n in ['hindflipper--1','hindflipper-1','short-tail']:
  if n in vol:paddle(n)
 near='foreflipper--1' if f=='left' else 'foreflipper-1' if f=='right' else None
 for n in ['foreflipper--1','foreflipper-1']:
  if n!=near:paddle(n.replace('foreflipper','foreupper'));paddle(n)
 coat=Image.new('RGBA',(W,W));cd=ImageDraw.Draw(coat);cd.rectangle((0,0,W,W),fill=P['g']);x0,y0,x1,y1=map(snap,bb)
 # Restrained broad painted dorsal light and underside, clipped by independently projected skin.
 cd.rectangle((x0,y0,x1,y0+2),fill=P['l']);cd.rectangle((x0,y1-2,x1,y1),fill=P['d'])
 if f in ['left','right']:cd.rectangle((x0+2,y1-3,x1-2,y1-2),fill=P['c'])
 elif f=='down':cd.rectangle((x0+3,(y0+y1)//2,x1-3,y1-1),fill=P['l'])
 coat.putalpha(bodymask);im.alpha_composite(coat);d=ImageDraw.Draw(im);h=[xy(p) for p in body['hull']];d.line(h+[h[0]],fill=P['o'])
 for name,p in r['landmarks'].items():
  x,y=xy(p)
  if 0<=x<W and 0<=y<W and bodymask.getpixel((x,y)) and y<y1-2:
   d.point((x,y),fill=P['d']);
   if name.endswith('0') and bodymask.getpixel((min(W-1,x+1),y)):d.point((x+1,y),fill=P['d'])
 if near:paddle(near.replace('foreflipper','foreupper'));paddle(near)
 d.polygon([xy(p) for p in vol['short-thick-neck']['hull']],fill=P['g'])
 d.line([xy(r['spine'][-1]),xy(r['head'])],fill=P['g'],width=4) # Four-pixel bridge follows actual .44-.48 unit neck diameter.
 # Guide-projected rigid whiskers behind the finished face, rear hidden rather than front face reuse.
 if f!='up':
  for name,ps in r['whiskers'].items():
   if f=='left' and name.startswith('1-') or f=='right' and name.startswith('-1-'):continue
   d.line([xy(p) for p in ps],fill=P['c'])
 hp=heads[f];hx,hy=xy(r['head']);im.alpha_composite(T[f],(hx+hp['offset'][0],hy+hp['offset'][1]))
 # Fixed source head, no action shrinking/pitch. Whisker roots remain under muzzle master.
 assert im.getbbox() and min(im.getbbox()[:2])>=3 and max(im.getbbox()[2:])<=93
 rows=[''.join(inverse[im.getpixel((x,y))] for x in range(W)) for y in range(W)]
 frames.append({'facing':f,'clip':r['clip'],'index':r['index'],'pixels':rows})
M={'identity':'harbor-seal-draft-v1-drawing-02','canvas':[W,W],'palette':palette,'heads':heads,'frames':frames,'stylization':['Rounded earless stable head with two pale muzzle lobes, nostril, quiet black eyes, actual projected whisker fan.','Continuous guide-derived tapered coat, broad dorsal/ventral palette masses and actual skin-vertex spots; hull outline intentionally integer simplified.','Independent near/far short forepaddles and paired trailing webbed hindflippers, no sea-lion walking feet.']}
for directory in [S,O]:(directory/'masters.json').write_text(json.dumps(M,indent=1)+'\n',encoding='utf-8')
print('HARBOR_SEAL_MASTERS_OK',len(frames))
