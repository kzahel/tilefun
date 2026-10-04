"""Palette-letter mallard finish and integer articulated appendage drawings."""
import json,math,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageSequence
S=Path(__file__).parent;ROOT=S.parents[3];O=ROOT/'public/demos/wildlife-v2/mallard-duck/draft-v1'
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text());W=48;F=list(G['cameraContract']['modelYawDegrees'])
P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def snap(v):return int(math.floor(v+.5))
def xy(v):return tuple(snap(x) for x in v[:2])
def pattern(rows):
 im=Image.new('RGBA',(len(rows[0]),len(rows)))
 for y,row in enumerate(rows):
  assert len(row)==im.width
  for x,k in enumerate(row):
   if k!='.':im.putpixel((x,y),P[k])
 return im
parts={g:{f:pattern(M[g][f]['pixels']) for f in F} for g in ['bodies','heads']}
def paste(im,g,r):
 a=xy(r['head'] if g=='heads' else r['body']);off=M[g][r['facing']]['offset'];im.alpha_composite(parts[g][r['facing']],(a[0]+off[0],a[1]+off[1]))
def wing(im,r,s,near):
 d=ImageDraw.Draw(im)
 for group,col in [('secondary','t' if near else 's'),('primary','s')]:
  v=r['volumes'][f'{group}-{s}-volume'];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P[col]);d.line(ps+[ps[0]],fill=P['o'])
  # Broad outer feather light band, aligned with actual fan instead of dithering.
  a,b=ps[0],ps[len(ps)//2];d.line([a,b],fill=P['l'] if group=='secondary' else P['t'])
  if group=='primary':
   a=xy(r['wings'][str(s)]['elbow']);b=xy([(v['bbox'][0]+v['bbox'][2])/2,(v['bbox'][1]+v['bbox'][3])/2])
   d.line([a,b],fill=P['t']);d.point(b,fill=P['k'])
 v=r['volumes'][f'speculum-{s}-volume'];ps=[xy(p) for p in v['hull']];d.polygon(ps,fill=P['u']);d.line(ps[:2],fill=P['w'])
def foot(im,r,s,near):
 d=ImageDraw.Draw(im);c=r['contacts'][str(s)];ps=[xy(c['screen'][k]) for k in ['hip','joint','foot']]
 d.line(ps,fill=P['a'] if near else P['c'],width=1)
 if r['clip']=='flap':d.line([ps[-1],(ps[-1][0]+1,ps[-1][1])],fill=P['a']);return
 hull=[xy(p) for p in r['volumes'][f'web-{s}-volume']['hull']]
 d.polygon(hull,fill=P['a'] if near else P['c'])
 if r['facing']=='up':
  # Heel is continuous orange, with no front toe ray cluster on rear-facing feet.
  return
 if len(hull)>2:d.point(hull[-1],fill=P['y'])
def tail(im,r):
 v=r['volumes']['tail-volume'];ps=[xy(p) for p in v['hull']];d=ImageDraw.Draw(im);d.polygon(ps,fill=P['w']);d.line(ps+[ps[0]],fill=P['o'])
 x,y=xy(r['landmarks']['tail-curl-volume']);d.line([(x,y+1),(x+1,y),(x,y-1)],fill=P['k'])
def bill(im,r):
 if r['facing']=='up':return
 d=ImageDraw.Draw(im)
 # Freeze the complete bill with its skull in unchanged-orientation clips.
 idle=next(g for g in G['records'] if g['facing']==r['facing'] and g['clip']=='idle')
 h0,h=xy(idle['head']),xy(r['head']);dx,dy=h[0]-h0[0],h[1]-h0[1]
 p0,q0=xy(idle['landmarks']['upper-bill-volume']),xy(idle['landmarks']['lower-bill-volume'])
 p=(p0[0]+dx,p0[1]+dy);q=(q0[0]+dx,q0[1]+dy)
 if r['clip']=='action':q=xy(r['landmarks']['lower-bill-volume'])
 if r['facing']=='down':
  d.line([(p[0]-1,p[1]),(p[0]+1,p[1])],fill=P['y'],width=2)
  if q[1]>p[1]+1:d.line([(p[0]-1,p[1]+1),(p[0]+1,p[1]+1)],fill=P['k'])
  d.line([(q[0]-1,q[1]),(q[0]+1,q[1])],fill=P['y']);d.point((p[0],p[1]),fill=P['o'])
 else:
  x,y=p;d.line([(x-2,y),(x+1,y)],fill=P['y'])
  if q[1]>y:d.line([(x-2,y+1),(x+1,y+1)],fill=P['k'])
  d.line([(q[0]-2,q[1]),(q[0]+1,q[1])],fill=P['y']);d.point((x-2 if r['facing']=='left' else x+1,y),fill=P['o'])
def compose(r):
 im=Image.new('RGBA',(W,W));order=sorted([-1,1],key=lambda s:r['contacts'][str(s)]['screen']['hip'][2],reverse=True)
 foot(im,r,order[0],False)
 if r['clip']=='flap':
  wo=sorted([-1,1],key=lambda s:r['volumes'][f'secondary-{s}-volume']['depthRange'][0],reverse=True);wing(im,r,wo[0],False)
 tail(im,r);paste(im,'bodies',r);foot(im,r,order[1],True);paste(im,'bodies',r)
 if r['clip']=='flap':wing(im,r,wo[1],True)
 # Explicit collar/neck bridge to independently projected head position.
 a=xy(r['body']);h=xy(r['head']);d=ImageDraw.Draw(im)
 if r['facing'] in ['left','right']:d.line([(h[0],h[1]+2),(a[0]+(-5 if r['facing']=='left' else 5),a[1]-5)],fill=P['g'],width=2);d.point((a[0]+(-5 if r['facing']=='left' else 5),a[1]-5),fill=P['w'])
 if r['facing']=='up':d.line([(h[0],h[1]+2),(a[0],a[1]-10)],fill=P['g'],width=2)
 paste(im,'heads',r);bill(im,r)
 return im
records=G['records'];frames={(r['facing'],r['clip'],r['index']):compose(r) for r in records}
clips={'idle':{'start':0,'count':1},'waddle':{'start':1,'count':8,'description':'Alternating webbed feet; six discrete planted samples per side including zero-lift swing boundary; one-pixel weight transfer'},'swim':{'start':9,'count':8,'description':'Alternating submerged power and feathered recovery paddles, wings folded'},'flap':{'start':17,'count':8,'description':'Articulated secondary/primary downstroke and folding recovery; tucked feet'},'action':{'start':25,'count':6,'description':'Quack with hinged lower bill and tail shiver; fixed skull'}}
for c in clips.values():c['durationMs']=c['count']*160
meta={'identity':M['identity'],'motionIdentity':'mallard-duck-draft-v1-motion-02','reviewStatus':'draft, pending visual gate and human review','image':'sheet.png','frameWidth':W,'frameHeight':W,'anchor':G['anchor'],'rootMotion':False,'frameDurationMs':160,'fps':6.25,'cameraContract':G['cameraContract'],'orthoScale':G['orthoScale'],'shiftY':G['shiftY'],'clips':clips,'facings':{}}
sheet=Image.new('RGBA',(W*31,W*4))
for row,f in enumerate(F):
 meta['facings'][f]={'row':row,'frames':[]}
 for c,spec in clips.items():
  for i in range(spec['count']):
   im=frames[f,c,i];col=spec['start']+i;sheet.alpha_composite(im,(col*W,row*W));meta['facings'][f]['frames'].append({'clip':c,'index':i,'rect':[col*W,row*W,W,W],'visibleBounds':im.getbbox(),'guideRecord':next(n for n,r in enumerate(records) if (r['facing'],r['clip'],r['index'])==(f,c,i))})
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n');(O/'masters.json').write_bytes((S/'masters.json').read_bytes())
contact=Image.new('RGBA',(W*31,W*4+18),'#879b82');contact.alpha_composite(sheet,(0,18));ImageDraw.Draw(contact).text((3,3),'Mallard | idle | waddle8 | swim8 | flap8 | quack6 | down/up/left/right',fill='white');contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*4,contact.height*4),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in F:
 strip=Image.new('RGBA',(W*8,(W+12)*5),'#879b82');d=ImageDraw.Draw(strip)
 for row,c in enumerate(clips):
  d.text((2,row*(W+12)+1),f'{f} {c}: chronological',fill='white')
  for i in range(clips[c]['count']):strip.alpha_composite(frames[f,c,i],(i*W,row*(W+12)+12))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(ROOT/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(320,208),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(160,-93));bg.alpha_composite(crop([256,96,48,64]),(4,5));bg.alpha_composite(crop([0,1152,208,64]),(58,143));bg.save(O/'scene-background.png')
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scenery(c,i):
 im=bg.copy()
 for n,f in enumerate(F):
  im.alpha_composite(frames[f,c,i],(34+n*65,64));im.alpha_composite(person.crop((0,n*32,32,n*32+32)),(39+n*65,28))
 return im
scenery('idle',0).save(O/'scene-native.png');scenery('idle',0).resize((1280,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
sequence=[('idle',0)]*3+[(c,i) for c in ['waddle','swim','flap'] for _ in range(2) for i in range(8)]+[('action',i) for i in range(6)]+[('idle',0)]*3
native=[]
for c,i in sequence:
 im=Image.new('RGBA',(W*4,W),'#879b82')
 for n,f in enumerate(F):im.alpha_composite(frames[f,c,i],(n*W,0))
 native.append(im)
def gif(ims,name):
 ims=[im.convert('RGB') for im in ims];ims[0].save(O/name,save_all=True,append_images=ims[1:],duration=160,loop=0,disposal=2,optimize=False)
gif(native,'preview-native.gif');gif([im.resize((W*16,W*4),Image.Resampling.NEAREST) for im in native],'preview.gif');gif([scenery(c,i) for c,i in sequence],'scene-native.gif')
over=Image.new('RGBA',(W*4,W*2),'#879b82')
for row,f in enumerate(F):
 r=next(r for r in records if r['facing']==f and r['clip']=='idle');im=frames[f,'idle',0].copy();d=ImageDraw.Draw(im)
 for v in r['volumes'].values():ps=[xy(p) for p in v['hull']];d.line(ps+[ps[0]],fill='#f1bc78')
 over.alpha_composite(frames[f,'idle',0],(row*W,0));over.alpha_composite(im,(row*W,W))
over.resize((W*16,W*8),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
allowed=set(P.values())|{(0,0,0,0)};assert set(sheet.getdata())<=allowed;assert set(sheet.getchannel('A').getdata())=={0,255}
for k,im in frames.items():b=im.getbbox();assert b and b[0]>=2 and b[1]>=2 and b[2]<=W-2 and b[3]<=W-2,(k,b)
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes()
timing={}
for name in ['preview-native.gif','preview.gif','scene-native.gif']:
 im=Image.open(O/name);timing[name]=sum(fr.info['duration'] for fr in ImageSequence.Iterator(im));assert timing[name]==9600
report={'status':'integrity pass, visual gate separate','identity':M['identity'],'frames':124,'binaryAlpha':True,'padding':True,'palette':M['palette'],'gifDurationMs':timing,'idleVisibleHeights':{f:frames[f,'idle',0].getbbox()[3]-frames[f,'idle',0].getbbox()[1] for f in F},'stylization':M['stylization']}
(O/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print('MALLARD_FINISH_OK',report['idleVisibleHeights'])
