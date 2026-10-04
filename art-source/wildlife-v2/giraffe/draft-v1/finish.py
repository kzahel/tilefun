"""Deterministic authored-letter composition, integer limb/ear finishing.
Guide positions and hulls come from Blender; no rendered colors are sampled.
"""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/giraffe/draft-v1'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text())
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()};W=G['canvas'][0];F=list(G['cameraContract']['modelYawDegrees'])
def snap(v):return int(math.floor(v+.5))
def xy(p):return tuple(snap(x) for x in p[:2])
def pattern(rows):
 im=Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,row in enumerate(rows):
  assert len(row)==im.width
  for x,k in enumerate(row):
   if k!='.':im.putpixel((x,y),P[k])
 return im
parts={g:{f:pattern(M[g][f]['pixels']) for f in F} for g in ['bodies','heads']}
def paste(im,g,r):
 a=xy(r['body']);off=M[g][r['facing']]['offset'];im.alpha_composite(parts[g][r['facing']],(a[0]+off[0],a[1]+off[1]))
def ribbon(im,points,radii,base,light=False):
 d=ImageDraw.Draw(im);ns=[]
 for i,p in enumerate(points):
  a,b=points[max(0,i-1)],points[min(len(points)-1,i+1)];dx,dy=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dy) or 1
  ns.append((-dy/l*radii[i],dx/l*radii[i]))
 ps=[(snap(p[0]+n[0]),snap(p[1]+n[1])) for p,n in zip(points,ns)]+[(snap(p[0]-n[0]),snap(p[1]-n[1])) for p,n in reversed(list(zip(points,ns)))]
 d.polygon(ps,fill=P[base]);d.line(ps+[ps[0]],fill=P['o'])
 if light:d.line([(x-1,y) for x,y in points],fill=P['h'],width=1)
def leg(im,n,c,near,f):
 ps=[xy(c['screen'][k]) for k in ['hip','proximal','joint','foot']]
 ribbon(im,ps,[1.6,1.2,1,.7],'t' if near else 's',near)
 d=ImageDraw.Draw(im);a,b=ps[:2]
 # Fixed upper-leg coat patches move with each articulated segment.
 for t in [.30,.65]:
  x=snap(a[0]+(b[0]-a[0])*t);y=snap(a[1]+(b[1]-a[1])*t)
  d.line([(x,y),(x,y+1)],fill=P['p'] if near else P['o'])
 x,y=ps[-1];d.polygon([(x-1,y-1),(x+1,y-1),(x+2,y),(x+1,y+1),(x-1,y+1)],fill=P['o'])
 if near:d.line([(x-1,y),(x+1,y)],fill=P['s'])
 # Front cloven-toe mark is deliberately absent from rear heels.
 if f!='up':d.point((x,y+1),fill=P['k'])
def ear(im,r,side,near):
 v=r['volumes'][f'ear-{side}-volume']
 # Preserve the complete ear patch in unchanged-orientation walking poses.
 # Independently rounding every hull vertex made its skull overlap flicker.
 if r['clip']!='action':
  idle=next(g for g in G['records'] if g['facing']==r['facing'] and g['clip']=='idle')
  v=idle['volumes'][f'ear-{side}-volume'];a,b=xy(r['body']),xy(idle['body']);dx,dy=a[0]-b[0],a[1]-b[1]
 else:dx=dy=0
 ps=[(xy(p)[0]+dx,xy(p)[1]+dy) for p in v['hull']];d=ImageDraw.Draw(im)
 d.polygon(ps,fill=P['h'] if near else P['t']);d.line(ps+[ps[0]],fill=P['o'])
 # Deliberate broad inner fill follows the rigid ear volume with no length scaling.
 a,b=v['bbox'][:2],v['bbox'][2:];cx=snap((a[0]+b[0])/2)+dx;cy=snap((a[1]+b[1])/2)+dy
 d.line([(cx-1,cy),(cx+1,cy)],fill=P['c'] if near else P['s'])
def tail(im,r):
 if r['facing']=='down':return
 ps=[xy(p) for p in r['tail']];d=ImageDraw.Draw(im);d.line(ps,fill=P['o'],width=2);d.line(ps,fill=P['t'],width=1)
 x,y=ps[-1];d.polygon([(x-1,y-1),(x+1,y-1),(x+2,y+2),(x,y+4),(x-1,y+2)],fill=P['o'])
def compose(r):
 im=Image.new('RGBA',(W,W));order=sorted(r['contacts'].items(),key=lambda v:v[1]['screen']['hip'][2],reverse=True)
 for n,c in order[:2]:leg(im,n,c,False,r['facing'])
 earorder=sorted([-1,1],key=lambda s:r['volumes'][f'ear-{s}-volume']['depthRange'][0],reverse=True)
 ear(im,r,earorder[0],False)
 if r['facing']=='up':paste(im,'heads',r)
 paste(im,'bodies',r)
 for n,c in order[2:]:leg(im,n,c,True,r['facing'])
 # Upper limbs meet under the body, rather than cutting over its coat patterns.
 paste(im,'bodies',r)
 tail(im,r)
 if r['facing']!='up':paste(im,'heads',r)
 ear(im,r,earorder[1],True)
 return im
records=G['records'];frames={(r['facing'],r['clip'],r['index']):compose(r) for r in records}
sheet=Image.new('RGBA',(W*25,W*4))
clips={'idle':{'start':0,'count':1},'walk':{'start':1,'count':16,'durationMs':3200,'description':'Lateral sequence HL FL HR FR, landing offsets 0/2/8/10; 11 of 16 samples in stance; three rigid segments per leg'},'action':{'start':17,'count':8,'durationMs':1600,'description':'Fixed-length tail fly-flick and ear swivel; fixed skull/neck'}}
meta={'identity':M['identity'],'motionIdentity':'giraffe-draft-v1-motion-02','reviewStatus':'draft, pending visual gate and human review','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'rootMotion':False,'fps':5,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':clips,'facings':{}}
for row,f in enumerate(F):
 meta['facings'][f]={'row':row,'frames':[]}
 for clip,spec in clips.items():
  for i in range(spec['count']):
   im=frames[f,clip,i];col=spec['start']+i;sheet.alpha_composite(im,(col*W,row*W))
   meta['facings'][f]['frames'].append({'clip':clip,'index':i,'rect':[col*W,row*W,W,W],'visibleBounds':im.getbbox(),'guideRecord':next(n for n,r in enumerate(records) if (r['facing'],r['clip'],r['index'])==(f,clip,i))})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n')
(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*25,W*4+18),'#879b82');contact.alpha_composite(sheet,(0,18));ImageDraw.Draw(contact).text((4,3),'Giraffe | idle | walk 0-15 | fly-flick 0-7 | down/up/left/right',fill='white')
contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*2,contact.height*2),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(W*16,(W+14)*3),'#879b82');d=ImageDraw.Draw(strip)
 for row,clip in enumerate(clips):
  d.text((2,row*(W+14)+2),f'{f} {clip}: chronological',fill='white')
  for i in range(clips[clip]['count']):strip.alpha_composite(frames[f,clip,i],(i*W,row*(W+14)+14))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*2,strip.height*2),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(ROOT/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(640,272),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(480,-92));bg.alpha_composite(crop([256,96,48,64]),(4,5));bg.alpha_composite(crop([0,1152,208,64]),(200,200))
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene(c,i):
 im=bg.copy()
 for n,f in enumerate(F):
  im.alpha_composite(frames[f,c,i],(24+n*152,43));im.alpha_composite(person.crop((0,n*32,32,n*32+32)),(35+n*152,142))
 return im
bg.save(O/'scene-background.png');scene('idle',0).save(O/'scene-native.png');scene('idle',0).resize((2560,1088),Image.Resampling.NEAREST).save(O/'scene-4x.png')
sequence=[('idle',0)]*3+[('walk',i) for _ in range(2) for i in range(16)]+[('action',i) for i in range(8)]+[('idle',0)]*3
native=[]
for c,i in sequence:
 im=Image.new('RGBA',(W*4,W),'#879b82')
 for n,f in enumerate(F):im.alpha_composite(frames[f,c,i],(n*W,0))
 native.append(im)
def gif_save(ims,path):
 ims=[im.convert('RGB') for im in ims];ims[0].save(path,save_all=True,append_images=ims[1:],duration=200,loop=0,disposal=2,optimize=False)
gif_save(native,O/'preview-native.gif');gif_save([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],O/'preview.gif');gif_save([scene(c,i) for c,i in sequence],O/'scene-native.gif')
guide=Image.new('RGBA',(W*16,W*4),'#23343b')
over=Image.new('RGBA',(W*4,W*2),'#879b82')
for row,f in enumerate(F):
 for i in range(16):
  r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,'walk',i));im=Image.new('RGBA',(W,W),'#23343b');d=ImageDraw.Draw(im)
  for n,v in r['volumes'].items():
   ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#a1cbaa' if 'skull' in n or 'ear-' in n else '#597d8a')
  for c in r['contacts'].values():
   d.line([xy(c['screen'][k]) for k in ['hip','proximal','joint','foot']],fill='#f8c878');x,y=xy(c['screen']['ground']);d.ellipse((x-1,y-1,x+1,y+1),fill='#ee6666' if c['planted'] else '#7799ff')
  guide.alpha_composite(im,(i*W,row*W))
 r=next(r for r in records if r['facing']==f and r['clip']=='idle');im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
 for v in r['volumes'].values():
  ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#e3a773')
 over.alpha_composite(frames[f,'idle',0],(row*W,0));over.alpha_composite(im,(row*W,W))
guide.save(O/'projected-volume-contact-sheet-native.png');over.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
allowed=set(P.values())|{(0,0,0,0)};assert set(sheet.getdata())<=allowed;assert set(sheet.getchannel('A').getdata())=={0,255}
for k,im in frames.items():
 b=im.getbbox();assert b and b[0]>=2 and b[1]>=2 and b[2]<=W-2 and b[3]<=W-2,(k,b)
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes()
timing={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 gif=Image.open(O/name);timing[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(gif));assert timing[name]==9200
report={'status':'integrity pass; not visual acceptance','identity':M['identity'],'frames':100,'binaryAlpha':True,'padding':True,'decodedSheetMatches':True,'fixedHeadMasters':True,'palette':M['palette'],'gifDurationMs':timing,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'stylization':M['stylization']}
(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print('GIRAFFE_FINISH_OK',report['idleVisibleHeights'])
