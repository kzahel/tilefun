"""Authored letter goldfish, integer posterior wave and concave fin/ray clusters."""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;R=S.parents[3];O=R/'public/demos/wildlife-v2/fish/draft-v2';W=48
G=json.loads((S/'projected-guides.json').read_text());M=json.loads((S/'masters.json').read_text());F=list(G['cameraContract']['modelYawDegrees']);P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def xy(v):return tuple(int(math.floor(p+.5)) for p in v[:2])
def patch(p):
 rows=p['pixels'];im=Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,row in enumerate(rows):
  assert len(row)==im.width
  for x,k in enumerate(row):
   if k!='.':im.putpixel((x,y),P[k])
 return im
parts={g:{f:patch(M[g][f]) for f in F} for g in ['bodies','heads']}
def paste(im,g,r):
 x,y=xy(r['head'] if g=='heads' else r['body']);dx,dy=M[g][r['facing']]['offset'];im.alpha_composite(parts[g][r['facing']],(x+dx,y+dy))
def fin(im,r,name,near=True):
 d=ImageDraw.Draw(im);ps=[xy(p) for p in r['finContours'][name]];d.polygon(ps,fill=P['f'] if near else P['t']);d.line(ps+[ps[0]],fill=P['o'])
 if name=='caudal-volume':
  # Preserve actual fork notch and two lobes, not a convex triangular fan.
  root=xy(r['spine']['CAUDAL-fork']['screen']);d.line([root,ps[1]],fill=P['g']);d.line([root,ps[3]],fill=P['h']);d.point(ps[2],fill=P['t'])
 elif name=='dorsal-volume':d.line([ps[1],ps[2]],fill=P['h']);d.line([ps[0],ps[1]],fill=P['g'])
 else:d.line([ps[0],ps[1]],fill=P['g'] if near else P['f'])
def posterior(im,r):
 d=ImageDraw.Draw(im)
 for name in ['peduncle-volume','posterior-volume']:
  v=r['volumes'][name];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P['g']);d.line(ps+[ps[0]],fill=P['o'])
  # Restrained upper band and broad lower shadow follow each rigid volume.
  b=v['bbox'];y=int(math.floor((b[1]+b[3])/2+.5));x0,x1=int(math.ceil(b[0])),int(math.floor(b[2]));d.line([(x0,y),(x1,y)],fill=P['e'])
  if x1>x0:d.line([(x0+1,y-1),(x1,y-1)],fill=P['h'])
def lips(im,r):
 if r['facing']=='up':return
 d=ImageDraw.Draw(im);p,q=xy(r['landmarks']['upper-lip-volume']),xy(r['landmarks']['lower-lip-volume'])
 if r['facing']=='down':
  d.line([(p[0]-1,p[1]),(p[0]+1,p[1])],fill=P['w'])
  if q[1]>p[1]:d.point((p[0],p[1]+1),fill=P['k'])
  d.line([(q[0]-1,q[1]),(q[0]+1,q[1])],fill=P['w'])
 else:
  step=-1 if r['facing']=='left' else 1;d.line([(p[0]-step,p[1]),p],fill=P['w'])
  # Rigid lower jaw retreats toward chin when open; only its lip occludes face.
  if q[1]>p[1]+1:d.line([p,q],fill=P['k'])
  d.point(q,fill=P['w'])
def compose(r):
 im=Image.new('RGBA',(W,W));fo=sorted([-1,1],key=lambda s:r['volumes'][f'pectoral-{s}-volume']['depthRange'][0],reverse=True)
 fin(im,r,f'pectoral-{fo[0]}-volume',False);fin(im,r,f'pelvic-{fo[0]}-volume',False);fin(im,r,'caudal-volume');fin(im,r,'anal-volume');posterior(im,r);fin(im,r,'dorsal-volume')
 if r['facing']=='up':paste(im,'heads',r)
 paste(im,'bodies',r)
 fin(im,r,f'pelvic-{fo[1]}-volume');fin(im,r,f'pectoral-{fo[1]}-volume')
 if r['facing']!='up':paste(im,'heads',r)
 lips(im,r);return im
frames={(r['facing'],r['clip'],r['index']):compose(r) for r in G['records']};clips={'idle':{'start':0,'count':1},'swim':{'start':1,'count':8,'description':'Posterior traveling axial wave through fixed-length spine links, lateral forked caudal beat and paired fin sculling'},'action':{'start':9,'count':6,'description':'Ventral lip gape and pectoral feeding-hover scull around stable skull; source operculum movement is below pixel scale'}}
for c in clips.values():c['durationMs']=c['count']*160
meta={'identity':M['identity'],'motionIdentity':'fish-draft-v2-motion-01','reviewStatus':'pending production and human review','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'rootMotion':False,'frameDurationMs':160,'fps':6.25,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'media':{'kind':'water','waterSurfaceZ':1.2,'bodyCenterZ':.48,'support':'buoyancy; no ground contacts'},'clips':clips,'facings':{}}
sheet=Image.new('RGBA',(W*15,W*4))
for row,f in enumerate(F):
 meta['facings'][f]={'row':row,'frames':[]}
 for c,cs in clips.items():
  for i in range(cs['count']):
   im=frames[f,c,i];col=cs['start']+i;sheet.alpha_composite(im,(col*W,row*W));meta['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[col*W,row*W,W,W],'visibleBounds':im.getbbox(),'guideRecord':next(n for n,r in enumerate(G['records']) if (r['facing'],r['clip'],r['index'])==(f,c,i))})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*15,W*4+18),'#879b82');contact.alpha_composite(sheet,(0,18));ImageDraw.Draw(contact).text((3,3),'Pond goldfish | idle | swim8 | gulp6 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*4,contact.height*4),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(W*8,(W+12)*3),'#879b82');d=ImageDraw.Draw(strip)
 for row,c in enumerate(clips):
  d.text((2,row*(W+12)+1),f'{f} {c}: chronological',fill='white')
  for i in range(clips[c]['count']):strip.alpha_composite(frames[f,c,i],(i*W,row*(W+12)+12))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(R/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(320,208),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(160,-93));bg.alpha_composite(crop([256,96,48,64]),(4,5));bg.alpha_composite(crop([0,1152,208,64]),(58,143))
# Existing committed water tile, unscaled, makes actual swimming context visible.
water=Image.open(R/'public/assets/tilesets/water.png').convert('RGBA').crop((0,0,16,16))
for y in range(72,136,16):
 for x in range(32,304,16):bg.alpha_composite(water,(x,y))
bg.save(O/'scene-background.png');person=Image.open(R/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene(c,i):
 im=bg.copy()
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(34+row*65,74));im.alpha_composite(person.crop((0,row*32,32,row*32+32)),(39+row*65,28))
 return im
scene('idle',0).save(O/'scene-native.png');scene('idle',0).resize((1280,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
seq=[('idle',0)]*3+[('swim',i) for _ in range(2) for i in range(8)]+[('action',i) for i in range(6)]+[('idle',0)]*3;native=[]
for c,i in seq:
 im=Image.new('RGBA',(W*4,W),'#8bad99')
 for row,f in enumerate(F):im.alpha_composite(frames[f,c,i],(row*W,0))
 native.append(im)
def gif(ims,name):
 ims=[im.convert('RGB') for im in ims];ims[0].save(O/name,save_all=True,append_images=ims[1:],duration=160,loop=0,disposal=2,optimize=False)
gif(native,'preview-native.gif');gif([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],'preview.gif');gif([scene(c,i) for c,i in seq],'scene-native.gif')
overlay=Image.new('RGBA',(W*4,W*2),'#879b82')
for row,f in enumerate(F):
 r=next(r for r in G['records'] if r['clip']=='idle' and r['facing']==f);im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
 for v in r['volumes'].values():ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#f1bc78')
 overlay.alpha_composite(frames[f,'idle',0],(row*W,0));overlay.alpha_composite(im,(row*W,W))
overlay.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
assert set(sheet.getdata())<=set(P.values())|{(0,0,0,0)};assert set(sheet.getchannel('A').getdata())=={0,255}
for key,im in frames.items():b=im.getbbox();assert b and min(b[:2])>=2 and max(b[2:])<=W-2,(key,b)
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes();timings={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);timings[name]=sum(f.info['duration'] for f in ImageSequence.Iterator(im));assert timings[name]==4480
report={'status':'integrity pass; visual gate separate','identity':M['identity'],'frames':60,'binaryAlpha':True,'padding':True,'palette':M['palette'],'gifDurationMs':timings,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'stylization':M['stylization']};(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print('FISH_FINISH_OK',report['idleVisibleHeights'])
