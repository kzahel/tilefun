from pathlib import Path
from PIL import Image,ImageDraw
import json,math
S=Path(__file__).parent;G=json.loads((S/'projected-guides.json').read_text());W=48;P={'k':'#191f2b','s':'#303846','c':'#4b5663','h':'#69747e','w':'#f3f1df','g':'#b5c5bf','e':'#a8d56c','p':'#d88d92'};keys=list(P);frames=[]
heads={'down':['..kkk..','kcsssck','kceweck','kswpwsk','.kwwwk.','..kkk..'],'up':['..kkk..','kcsssck','kcsssck','kcsssck','.ksssk.','..kkk..'],'left':['..kkkk.','.kccssk','kcesssk','pwwsssk','.wwwsk.','..kkk..']};heads['right']=[r[::-1] for r in heads['left']]
def rnd(points):return [(math.floor(x+.5),math.floor(y+.5)) for x,y in points]
for r in G['records']:
 im=Image.new('L',(48,48));d=ImageDraw.Draw(im);bodymask=Image.new('1',(48,48));bd=ImageDraw.Draw(bodymask)
 for n,v in sorted(r['volumes'].items(),key=lambda q:-sum(q[1]['depthRange'])/2):
  if n.startswith(('skull','muzzle','nose','eye')):continue
  pts=rnd(v['hull']);color='w' if ('paw' in n or n=='white-bib') else 'p' if n.startswith('ear-pink') else 'c';idx=keys.index(color)+1
  if len(set(pts))>=3:d.polygon(pts,fill=idx)
  elif len(set(pts))>=2:d.line(pts,fill=idx,width=1)
  elif pts:d.point(pts[0],fill=idx)
  if n in ['torso','shoulder','pelvis']:bd.polygon(pts,fill=1)
 # Broad united back shading avoids ellipsoid bead outlines; visible body surfaces stay dark.
 bp=bodymask.load();box=bodymask.getbbox()
 for y in range(box[1],box[3]):
  for x in range(box[0],box[2]):
   if bp[x,y] and im.getpixel((x,y))==keys.index('c')+1:im.putpixel((x,y),keys.index('c' if y<box[1]+2 else 's')+1)
 # Connected projected tail axis restores subpixel joints without inventing appendage motion.
 d.line(rnd([p[:2] for p in r['tail']]),fill=keys.index('c')+1,width=1)
 visibleBeforeOutline=im.copy()
 # Outline entire projected silhouette, then stamp unchanged fixed skull/marking master.
 old=im.copy();px=old.load()
 for y in range(1,47):
  for x in range(1,47):
   if px[x,y] and any(not px[x+dx,y+dy] for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]):im.putpixel((x,y),1)
 hx,hy=[math.floor(v+.5) for v in r['head'][:2]];template=heads[r['facing']]
 # Ear pink is a restrained single projected interior pixel; action remains driven by rigid ear guides.
 for side in [-1,1]:
  v=r['volumes'][f'ear-pink-{side}'];x=round((v['bbox'][0]+v['bbox'][2])/2);y=round((v['bbox'][1]+v['bbox'][3])/2)
  if r['facing']!='up' and y<hy-3 and 0<x<47 and 0<y<47 and im.getpixel((x,y))!=0:im.putpixel((x,y),keys.index('p')+1)
 # Two-pixel mittens follow actual projected paw centers at distinct ground depths.
 pawdepths={n:sum(r['volumes'][n+'-paw']['depthRange'])/2 for n in ['HL','FL','HR','FR']};median=sorted(pawdepths.values())[2]
 for n,depth in pawdepths.items():
  v=r['volumes'][n+'-paw'];x=round((v['bbox'][0]+v['bbox'][2])/2);y=round((v['bbox'][1]+v['bbox'][3])/2);color='w' if depth<=median else 'g'
  for xx in [x-1,x]:
   if im.getpixel((xx,y))!=0 and not bodymask.getpixel((xx,y)):im.putpixel((xx,y),keys.index(color)+1)
 # The close skull hides far hind paws; no foot highlights may overpaint its complete template.
 for yy,line in enumerate(template):
  for xx,ch in enumerate(line):
   if ch!='.':im.putpixel((hx-3+xx,hy-3+yy),keys.index(ch)+1)
 pixels=list(im.get_flattened_data());rows=[''.join('.' if c==0 else keys[c-1] for c in pixels[y*48:(y+1)*48]) for y in range(48)];frames.append({'facing':r['facing'],'clip':r['clip'],'index':r['index'],'pixels':rows})
M={'identity':'cat-draft-v1-pixels-01','palette':P,'canvas':[48,48],'anchor':[24,34],'headTemplates':heads,'stylization':['Fresh natural quadruped geometry; approved upright cat supplies palette/short face style only.','Full six-row skull, eye/muzzle/marking templates unchanged at fixed head anchor; ears independently articulate.','United charcoal back with restrained broad shade, cream bib/paws, no front toe/nail decals on rear heels.','Actual projected mesh hulls and tail axis guide integer silhouettes; no quantized-render finish or per-frame scaling.'],'frames':frames};(S/'masters.json').write_text(json.dumps(M,indent=1)+'\n',encoding='utf-8');print('CAT_MASTERS_OK',len(frames))
