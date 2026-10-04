from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;G=json.loads((S/'projected-guides.json').read_text());P={'k':'#19232b','s':'#7f5939','b':'#af7c49','l':'#d3a267','w':'#f0eddb','g':'#c5c2ae','e':'#241c16'};keys=list(P);frames=[]
heads={'down':['...bbb...','.bbblbbb.','bbblwlbbb','bbblwlbbb','bbblwlbbb','bbewwwebb','.bbwwwbb.','..wwwww..','...kkk...','...www...'],'up':['..bbbbb..','.bbblbbb.','bbblllbbb','bbblblbbb','bbbsssbbb','.bbsssbb.','..bbbbb..'],'left':['.....bbb...','....blblbb.','...bbblwbbb','...bblwbbbb','..wwewbbbbb','kwwwwwbbbbb','.wwwwbbbbb.','..wwbbbb...']};heads['right']=[r[::-1] for r in heads['left']];offsets={'down':[-4,-4],'up':[-4,-3],'left':[-6,-3],'right':[-4,-3]}
def rnd(points):return [(math.floor(x+.5),math.floor(y+.5)) for x,y in points]
for r in G['records']:
 im=Image.new('L',(64,64));d=ImageDraw.Draw(im);bodymask=Image.new('1',(64,64));bd=ImageDraw.Draw(bodymask)
 for n,v in sorted(r['volumes'].items(),key=lambda q:-sum(q[1]['depthRange'])/2):
  if n in ['skull','muzzle','nose','blaze'] or n.startswith('eye'):continue
  pts=rnd(v['hull']);color='w' if ('paw' in n or n=='white-chest' or n in ['tail-4','tail-5']) else 'k' if n=='black-saddle' else 's' if n.startswith('pendent-ear') else 'b';idx=keys.index(color)+1
  if len(set(pts))>=3:d.polygon(pts,fill=idx)
  elif len(set(pts))>=2:d.line(pts,fill=idx,width=1)
  elif pts:d.point(pts[0],fill=idx)
  if n in ['torso','shoulder','pelvis','neck']:bd.polygon(pts,fill=1)
 bp=bodymask.load();box=bodymask.getbbox()
 for y in range(box[1],box[3]):
  for x in range(box[0],box[2]):
   if bp[x,y] and im.getpixel((x,y))==keys.index('b')+1:im.putpixel((x,y),keys.index('l' if y<box[1]+2 else 'b')+1)
 # Actual tail centerline joins subpixel mesh sections; white tip is never an independent translated still.
 d.line(rnd([p[:2] for p in r['tail']]),fill=keys.index('b')+1,width=1);d.line(rnd([p[:2] for p in r['tail'][-3:]]),fill=keys.index('w')+1,width=1)
 old=im.copy();px=old.load()
 for y in range(1,63):
  for x in range(1,63):
   if px[x,y] and any(not px[x+dx,y+dy] for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):im.putpixel((x,y),keys.index('s' if px[x,y]==keys.index('b')+1 else 'k')+1)
 d.line(rnd([p[:2] for p in r['tail'][-3:]]),fill=keys.index('w')+1,width=1)
 depths={n:sum(r['volumes'][n+'-paw']['depthRange'])/2 for n in ['HL','FL','HR','FR']};median=sorted(depths.values())[2]
 for n,depth in depths.items():
  v=r['volumes'][n+'-paw'];x=round((v['bbox'][0]+v['bbox'][2])/2);y=round((v['bbox'][1]+v['bbox'][3])/2)
  for xx in [x-1,x]:
   if im.getpixel((xx,y))!=0 and not bodymask.getpixel((xx,y)):im.putpixel((xx,y),keys.index('w' if depth<=median else 'g')+1)
 hx,hy=[math.floor(v+.5) for v in r['head'][:2]];dx,dy=offsets[r['facing']]
 for yy,line in enumerate(heads[r['facing']]):
  for xx,ch in enumerate(line):
   if ch!='.':im.putpixel((hx+dx+xx,hy+dy+yy),keys.index(ch)+1)
 # The nearer pendent ear overlaps the cheek, while the far ear stays behind the skull.
 earNames=['pendent-ear--1','pendent-ear-1'];earNames=earNames if r['facing'] in ['down','up'] else [min(earNames,key=lambda n:sum(r['volumes'][n]['depthRange']))]
 for n in earNames:
  pts=rnd(r['volumes'][n]['hull']);d.polygon(pts,fill=keys.index('s')+1);d.line(pts+[pts[0]],fill=keys.index('s')+1,width=1)
 pixels=list(im.get_flattened_data());rows=[''.join('.' if c==0 else keys[c-1] for c in pixels[y*64:(y+1)*64]) for y in range(64)];frames.append({'facing':r['facing'],'clip':r['clip'],'index':r['index'],'pixels':rows})
M={'identity':'dog-draft-v1-pixels-02','palette':P,'canvas':[64,64],'anchor':[32,44],'headTemplates':heads,'headOffsets':offsets,'stylization':['Species-specific full fixed head/blaze/muzzle masters; nearer rigid pendent ear naturally occludes part of the cheek, far ear behind.','Projected tan chest/legs with stable black saddle, cream chest/paws and connected white tail tip.','Outer contour and broad upper highlight; no generic ellipsoid-render quantization or per-frame scaling.','Near/far paw highlights are clipped outside torso and behind complete skull, at independently projected ground depths.'],'frames':frames};(S/'masters.json').write_text(json.dumps(M,indent=1)+'\n',encoding='utf-8');print('DOG_MASTERS_OK',len(frames))
