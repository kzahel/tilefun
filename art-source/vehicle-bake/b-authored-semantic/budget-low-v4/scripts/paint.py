"""Semantic surface atlas. No screen pixels are projected into the mesh.
Run outside Blender with Python/Pillow, then build.py in Blender.
"""
import json, math, hashlib
from pathlib import Path
from collections import Counter

ROOT = next(p for p in Path(__file__).resolve().parents if (p/'scripts/vehicle-bake/README.md').is_file())
ROUTE = 'b-authored-semantic'
P = {'ink':(58,58,80),'warm_ink':(74,42,61),'red_deep':(127,33,76),
 'red_shadow':(161,18,80),'red_mid':(197,52,88),'red':(211,68,92),
 'red_light':(227,90,90),'red_glint':(225,132,132),
 'glass_dark':(86,89,114),'glass':(115,140,168),'glass_light':(164,187,213),
 'glass_glint':(186,210,224),'rim':(131,136,151),'silver':(212,212,230),
 'white':(248,248,248),'tire_light':(70,70,94),'ruby':(186,39,88)}
REGIONS = {'coachwork':[4,4,508,196], 'front_glass':[4,204,132,268],
 'rear_glass':[140,204,268,268], 'side_glass':[276,204,508,268],
 'roof':[4,276,132,340], 'nose':[140,276,268,340], 'tail':[276,276,404,340],
 'fender':[412,276,508,340], 'wheel_cap':[4,348,132,476],
 'tread':[140,348,268,412], 'swatches':[276,348,508,476]}

def interp(x,pts):
 for (a,av),(b,bv) in zip(pts,pts[1:]):
  if x<=b:return av+(bv-av)*(x-a)/(b-a)
 return pts[-1][1]
WIDTH=[(-2.3,.68),(-2.13,.85),(-1.5,.94),(-.6,.865),(.3,.88),(1.35,.965),(2.08,.91),(2.3,.76)]
DECK=[(-2.3,.39),(-2.05,.48),(-1.2,.57),(-.6,.63),(.5,.66),(1.25,.66),(2.1,.61),(2.3,.52)]

def body_point(x,t):
 w=interp(x,WIDTH);z=interp(x,DECK);c=math.cos(t);s=math.sin(t)
 y=w*math.copysign(abs(c)**.57,c)
 zz=.19+(z-.19)*(math.copysign(abs(s)**.45,s)+1)/2
 if s>0:zz+=.08*math.exp(-((abs(x)-1.4)/.52)**2)*(abs(y)/w)**3
 return x,y,zz

def color(region,u,v):
 # v is image-down. Coachwork v is circular parameter t, starting at +Y.
 if region=='coachwork':
  x=-2.3+4.6*u;t=2*math.pi*v;_,y,z=body_point(x,t);s=math.sin(t)
  role='red_light' if s>.52 else ('red' if s>.12 else ('red_mid' if s>-.12 else 'red_deep'))
  # A broad surface-owned shoulder accent; deliberately restrained.
  if .30<s<.46:role='red_glint'
  if s>0 and .64<abs(y)/interp(x,WIDTH)<.86 and (x<-.85 or x>1.30):role='red_glint'
  # Exact source hood-crease landmark run, clipped to upper hood surface.
  if -2.0<x<-.90 and s>0 and abs(abs(y)-interp(x,[(-2,.44),(-1.67,.46),(-1.1,.47),(-.9,.50)]))<.045:role='warm_ink'
  if 1.40<x<1.83 and abs(y)<.41 and s>0:
   if min(abs(x-q) for q in (1.45,1.60,1.75))<.041:role='warm_ink'
  # Real side shut lines and sill in longitudinal / height coordinates.
  if abs(y)>.80 and .28<z<.60 and -.74<x<.56:
   front=-.64-(z-.30)*.08/.30;back=.46+(z-.29)*.09/.29
   if min(abs(x-front),abs(x-back))<.028 or (abs(z-.30)<.023 and -.64<x<.47):role='warm_ink'
  if abs(y)>.85 and .57<z<.605 and .29<x<.45:role='silver'
  if abs(y)>.83 and .55<x<.99 and .36<z<.57 and x>.55+(.57-z)*.4:role='ink'
  return role
 if region in ('front_glass','rear_glass','side_glass'):
  if u<.055 or u>.945 or v<.13 or v>.87:return 'ink'
  if region=='side_glass' and .64<u<.69:return 'ink'
  if .26<v<.34:return 'glass_glint'
  return 'glass_light' if v<.52 else 'glass'
 if region=='roof':
  if u<.035 or u>.965 or v<.045 or v>.955:return 'red_mid'
  return 'red_light'
 if region in ('nose','tail'):
  # u is lateral, v top-to-bottom. Solid intakes, framed lenses.
  if region=='nose':
   if .34<u<.66 and .46<v<.88:return 'ink'
   if (.08<u<.27 or .73<u<.92) and .44<v<.78:return 'ink'
   return 'red' if v<.45 else 'red_shadow'
  if (.08<u<.40 or .60<u<.92) and .12<v<.35:return 'ruby' if v>.22 else 'white'
  if .15<u<.85 and .48<v<.94:return 'ink'
  if .51<v<.89 and any(abs(u-q)<.012 for q in (.25,.38,.5,.62,.75)):return 'rim'
  return 'red' if v<.4 else 'red_mid'
 if region=='fender':return 'ink' if v>.84 else ('red_glint' if v<.28 else 'red_mid')
 if region=='wheel_cap':
  a=(u-.5)*2;b=(v-.5)*2;r=math.hypot(a,b);theta=math.atan2(b,a)
  if r>.93:return 'ink'
  if r>.83:return 'rim'
  if r<.16:return 'silver'
  # Five clean spokes rotate with the independent wheel; dark barrel elsewhere.
  if r<.80 and abs(math.sin(2.5*(theta+r*.32)))<.23:return 'silver'
  return 'ink'
 if region=='tread':return 'tire_light' if .18<v<.40 else 'ink'
 return 'ink'

def main():
 import argparse
 from PIL import Image, ImageDraw
 ap=argparse.ArgumentParser();ap.add_argument('--revision',default='v1');a=ap.parse_args()
 dest=ROOT/'art-source/vehicle-bake'/ROUTE/a.revision
 if (dest/'complete.lock.json').exists():raise SystemExit('Completed candidate is immutable; choose another revision')
 dest.mkdir(parents=True,exist_ok=True)
 im=Image.new('RGB',(512,512),P['ink']);ownership=Image.new('RGB',im.size);px=im.load();op=ownership.load()
 for idx,(name,(x0,y0,x1,y1)) in enumerate(REGIONS.items()):
  if name=='swatches':continue
  for y in range(y0-2,y1+2):
   for x in range(x0-2,x1+2):
    u=max(0,min(1,(x-x0)/(x1-x0-1)));v=max(0,min(1,(y-y0)/(y1-y0-1)))
    px[x,y]=P[color(name,u,v)];op[x,y]=((idx*61+49)%255,(idx*97+70)%255,(idx*31+130)%255)
 draw=ImageDraw.Draw(im);swatches={}
 for k,(name,c) in enumerate(P.items()):
  x=280+(k%7)*32;y=352+(k//7)*32;draw.rectangle((x,y,x+27,y+27),fill=c);swatches[name]=[x+14,y+14]
 im.save(dest/'atlas.png');ownership.save(dest/'paint-ownership.png')
 # Semantic route deliberately does not pretend a raw projection exists.
 Image.new('L',im.size,0).save(dest/'rejected-projection.png')
 uncertainty=Image.new('L',im.size,0);ud=ImageDraw.Draw(uncertainty)
 ud.rectangle(REGIONS['coachwork'],fill=64);ud.rectangle(REGIONS['tread'],fill=128)
 uncertainty.save(dest/'authored-uncertainty.png')
 refs=ROOT/'public/demos/vehicle-style-study/03-guide-pixel-finish'
 evidence=ROOT/'art-source/vehicle-style-study/03-guide-pixel-finish/evidence'
 hist={}
 for kind in ('body','glass','intakes','panels','rim','lamps'):
  cs=Counter()
  for i in range(8):
   target=Image.open(refs/f'view-{i}.png').convert('RGBA');mask=Image.open(evidence/'guides'/f'{kind}-{i}-128.png').convert('L')
   cs.update(c[:3] for c,m in zip(target.getdata(),mask.getdata()) if m and c[3])
  hist[kind]=[{'rgb':list(c),'pixels':n} for c,n in cs.most_common(20)]
 (dest/'source-mask-palette.json').write_text(json.dumps(hist,indent=2)+'\n')
 recipe={'route':ROUTE,'revision':a.revision,'surfaceRegions':REGIONS,'swatches':swatches,'palette':P,
 'widthFunction':WIDTH,'deckFunction':DECK,'exportWorldScale':80/4.6,
 'bodyParam':'same approach-3 superellipse, powers 0.57 / 0.45, 0.08 fender Gaussian',
 'method':'Geometry-aware authored semantic UV paint. Source-mask histograms validate palette roles; no image projection or view-conditioned material.',
 'ownership':{'coachwork':'source width/deck/superellipse functions; longitudinal seams and deck slats in object coordinates',
 'glass':'separate retained-source apertures; border and band re-authored in their own UV rectangles',
 'wheels':'independent cap/tread regions, five spoke cap painting', 'hidden':'underside and well interiors explicitly authored ink'},
 'uncertainty':{'rawProjection':'not used by this route; rejected-projection.png is empty, not a coverage claim',
 'authored-uncertainty.png':'64: analytically authored body ramp; 128: inferred hidden tread; 0: semantic design regions or unused',
 'conflicts':'opposite-view illumination cannot coexist in one atlas; symmetric body ramp is an intentional compromise'},
 'sourcePaletteEvidence':'source-mask-palette.json'}
 (dest/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
 print(dest)
if __name__=='__main__':main()
