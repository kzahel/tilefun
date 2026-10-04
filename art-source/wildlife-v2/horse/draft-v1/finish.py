"""Integer Pillow composition of authored bay horse masters against actual guides."""
from pathlib import Path
import json,hashlib,math,shutil
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[4];S=Path(__file__).resolve().parent
O=ROOT/'public/demos/wildlife-v2/horse/draft-v1';O.mkdir(parents=True,exist_ok=True)
M=json.loads((S/'masters.json').read_text());G=json.loads((S/'projected-guides.json').read_text())
W,H=G['canvas'];FACINGS=list(G['facings']);P={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in M['palette'].items()}
def snap(x):return math.floor(x+.5)
def xy(p):return tuple(snap(v) for v in p[:2])
def pattern(group,f):
 e=M[group][f];rs=e['pixels'] if 'pixels' in e else [r[::-1] for r in M[group][e['mirror']]['pixels']]
 im=Image.new('RGBA',(len(rs[0]),len(rs)));assert all(len(r)==im.width for r in rs)
 for y,row in enumerate(rs):
  for x,ch in enumerate(row):
   if ch!='.':im.putpixel((x,y),P[ch])
 return im,e['offset']
def paste(im,group,f,anchor):
 p,o=pattern(group,f);a=xy(anchor);im.alpha_composite(p,(a[0]+o[0],a[1]+o[1]))
def leg(im,c,near,facing):
 d=ImageDraw.Draw(im);a,b,k,fl,foot=[xy(c['screen'][n]) for n in ['hip','knee','ankle','fetlock','foot']]
 d.line([a,b],fill=P['B' if near else 'R'],width=3)
 d.line([b,k],fill=P['B' if near else 'S'],width=2)
 d.line([k,fl,foot],fill=P['N' if near else 'F'],width=2)
 paste(im,'hooves','rear' if facing=='up' else ('near' if near else 'far'),c['screen']['foot'])
def tail(im,r):
 d=ImageDraw.Draw(im);ps=[xy(p) for p in r['tail']]
 d.line(ps,fill=P['K'],width=3);d.line(ps,fill=P['N'],width=2)
 for p in ps[1:-1]:d.point((p[0]+1,p[1]),fill=P['F'])
 d.point(ps[-1],fill=P['N'])
def compose(r):
 im=Image.new('RGBA',(W,H));ordered=sorted(r['contacts'].items(),key=lambda p:p[1]['screen']['hip'][2],reverse=True)
 # Rigid compound rounding keeps the skull attached to the same torso pixel
 # phase. Independent landmark rounding had a one-pixel profile head tick.
 idle=next(q for q in G['records'] if q['facing']==r['facing'] and q['clip']=='idle')
 rb,ib,ih=xy(r['body']),xy(idle['body']),xy(idle['head'])
 head_anchor=[rb[0]+ih[0]-ib[0],rb[1]+ih[1]-ib[1]]
 for i,(n,c) in enumerate(ordered):leg(im,c,i>=2,r['facing'])
 if r['facing']!='up':tail(im,r)
 if r['facing']=='up':paste(im,'heads',r['facing'],head_anchor)
 paste(im,'bodies',r['facing'],r['body'])
 if r['facing']=='up':tail(im,r)
 if r['facing']!='up':paste(im,'heads',r['facing'],head_anchor)
 return im
records=G['records'];frames={(r['facing'],r['clip'],r['index']):compose(r) for r in records}
CLIPS=[('idle',0,1),('walk',1,16),('action',17,8)];COLS=25
sheet=Image.new('RGBA',(W*COLS,H*4));meta=dict(identity=M['identity'],status='pending draft; no human approval',image='sheet.png',frameWidth=W,frameHeight=H,anchor=G['anchor'],fps=10,facings={},rootMotion=False,clips={clip:{'start':start,'count':count} for clip,start,count in CLIPS},camera={k:G[k] for k in ['elevationAboveGround','polarAngleFromVertical','cameraLocation','cameraEuler','orthoScale','shiftY','pixelsPerWorldUnit','facings']})
for row,f in enumerate(FACINGS):
 meta['facings'][f]={'row':row,'frames':[]}
 for clip,start,count in CLIPS:
  for i in range(count):
   im=frames[f,clip,i];sheet.alpha_composite(im,((start+i)*W,row*H));r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,clip,i))
   meta['facings'][f]['frames'].append(dict(clip=clip,index=i,rect=[(start+i)*W,row*H,W,H],visibleBounds=list(im.getbbox()),contacts={n:dict(planted=c['planted'],foot=c['screen']['foot'],ground=c['screen']['ground']) for n,c in r['contacts'].items()}))
sheet.save(O/'sheet.png');meta['sheetSha256']=hashlib.sha256((O/'sheet.png').read_bytes()).hexdigest();meta['motionIdentity']='horse-draft-v1-walk-tailswish-01'
(O/'sprite.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8');shutil.copyfile(S/'masters.json',O/'masters.json')
contact=Image.new('RGBA',(sheet.width,sheet.height+20),'#879b82');contact.alpha_composite(sheet,(0,20));ImageDraw.Draw(contact).text((2,2),'HORSE: idle / 16 walk / 8 tail swish',fill='white')
contact.save(O/'contact-sheet-native.png');contact.resize((contact.width*3,contact.height*3),Image.Resampling.NEAREST).save(O/'contact-sheet.png')
for f in FACINGS:
 strip=Image.new('RGBA',(W*16,(H+12)*3),'#879b82');d=ImageDraw.Draw(strip)
 for row,(clip,start,count) in enumerate(CLIPS):
  d.text((2,row*(H+12)),f+' '+clip,fill='white')
  for i in range(count):strip.alpha_composite(frames[f,clip,i],(i*W,row*(H+12)+12))
 strip.save(O/f'strip-{f}-native.png');strip.resize((strip.width*4,strip.height*4),Image.Resampling.NEAREST).save(O/f'strip-{f}.png')
atlas=Image.open(ROOT/'public/assets/tilesets/me-complete.png').convert('RGBA')
def crop(rect):
 x,y,w,h=rect;return atlas.crop((x,y,x+w,y+h))
bg=Image.new('RGBA',(320,208),'#769458');bg.alpha_composite(crop([1920,7312,160,160]),(160,-96));bg.alpha_composite(crop([0,1152,208,64]),(96,130));bg.alpha_composite(crop([256,96,48,64]),(8,4))
person=Image.open(ROOT/'public/demos/pixel-characters/person-32.png').convert('RGBA')
def scene_frame(clip,i):
 im=bg.copy()
 for n,f in enumerate(FACINGS):
  x=76+n*64;im.alpha_composite(frames[f,clip,i],(x-40,107-61));im.alpha_composite(person.crop((0,n*32,32,n*32+32)),(x-16,25))
 return im
bg.save(O/'scene-background.png');scene_frame('idle',0).save(O/'scene-native.png');scene_frame('idle',0).resize((1280,832),Image.Resampling.NEAREST).save(O/'scene-4x.png')
SEQUENCE=[('idle',0)]*4+[('walk',i) for _ in range(2) for i in range(16)]+[('action',i) for i in range(8)]+[('idle',0)]*4
def gif(images,p):
 ims=[im.convert('RGB') for im in images];ims[0].save(p,save_all=True,append_images=ims[1:],duration=100,loop=0,disposal=2,optimize=False)
native=[]
for clip,i in SEQUENCE:
 im=Image.new('RGBA',(W*4,H),'#879b82')
 for n,f in enumerate(FACINGS):im.alpha_composite(frames[f,clip,i],(n*W,0))
 native.append(im)
gif(native,O/'preview-native.gif');gif([im.resize((im.width*6,im.height*6),Image.Resampling.NEAREST) for im in native],O/'preview.gif')
gif([scene_frame(c,i) for c,i in SEQUENCE],O/'scene-native.gif');gif([scene_frame(c,i).resize((1280,832),Image.Resampling.NEAREST) for c,i in SEQUENCE],O/'scene-4x.gif')
travel=[]
for i in range(32):
 im=bg.copy();x=228-snap(i*(2.17/12)*10);im.alpha_composite(frames['left','walk',i%16],(x-40,107-61));travel.append(im)
gif(travel,O/'travel-native.gif')
guide=Image.new('RGBA',(W*16,H*4),'#23343b');comparison=Image.new('RGBA',(W*4,H*2),'#879b82')
for row,f in enumerate(FACINGS):
 for i in range(16):
  r=next(r for r in records if (r['facing'],r['clip'],r['index'])==(f,'walk',i));im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
  for n,v in r['volumes'].items():
   pts=[xy(p) for p in v['hull']];d.line(pts+[pts[0]],fill='#b5dba0' if any(t in n for t in ['skull','ear','muzzle']) else '#597d8a')
  for c in r['contacts'].values():
   d.line([xy(c['screen'][k]) for k in ['hip','knee','ankle','fetlock','foot']],fill='#f8c878');d.point(xy(c['screen']['ground']),fill='#ff5555' if c['planted'] else '#5588ff')
  guide.alpha_composite(im,(i*W,row*H))
 gi=Image.open(O/'guides'/f'{f}-idle-00.png').convert('RGBA');comparison.alpha_composite(gi.resize((W,H),Image.Resampling.NEAREST),(row*W,0));comparison.alpha_composite(frames[f,'idle',0],(row*W,H))
guide.resize((guide.width*4,guide.height*4),Image.Resampling.NEAREST).save(O/'projected-volume-contact-sheet.png');comparison.resize((comparison.width*6,comparison.height*6),Image.Resampling.NEAREST).save(O/'guide-art-comparison.png')
heights={};allowed=set(P.values())|{(0,0,0,0)}
for r in records:
 im=frames[r['facing'],r['clip'],r['index']];b=im.getbbox();assert b and b[0]>=2 and b[1]>=2 and b[2]<=W-2 and b[3]<=H-2,(r['facing'],r['clip'],r['index'],b)
 assert set(im.getchannel('A').get_flattened_data())<={0,255};assert set(im.get_flattened_data())<=allowed
 assert all(abs(a-b)<.001 for a,b in zip(r['anchor'][:2],G['anchor']))
 for n,c in r['contacts'].items():
  assert all(abs(a-b)<1e-6 for a,b in zip(c['lengths'],G['limbLengths'][n]))
  if c['planted']:assert abs(c['foot'][2]-.11)<1e-6
 if r['clip']=='idle':heights[r['facing']]=b[3]-b[1]
assert Image.open(O/'sheet.png').convert('RGBA').tobytes()==sheet.tobytes()
v=dict(status='integrity only, independent visual gate pending',identity=M['identity'],nativeCanvas=[W,H],visibleIdleHeights=heights,binaryAlpha=True,paletteColors=len(P),constantAnchor=G['anchor'],decodedSheetMatches=True,rootMotion=False,sequenceDurationMs=4800,action='eight-pose five-link hair-tail swish',sceneSources={'atlas':'public/assets/tilesets/me-complete.png','roof':[1920,7312,160,160],'tree':[256,96,48,64],'cars':[0,1152,208,64],'Explorer':'public/demos/pixel-characters/person-32.png'},stylization=M['stylization'])
(O/'validation.json').write_text(json.dumps(v,indent=2)+'\n',encoding='utf8');print(json.dumps(v))
